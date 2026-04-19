import { SingleSheetClean } from "./sheets/single-sheet-clean.js";
import { SingleSheetMinimal } from "./sheets/single-sheet-minimal.js";

import { StorySheet } from "./sheets/story-sheet.js";
import { registerHotkeys } from "./scripts/config.js";

export const MODULE_ID = "story-teller-x";

class StoryTeller2 {
  static SHEET_TYPES = {
    default: "JournalSheet",
    story: "StorySheet",
  };

  static SHEET_LABELS = {
    story: "STORYTELLER.StoryEntry",
  };

  static getDocumentTypes() {
    return StoryTeller2.SHEET_TYPES;
  }

  static getTypeLabels() {
    return StoryTeller2.SHEET_LABELS;
  }

  init() {
    let types = StoryTeller2.getDocumentTypes();
    let labels = StoryTeller2.getTypeLabels();

    this._activateSocketListeners(game.socket);
    registerHotkeys();
  }

  _activateSocketListeners(socket) {
    socket.on("module.storyteller2", this._setPageToOpen.bind(this));
  }

  registerObjects(types, labels) {
    for (let [className, localizationKey] of Object.entries(labels)) {
      if (className === "default") continue;

      Journal.registerSheet("journals", types[className], {
        types: ["base"],
        makeDefault: false,
        label: game.i18n.localize(localizationKey),
      });
    }

    //game.system.documentTypes.JournalEntry = game.system.documentTypes.JournalEntry.concat(Object.keys(types)).sort();
    //game.system.documentTypes["JournalEntry"] = (Object.keys(types)).sort();
    //CONFIG.JournalEntry.typeLabels = mergeObject((CONFIG.JournalEntry.typeLabels || {}), labels)
  }

  showStoryByIDToAll(id = "", page = 0) {
    if (page !== 0) {
      game.socket.emit("module.storyteller2", {
        action: "setPageToOpen",
        id: id,
        page: page,
      });
      let pages = game.settings.get(`${MODULE_ID}`, "pages");
      pages[id] = page;
      game.settings.set(`${MODULE_ID}`, "pages", pages);
    }

    let story = game.journal.get(id);
    story.show("text");
  }

  showStoryToPlayerOnly(id = "", page = 0) {
    if (page !== 0) {
      let pages = game.settings.get(`${MODULE_ID}`, "pages");
      pages[id] = page;
      game.settings.set(`${MODULE_ID}`, "pages", pages);
    }

    let story = game.journal.get(id);
    story.sheet.render(true);
  }

  async _setPageToOpen(data) {
    if (data.action !== "setPageToOpen" || data.id === "") {
      return;
    }
    console.log(
      `Story Teller 2 | _setPageToOpen called with action[${data.action}] and id[${data.id}] and page[${data.action}]`
    );
    let pages = game.settings.get("StoryTeller2", "pages");
    pages[data.id] = data.page;
    await game.settings.set("StoryTeller2", "pages", pages);
  }

  /*
   *
   *   Register each sheet from the array.
   *
   *   @param key: "StorySheet",  -- Unique key, must not overlap with other keys. It is used to access the object.
   *   @param sheet: StorySheet, -- The class that implements the settings for the new journal. You don't need to create an instance, the class description itself is passed.
   *   @param label: "StoryTeller2.StorySheet", -- Key-identifier of the string for translation.
   */
  registerAddonSheet(s) {
    let types = {};
    let labels = {};

    types[s.key] = s.sheet;
    labels[s.key] = s.label;

    this.registerObjects(types, labels);
  }
}

Hooks.on("ready", () => {
  game.StoryTeller2.registerAddonSheet({
    key: "StorySheet",
    sheet: StorySheet,
    label: "StoryTeller2.StorySheet",
  });

  console.log("Story Teller 2 Journal | Ready");
});

Hooks.on("init", () => {
  registerSettings();
  game.StoryTeller2 = new StoryTeller2();
  game.StoryTeller2.init();
  CONFIG.debug.hooks = true;
});

Hooks.once("init", function () {
  //CONFIG.debug.hooks = true;
});

function registerSettings() {
  game.settings.register(`${MODULE_ID}`, "size", {
    name: game.i18n.localize("StoryTeller2.Settings.Size"),
    hint: game.i18n.localize("StoryTeller2.Settings.SizeHint"),
    scope: "client",
    requiresReload: true,
    type: Number,
    choices: {
      70: "70%",
      80: "80%",
      90: "90%",
      100: "100%",
    },
    default: 80,
    config: true,
  });

  game.settings.register(`${MODULE_ID}`, "bookOpenSound", {
    name: game.i18n.localize("StoryTeller2.Settings.BookOpenSound"),
    hint: game.i18n.localize("StoryTeller2.Settings.BookOpenSoundHint"),
    scope: "client",
    type: Boolean,
    default: true,
    config: true,
  });

  game.settings.register(`${MODULE_ID}`, "pages", {
    scope: "client",
    type: Object,
    default: {},
    config: false,
  });
}

Handlebars.registerHelper("offset", function (value) {
  return parseInt(value) + 1;
});

Handlebars.registerHelper("getIdByIndex", function (array, index) {
  return array[index].id;
});

Handlebars.registerHelper("getDontOpen", function () {
  let addClass = "";
  if (game.settings.get(`${MODULE_ID}`, "dontOpen")) {
    addClass = "dontopen";
  }
  return addClass;
});

export const SHEET_TYPES = Array.from(Object.values(StoryTeller2.SHEET_TYPES));
