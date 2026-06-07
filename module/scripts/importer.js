import { MODULE_ID } from "../main.mjs";

export class StoryImporterDialog extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "storyteller-importer",
            title: game.i18n.localize("STORYTELLER.ImporterTitle") || "StoryTeller X E-book Importer",
            template: `modules/${MODULE_ID}/templates/importer.html`,
            classes: ["sheet"],
            width: 400,
            height: "auto",
        });
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".import-btn").click(this._onImport.bind(this));
    }

    async _onImport(event) {
        event.preventDefault();
        const fileInput = this.element.find('input[type="file"]')[0];
        if (!fileInput.files.length) {
            ui.notifications.error("Please select a file to import.");
            return;
        }

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
        const text = await file.text();
        const paragraphs = text.split(/\n\s*\n/); // Split by double newlines
        
        await this._createJournal(file.name.replace('.txt', ''), paragraphs);
    }

    async _importEpub(file) {
        if (typeof JSZip !== 'undefined') {
            try {
                const zip = await JSZip.loadAsync(file);
                let textContent = [];
                for (const [filename, zipEntry] of Object.entries(zip.files)) {
                    if (filename.endsWith('.html') || filename.endsWith('.xhtml')) {
                        let html = await zipEntry.async("text");
                        // Strip HTML tags
                        let stripped = html.replace(/<style[^>]*>.*<\/style>/gi, '')
                                           .replace(/<[^>]+>/g, ' ')
                                           .replace(/\s+/g, ' ');
                        textContent.push(stripped);
                    }
                }
                await this._createJournal(file.name.replace('.epub', ''), textContent);
            } catch (e) {
                console.error(e);
                ui.notifications.error("Failed to parse EPUB.");
            }
        } else {
            ui.notifications.warn("EPUB import requires JSZip library. For now, please convert your book to .txt format.");
        }
    }

    async _createJournal(name, chunks) {
        let journalData = {
            name: name,
            pages: []
        };
        
        let pages = [];
        let currentPageText = "";
        let pageCount = 1;
        
        for (let i = 0; i < chunks.length; i++) {
            let p = chunks[i].trim();
            if (!p) continue;
            
            currentPageText += `<p>${p}</p>`;
            
            if ((i > 0 && i % 10 === 0) || i === chunks.length - 1) {
                pages.push({
                    name: `Page ${pageCount}`,
                    type: "text",
                    text: {
                        content: currentPageText,
                        format: 1 // HTML
                    }
                });
                currentPageText = "";
                pageCount++;
            }
        }
        
        journalData.pages = pages;
        
        try {
            const entry = await JournalEntry.create(journalData);
            ui.notifications.info(`Successfully imported ${name} as a Journal Entry!`);
            entry.sheet.render(true);
            this.close();
        } catch(e) {
            console.error(e);
            ui.notifications.error("Failed to create Journal Entry.");
        }
    }
}
