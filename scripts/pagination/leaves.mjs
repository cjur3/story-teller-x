/**
 * DOM helpers that turn the split text of one journal page (a "chapter") into
 * book leaves, and keep leaf numbers in sync. Pure DOM, no Foundry globals, so
 * they can be tested with jsdom.
 *
 * Leaf structure, as produced by templates/story-sheet.html:
 *   div.page-num[data-page-type]
 *     article.journal-entry-page.text[data-page-id]
 *       section.journal-page-content      <- the text lives here
 *       .back-to-toc                      <- added by the sheet
 *     .st-folio
 *     .storyteller2-page-entry-nav.prev / .next
 */

/**
 * The HTML to split for a text leaf: the title header (if shown) followed by the
 * contents of the text section, so the title takes space on the first leaf only.
 * @returns {string|null} null if the leaf has no text section
 */
export function getLeafSourceHtml(leaf) {
  const article = leaf.querySelector(":scope > article");
  const section = article?.querySelector(":scope > section.journal-page-content");
  if (!section) return null;
  const header = article.querySelector(":scope > header");
  return (header ? header.outerHTML : "") + section.innerHTML;
}

/**
 * Replace one leaf by one leaf per page of `pagesHtml`.
 * The first leaf is the original element (so its listeners stay).
 * @param {HTMLElement} leaf  the original `.page-num`
 * @param {string[]} pagesHtml
 * @returns {HTMLElement[]} the leaves of this chapter, in order
 */
export function buildChapterLeaves(leaf, pagesHtml) {
  const article = leaf.querySelector(":scope > article");
  const section = article.querySelector(":scope > section.journal-page-content");
  article.querySelector(":scope > header")?.remove();

  const leaves = [leaf];
  pagesHtml.forEach((html, i) => {
    let target = leaf;
    if (i > 0) {
      target = leaf.cloneNode(false);
      const articleClone = article.cloneNode(false);
      const sectionClone = section.cloneNode(false);
      articleClone.appendChild(sectionClone);
      target.appendChild(articleClone);
      // arrows and folio, not the article
      for (const child of leaf.children) {
        if (child === article) continue;
        target.appendChild(child.cloneNode(true));
      }
      leaves[i - 1].after(target);
      leaves.push(target);
    }
    target.dataset.leafInChapter = String(i);
    target.dataset.chapterLeaves = String(pagesHtml.length);
    target.querySelector(":scope > article > section.journal-page-content").innerHTML = html;
  });
  if (pagesHtml.length === 0) leaf.dataset.leafInChapter = "0";
  return leaves;
}

/**
 * Number the pages like a printed book: counting starts where the story starts.
 * The first chapter page is page 1; the table of contents pages (and a blank page
 * in front of the first chapter) are not counted. Blank filler pages between
 * chapters do count, but show no number.
 *
 * @param {HTMLElement} pagesEl  the element holding all `.page-num` leaves
 * @returns {{firstLeafOf: Map<string, number>, offset: number}}
 *   `firstLeafOf`: journal page id -> page number of its first leaf;
 *   `offset`: leaf position minus page number
 */
export function numberLeaves(pagesEl) {
  const leaves = [...pagesEl.querySelectorAll(":scope > .page-num")];
  const isChapterLeaf = (leaf) => !leaf.classList.contains("st-filler") && leaf.querySelector(":scope > article");
  const startIndex = leaves.findIndex(isChapterLeaf);
  const offset = startIndex < 0 ? 0 : startIndex - 1;

  const firstLeafOf = new Map();
  leaves.forEach((leaf, index) => {
    if (leaf.classList.contains("st-filler")) return;
    const article = leaf.querySelector(":scope > article");
    if (!article) return; // table of contents
    const pageId = article.dataset.pageId;
    if (pageId && !firstLeafOf.has(pageId)) firstLeafOf.set(pageId, index - offset);
    let folio = leaf.querySelector(":scope > .st-folio");
    if (!folio) {
      folio = leaf.ownerDocument.createElement("div");
      folio.className = "st-folio";
      leaf.insertBefore(folio, article.nextSibling);
    }
    folio.textContent = String(index - offset);
  });
  return { firstLeafOf, offset };
}

/**
 * Put the page number into every table of contents entry: chapters (by page id)
 * and heading entries (by the heading they point to).
 * @param {HTMLElement} pagesEl  the element holding all `.page-num` leaves
 * @param {{firstLeafOf: Map<string, number>, offset: number}} numbering  from numberLeaves
 */
export function fillTocPageNumbers(pagesEl, { firstLeafOf, offset }) {
  const leaves = [...pagesEl.querySelectorAll(":scope > .page-num")];
  const numberOf = (el) => {
    const leaf = el?.closest(".page-num");
    return leaf ? leaves.indexOf(leaf) - offset : -1;
  };

  const setNumber = (li, n) => {
    const heading = li.querySelector(":scope > .page-heading, :scope > .st-toc-heading-row");
    if (!heading) return;
    let span = heading.querySelector(":scope > .st-toc-page");
    if (!span) {
      span = li.ownerDocument.createElement("span");
      span.className = "st-toc-page";
      heading.appendChild(span);
    }
    span.textContent = n === undefined || n < 1 ? "" : String(n);
  };

  for (const toc of pagesEl.querySelectorAll(":scope > .page-num.num-start")) {
    for (const li of toc.querySelectorAll("li.directory-item[data-page-id]")) {
      setNumber(li, firstLeafOf.get(li.dataset.pageId));
    }
    for (const li of toc.querySelectorAll("li.st-toc-heading[data-heading]")) {
      const target = pagesEl.querySelector(`[data-st-heading="${li.dataset.heading}"]`);
      setNumber(li, numberOf(target));
    }
  }
}

