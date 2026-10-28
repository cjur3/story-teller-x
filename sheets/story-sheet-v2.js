import { MODULE_ID, STORY_THEMES, STORY_THEME_IDS } from "../scripts/constants.js";
import { PageFlip } from "../scripts/pageflip/page-flip.module.mjs";

const JournalEntrySheetV2 = foundry.applications.sheets.journal.JournalEntrySheet;
const bookWidth = 1390;
const bookHeight = 937;

export class StorySheetV2 extends JournalEntrySheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["story-sheet", "storyteller2-loading"],
    window: {resizable: false},
    position: {width: bookWidth, height: bookHeight},
    actions: {copyStoryId: this.prototype._onCopyID},
  };

  pageFlipSoundURL = `modules/${MODULE_ID}/sounds/paper-flip.mp3`;
  computerOpenSoundURL = `modules/${MODULE_ID}/sounds/computer-open.mp3`;
  computerPageSoundURL = `modules/${MODULE_ID}/sounds/computer-page.mp3`;
  Pager = null;
  pageSaveTimer = null;

  get mode() { return this.constructor.VIEW_MODES.MULTIPLE; }

  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.position.width = getBookWidth();
    applicationOptions.position.height = getBookHeight();
    return applicationOptions;
  }

  getTheme() {
    return foundry.applications.apps.DocumentSheetConfig.getSheetThemeForDocument(this.document)
      || game.settings.get(MODULE_ID, "theme");
  }

  playSound(type) {
    const setting = type === "open" ? "bookOpenSound" : "pageTurnSound";
    if (!game.settings.get(MODULE_ID, setting)) return;
    const computerSounds = STORY_THEMES[this.getTheme()]?.computerSounds ?? false;
    const src = computerSounds
      ? (type === "open" ? this.computerOpenSoundURL : this.computerPageSoundURL)
      : this.pageFlipSoundURL;
    foundry.audio.AudioHelper.play({src, volume: 0.8, autoplay: true, loop: false}, false);
  }

  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if (this.isEditable) controls.unshift({
      icon: "fas fa-file-circle-plus", label: "JOURNAL.AddPage", action: "createPage"
    });
    if (game.user.isGM) controls.unshift({
      icon: "fas fa-crosshairs", label: "StoryTeller2.CopyID", action: "copyStoryId"
    });
    return controls;
  }

  async _onCopyID() {
    const page = getPage(this.document.id);
    await game.clipboard.copyPlainText(
      `game.StoryTeller2.showStoryByIDToAll("${this.document.id}", ${page})`
    );
    ui.notifications.info(game.i18n.localize("STORYTELLER2.CopyIDMessage"));
  }

  async _preRender(context, options) {
    if (this.Pager) {
      this.Pager.destroy();
      this.Pager = null;
    }
    await super._preRender(context, options);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const theme = this.getTheme();
    this.element.classList.remove(...STORY_THEME_IDS);
    if (theme && theme !== "book") this.element.classList.add(theme);
    const filter = game.settings.get(MODULE_ID, "imageFilter");
    if (filter) this.element.classList.add(`filter-${filter}`);
    this.element.classList.toggle("hide-toc-numbers", game.settings.get(MODULE_ID, "hideTOCPageNumbers"));
    this.element.querySelector('[data-application-part="sidebar"]')?.classList.add("storyteller-native-sidebar");
    this._buildStoryPages();
    if (options.isFirstRender) this.playSound("open");
    requestAnimationFrame(() => this.element.classList.remove("storyteller2-loading"));
  }

  _buildStoryPages() {
    const container = this.element.querySelector(".journal-entry-pages");
    if (!container) return;
    // Foundry may perform a partial V2 render while the PageFlip DOM is still
    // present. Collect page articles at any depth so rebuilding is idempotent.
    const articles = Array.from(
      container.querySelectorAll(".journal-entry-page:not(.pages-content)")
    );

    const story = document.createElement("div");
    story.id = `story-${this.document.id}`;
    story.className = "scrollable pages";
    story.append(this._createContentsPage());

    articles.forEach((article, index) => {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "back-to-toc icon fa-solid fa-book-open";
      back.title = game.i18n.localize("STORYTELLER.BackToTOC");
      article.querySelectorAll(":scope > .back-to-toc").forEach(button => button.remove());
      article.append(back);
      const wrapper = this._createPageWrapper(index + 1);
      wrapper.prepend(article);
      story.append(wrapper);
    });
    container.replaceChildren(story);

    const savedPage = Math.min(getPage(this.document.id), story.children.length - 1);
    const totalPages = story.querySelectorAll(".page-num").length;
    this.Pager = this.getPager(story, savedPage);
    this.Pager.loadFromHTML(story.querySelectorAll(".page-num"));
    this.stylePageTurnButtons(savedPage, totalPages);

    story.querySelectorAll(".back-to-toc").forEach(button => button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      this.Pager.turnToPage(0);
    }));
    story.querySelectorAll(".storyteller-toc-entry").forEach(entry => {
      const openPage = () => {
        const target = story.querySelector(`.journal-entry-page[data-page-id="${entry.dataset.pageId}"]`)
          ?.closest(".page-num");
        if (target) this.Pager.turnToPage(Array.from(story.querySelectorAll(".page-num")).indexOf(target));
      };
      entry.addEventListener("click", openPage);
      entry.addEventListener("keydown", event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openPage();
      });
    });
    this.Pager.on("flip", event => {
      this.stylePageTurnButtons(event.data, totalPages);
      this.queuePageSave(event.data);
      this.playSound("page");
    });
  }

  _createContentsPage() {
    const wrapper = this._createPageWrapper(0, "num-start");
    const article = document.createElement("article");
    article.className = "journal-entry-page pages-content";
    const content = document.createElement("div");
    content.className = "content-inner";
    const title = document.createElement("h1");
    title.textContent = this.document.name;
    content.append(title);
    const list = document.createElement("ol");
    list.className = "directory-list scrollable";
    for (const page of this.document.pages.contents) {
      const item = document.createElement("li");
      item.className = "directory-item storyteller-toc-entry";
      item.dataset.pageId = page.id;
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      const label = document.createElement("span");
      label.className = "page-title";
      label.textContent = page.name;
      item.append(label);
      list.append(item);
    }
    const nav = document.createElement("nav");
    nav.className = "pages-list";
    nav.append(list);
    content.append(nav);
    if (this.isEditable) {
      const create = document.createElement("button");
      create.type = "button";
      create.className = "create";
      create.dataset.action = "createPage";
      create.innerHTML = `<i class="fa-solid fa-file-circle-plus"></i> ${game.i18n.localize("JOURNAL.AddPage")}`;
      content.append(create);
    }
    article.append(content);
    wrapper.prepend(article);
    return wrapper;
  }

  _createPageWrapper(index, extraClass = "") {
    const wrapper = document.createElement("div");
    wrapper.className = `page-num ${index % 2 ? "odd" : "even"} ${extraClass}`.trim();
    for (const direction of ["left", "right"]) {
      const arrow = document.createElement("button");
      arrow.type = "button";
      arrow.className = `journal-page-arrow-${direction} storyteller2-page-entry-nav ${direction === "left" ? "prev" : "next"}`;
      const localizationKey = direction === "left" ? "STORYTELLER2.PreviousPage" : "STORYTELLER2.NextPage";
      const label = game.i18n.localize(localizationKey);
      arrow.title = label;
      arrow.setAttribute("aria-label", label);
      arrow.addEventListener("click", () => direction === "left" ? this.Pager.flipPrev() : this.Pager.flipNext());
      wrapper.append(arrow);
    }
    return wrapper;
  }

  getPager(element, savedPage) {
    const computerTheme = STORY_THEMES[this.getTheme()]?.computerSounds ?? false;
    return new PageFlip(element, {
      width: element.offsetWidth / 2,
      height: element.offsetHeight,
      size: "fixed",
      startPage: savedPage || 0,
      usePortrait: false,
      useMouseEvents: false,
      showPageCorners: false,
      maxShadowOpacity: computerTheme ? 0.1 : 0.9,
      drawShadow: !computerTheme,
      flippingTime: computerTheme ? 280 : 1000,
      showCover: true,
      clickEventClasses: ["editor-edit", "storyteller2-page-entry-nav", "back-to-toc"],
    });
  }

  stylePageTurnButtons(pageNumber, totalPages) {
    this.element.querySelectorAll(".journal-page-arrow-left.prev")
      .forEach(button => button.hidden = pageNumber <= 0);
    this.element.querySelectorAll(".journal-page-arrow-right.next")
      .forEach(button => button.hidden = pageNumber + 1 >= totalPages);
  }

  queuePageSave(page) {
    window.clearTimeout(this.pageSaveTimer);
    this.pageSaveTimer = window.setTimeout(() => {
      this.pageSaveTimer = null;
      void setPage(this.document.id, page);
    }, 150);
  }

  _onClose(options) {
    window.clearTimeout(this.pageSaveTimer);
    this.pageSaveTimer = null;
    if (this.Pager) {
      void setPage(this.document.id, this.Pager.pages?.currentPageIndex ?? 0);
      this.Pager.destroy();
      this.Pager = null;
    }
    super._onClose(options);
  }
}

function getBookDimensions() {
  const scale = game.settings.get(MODULE_ID, "size") / 100;
  const availableHeight = window.innerHeight * scale;
  const availableWidth = window.innerWidth * scale;
  const height = Math.min(availableHeight, availableWidth * (bookHeight / bookWidth));
  return {height, width: height * (bookWidth / bookHeight)};
}

function getBookWidth() { return getBookDimensions().width; }
function getBookHeight() { return getBookDimensions().height; }

async function setPage(id, page) {
  const pages = game.settings.get(MODULE_ID, "pages");
  pages[id] = page;
  await game.settings.set(MODULE_ID, "pages", pages);
}

function getPage(id) { return game.settings.get(MODULE_ID, "pages")[id] ?? 0; }
