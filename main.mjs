import { SingleSheetClean } from "./sheets/single-sheet-clean.js";
import { SingleSheetMinimal } from "./sheets/single-sheet-minimal.js";

import { StorySheetV2 as StorySheet } from "./sheets/story-sheet-v2.js";
import { registerHotkeys } from "./scripts/config.js";
import { StoryImporterDialog } from "./scripts/importer.js";
import { MODULE_ID, getStoryThemeChoices } from "./scripts/constants.js";

export { MODULE_ID } from "./scripts/constants.js";

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

      foundry.applications.apps.DocumentSheetConfig.registerSheet(
        CONFIG.JournalEntry.documentClass,
        // Preserve the legacy scope so existing per-document sheet selections
        // continue to resolve after the Application V2 migration.
        "journals",
        types[className],
        {
          types: ["base"],
          makeDefault: false,
          label: game.i18n.localize(localizationKey),
          themes: className === "StorySheet" ? getStoryThemeChoices() : undefined,
        }
      );
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
    story.sheet.render({force: true});
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
  console.log("Story Teller 2 Journal | Ready");

  let pdfChoices = { "default": "Default" };
  for (let s of Object.values(CONFIG.JournalEntry.sheetClasses.base || {})) {
    if (s.cls !== StorySheet) {
      pdfChoices[s.id] = s.label;
    }
  }
  let setting = game.settings.settings.get(`${MODULE_ID}.pdfSheet`);
  if (setting) {
    setting.choices = pdfChoices;
  }

  const originalGetSheetClass = CONFIG.JournalEntry.documentClass.prototype._getSheetClass;
  CONFIG.JournalEntry.documentClass.prototype._getSheetClass = function() {
    let sheetClass = originalGetSheetClass.call(this);

    const hasPDF = this.pages.some(p => p.type === "pdf");
    if (hasPDF) {
      const customPdfSheet = game.settings.get(MODULE_ID, "pdfSheet");
      if (customPdfSheet && customPdfSheet !== "default") {
        const overrideSheet = CONFIG.JournalEntry.sheetClasses.base[customPdfSheet];
        if (overrideSheet) return overrideSheet.cls;
      }
    }

    return sheetClass;
  };
});

Hooks.once("init", () => {
  registerSettings();
  game.StoryTeller2 = new StoryTeller2();
  game.StoryTeller2.init();
  game.StoryTeller2.registerAddonSheet({
    key: "StorySheet",
    sheet: StorySheet,
    label: "StoryTeller2.StorySheet",
  });
  CONFIG.debug.hooks = true;
});

Hooks.on("renderJournalDirectory", (app, html, data) => {
  const button = html.querySelector("#stoy-teller-import-button");

  if (!button) {
    const importButtonIcon = document.createElement("i");
    importButtonIcon.classList.add("fas", "fa-book");
    const importButtonText = document.createElement("span");
    importButtonText.innerText = "Import text document or e-book"
    const importButton = document.createElement("button");
    importButton.classList.add("storyteller-importer-btn");

    importButton.appendChild(importButtonIcon);
    importButton.appendChild(importButtonText);

    importButton.addEventListener("click", ev => {
      new StoryImporterDialog().render(true);
    });

    html.querySelector(".directory-header .header-actions").appendChild(importButton);
  }
});

function applyStoryThemeChoices(root, selectedTheme) {
  const [sheetSelect, themeSelect] = root?.querySelectorAll("select") ?? [];
  if (!sheetSelect || !themeSelect) return;

  const selectedLabel = sheetSelect.selectedOptions[0]?.textContent;
  const isStorySheet = sheetSelect.value.includes("StorySheet")
    || selectedLabel === game.i18n.localize("StoryTeller2.StorySheet");
  if (!isStorySheet) return;

  const choices = getStoryThemeChoices();
  selectedTheme ??= themeSelect.value;
  const defaultLabel = themeSelect.querySelector('option[value=""]')?.textContent ?? "Default";
  const replacement = themeSelect.cloneNode(false);
  replacement.replaceChildren(
    new Option(defaultLabel, ""),
    ...Object.entries(choices).map(([value, label]) => new Option(label, value))
  );
  replacement.value = Object.hasOwn(choices, selectedTheme) ? selectedTheme : "";
  replacement.disabled = false;
  themeSelect.replaceWith(replacement);
}

Hooks.on("renderDocumentSheetConfig", (app, html) => {
  const root = html instanceof HTMLElement
    ? html
    : html?.[0] instanceof HTMLElement
      ? html[0]
      : app.element;
  if (!root) return;

  applyStoryThemeChoices(root);
  if (root.dataset.storyTellerThemeSelector === "true") return;
  root.dataset.storyTellerThemeSelector = "true";

  root.addEventListener("change", event => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    if (!["sheetClass", "theme"].includes(event.target.name)) return;

    // Foundry rebuilds the Theme field after every form change using the
    // choices from when the dialog opened. Capture the theme before that
    // happens, then restore both the choices and the selection.
    const selectedTheme = event.target.name === "theme" ? event.target.value : undefined;
    setTimeout(() => applyStoryThemeChoices(app.element, selectedTheme));
  }, true);
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

  game.settings.register(`${MODULE_ID}`, "pageTurnSound", {
    name: game.i18n.localize("StoryTeller2.Settings.PageTurnSound"),
    hint: game.i18n.localize("StoryTeller2.Settings.PageTurnSoundHint"),
    scope: "client",
    type: Boolean,
    default: true,
    config: true,
  });

  game.settings.register(`${MODULE_ID}`, "theme", {
    name: game.i18n.localize("StoryTeller2.Settings.DefaultTheme"),
    hint: game.i18n.localize("StoryTeller2.Settings.DefaultThemeHint"),
    scope: "world",
    config: true,
    type: String,
    choices: getStoryThemeChoices(),
    default: "book",
    onChange: () => window.location.reload(),
  });

  game.settings.register(`${MODULE_ID}`, "imageFilter", {
    name: game.i18n.localize("StoryTeller2.Settings.ImageFilter"),
    hint: game.i18n.localize("StoryTeller2.Settings.ImageFilterHint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      "none": "None",
      "sepia": "Sepia",
      "grayscale": "Grayscale",
      "invert": "Dark / Invert",
    },
    default: "none",
    onChange: () => window.location.reload()
  });

  game.settings.register(`${MODULE_ID}`, "hideTOCPageNumbers", {
    name: game.i18n.localize("StoryTeller2.Settings.HideTOCPageNumbers"),
    hint: game.i18n.localize("StoryTeller2.Settings.HideTOCPageNumbersHint"),
    scope: "client",
    type: Boolean,
    default: false,
    config: true,
  });

  game.settings.register(`${MODULE_ID}`, "pages", {
    scope: "client",
    type: Object,
    default: {},
    config: false,
  });

  game.settings.register(`${MODULE_ID}`, "pdfSheet", {
    name: game.i18n.localize("StoryTeller2.Settings.PdfSheet"),
    hint: game.i18n.localize("StoryTeller2.Settings.PdfSheetHint"),
    scope: "client",
    config: true,
    type: String,
    choices: {
      "default": "Default",
    },
    default: "default",
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
