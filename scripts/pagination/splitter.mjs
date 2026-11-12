/**
 * HTML page splitter.
 *
 * Splits an HTML string into pages that each fit into a fixed height, so no
 * scrolling is needed. Based on the idea of @talers/html-pages (MIT), rewritten
 * to be readable and faster:
 *  - the page height is passed in explicitly,
 *  - a whole block is tried first, and only split when it does not fit,
 *  - the cut point inside a text node is found by binary search,
 *  - headings are kept together with the text that follows them,
 *  - elements that cannot fit a page on their own are placed anyway (alone on
 *    their page) so the splitter always makes progress.
 *
 * Contract for `container`: an element attached to the document, already sized
 * to the content width, with `display: flow-root` (so floats count towards its
 * height) and an automatic height. It is used as scratch space and is empty
 * again when the generator finishes.
 *
 * Classes added to the continued part of a split element:
 *  - `st-continued` on every element that continues from the previous page
 *    (e.g. `li` so the theme can hide a repeated bullet).
 */

export const ATOMIC_TAGS = new Set([
  "IMG", "VIDEO", "AUDIO", "IFRAME", "SVG", "CANVAS", "OBJECT", "EMBED",
  "HR", "BR", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "FIGURE", "TR",
  "H1", "H2", "H3", "H4", "H5", "H6",
]);

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const MEDIA_SELECTOR = "img,video,audio,iframe,svg,canvas,object,embed,hr";
/** Embeds that can be scaled down to the room that is left on a page. */
const SCALABLE_SELECTOR = "img,video,iframe,svg,canvas,embed,object";
/** A scaled-down embed is not worth showing below this height (px). */
const MIN_SCALED_HEIGHT = 48;

/** Characters after which a line may be broken (the break goes after them). */
const BREAK_AFTER = /[\s -​\-–—­]/;

const ELEMENT = 1;
const TEXT = 3;

/**
 * Indices at which `text` may be cut. Each index is the length of a prefix that
 * ends at a legal break. The full length is not included.
 */
export function getBreakpoints(text) {
  const points = [];
  for (let i = 0; i < text.length - 1; i++) {
    // cut after a space or hyphen, unless more spaces follow (keep runs together)
    if (BREAK_AFTER.test(text[i]) && !/\s/.test(text[i + 1])) points.push(i + 1);
  }
  return points;
}

/** Does the element hold anything a reader would see? */
export function hasContent(node) {
  if (!node) return false;
  if (node.nodeType === TEXT) return node.data.trim() !== "";
  if (node.nodeType !== ELEMENT) return false;
  if (ATOMIC_TAGS.has(node.tagName.toUpperCase()) && node.tagName !== "BR") return true;
  return node.textContent.trim() !== "" || node.querySelector(MEDIA_SELECTOR) !== null;
}

function isAtomic(node, extraAtomic) {
  if (node.nodeType !== ELEMENT) return false;
  if (ATOMIC_TAGS.has(node.tagName.toUpperCase())) return true;
  if (extraAtomic && node.matches(extraAtomic)) return true;
  return !node.firstChild;
}

const defaultMeasure = (container) => container.getBoundingClientRect().height;

/** Resolves on the next macrotask without the 4ms+ clamping of setTimeout. */
export function yieldToMainThread() {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(undefined);
  });
}

/**
 * Split `html` into pages.
 *
 * @param {string} html
 * @param {object} options
 * @param {HTMLElement} options.container   scratch container, see file header
 * @param {number} options.height           usable page height in px
 * @param {AbortSignal} [options.signal]
 * @param {string} [options.atomic]         extra CSS selector for unsplittable elements
 * @param {number} [options.tolerance=0.5]  px of rounding slack
 * @param {number} [options.maxPages=5000]  safety limit
 * @param {number} [options.yieldAfterMs=12] time slice before yielding to the UI
 * @param {(container: HTMLElement) => number} [options.measure]
 *        height of the container; override for tests
 * @yields {string} inner HTML of each page
 */
