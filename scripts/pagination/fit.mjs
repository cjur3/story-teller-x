/**
 * Gives images and other embeds a fixed size that fits on one page.
 *
 * An image that is taller than the page cannot be split, so the splitter could
 * only show it alone on a page, overflowing into the margin and the page number.
 * This runs before splitting: it scales every embed down (never up), keeping the
 * aspect ratio, so that it is never bigger than the content area.
 */

const IMG = "IMG";

/** Elements an image can sit in while the float belongs to the image's block. */
const FLOAT_WRAPPERS = new Set(["A", "FIGURE", "SPAN", "EM", "STRONG", "I", "B"]);

/** Floated images may take at most this much of the content box. */
const FLOAT_MAX_WIDTH = 0.5;
const FLOAT_MAX_HEIGHT = 0.6;
/** With autoFloat, images up to this share of the width are floated. */
const AUTO_FLOAT_WIDTH = 0.45;
const EMBED_SELECTOR = "img,video,iframe,svg,canvas,embed,object";

/** px value of a CSS length / HTML attribute, resolving % against `basis`. */
function toPx(value, basis) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "" || text === "auto") return null;
  const n = parseFloat(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  return text.endsWith("%") ? (n / 100) * basis : n;
}

/** The size the author asked for, completed with the natural aspect ratio. */
function requestedSize(el, natural, max) {
  let w = toPx(el.style.width, max.width) ?? toPx(el.getAttribute("width"), max.width);
  let h = toPx(el.style.height, max.height) ?? toPx(el.getAttribute("height"), max.height);

  let ratio = natural ? natural.height / natural.width : null;
  if (!ratio && el.tagName.toUpperCase() === "SVG") {
    const box = (el.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    if (box.length === 4 && box[2] > 0 && box[3] > 0) ratio = box[3] / box[2];
  }

  if (w && h) return { width: w, height: h };
  if (ratio) {
    if (w) return { width: w, height: w * ratio };
    if (h) return { width: h / ratio, height: h };
    if (natural) return { width: natural.width, height: natural.height };
  }
  return null;
}

function sideOf(el) {
  const css = el.style.float;
  if (css === "left" || css === "right") return css;
  const align = (el.getAttribute("align") ?? "").toLowerCase();
  if (align === "left" || align === "right") return align;
  if (el.classList.contains("float-left") || el.classList.contains("st-float-left")) return "left";
  if (el.classList.contains("float-right") || el.classList.contains("st-float-right")) return "right";
  return null;
}

/**
 * The float an embed already has, from itself or the link/figure around it.
 * @returns {{side:"left"|"right", holder:Element}|null}
 */
function findFloat(el) {
  for (let node = el; node && node.tagName !== "BODY"; node = node.parentElement) {
    if (node !== el && !FLOAT_WRAPPERS.has(node.tagName)) break;
    const side = sideOf(node);
    if (side) return { side, holder: node };
  }
  return null;
}

/** The element that carries the float for an embed: its figure if it has one. */
function floatHolder(el) {
  let holder = el;
  while (holder.parentElement && FLOAT_WRAPPERS.has(holder.parentElement.tagName)) {
    holder = holder.parentElement;
  }
  return holder;
}

/** Make the float explicit and give it room, so text wraps with a gap. */
function applyFloat(holder, side) {
  holder.classList.add("st-float", `st-float-${side}`);
  holder.style.setProperty("float", side);
  holder.removeAttribute("align");
  if (!holder.style.margin && !holder.style.marginLeft && !holder.style.marginRight) {
    holder.style.setProperty(
      "margin",
      side === "left" ? "0.25em 1em 0.5em 0" : "0.25em 0 0.5em 1em"
    );
  }
}

/**
 * @param {string} html
 * @param {{width:number,height:number,captionAllowance?:number}} max
 *        largest box an embed may fill (see measureContentArea -> imageMax)
 * @param {Map<string, {width:number,height:number}>} [sizes] natural sizes by src
 * @param {object} [options]
 * @param {boolean} [options.autoFloat] float small images (alternating left and
 *        right) so that text wraps around them
 * @returns {string} html with sizes written into the embeds
 */
export function fitMedia(html, max, sizes = new Map(), { autoFloat = false } = {}) {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  let nextAutoSide = "left";

  for (const el of body.querySelectorAll(EMBED_SELECTOR)) {
    // an svg nested in another svg is part of that drawing
    if (el.parentElement?.closest("svg")) continue;

    const natural = el.tagName.toUpperCase() === IMG ? sizes.get(el.getAttribute("src")) : null;
    const hasCaption = el.closest("figure")?.querySelector("figcaption") != null;
    let maxHeight = Math.max(1, max.height - (hasCaption ? (max.captionAllowance ?? 0) : 0));
    let maxWidth = Math.max(1, max.width);

    const size = requestedSize(el, natural, max);
    const style = el.style;

    let float = findFloat(el);
    if (
      !float &&
      autoFloat &&
      size &&
      size.width <= max.width * AUTO_FLOAT_WIDTH &&
      !el.closest("table")
    ) {
      float = { side: nextAutoSide, holder: floatHolder(el) };
      nextAutoSide = nextAutoSide === "left" ? "right" : "left";
    }
    if (float) {
      // a floated image must leave room for the text beside it
      maxWidth = Math.max(1, Math.floor(max.width * FLOAT_MAX_WIDTH));
      maxHeight = Math.max(1, Math.min(maxHeight, Math.floor(max.height * FLOAT_MAX_HEIGHT)));
      applyFloat(float.holder, float.side);
    }

    if (!size) {
      // size unknown (e.g. the image failed to load): at least cap it
      style.setProperty("max-width", "100%");
      style.setProperty("max-height", `${Math.floor(maxHeight)}px`);
      style.setProperty("object-fit", "contain");
      continue;
    }

    const scale = Math.min(1, maxWidth / size.width, maxHeight / size.height);
    const width = Math.max(1, Math.floor(size.width * scale));
    const height = Math.max(1, Math.floor(size.height * scale));

    el.setAttribute("width", String(width));
    el.setAttribute("height", String(height));
    style.setProperty("width", `${width}px`);
    // height follows the width through the aspect ratio, so an even narrower
    // container (a nested list, say) shrinks the image without distorting it
    style.setProperty("height", "auto");
    style.setProperty("aspect-ratio", `${width} / ${height}`);
    style.setProperty("max-width", "100%");
    style.setProperty("max-height", `${height}px`);
    style.setProperty("object-fit", "contain");
  }

  return body.innerHTML;
}
