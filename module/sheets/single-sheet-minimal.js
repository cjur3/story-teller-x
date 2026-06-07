import { PageFlip } from "../scripts/pageflip/page-flip.module.mjs";
import { MODULE_ID } from "../main.mjs";

const bookSizeCorrection = 1;
const bookWidth = 695;
const bookHeight = 937;

/* I recommend inheriting from the StorySheet class, but if you know what you're doing, you can use anything. */
export class SingleSheetMinimal extends JournalSheet {
  pageFlipSound = `modules/${MODULE_ID}/sounds/paper-flip.mp3`;

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      baseApplication: "JournalSheet",
      /* One of the most important lines, here you can add classes that will apply to the entire Journal window. */
      classes: [
        "sheet",
        "single-sheet",
        "minimal",
        "storyteller-addon-singlesheet",
      ],
      /* This file contains the html markup code, in case you need a more complex design style. For example, without page turning. */
      template: `modules/${MODULE_ID}/templates/single-sheet.html`,
      width: getBookWidth(),
      height: getBookHeight(),
      resizable: false,
      closeOnSubmit: false,
      submitOnClose: true,
    });
  }
  pageFlipElement = null;

  sound() {
    //if (game.settings.get('storyteller2', 'bookOpenSound')) {
    //   AudioHelper.play({src: this.pageFlip, volume: 0.8, autoplay: true, loop: false}, false);
    //}
  }

  /** @inheritdoc */
  async _render(force, options = {}) {
    this.sound();
    await super._render(force, options);
    var journalEntryPages = document.querySelector(".journal-entry-pages");
    var jepHeight = journalEntryPages.offsetHeight;
    var jepWidth = journalEntryPages.offsetWidth;

    let data = this.getData().data;
    let startPage = 1;
    let savedPage = getPage(data._id);
    this.pageFlipElement = new PageFlip(
      document.getElementById("story-" + data._id),
      {
        width: jepWidth, // getBookWidth(), // bookWidth,  // 550, // base page width
        height: jepHeight, //getBookHeight(), // bookHeight, //733, // base page height

        size: "fixed",
        startPage: 0,
        // set threshold values:
        //minWidth: 315,
        //maxWidth: 1000,
        usePortrait: true,
        drawShadow: true,
        flippingTime: 500,
        disableFlipByClick: true,
        showPageCorners: true,
        swipeDistance: 5,
        //clickEventForward: 0,
        useMouseEvents: true,

        maxShadowOpacity: 0.25, // Half shadow intensity
        //showCover: true,
        mobileScrollSupport: false, // disable content scrolling on mobile devices
        clickEventClasses: [
          "storyteller2-page-entry-nav",
          "journal-entry-pages-nav",
        ],
      }
    );

    this.pageFlipElement.loadFromHTML(document.querySelectorAll(".page-num"));
    if (options.pageId != undefined) {
      this.goToPage(options.pageId);
    }

    let rightArrow = document.querySelector(
      ".page-num.num-start .journal-page-arrow-right"
    );
    rightArrow.style.display = "block";

    this.pageFlipElement.on("flip", (e) => {
      // callback code
      var newPageNumber = e.data;

      // total pages in the Table of Contents(NOT the book array!!!)
      var totalPages = document.querySelectorAll(
        ".journal-entry-pages .pagelookup li"
      );
      let count = totalPages?.length;
      let ajustednewPageNumber =
        newPageNumber != 0 && !(newPageNumber > count)
          ? newPageNumber - 1
          : newPageNumber;

      var pageState = "toc";
      var pageClass = ajustednewPageNumber;
      if (newPageNumber === 0) {
        pageState = "toc";
        pageClass = "num-start";
      }
      if (newPageNumber === count) {
        pageState = "last";
      }
      if (newPageNumber > 0 && newPageNumber < count) {
        pageState = "middle";
      }

      this.stylePageTurnButtons(pageState, pageClass);
    });
  }

  stylePageTurnButtons(pageType, pageClass) {
    let leftArrow = document.querySelector(
      `.page-num.${CSS.escape(pageClass)} .journal-page-arrow-left`
    );
    let rightArrow = document.querySelector(
      `.page-num.${CSS.escape(pageClass)} .journal-page-arrow-right`
    );

    switch (pageType) {
      case "toc":
        leftArrow.style.display = "none";
        rightArrow.style.display = "block";
        break;
      case "middle":
        leftArrow.style.display = "block";
        rightArrow.style.display = "block";
        break;
      case "last":
        leftArrow.style.display = "block";
        rightArrow.style.display = "none";
        break;
    }
    return;
  }

  styleImage(storyId) {
    let images = document.querySelectorAll(
      storyId + " .page-num .journal-entry-page.image"
    );
    if (images.length > 0) {
      images.forEach((image) => {
        let pageClass = image.parentElement.className;
        let pageQuery = storyId + " ." + pageClass.replaceAll(" ", ".");
        $(pageQuery).css("overflow", "hidden");
        if (!game.settings.get("storyteller-addon-singlesheet", "background")) {
          $(pageQuery).css("background-image", "none");
          $(pageQuery + " .journal-entry-page").css(
            "-webkit-mask-image",
            "url(./modules/storyteller2/img/clean_mask.webp)"
          );
        }
      });
    }
  }

  /**
   * Update child views inside the main sheet.
   * @returns {Promise<void>}
   * @protected
   */

  async _renderPageViews() {
    for (const pageNode of this.element[0].querySelectorAll(
      ".journal-entry-page"
    )) {
      const id = pageNode.dataset.pageId;
      if (!id) continue;
      const edit = pageNode.querySelector(":scope > .edit-container");
      const sheet = this.getPageSheet(id);
      const data = await sheet.getData();
      const view = await sheet._renderInner(data);
      pageNode.replaceChildren(...view.get());
      if (edit) pageNode.appendChild(edit);
      sheet._activateCoreListeners(view.parent());
      sheet.activateListeners(view);
      await this._renderHeadings(pageNode, sheet.toc);
      for (const cls of sheet.constructor._getInheritanceChain()) {
        Hooks.callAll(`render${cls.name}`, sheet, view, data);
      }
    }

    this.styleImage(
      "#" + this.element[0].querySelectorAll(".scrollable.pages")[0].id
    );
  }

  /** @inheritdoc */
  async _updateObject(event, formData) {
    if (formData.img === "") {
      formData.img = this.object.data.img;
    }
    return super._updateObject(event, formData);
  }

  /** @inheritdoc */
  _getHeaderButtons() {
    const buttons = super._getHeaderButtons();

    if (game.user.isGM) {
      buttons.unshift({
        label: "STORYTELLER.CopyID",
        class: "switch-copyid",
        icon: "fas fa-crosshairs",
        onclick: (ev) => this._onCopyID(ev),
      });
    }

    return buttons;
  }

  async _onShowPlayers(event) {
    event.preventDefault();
    await this.submit();
    return this.object.show(this._sheetMode, true);
  }

  _onConfigureStory(event) {
    let story = $(event.target).closest(".window-app.story-sheet");

    let pageRightImage = story.find(".page-inner.image");
    let pageRightSettings = story.find(".page-inner.settings");
    pageRightImage.toggleClass("hidden");
    pageRightSettings.toggleClass("hidden");
  }

  _onCopyID(event) {
    const text =
      `game.StoryTeller.showStoryByIDToAll("` + this.object.id + `")`;
    let aux = document.createElement("input");
    aux.setAttribute("value", text);
    document.body.appendChild(aux);
    aux.select();
    document.execCommand("copy");
    document.body.removeChild(aux);

    ui.notifications.info(
      game.i18n.format("STORYTELLER.CopyIDMessage", {
        mode: "text",
        title: "Info",
        which: "authorized",
      })
    );
  }

  /** Меняем анимацию скрытия книги */
  /** @inheritdoc */
  async close(options = {}) {
    let el = this.element;
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
    let targetPage = document.querySelector(
      '.pagelookup li[data-page-id="' + pageId + '"]'
    );
    let targetPageNum = Number(targetPage.getAttribute("page"));
    let pageList = targetPage.closest(".journal-entry-pages").children[1];
    let journalId = pageList.getAttribute("id").split("-")[1];

    this.pageFlipElement.flip(targetPageNum);

    var totalPages = document.querySelectorAll(
      ".journal-entry-pages .pagelookup li"
    );
    let count = totalPages?.length;
    var pageState = targetPageNum < count ? "middle" : "last";
    var pageClass = targetPageNum - 1;
    this.stylePageTurnButtons(pageState, pageClass);
  }
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
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
  return pages[id];
}