export async function* splitHtmlToPages(html, options) {
  const {
    container,
    height,
    signal,
    atomic,
    tolerance = 0.5,
    maxPages = 5000,
    yieldAfterMs = 12,
    measure = defaultMeasure,
  } = options;

  const doc = container.ownerDocument;
  const source = new DOMParser().parseFromString(html, "text/html").body;
  container.replaceChildren();

  const fits = () => measure(container) <= height + tolerance;
  const pageIsEmpty = () => !hasContent(container);

  let sliceStart = performance.now();
  const maybeYield = async () => {
    if (performance.now() - sliceStart < yieldAfterMs) return;
    await yieldToMainThread();
    sliceStart = performance.now();
  };

  /**
   * Move as much of `src`'s children as fits into `dst` (which is `container`
   * or a descendant of it). Whatever does not fit stays in `src`.
   * @returns {Promise<boolean>} true if `src` was emptied, false if the page is full
   */
  async function fill(src, dst) {
    while (src.firstChild) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await maybeYield();

      const node = src.firstChild;
      const emptyBefore = pageIsEmpty();

      dst.appendChild(node);
      if (fits()) continue;

      // Overflow: take the node back out and try to place only a part of it.
      dst.removeChild(node);
      src.insertBefore(node, src.firstChild);

      if (node.nodeType === TEXT) {
        if (placeTextPart(node, src, dst, emptyBefore)) continue;
        return false;
      }

      if (node.nodeType !== ELEMENT) {
        // comments etc. never take space: drop them
        src.removeChild(node);
        continue;
      }

      if (isAtomic(node, atomic)) {
        if (!emptyBefore) {
          // Title (and nothing else) on the page: the picture shrinks to the room that is
          // left instead of leaving the title alone on a page of its own.
          if (onlyHeadingsOnPage() && shrinkToFit(node, src, dst)) continue;
          return false;
        }
        // Nothing else on the page and still too big: show it alone.
        dst.appendChild(node);
        continue;
      }

      const clone = node.cloneNode(false);
      clone.removeAttribute("id");
      dst.appendChild(clone);
      const exhausted = await fill(node, clone);

      if (!hasContent(clone)) {
        dst.removeChild(clone);
        if (!emptyBefore) return false;
        // Cannot be split and does not fit: place it as a whole.
        dst.appendChild(node);
        continue;
      }

      if (exhausted || !hasContent(node)) {
        // Everything was placed (or only empty shells are left): drop the rest.
        src.removeChild(node);
        continue;
      }

      markContinued(node, clone);
      return false;
    }
    return true;
  }

  /**
   * Put the longest prefix of text node `node` that fits into `dst`.
   * @returns {boolean} true if the whole text was placed (continue filling)
   */
  function placeTextPart(node, src, dst, emptyBefore) {
    const text = node.data;
    const points = getBreakpoints(text);
    const prefix = doc.createTextNode("");
    dst.appendChild(prefix);

    // largest index into `points` whose prefix fits; -1 if none
    let lo = -1;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      prefix.data = text.slice(0, points[mid]);
      if (fits()) lo = mid;
      else hi = mid - 1;
    }

    if (lo === -1) {
      if (emptyBefore && points.length > 0) {
        // Even the first word is too wide for an empty page: show it anyway.
        lo = 0;
      } else if (emptyBefore) {
        prefix.data = text;
        src.removeChild(node);
        return true;
      } else {
        dst.removeChild(prefix);
        return false;
      }
    }

    const cut = points[lo];
    prefix.data = text.slice(0, cut);
    const keepWhitespace = node.parentNode?.closest?.("pre") != null;
    const rest = text.slice(cut);
    node.data = keepWhitespace ? rest : rest.replace(/^\s+/, "");
    if (node.data === "") src.removeChild(node);
    return false;
  }

  /** Is everything on the current page a title or heading (or empty)? */
  function onlyHeadingsOnPage() {
    return [...container.children].every(
      (el) => el.tagName === "HEADER" || HEADING_TAGS.has(el.tagName) || !hasContent(el)
    );
  }

  const mediaHeight = (el) =>
    el.getBoundingClientRect().height || Number(el.getAttribute("height")) || 0;

  /** Scale an embed by `scale`, keeping its aspect ratio. */
  function scaleMedia(el, scale) {
    const w = parseFloat(el.style.width) || Number(el.getAttribute("width")) || el.getBoundingClientRect().width;
    const newHeight = Math.max(1, Math.floor(mediaHeight(el) * scale));
    el.setAttribute("height", String(newHeight));
    el.style.setProperty("max-height", `${newHeight}px`);
    if (w) {
      const newWidth = Math.max(1, Math.floor(w * scale));
      el.setAttribute("width", String(newWidth));
      el.style.setProperty("width", `${newWidth}px`);
      if (el.style.aspectRatio) el.style.setProperty("aspect-ratio", `${newWidth} / ${newHeight}`);
    }
  }

  /**
   * Place `node` (the first child of `src`) on the page by scaling its embed down to
   * the room that is left. Puts it back into `src` if even that does not work.
   * @returns {boolean} true if the node now sits on the page
   */
  function shrinkToFit(node, src, dst) {
    const embed = node.matches?.(SCALABLE_SELECTOR) ? node : node.querySelector?.(SCALABLE_SELECTOR);
    if (!embed) return false;
    dst.appendChild(node);
    for (let attempt = 0; attempt < 3 && !fits(); attempt++) {
      const over = measure(container) - height;
      const current = mediaHeight(embed);
      if (current - over < MIN_SCALED_HEIGHT) break;
      scaleMedia(embed, (current - over - 1) / current);
    }
    if (fits()) return true;
    dst.removeChild(node);
    src.insertBefore(node, src.firstChild);
    return false;
  }

  /** Adjust the remainder `node` of an element that was split into `clone`. */
  function markContinued(node, clone) {
    node.classList.add("st-continued");
    if (node.tagName === "OL") {
      // clone holds the items that moved; keep the numbering going
      const start = Number(clone.getAttribute("start") ?? node.getAttribute("start") ?? 1);
      const moved = clone.querySelectorAll(":scope > li").length;
      node.setAttribute("start", String(start + moved));
    }
  }

  /**
   * A floated image is only useful next to the text that wraps it, so a float at
   * the end of a page moves to the next page, like a heading.
   */
  function isFloatBlock(el) {
    if (el.classList.contains("st-float")) return true;
    // <p><img class="st-float"></p>: a paragraph that only holds the float
    return (
      el.childElementCount === 1 &&
      el.textContent.trim() === "" &&
      el.firstElementChild.classList.contains("st-float")
    );
  }

  /** Keep a trailing heading or float with the next page's text. */
  function pullBackTrailingHeading() {
    const last = container.lastElementChild;
    if (!last || !(HEADING_TAGS.has(last.tagName) || isFloatBlock(last))) return;
    // only when there is something else on this page, otherwise we'd loop
    if (container.childElementCount < 2 || !hasContent(last.previousElementSibling)) return;
    container.removeChild(last);
    source.insertBefore(last, source.firstChild);
  }

  let pageCount = 0;
  try {
    while (source.firstChild) {
      const exhausted = await fill(source, container);
      if (!exhausted) pullBackTrailingHeading();
      if (hasContent(container)) {
        yield container.innerHTML;
        pageCount++;
      }
      container.replaceChildren();
      if (pageCount >= maxPages) {
        console.warn(`Story Teller X | page splitter stopped after ${maxPages} pages`);
        return;
      }
    }
  } finally {
    container.replaceChildren();
  }
}
