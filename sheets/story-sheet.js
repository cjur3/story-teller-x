import { MODULE_ID } from "../main.mjs";
import { promptDialog } from "../scripts/compat.mjs";
import {
  BOOK_TOGGLE_KEYS,
  fontSelectHtml,
  getBookOption,
  getBookOptions,
  setBookOptions,
} from "../scripts/book-options.mjs";
import {
  fitMedia,
  measureContentArea,
  paginate,
  paginateToc,
  preloadImages,
} from "../scripts/pagination/index.mjs";
import {
  buildChapterLeaves,
  buildTocHeadings,
  collectChapterHeadings,
  fillTocPageNumbers,
  insertChapterFillers,
  findLeafIndex,
  getLeafBookmark,
  getLeafSourceHtml,
  numberLeaves,
} from "../scripts/pagination/leaves.mjs";
import { applySkin, defaultFontColor, skinSelectHtml } from "../scripts/book-skins.mjs";
import { setBookUnits } from "../scripts/book-units.mjs";
import {
  canConfigureChapter,
  getChapterOptions,
  openChapterOptionsDialog,
  setChapterOptions,
} from "../scripts/chapter-options.mjs";
import { PageFlip } from "../scripts/pageflip/page-flip.module.mjs";

const bookSizeCorrection = 1;
const bookWidth = 1390;
const bookHeight = 937;

export class StorySheet extends JournalSheet {
  pageFlipSoundURL = `modules/${MODULE_ID}/sounds/paper-flip.mp3`;
  static classes = ["sheet", "story-sheet", "storyteller2-loading"];

