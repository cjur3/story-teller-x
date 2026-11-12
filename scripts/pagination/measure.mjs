/**
 * Measures the area that text can use on one page of the book.
 *
 * It builds a hidden copy of a real content leaf inside the sheet, so that the
 * theme's padding, fonts and sizes apply, and reads the content box from it.
 */

const px = (value) => parseFloat(value) || 0;

/**
 * @param {object} options
 * @param {HTMLElement} options.host         element to attach the measurer to
 *        (inside the sheet, so theme CSS applies)
 * @param {{width:number,height:number}} options.leafSize  size of one leaf in px
 * @param {boolean} [options.pageNumbers]    reserve room for the page number
 * @param {string[]} [options.leafClasses]   classes of a content leaf
 * @param {string[]} [options.articleClasses] classes of a content article
 * @param {string} [options.contentTag]      tag of the element that holds the text
 * @param {string[]} [options.contentClasses] classes of that element (use the real
 *        ones, e.g. "journal-page-content", so its padding and font apply)
 * @returns {Promise<{width:number,height:number,container:HTMLElement,dispose:() => void}>}
 *   `container` is ready to be given to splitHtmlToPages.
 */
export async function measureContentArea({
  host,
  leafSize,
  pageNumbers = false,
  leafClasses = ["page-num"],
  articleClasses = ["journal-entry-page", "text"],
  contentTag = "div",
  contentClasses = ["st-content"],
}) {
  await document.fonts?.ready;
  const doc = host.ownerDocument;

  const leaf = doc.createElement("div");
  leaf.classList.add(...leafClasses, "st-measure");
  Object.assign(leaf.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: `${leafSize.width}px`,
    height: `${leafSize.height}px`,
    visibility: "hidden",
    pointerEvents: "none",
    overflow: "hidden",
  });

  const article = doc.createElement("article");
  article.classList.add(...articleClasses);
  // the real leaf CSS does this too; do not depend on it
  article.style.height = "100%";
  article.style.boxSizing = "border-box";

  const content = doc.createElement(contentTag);
  content.classList.add(...contentClasses);
  content.style.display = "flow-root";
  content.style.height = "auto";
  content.style.overflow = "visible";
  content.style.boxSizing = "border-box";

  article.appendChild(content);
  leaf.appendChild(article);

  let folioSpace = 0;
  if (pageNumbers) {
    const folio = doc.createElement("div");
    folio.classList.add("st-folio");
    folio.textContent = "000";
    folio.style.display = "block"; // measure it even if the sheet hides folios
    leaf.appendChild(folio);
  }

  host.appendChild(leaf);

  const style = getComputedStyle(article);
  // Width: the text element's content box (its own padding is part of the theme).
  // Height: what is left of the article below its padding. The text element's own
  // vertical padding stays in the budget: the splitter measures the whole element,
  // padding included.
  const contentStyle = getComputedStyle(content);
  const contentWidth =
    content.clientWidth - px(contentStyle.paddingLeft) - px(contentStyle.paddingRight);
  let contentHeight =
    article.clientHeight - px(style.paddingTop) - px(style.paddingBottom);

  if (pageNumbers) {
    const folio = leaf.querySelector(".st-folio");
    // the folio is positioned from the bottom edge: its top edge is the limit
    const leafRect = leaf.getBoundingClientRect();
    const folioRect = folio.getBoundingClientRect();
    const articleRect = article.getBoundingClientRect();
    const folioTop = folioRect.top - leafRect.top;
    const articleBottomPadding = px(style.paddingBottom);
    // space the folio takes inside the article's content box
    folioSpace = Math.max(
      0,
      articleRect.bottom - articleBottomPadding - leafRect.top - folioTop
    );
    contentHeight -= folioSpace;
  }

  const image = probeImageOverhead(content, contentStyle);

  // The splitter appends text into this element, so its size must be the content box.
  content.style.width = `${contentWidth + px(contentStyle.paddingLeft) + px(contentStyle.paddingRight)}px`;

  const paddingY = px(contentStyle.paddingTop) + px(contentStyle.paddingBottom);
  const lineHeight =
    px(contentStyle.lineHeight) || px(contentStyle.fontSize) * 1.3 || 20;
  const finalHeight = Math.max(0, contentHeight);
  return {
    width: contentWidth,
    height: finalHeight,
    /** Largest box an image may fill so that it still fits a page on its own. */
    imageMax: {
      width: Math.max(1, contentWidth - image.x),
      height: Math.max(1, finalHeight - paddingY - image.y),
      captionAllowance: lineHeight * 3,
    },
    folioSpace,
    container: content,
    dispose: () => leaf.remove(),
  };
}

/**
 * How much room a lone image takes beyond its own size in this theme: margins of
 * its paragraph or figure, the gap an inline image leaves for text descenders,
 * borders and padding. Measured with a 1x100 px dummy image in the real layout.
 */
function probeImageOverhead(content, contentStyle) {
  const doc = content.ownerDocument;
  const PROBE_HEIGHT = 100;
  const paddingY = px(contentStyle.paddingTop) + px(contentStyle.paddingBottom);
  let x = 0;
  let y = 0;

  for (const wrapperTag of [null, "p", "figure"]) {
    const img = doc.createElement("img");
    img.src = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
    img.setAttribute("width", "1");
    img.setAttribute("height", String(PROBE_HEIGHT));
    const wrapper = wrapperTag ? doc.createElement(wrapperTag) : null;
    wrapper?.appendChild(img);
    content.appendChild(wrapper ?? img);

    const rect = content.getBoundingClientRect();
    y = Math.max(y, rect.height - paddingY - PROBE_HEIGHT);

    const sides = (el) => {
      const s = getComputedStyle(el);
      return (
        px(s.marginLeft) + px(s.marginRight) + px(s.paddingLeft) + px(s.paddingRight) +
        px(s.borderLeftWidth) + px(s.borderRightWidth)
      );
    };
    x = Math.max(x, sides(img) + (wrapper ? sides(wrapper) : 0));

    (wrapper ?? img).remove();
  }
  // one pixel of slack against sub-pixel rounding
  return { x: Math.ceil(x), y: Math.ceil(Math.max(0, y)) + 1 };
}
