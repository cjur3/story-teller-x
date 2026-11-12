import { MODULE_ID } from "../main.mjs";
import { escapeHtml, splitTextIntoChapters, stripGutenbergBoilerplate } from "./importer-chapters.mjs";
import { IMAGE_SCHEME, parseEpub } from "./epub.mjs";
import { ZipReader } from "./zip.mjs";
import { promptDialog, renderTpl } from "./compat.mjs";
import { fontSelectHtml } from "./book-options.mjs";
import { DEFAULT_COVER, DEFAULT_PAGE, defaultFontColor, skinSelectHtml } from "./book-skins.mjs";

export class StoryImporterDialog {

    async render() {
        const importer = await renderTpl(`modules/${MODULE_ID}/templates/importer.html`, {
            fontSelect: fontSelectHtml(),
            coverSelect: skinSelectHtml("cover", "coverColor", DEFAULT_COVER),
            pageSelect: skinSelectHtml("page", "pageColor", DEFAULT_PAGE),
            fontColor: defaultFontColor(DEFAULT_PAGE),
        });
        promptDialog({
            title: game.i18n.localize("StoryTellerX.ImporterTitle") || "StoryTeller X E-book Importer",
            icon: "fas fa-book",
            width: 500,
            resizable: true,
            content: importer,
            okLabel: "Import E-Book",
            okIcon: "fas fa-upload",
            callback: (root) => this._onImport(root),
            onRender: (element) => { this.element = element; this._wireForm(element); }
        });
    }

    /** Show the skin fields only for the Story Book, and prefill the font color from the page color. */
    _wireForm(root) {
        const sheetType = root.querySelector('select[name="sheetType"]');
        const page = root.querySelector('select[name="pageColor"]');
        const color = root.querySelector('input[name="fontColor"]');
        const useDefault = root.querySelector('input[name="fontColorDefault"]');
        const update = () => {
            const story = sheetType.value === 'story';
            root.querySelectorAll('.st-story-only').forEach(el => { el.style.display = story ? '' : 'none'; });
            // the page color decides the default text color of a Story Book
            if (useDefault.checked) color.value = defaultFontColor(story ? page.value : DEFAULT_PAGE);
        };
        sheetType.addEventListener('change', update);
        page.addEventListener('change', update);
        // picking a color is a choice: stop following the page color
        color.addEventListener('input', () => { useDefault.checked = false; });
        useDefault.addEventListener('change', update);
        update();
    }

    async _onImport(root) {
        if (root) this.element = root;
        const fileInput = this.element.querySelector('input[type="file"]');
        this.includeImages = this.element.querySelector('input[name="images"]')?.checked ?? true;

        if (!fileInput.files.length) {
            ui.notifications.error("Please select a file to import.");
            return;
        }

        this.fontFamily = this.element.querySelector('select[name="fontFamily"]')?.value ?? '';
        const field = (name) => this.element.querySelector(`[name="${name}"]`);
        this.sheetType = field('sheetType')?.value ?? 'story';
        this.coverColor = field('coverColor')?.value ?? DEFAULT_COVER;
        this.pageColor = field('pageColor')?.value ?? DEFAULT_PAGE;
        // "" = the default of the page color (bright grey on black pages)
        this.fontColor = field('fontColorDefault')?.checked ? '' : (field('fontColor')?.value ?? '');

        const file = fileInput.files[0];
        const fileName = file.name;

        if (fileName.endsWith('.txt')) {
            await this._importTxt(file);
        } else if (fileName.endsWith('.epub')) {
            await this._importEpub(file);
        } else {
            ui.notifications.error("Unsupported file format. Please upload .txt or .epub");
        }
    }

    async _importTxt(file) {
        const name = file.name.replace(/\.txt$/i, '');
        const text = stripGutenbergBoilerplate(await file.text());
        const chapters = splitTextIntoChapters(text, name).map(chapter => ({
            name: chapter.name,
            html: chapter.paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')
        }));
        await this._createJournal(name, chapters);
    }