/**
 * Chapters that would start on a left-hand page get a blank page in front, so
 * they start on the right-hand page of a spread. (Leaf 0, the cover, is right;
 * odd leaves are left, even leaves are right.)
 * @returns {number} how many blank pages were added
 */
export function insertChapterFillers(pagesEl) {
  const doc = pagesEl.ownerDocument;
  let previousId = null;
  let inserted = 0;

  for (const leaf of [...pagesEl.querySelectorAll(":scope > .page-num")]) {
    const pageId = leaf.querySelector(":scope > article")?.dataset.pageId ?? null;
    if (pageId && pageId !== previousId) {
      const index = [...pagesEl.querySelectorAll(":scope > .page-num")].indexOf(leaf);
      if (index % 2 === 1) {
        const filler = doc.createElement("div");
        filler.className = "page-num st-filler";
        for (const nav of leaf.querySelectorAll(":scope > .storyteller2-page-entry-nav")) {
          filler.appendChild(nav.cloneNode(true));
        }
        leaf.before(filler);
        inserted++;
      }
    }
    if (pageId) previousId = pageId;
  }
  return inserted;
}

/**
 * Headings (levels 1-`maxLevel`) of each chapter, in book order. The title
 * header of a page is not a heading of its own chapter. Every heading gets a
 * `data-st-heading` key so that TOC entries can find it again.
 * @param {HTMLElement} pagesEl
 * @returns {Map<string, {text:string,level:number,key:string}[]>} by page id
 */
export function collectChapterHeadings(pagesEl, maxLevel = 3) {
  const selector = Array.from({ length: maxLevel }, (_, i) => `h${i + 1}`).join(",");
  const byPage = new Map();
  let counter = 0;

  for (const leaf of pagesEl.querySelectorAll(":scope > .page-num")) {
    const article = leaf.querySelector(":scope > article");
    const section = article?.querySelector(":scope > section.journal-page-content");
    if (!section) continue;
    for (const heading of section.querySelectorAll(selector)) {
      if (heading.closest(".journal-page-header")) continue;
      const text = heading.textContent.trim();
      if (!text) continue;
      const key = String(counter++);
      heading.dataset.stHeading = key;
      const list = byPage.get(article.dataset.pageId) ?? [];
      list.push({ text, level: Number(heading.tagName[1]), key });
      byPage.set(article.dataset.pageId, list);
    }
  }
  return byPage;
}

/**
 * List the headings under their chapter in the table of contents.
 * @param {HTMLElement} tocEl  a table of contents leaf
 * @param {ReturnType<typeof collectChapterHeadings>} headingsByPage
 */
export function buildTocHeadings(tocEl, headingsByPage) {
  const doc = tocEl.ownerDocument;
  for (const li of tocEl.querySelectorAll("li.directory-item[data-page-id]")) {
    li.querySelector(":scope > ol")?.remove(); // Foundry's own (hidden) heading list
    const headings = headingsByPage.get(li.dataset.pageId);
    if (!headings?.length) continue;
    const minLevel = Math.min(...headings.map((h) => h.level));
    const list = doc.createElement("ol");
    list.className = "st-toc-headings";
    for (const heading of headings) {
      const item = doc.createElement("li");
      item.className = "st-toc-heading";
      item.dataset.heading = heading.key;
      item.dataset.depth = String(heading.level - minLevel);
      const row = doc.createElement("div");
      row.className = "st-toc-heading-row";
      const label = doc.createElement("span");
      label.className = "st-toc-heading-text";
      label.textContent = heading.text;
      row.appendChild(label);
      item.appendChild(row);
      list.appendChild(item);
    }
    li.appendChild(list);
  }
}

/** Index of the leaf for a bookmark, clamped to the chapter. -1 if the chapter is gone. */
export function findLeafIndex(pagesEl, pageId, leafInChapter = 0) {
  const leaves = [...pagesEl.querySelectorAll(":scope > .page-num")];
  const inChapter = leaves
    .map((leaf, index) => ({ leaf, index }))
    .filter(({ leaf }) => leaf.querySelector(":scope > article")?.dataset.pageId === pageId);
  if (!inChapter.length) return -1;
  return inChapter[Math.min(leafInChapter, inChapter.length - 1)].index;
}

/** Bookmark for a leaf: which chapter, which leaf of it. */
export function getLeafBookmark(leaf) {
  const pageId = leaf?.querySelector(":scope > article")?.dataset.pageId;
  if (!pageId) return null;
  return { pageId, leaf: Number(leaf.dataset.leafInChapter ?? 0) };
}
