import { MODULE_ID } from "../main.mjs";
import { PageFlip } from "../scripts/pageflip/page-flip.module.mjs";

const bookSizeCorrection = 1;
const bookWidth = 1390;
const bookHeight = 937;

export class StorySheet extends JournalSheet {
  pageFlipSoundURL = `modules/${MODULE_ID}/sounds/paper-flip.mp3`;
  static classes = ["sheet", "story-sheet"];

  constructor(...args) {
    super(...args);

    console.debug(
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
        label: "STORYTELLER2.CopyID",
        class: "switch-copyid",
        icon: "fas fa-crosshairs",
        onclick: (ev) => this._onCopyID(ev),
      });
    }

    return buttons;
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
    this.sound();
    await super._render(force, options);
    console.debug("Story Teller 2 | Rendering Story Sheet");

    let data = this.getData().data;
    let storyId = data._id;
    let startPage = data.pages.length >= 1 ? 2 : 1;

    let savedPage = getPage(data._id) ?? 0;
    if (savedPage > data.pages.length) {
      savedPage = data.pages.length - 1;
    }

    this.Pager = this.getPager(storyId, savedPage);

    if (this.Pager.pages == null) {
      this.Pager.loadFromHTML(this.element[0].querySelectorAll(".page-num"));
    } else {
      this.Pager.updateFromHtml(this.element[0].querySelectorAll(".page-num"));
    }

    var totalPages = this.Pager.pages.pages.length;
    this.stylePageTurnButtons(savedPage, totalPages);

    var journalEntries = this.element[0].querySelectorAll(
      ".page-num.num-start ol li.level1"
    );
    journalEntries.forEach((element) => {
      element.addEventListener("click", (event) => {
        var pageId = event.currentTarget?.dataset?.pageId;

        /* this is so that the LANDSCAPE pages open on the correct odd/even group
        within the array, ESPECIALLY if the page is at the end of the array */
        if (pageId % 2 == 0) {
          pageId = page--;
        }
        this.goToPage(pageId);
      });
    });

    this.Pager.on("flip", (e) => {
      // callback code
      var newPageNumber = e.data;
      var totalPages = this.Pager.pages.pages.length;

      this.stylePageTurnButtons(newPageNumber, totalPages);
      setPage(data._id, newPageNumber);
    });
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
      useMouseEvents: false,
      showPageCorners: false,
      maxShadowOpacity: 0.9, // Half shadow intensity
      showCover: true,
      clickEventClasses: [
        "storyteller2-page-entry-nav",
        "journal-entry-pages-nav",
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
    console.debug("Story Teller 2 | Updating Story Sheet");
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

  goToPage(pageId) {
    let targetPage = this.element[0].querySelector(
      `.story-sheet .page-num .journal-entry-page[data-page-id="${pageId}"]`
    );
    if (!this.Pager) {
      console.debug("Story Teller 2 | Pager does not exist yet, creating");
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

    // since the handlebars starts at ZERO, we need to add 1 to each
    let targetPageNum = Number(targetPage.dataset.entryIndex) + 1;
    console.debug(`going to page: ${targetPageNum}, Journal Entry id: ${pageId}`);

    this.Pager.flip(targetPageNum, "top"); //ToPage(targetPageNum);

    var totalPages = this.Pager.pages.pages.length;
    this.stylePageTurnButtons(targetPageNum, totalPages);
  }
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
