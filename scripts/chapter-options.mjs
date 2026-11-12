import { MODULE_ID } from "../main.mjs";
import { promptDialog } from "./compat.mjs";

/**
 * Per-chapter options (a chapter is a journal page). The title switch is Foundry's own
 * "show title" of the page; the rest is stored as a flag on the page.
 */
const FLAG_KEY = "chapter";

/**
 * Page filter: the texture of the page is laid over the whole chapter page with this
 * blend mode (css/book-skins.css), so the text takes on the grain of the paper.
 * "" = no filter.
 */
export const CHAPTER_FILTERS = ["", "darken", "multiply", "overlay", "soft-light", "hard-light", "color-burn", "luminosity"];

export function getChapterOptions(page) {
  const stored = page?.getFlag(MODULE_ID, FLAG_KEY) ?? {};
  return {
    showTitle: !!page?.title?.show,
    filter: CHAPTER_FILTERS.includes(stored.filter) ? stored.filter : "",
  };
}

export async function setChapterOptions(page, { showTitle, filter }) {
  return page.update({
    "title.show": !!showTitle,
    [`flags.${MODULE_ID}.${FLAG_KEY}.filter`]: CHAPTER_FILTERS.includes(filter) ? filter : "",
  });
}

/** Whether the current user may change the page (owner, and not in a locked compendium). */
export function canConfigureChapter(page) {
  if (!page?.isOwner) return false;
  const pack = page.parent?.pack;
  return !(pack && game.packs.get(pack)?.locked);
}

/** Dialog for one chapter. Resolves to the chosen values, or null when cancelled. */
export function openChapterOptionsDialog(page) {
  const t = (key) => game.i18n.localize(key);
  const current = getChapterOptions(page);
  const filters = CHAPTER_FILTERS.map(
    (f) =>
      `<option value="${f}" ${f === current.filter ? "selected" : ""}>${t(`STORYTELLER.Chapter.filters.${f || "none"}`)}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>${t("STORYTELLER.Chapter.showTitle")}</label>
      <div class="form-fields"><input type="checkbox" name="showTitle" ${current.showTitle ? "checked" : ""}></div>
      <p class="hint">${t("STORYTELLER.Chapter.showTitleHint")}</p>
    </div>
    <div class="form-group">
      <label>${t("STORYTELLER.Chapter.filter")}</label>
      <div class="form-fields"><select name="filter">${filters}</select></div>
      <p class="hint">${t("STORYTELLER.Chapter.filterHint")}</p>
    </div>`;

  return promptDialog({
    title: `${t("STORYTELLER.Chapter.title")}: ${page.name}`,
    icon: "fas fa-gear",
    width: 440,
    content,
    okLabel: t("STORYTELLER.BookOptionsSave"),
    okIcon: "fas fa-save",
    callback: (root) => ({
      showTitle: root.querySelector('input[name="showTitle"]').checked,
      filter: root.querySelector('select[name="filter"]').value,
    }),
  });
}