    async _importEpub(file) {
        try {
            ui.notifications.info("Reading the EPUB...");
            const zip = await ZipReader.fromFile(file);
            const book = await parseEpub(zip, { includeImages: this.includeImages });
            const name = book.title || file.name.replace(/\.epub$/i, '');

            const urls = await this._storeImages(zip, book.images, name);
            const chapters = book.chapters.map(chapter => ({
                name: chapter.name,
                html: this._useImageUrls(chapter.html, urls)
            }));

            // a title page in front, so the book opens like a book
            const byline = book.author ? `<p><em>${escapeHtml(book.author)}</em></p>` : '';
            chapters.unshift({ name, html: `<h1>${escapeHtml(name)}</h1>${byline}` });

            await this._createJournal(name, chapters);
        } catch (e) {
            console.error(e);
            ui.notifications.error(`Failed to import the EPUB: ${e.message}`);
        }
    }

    /**
     * Store the images of the book in the world folder.
     * @returns {Promise<Map<string, string>>} zip path -> url; images that could not be stored are missing
     */
    async _storeImages(zip, paths, bookName) {
        const urls = new Map();
        if (!paths.length) return urls;

        const FilePicker = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
        const folder = `worlds/${game.world.id}/${MODULE_ID}`;
        const target = `${folder}/${bookName.replace(/[^\w-]+/g, '_').slice(0, 60) || 'book'}`;
        for (const dir of [folder, target]) {
            try {
                await FilePicker.createDirectory('data', dir);
            } catch (e) {
                // the folder exists already
            }
        }

        const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif' };
        let done = 0;
        let failed = 0;
        for (const path of paths) {
            const base = path.split('/').pop().replace(/[^\w.-]+/g, '_');
            const type = types[base.split('.').pop().toLowerCase()];
            if (!type) continue;
            try {
                const file = new File([await zip.bytes(path)], base, { type });
                const result = await FilePicker.upload('data', target, file, {}, { notify: false });
                if (result?.path) urls.set(path, result.path);
                else failed++;
            } catch (e) {
                failed++;
            }
            if (++done % 20 === 0) ui.notifications.info(`Storing illustrations: ${done} / ${paths.length}`);
        }
        if (failed) ui.notifications.warn(`${failed} illustrations could not be stored and were left out.`);
        return urls;
    }

    /** Replace the image placeholders of the parser by stored urls; drop images without one. */
    _useImageUrls(html, urls) {
        return html.replace(new RegExp(`<img src="${IMAGE_SCHEME}([^"]*)"([^>]*)>`, 'g'), (match, encoded, rest) => {
            const url = urls.get(decodeURIComponent(encoded));
            return url ? `<img src="${url}"${rest}>` : '';
        });
    }

    /**
     * One journal page per chapter. A Story Book is set up with automatic page
     * splitting, page numbers and the chosen cover, pages and text color.
     * @param {string} name
     * @param {{name:string, html:string}[]} chapters
     */
    async _createJournal(name, chapters) {
        const story = this.sheetType !== 'default';
        // The default journal sheet has no book options: put the text color into the pages
        const wrap = (html) => (!story && this.fontColor) ? `<div style="color: ${escapeHtml(this.fontColor)}">${html}</div>` : html;
        const flags = {};
        if (story) {
            flags.core = { sheetClass: "journals.StorySheet" };
            flags[MODULE_ID] = {
                book: {
                    autoSplit: true,
                    pageNumbers: true,
                    fontFamily: this.fontFamily ?? '',
                    coverColor: this.coverColor ?? DEFAULT_COVER,
                    pageColor: this.pageColor ?? DEFAULT_PAGE,
                    fontColor: this.fontColor ?? ''
                }
            };
        }
        const journalData = {
            name: name,
            pages: chapters.map(chapter => ({
                name: chapter.name,
                type: "text",
                text: { content: wrap(chapter.html), format: 1 } // HTML
            })),
            flags
        };

        try {
            const entry = await JournalEntry.create(journalData);
            ui.notifications.info(`Successfully imported ${name} as a Journal Entry!`);
            entry.sheet.render(true);
        } catch (e) {
            console.error(e);
            ui.notifications.error("Failed to create Journal Entry.");
        }
    }
}
