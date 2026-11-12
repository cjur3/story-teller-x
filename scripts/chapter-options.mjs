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
      `<option value="${f}" ${f === current.filter ? "selected" : ""}>${t(`StoryTellerX.Chapter.filters.${f || "none"}`)}</option>`
  ).join("");
  // pictures never show a title in the book
  const titleRow =
    page.type === "image"
      ? ""
      : `<div class="form-group">
      <label>${t("StoryTellerX.Chapter.showTitle")}</label>
      <div class="form-fields"><input type="checkbox" name="showTitle" ${current.showTitle ? "checked" : ""}></div>
      <p class="hint">${t("StoryTellerX.Chapter.showTitleHint")}</p>
    </div>`;
  const content = `${titleRow}
    <div class="form-group">
      <label>${t("StoryTellerX.Chapter.filter")}</label>
      <div class="form-fields"><select name="filter">${filters}</select></div>
      <p class="hint">${t("StoryTellerX.Chapter.filterHint")}</p>
    </div>`;

  return promptDialog({
    title: `${t("StoryTellerX.Chapter.title")}: ${page.name}`,
    icon: "fas fa-gear",
    width: 440,
    content,
    okLabel: t("StoryTellerX.BookOptionsSave"),
    okIcon: "fas fa-save",
    callback: (root) => ({
      showTitle: root.querySelector('input[name="showTitle"]')?.checked ?? current.showTitle,
      filter: root.querySelector('select[name="filter"]').value,
    }),
  });
}
