/**
 * Book skins: a cover color plus a page color. Images live in img/book/
 * (cover-<c>, pages-<p>, page-left-<p>, page-right-<p>); css/book-skins.css
 * maps the same names to CSS variables.
 */
export const COVER_COLORS = ["brown", "brown-seam", "black", "bloodred", "khaki"];
export const PAGE_COLORS = ["beige", "white", "black"];

export const DEFAULT_COVER = "brown";
export const DEFAULT_PAGE = "beige";

/** Default text color per page color (must match css/book-skins.css). */
export const PAGE_FONT_COLORS = {
  beige: "#48392e",
  white: "#48392e",
  black: "#d4d4d4", // bright grey
};

export function defaultFontColor(pageColor) {
  return PAGE_FONT_COLORS[pageColor] ?? PAGE_FONT_COLORS[DEFAULT_PAGE];
}

const label = (group, value) => {
  const key = `StoryTellerX.Skin.${group}.${value}`;
  return game.i18n.has?.(key) ? game.i18n.localize(key) : value;
};

/** <select> markup for a skin color. */
export function skinSelectHtml(group, name, current) {
  const values = group === "cover" ? COVER_COLORS : PAGE_COLORS;
  const options = values.map(
    (v) => `<option value="${v}" ${v === current ? "selected" : ""}>${label(group, v)}</option>`
  );
  return `<select name="${name}">${options.join("")}</select>`;
}

/** Black or white, whichever stands out from the hex color `color` (for text shadows). */
export function contrastColor(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color ?? "")?.[1];
  if (!hex) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "#000000" : "#ffffff";
}

/** Apply the skin of a book to a sheet element. */
export function applySkin(element, { coverColor, pageColor, fontColor }) {
  for (const cls of [...element.classList]) {
    if (cls.startsWith("st-cover-") || cls.startsWith("st-page-color-")) element.classList.remove(cls);
  }
  element.classList.add(`st-cover-${COVER_COLORS.includes(coverColor) ? coverColor : DEFAULT_COVER}`);
  element.classList.add(`st-page-color-${PAGE_COLORS.includes(pageColor) ? pageColor : DEFAULT_PAGE}`);
  if (fontColor) element.style.setProperty("--st-book-color", fontColor);
  else element.style.removeProperty("--st-book-color");
  // text shadow color that stands out from the text (loader, ...)
  element.style.setProperty("--st-contrast", contrastColor(fontColor || defaultFontColor(pageColor)));
}