  constructor(...args) {
    super(...args);

    console.log(
      `Story Teller 2 | AppId: ${this.appId},  dataId: ${
        this.getData().data._id
      }`
    );
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      baseApplication: "JournalSheet",
      classes: this.classes,
      template: `modules/${MODULE_ID}/templates/story-sheet.html`,
      width: getBookWidth(),
      height: getBookHeight(),
      resizable: false,
      closeOnSubmit: false,
      submitOnClose: true,
    });
  }

  sound() {
    if (this._silentRender) {
      this._silentRender = false;
      return;
    }
    if (game.settings.get(`${MODULE_ID}`, "bookOpenSound")) {
      foundry.audio.AudioHelper.play(
        {
          src: this.pageFlipSoundURL,
          volume: 0.8,
          autoplay: true,
          loop: false,
        },
        false
      );
    }
  }

  /** @inheritdoc */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    if (game.user.isGM) {
      buttons.unshift({
        label: "StoryTeller2.CopyID",
        class: "switch-copyid",
        icon: "fas fa-crosshairs",
        onclick: (ev) => this._onCopyID(ev),
      });
    }

    if (game.user.isGM) {
      buttons.unshift({
        label: "STORYTELLER.BookOptions",
        class: "switch-book-options",
        icon: "fas fa-sliders",
        onclick: () => this.openBookOptions(),
      });
    }

    return buttons;
  }

  /** Dialog with the per-book layout options (GM only). */
  async openBookOptions() {
    const current = getBookOptions(this.object);
    const t = (key) => game.i18n.localize(key);
    const toggles = BOOK_TOGGLE_KEYS.map(
      (key) => `<div class="form-group">
        <label>${t(`STORYTELLER.Option.${key}`)}</label>
        <div class="form-fields"><input type="checkbox" name="${key}" ${current[key] ? "checked" : ""}></div>
        <p class="hint">${t(`STORYTELLER.Option.${key}Hint`)}</p>
      </div>`
    ).join("");
    const font = `<div class="form-group">
        <label>${t("STORYTELLER.Option.fontFamily")}</label>
        <div class="form-fields">${fontSelectHtml(current.fontFamily)}</div>
        <p class="hint">${t("STORYTELLER.Option.fontFamilyHint")}</p>
      </div>`;
    const group = (labelKey, control, hintKey) => `<div class="form-group">
        <label>${t(labelKey)}</label>
        <div class="form-fields">${control}</div>
        ${hintKey ? `<p class="hint">${t(hintKey)}</p>` : ""}
      </div>`;
    const skin =
      group("STORYTELLER.Option.coverColor", skinSelectHtml("cover", "coverColor", current.coverColor)) +
      group("STORYTELLER.Option.pageColor", skinSelectHtml("page", "pageColor", current.pageColor)) +
      group(
        "STORYTELLER.Option.fontColor",
        `<input type="color" name="fontColor" value="${current.fontColor || defaultFontColor(current.pageColor)}">
         <label class="checkbox"><input type="checkbox" name="fontColorDefault" ${current.fontColor ? "" : "checked"}> ${t("STORYTELLER.Option.fontColorDefault")}</label>`,
        "STORYTELLER.Option.fontColorHint"
      );
    const content = skin + toggles + font;

    const values = await promptDialog({
      title: t("STORYTELLER.BookOptionsTitle"),
      icon: "fas fa-sliders",
      width: 500,
      content,
      okLabel: t("STORYTELLER.BookOptionsSave"),
      okIcon: "fas fa-save",
      callback: (root) => {
        const form = root.querySelector("form");
        const data = new (foundry.applications?.ux?.FormDataExtended ?? FormDataExtended)(form).object;
        // unchecked boxes may be missing: treat them as off
        return {
          ...Object.fromEntries(BOOK_TOGGLE_KEYS.map((key) => [key, !!data[key]])),
          fontFamily: data.fontFamily ?? "",
          coverColor: data.coverColor,
          pageColor: data.pageColor,
          fontColor: data.fontColorDefault ? "" : data.fontColor ?? "",
        };
      },
    });
    if (values) await setBookOptions(this.object, values);
  }

  _onCopyID(event) {
    let savedPage = getPage(this.getData().data._id);

    const text =
      `game.StoryTeller2.showStoryByIDToAll("` +
      this.object.id +
      `", ` +
      savedPage +
      `)`;

    let aux = document.createElement("input");
    aux.setAttribute("value", text);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);

    ui.notifications.info(
      game.i18n.format("STORYTELLER2.CopyIDMessage", {
        mode: "text",
        title: "Info",
        which: "authorized",
      })
    );
  }

  /** @inheritdoc */
  async _render(force, options = {}) {
    const renderStart = Date.now();
    this.sound();
    await super._render(force, options);
    console.log("Story Teller 2 | Rendering Story Sheet");

    let filter = game.settings.get(MODULE_ID, "imageFilter");
    if (filter) this.element[0].classList.add(`filter-${filter}`);

    const pageNumbers = getBookOption(this.object, "pageNumbers");
    const autoSplit = getBookOption(this.object, "autoSplit");
    this.element[0].classList.toggle("st-page-numbers", pageNumbers);
    this.element[0].classList.toggle("st-auto-split", autoSplit);

    applySkin(this.element[0], getBookOptions(this.object));
    setBookUnits(this.element[0]);

    const fontFamily = getBookOption(this.object, "fontFamily");
    this.element[0].classList.toggle("st-custom-font", !!fontFamily);
    if (fontFamily) this.element[0].style.setProperty("--st-book-font", `"${fontFamily}"`);
    else this.element[0].style.removeProperty("--st-book-font");

    // TOC numbers refer to page numbers, so they only make sense when the book has them
    let hideTOCNumbers = getBookOption(this.object, "hideTocNumbers");
    this.element[0].classList.toggle(
      "hide-toc-numbers",
      hideTOCNumbers || !pageNumbers
    );

    let data = this.getData().data;
    let storyId = data._id;
    let startPage = data.pages.length >= 1 ? 2 : 1;

    let savedPage = getPage(data._id) ?? 0;

    if (autoSplit) {
      const completed = await this.splitIntoLeaves(pageNumbers);
      // A newer render replaced this one while splitting; it will finish the job.
      if (!completed) return;
    }

    this.addEditButtons();

    let allArticles = this.element[0].querySelectorAll('article.journal-entry-page:not(.num-start)');
    for (let article of allArticles) {
      if (!article.querySelector('.back-to-toc')) {
        let backBtn = document.createElement('a');
        backBtn.className = 'back-to-toc';
        backBtn.title = game.i18n.localize("STORYTELLER.BackToTOC");
        backBtn.innerHTML = '<i class="fas fa-book-open"></i>';
        article.appendChild(backBtn);
      }
    }

    this.addChapterButtons();
    this.applyChapterFilters();
    this.addBlankLeaves();

    // Splitting changes the number of leaves, so only now is the position known
    const leafCount = this.element[0].querySelectorAll(".pages > .page-num").length;
    if (autoSplit) {
      const bookmark = getBookmark(data._id);
      const index = bookmark
        ? findLeafIndex(
            this.element[0].querySelector(".pages"),
            bookmark.pageId,
            bookmark.leaf
          )
        : -1;
      if (index >= 0) savedPage = index;
    }
    savedPage = Math.max(0, Math.min(savedPage, leafCount - 1));

    this.Pager = this.getPager(storyId, savedPage);

    if (this.Pager.pages == null) {
      this.Pager.loadFromHTML(this.element[0].querySelectorAll(".page-num"));
    } else {
      this.Pager.updateFromHtml(this.element[0].querySelectorAll(".page-num"));
    }

    var totalPages = this.Pager.pages.pages.length;
    this.stylePageTurnButtons(savedPage, totalPages);

    var backToTocBtns = this.element[0].querySelectorAll(".back-to-toc");
    backToTocBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.Pager.turnToPage(0);
      });
    });

    var journalEntries = this.element[0].querySelectorAll(
      ".page-num.num-start ol li.level1"
    );
    journalEntries.forEach((element) => {
      element.addEventListener("click", (event) => {
        var pageId = event.currentTarget?.dataset?.pageId;

        /* this is so that the LANDSCAPE pages open on the correct odd/even group
        within the array, ESPECIALLY if the page is at the end of the array */
        if (pageId % 2 == 0) {
          pageId--;
        }
        this.goToPage(pageId);
      });
    });

    // no scrollbars and no clipping while a page is turning (see css/book-skins.css)
    this.Pager.on("changeState", (e) => {
      this.element[0].classList.toggle("st-flipping", e.data !== "read");
    });

    this.Pager.on("flip", (e) => {
      // callback code
      var newPageNumber = e.data;
      var totalPages = this.Pager.pages.pages.length;

      this.stylePageTurnButtons(newPageNumber, totalPages);
      setPage(data._id, newPageNumber);
      this.saveBookmark(data._id, newPageNumber);

      if (game.settings.get(`${MODULE_ID}`, "pageTurnSound")) {
        foundry.audio.AudioHelper.play(
          {
            src: this.pageFlipSoundURL,
            volume: 0.8,
            autoplay: true,
            loop: false,
          },
          false
        );
      }
    });

    this.setLoadProgress(1);

    // Failsafe: Ensure loading mask is removed after initial render
    const elapsed = Date.now() - renderStart;
    const remaining = Math.max(150, 2000 - elapsed);
    setTimeout(() => {
        this.element[0].classList.remove("storyteller2-loading");
    }, remaining);
  }

  /** Move the progress bar of the loading screen (0..1). */
  setLoadProgress(fraction) {
    const root = this.element?.[0];
    if (!root) return;
    const percent = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
    const bar = root.querySelector(".st-progress-bar");
    if (bar) bar.style.width = `${percent}%`;
    const text = root.querySelector(".st-progress-text");
    if (text) text.textContent = `${percent}%`;
    root.querySelector(".st-progress")?.setAttribute("aria-valuenow", String(percent));
  }

  /**
   * Split every text page (chapter) into as many book pages as it needs.
   * @returns {Promise<boolean>} false if a newer render took over
   */
  async splitIntoLeaves(pageNumbers) {
    const { autoFloat, chaptersOnRight, tocHeadings } = getBookOptions(this.object);

    this._splitAbort?.abort();
    const abort = (this._splitAbort = new AbortController());

    const root = this.element[0];
    const pagesEl = root.querySelector(".pages");
    const host = root.querySelector(".journal-entry-pages");
    this.setLoadProgress(0.02);
    const leafSize = { width: host.offsetWidth / 2, height: host.offsetHeight };

    let area;
    try {
      area = await measureContentArea({
        host,
        leafSize,
        pageNumbers,
        leafClasses: ["page-num"],
        articleClasses: ["journal-entry-page", "text"],
        contentTag: "section",
        contentClasses: ["journal-page-content"],
      });

      if (area.height < 50 || area.width < 50) {
        console.warn("Story Teller X | page area too small to split", area);
        return true;
      }

      // The chapters are the bulk of the work: share the progress bar between them by text size
      const jobs = [...pagesEl.querySelectorAll(":scope > .page-num:not(.num-start)")]
        .filter((leaf) => leaf.querySelector(":scope > article.journal-entry-page.text"))
        .map((leaf) => ({ leaf, html: getLeafSourceHtml(leaf) }))
        .filter((job) => job.html !== null);
      const totalSize = jobs.reduce((sum, job) => sum + Math.max(1, job.html.length), 0);
      const CHAPTERS = { from: 0.05, to: 0.92 };
      let doneSize = 0;
      for (const { leaf, html } of jobs) {
        const size = Math.max(1, html.length);
        const report = (fraction) =>
          this.setLoadProgress(CHAPTERS.from + ((doneSize + fraction * size) / totalSize) * (CHAPTERS.to - CHAPTERS.from));
        // sizes first: an image taller than a page would overflow into the margin
        const sizes = await preloadImages(html, abort.signal);
        report(0.05);
        const fitted = fitMedia(html, area.imageMax, sizes, { autoFloat });
        const pages = await paginate(fitted, area, {
          signal: abort.signal,
          onProgress: (fraction) => report(0.05 + fraction * 0.95),
        });
        if (pages.length > 0) buildChapterLeaves(leaf, pages);
        doneSize += size;
        report(0);
      }
    } catch (error) {
      if (error?.name === "AbortError") return false;
      throw error;
    } finally {
      area?.dispose();
      if (this._splitAbort === abort) this._splitAbort = null;
    }

    this.setLoadProgress(0.94);
    // The table of contents may need several pages; headings go in first so they count.
    const tocLeaf = pagesEl.querySelector(":scope > .page-num.num-start");
    if (tocHeadings) buildTocHeadings(tocLeaf, collectChapterHeadings(pagesEl));
    const tocLeaves = paginateToc(tocLeaf, host, leafSize, (info) =>
      console.log("Story Teller X | table of contents, first page measured", JSON.stringify(info))
    );
    // numbers shown in the console help to find out why a table of contents page holds few entries
    console.log("Story Teller X | table of contents", {
      pageSize: leafSize,
      entriesPerPage: tocLeaves.map((leaf) => leaf.querySelectorAll("nav.pages-list > ol > li").length),
    });
    if (chaptersOnRight) insertChapterFillers(pagesEl);

    // page numbers start with the first chapter, not with the table of contents
    const numbering = numberLeaves(pagesEl);
    fillTocPageNumbers(pagesEl, numbering);
    this.activateTocHeadings();
    return true;
  }

  /**
   * Put a feather icon next to each chapter's title that opens the page editor
   * (the same icon Foundry uses for editing). Pages without a visible title get
   * a small icon in the top corner instead. Continuation leaves get none.
   */
  addEditButtons() {
    const root = this.element[0];
    root.querySelectorAll(".st-edit-page").forEach((el) => el.remove());

    const label = game.i18n.localize("JOURNAL.EditPage") || "Edit";
    for (const article of root.querySelectorAll(".pages article.journal-entry-page[data-page-id]")) {
      const leaf = article.closest(".page-num");
      if (Number(leaf?.dataset.leafInChapter ?? 0) > 0) continue;

      const page = this.object.pages.get(article.dataset.pageId);
      if (!page?.isOwner) continue;
      if (page.parent?.pack && game.packs.get(page.parent.pack)?.locked) continue;

      const button = document.createElement("a");
      button.className = "st-edit-page";
      button.title = label;
      button.innerHTML = '<i class="fa-solid fa-feather-pointed"></i>';

      const title = article.querySelector(".journal-page-header :is(h1,h2,h3,h4,h5,h6)");
      if (title) title.appendChild(button);
      else {
        button.classList.add("st-edit-page-corner");
        article.appendChild(button);
      }
    }

    // One delegated handler on the (per render fresh) sheet container, so it
    // works for every page no matter how the pages were rebuilt.
    const container = root.querySelector(".journal-sheet-container");
    if (container && !container.dataset.stEditBound) {
      container.dataset.stEditBound = "1";
      container.addEventListener("click", (event) => {
        const button = event.target.closest(".st-edit-page");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const pageId = button.closest("[data-page-id]")?.dataset.pageId;
        this.object.pages.get(pageId)?.sheet.render(true);
      });
    }
  }

  /**
   * A gear below the "back to contents" icon of every book page of a chapter the user
   * can edit. The gears in the table of contents come from the template.
   */
  addChapterButtons() {
    const root = this.element[0];
    const label = game.i18n.localize("STORYTELLER.Chapter.button");
    for (const article of root.querySelectorAll(".pages article.journal-entry-page[data-page-id]")) {
      if (article.querySelector(":scope > .st-chapter-config")) continue;
      if (!canConfigureChapter(this.object.pages.get(article.dataset.pageId))) continue;
      const button = document.createElement("a");
      button.className = "st-chapter-config st-chapter-config-page";
      button.title = label;
      button.innerHTML = '<i class="fa-solid fa-gear"></i>';
      article.appendChild(button);
    }

    // One handler in the capture phase: it must win against the click on a table of contents
    // entry (which turns the page) and works for entries the pagination has copied.
    const container = root.querySelector(".journal-sheet-container");
    if (container && !container.dataset.stChapterBound) {
      container.dataset.stChapterBound = "1";
      container.addEventListener(
        "click",
        (event) => {
          const button = event.target.closest(".st-chapter-config");
          if (!button) return;
          event.preventDefault();
          event.stopPropagation();
          this.openChapterOptions(button.closest("[data-page-id]")?.dataset.pageId);
        },
        true
      );
    }
  }

  async openChapterOptions(pageId) {
    const page = this.object.pages.get(pageId);
    if (!canConfigureChapter(page)) return;
    const values = await openChapterOptionsDialog(page);
    if (!values) return;
    this._silentRender = true; // a setting changed, no page turn sound
    await setChapterOptions(page, values);
  }

  /**
   * A blank left page in front of the table of contents, so the book opens like a real
   * one (blank page | contents) and the contents are an ordinary page. A blank page at
   * the end keeps the last spread complete. Left pages are the odd children, see
   * css/book-skins.css.
   */
  addBlankLeaves() {
    const pagesEl = this.element[0].querySelector(".pages");
    pagesEl.querySelectorAll(":scope > .page-num.st-blank").forEach((el) => el.remove());
    const blank = () => {
      const leaf = document.createElement("div");
      leaf.className = "page-num st-blank";
      return leaf;
    };
    pagesEl.prepend(blank());
    if (pagesEl.querySelectorAll(":scope > .page-num").length % 2 === 1) pagesEl.append(blank());
  }

  /** Mark the book pages of chapters with a page filter (see css/book-skins.css). */
  applyChapterFilters() {
    for (const leaf of this.element[0].querySelectorAll(".pages > .page-num:not(.num-start)")) {
      const pageId = leaf.querySelector(":scope > article")?.dataset.pageId;
      const filter = pageId ? getChapterOptions(this.object.pages.get(pageId)).filter : "";
      if (filter) leaf.dataset.stFilter = filter;
      else delete leaf.dataset.stFilter;
    }
  }

  /** Clicking a heading in the table of contents turns to the page it is on. */
  activateTocHeadings() {
    const root = this.element[0];
    root.querySelectorAll(".st-toc-heading").forEach((entry) => {
      entry.addEventListener("click", (event) => {
        // the entry sits inside its chapter's list item, which has its own click handler
        event.stopPropagation();
        const heading = root.querySelector(`[data-st-heading="${entry.dataset.heading}"]`);
        this.goToLeaf(heading?.closest(".page-num"));
      });
    });
  }

  /** Remember chapter and leaf, which survives a changed layout better than an index. */
  saveBookmark(storyId, leafIndex) {
    const leaf = this.element[0].querySelectorAll(".pages > .page-num")[leafIndex];
    // on the TOC there is no chapter: clear the bookmark so it cannot pull the reader back
    setBookmark(storyId, getLeafBookmark(leaf));
  }

  getPager(storyId, savedPage) {
    var journalEntryPages = this.element[0].querySelector(
      ".journal-entry-pages"
    );
    var jepHeight = journalEntryPages.offsetHeight;
    var jepWidth = journalEntryPages.offsetWidth / 2;

    return new PageFlip(document.getElementById("story-" + storyId), {
      width: jepWidth,
      height: jepHeight,
      size: "fixed",
      startPage: savedPage ?? 0,
      usePortrait: false,
      useMouseEvents: false,
      showPageCorners: false,
      maxShadowOpacity: 0.9, // Half shadow intensity
      showCover: false, // the blank page in front of the contents takes the cover's place
      clickEventClasses: [
        "editor-edit",
        "st-edit-page",
        "storyteller2-page-entry-nav",
        "back-to-toc",
        "st-chapter-config"
      ],
    });
  }

  stylePageTurnButtons(pageNumber, totalPages) {
    let rightArrow = this.element[0].querySelectorAll(
      ".page-num .journal-page-arrow-right.next"
    );

    if (rightArrow != null) {
      if ((pageNumber == undefined || pageNumber === 0) && totalPages === 1) {
        rightArrow[0].style.display = "none";
        return;
      }
      if (pageNumber + 2 >= totalPages) {
        Array.from(rightArrow)
          .slice(-1)
          .forEach((element) => {
            element.style.display = "none";
          });
      }
    }
    return;
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if (formData.img === "") {
      formData.img = this.object.data.img;
    }
    console.log("Story Teller 2 | Updating Story Sheet");
    return super._updateObject(event, formData);
  }

  async _onShowPlayers(event) {
    //let id = this.getData().data._id;
    let currentPageNumber = ui.activeWindow?.Pager?.pages?.currentPageIndex;
    let id =
      ui.activeWindow.Pager?.pages?.getPage(currentPageNumber)?.element
        ?.firstElementChild?.dataset.pageId;
    // Save current page to global storage
    game.socket.emit("module.StoryTeller2", {
      action: "setPageToOpen",
      id: id,
      page: getPage(id),
    });

    let popup = await super._onShowPlayers(event);
    return popup;
  }

  /** Меняем анимацию скрытия книги */
  /** @inheritdoc */
  async close(options = {}) {
    let el = this.element;
    let pageNumberToSave = this.Pager.pages?.currentPageIndex ?? 0;
    setPage(this.getData().data._id, pageNumberToSave);
    this.saveBookmark(this.getData().data._id, pageNumberToSave);
    this._splitAbort?.abort();
    this.Pager.destroy();
    super.close(options);
    return new Promise((resolve) => {
      el.fadeOut(200, () => {
        el.remove();

        // Clean up data
        this._element = null;
        delete ui.windows[this.appId];
        this._minimized = false;
        this._scrollPositions = null;
        this._state = Application.RENDER_STATES.CLOSED;
        resolve();
      });
    });
  }

  /** Turn to a leaf element. */
  goToLeaf(leaf) {
    if (!leaf || !this.Pager) return;
    const index = [...this.element[0].querySelectorAll(".pages > .page-num")].indexOf(leaf);
    if (index < 0) return;
    this.Pager.turnToPage(index);
    this.stylePageTurnButtons(index, this.Pager.pages.pages.length);
  }

  goToPage(pageId) {
    let targetPage = this.element[0].querySelector(
      `.story-sheet .page-num .journal-entry-page[data-page-id="${pageId}"]`
    );
    if (!targetPage) return;
    
    let pageNumDiv = targetPage.closest('.page-num');
    let allPageNums = Array.from(this.element[0].querySelectorAll('.page-num'));
    let targetPageNum = allPageNums.indexOf(pageNumDiv);

    if (!this.Pager) {
      console.log("Story Teller 2 | Pager does not exist yet, creating");
      var storyId = this.getData().data._id;
      this.Pager = this.getPager(storyId, 0);

      if (this.Pager.pages == null) {
        this.Pager.loadFromHTML(this.element[0].querySelectorAll(".page-num"));
      } else {
        this.Pager.updateFromHtml(
          this.element[0].querySelectorAll(".page-num")
        );
      }
    }

    console.log(`going to page: ${targetPageNum}, Journal Entry id: ${pageId}`);

    this.Pager.turnToPage(targetPageNum);

    var totalPages = this.Pager.pages.pages.length;
    this.stylePageTurnButtons(targetPageNum, totalPages);

    setTimeout(() => {
        this.element[0].classList.remove("storyteller2-loading");
    }, 150);
  }
}

function getBookmark(id) {
  return game.settings.get(`${MODULE_ID}`, "bookmarks")[id] ?? null;
}

async function setBookmark(id, bookmark) {
  const bookmarks = game.settings.get(`${MODULE_ID}`, "bookmarks");
  if (bookmark) bookmarks[id] = bookmark;
  else delete bookmarks[id];
  await game.settings.set(`${MODULE_ID}`, "bookmarks", bookmarks);
}

function getBookWidth() {
  let height = getBookHeight();
  return (bookWidth / bookHeight) * height;
}

function getBookHeight() {
  let bookSize = game.settings.get(`${MODULE_ID}`, "size") / 100;
  return window.innerHeight * bookSize * bookSizeCorrection;
}

async function setPage(id, page) {
  let pages = game.settings.get(`${MODULE_ID}`, "pages");
  pages[id] = page;
  await game.settings.set(`${MODULE_ID}`, "pages", pages);
}

function getPage(id) {
  let pages = game.settings.get(`${MODULE_ID}`, "pages");
  if (pages[id] === undefined) {
    return 0;
  }

  return pages[id];
}
