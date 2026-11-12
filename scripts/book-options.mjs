import { MODULE_ID } from "../main.mjs";
import { escapeHtml } from "./importer-chapters.mjs";
import { DEFAULT_COVER, DEFAULT_PAGE } from "./book-skins.mjs";

/**
 * Per-book options, stored as a flag on the JournalEntry so that every user
 * sees the same book layout. Add new options to BOOK_OPTION_DEFAULTS.
 */
const FLAG_KEY = "book";

const BOOK_OPTION_DEFAULTS = {
  // null = "not set on this book, use the world default setting"
  pageNumbers: null,
  // Split long text pages into book pages so that nothing needs scrolling.
  // Off unless a GM turns it on for the book.
  autoSplit: false,
  // Float small images left and right so text wraps around them (needs autoSplit).
  autoFloat: false,
  // Chapters (journal pages) start on a right-hand page; a blank page is added if needed.
  chaptersOnRight: false,
  // List the headings of each chapter below it in the table of contents.
  tocHeadings: false,
  // Hide the page numbers in the table of contents.
  hideTocNumbers: false,
  // Font of the book text; "" = the sheet's default font.
  fontFamily: "",
  // Cover and page color of the book (see book-skins.mjs).
  coverColor: DEFAULT_COVER,
  pageColor: DEFAULT_PAGE,
  // Text color; "" = the default of the page color (bright grey on black pages).
  fontColor: "",
};

/** World-level defaults for books that have no explicit value for an option. */
function worldDefault(key) {
  switch (key) {
    case "pageNumbers":
      return game.settings.get(MODULE_ID, "pageNumbersDefault");
    default:
      return BOOK_OPTION_DEFAULTS[key];
  }
}

/** Resolved options of a book (explicit value, else world default). */
export function getBookOptions(entry) {
  const stored = entry?.getFlag(MODULE_ID, FLAG_KEY) ?? {};
  const options = {};
  for (const key of Object.keys(BOOK_OPTION_DEFAULTS)) {
    options[key] = stored[key] ?? worldDefault(key);
  }
  return options;
}

export function getBookOption(entry, key) {
  return getBookOptions(entry)[key];
}

/** Persist one option. Re-renders open sheets through the document update. */
export async function setBookOption(entry, key, value) {
  if (!(key in BOOK_OPTION_DEFAULTS)) {
    throw new Error(`Story Teller X | Unknown book option "${key}"`);
  }
  return entry.setFlag(MODULE_ID, FLAG_KEY, { [key]: value });
}

/** Persist several options at once. Re-renders open sheets through the document update. */
export async function setBookOptions(entry, values) {
  const clean = {};
  for (const [key, value] of Object.entries(values)) {
    if (key in BOOK_OPTION_DEFAULTS) clean[key] = value;
  }
  return entry.setFlag(MODULE_ID, FLAG_KEY, clean);
}

export const BOOK_OPTION_KEYS = Object.keys(BOOK_OPTION_DEFAULTS);

/** Options that are on/off switches (the rest need their own form control). */
export const BOOK_TOGGLE_KEYS = BOOK_OPTION_KEYS.filter(
  (key) => typeof BOOK_OPTION_DEFAULTS[key] === "boolean" || BOOK_OPTION_DEFAULTS[key] === null
);

const SYSTEM_FONTS = ["Georgia", "Palatino Linotype", "Times New Roman", "Garamond", "Arial", "Verdana", "Courier New"];

/** Fonts a book can use: Foundry's own fonts plus common system fonts. */
export function fontChoices() {
  const foundry = Object.keys(CONFIG.fontDefinitions ?? {});
  return [...new Set([...foundry, ...SYSTEM_FONTS])].sort((a, b) => a.localeCompare(b));
}

/** <select> markup for the font option. */
export function fontSelectHtml(current = "", name = "fontFamily") {
  const options = [`<option value="">${game.i18n.localize("STORYTELLER.Option.fontDefault")}</option>`];
  for (const font of fontChoices()) {
    const safe = escapeHtml(font);
    options.push(`<option value="${safe}" style="font-family:'${safe}'" ${font === current ? "selected" : ""}>${safe}</option>`);
  }
  return `<select name="${name}">${options.join("")}</select>`;
}
