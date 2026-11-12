// DOM test for scripts/pagination/leaves.mjs.
// Run: npm i --no-save jsdom && node dev/pagination-harness/leaves.test.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
const dom = new JSDOM("<body></body>");
globalThis.document = dom.window.document;
const L = await import(new URL("../../scripts/pagination/leaves.mjs", import.meta.url).href);
const T = await import(new URL("../../scripts/pagination/toc.mjs", import.meta.url).href);

const toc = (id, n) => `<li class="directory-item level1" data-page-id="${id}"><div class="page-heading"><span class="page-title">${n}</span></div></li>`;
document.body.innerHTML = `
<div class="pages">
  <div class="page-num num-start"><div class="journal-entry-page pages-content"><ol>${toc("A","A")}${toc("B","B")}</ol></div></div>
  <div class="page-num" data-page-type="text"><article class="journal-entry-page text" data-page-id="A" data-entry-index="0">
     <header class="journal-page-header"><h1>A</h1></header><section class="journal-page-content"><p>one</p></section>
     <div class="edit-container"><a class="editor-edit"></a></div></article>
     <div class="st-folio">1</div><div class="journal-page-arrow-left storyteller2-page-entry-nav prev"></div><div class="journal-page-arrow-right storyteller2-page-entry-nav next"></div></div>
  <div class="page-num" data-page-type="image"><article class="journal-entry-page image" data-page-id="B"></article></div>
</div>`;
const pagesEl = document.querySelector(".pages");
const leaf = pagesEl.children[1];

assert.equal(L.getLeafSourceHtml(leaf), '<header class="journal-page-header"><h1>A</h1></header><p>one</p>');
const leaves = L.buildChapterLeaves(leaf, ["<h1>A</h1><p>p1</p>", "<p>p2</p>", "<p>p3</p>"]);
assert.equal(leaves.length, 3);
assert.equal(leaves[0], leaf);
assert.equal(pagesEl.children.length, 5);
assert.equal(leaf.querySelector("header"), null);
assert.equal(leaves[2].querySelector("article").dataset.pageId, "A");
assert.equal(leaves[2].querySelector("section").innerHTML, "<p>p3</p>");
assert.equal(leaves[2].dataset.leafInChapter, "2");
assert.ok(leaves[1].querySelector(".journal-page-arrow-right"));

const first = L.numberLeaves(pagesEl);
assert.equal(first.firstLeafOf.get("A"), 1);
assert.equal(first.firstLeafOf.get("B"), 4);
assert.equal(first.offset, 0);
assert.equal(pagesEl.children[3].querySelector(".st-folio").textContent, "3");
assert.equal(pagesEl.children[4].querySelector(".st-folio").textContent, "4", "folio created for leaf without one");

L.fillTocPageNumbers(pagesEl, first);
const nums = [...document.querySelectorAll(".st-toc-page")].map((e) => e.textContent);
assert.deepEqual(nums, ["1", "4"]);
L.fillTocPageNumbers(pagesEl, first); // idempotent
assert.equal(document.querySelectorAll(".st-toc-page").length, 2);

assert.equal(L.findLeafIndex(pagesEl, "A", 2), 3);
assert.equal(L.findLeafIndex(pagesEl, "A", 99), 3, "clamped to chapter");
assert.equal(L.findLeafIndex(pagesEl, "gone"), -1);
assert.deepEqual(L.getLeafBookmark(pagesEl.children[2]), { pageId: "A", leaf: 1 });
assert.equal(L.getLeafBookmark(pagesEl.children[0]), null);

// --- chapters on the right-hand page ---
// leaves now: 0 TOC, 1-3 chapter A, 4 chapter B. A starts at 1 (left) -> filler; B then at 5 (left) -> filler
let added = L.insertChapterFillers(pagesEl);
assert.equal(added, 2);
const kinds = [...pagesEl.children].map((c) => (c.classList.contains("st-filler") ? "F" : c.classList.contains("num-start") ? "T" : c.querySelector("article").dataset.pageId));
assert.deepEqual(kinds, ["T", "F", "A", "A", "A", "F", "B"].map((k, i) => k));
assert.equal(L.insertChapterFillers(pagesEl), 0, "already on right-hand pages");
const renumbered = L.numberLeaves(pagesEl);
// the blank page in front of the first chapter is not counted: A is page 1, the filler between A and B counts
assert.equal(renumbered.offset, 1);
assert.equal(renumbered.firstLeafOf.get("A"), 1);
assert.equal(renumbered.firstLeafOf.get("B"), 5);
assert.equal(pagesEl.children[2].querySelector(".st-folio").textContent, "1");
assert.equal(pagesEl.children[1].querySelector(".st-folio"), null, "no number before the story starts");
assert.equal(pagesEl.children[1].querySelector(".st-folio"), null, "filler has no number");
assert.ok(pagesEl.children[1].querySelector(".prev"), "filler keeps the page-turn arrows");

// --- headings in the TOC ---
document.body.innerHTML = `<div class="pages">
  <div class="page-num num-start"><ol>${toc("A","A")}</ol></div>
  <div class="page-num"><article class="journal-entry-page text" data-page-id="A"><section class="journal-page-content"><header class="journal-page-header"><h1>Title</h1></header><h2>Intro</h2><p>x</p></section></article></div>
  <div class="page-num"><article class="journal-entry-page text" data-page-id="A"><section class="journal-page-content"><h2>Part two</h2><h3>Detail</h3><h5>too deep</h5></section></article></div>
</div>`;
const p2 = document.querySelector(".pages");
const headings = L.collectChapterHeadings(p2);
assert.deepEqual(headings.get("A").map((h) => [h.text, h.level]), [["Intro", 2], ["Part two", 2], ["Detail", 3]]);
L.buildTocHeadings(p2.children[0], headings);
const rows = [...p2.querySelectorAll(".st-toc-heading")];
assert.equal(rows.length, 3);
assert.deepEqual(rows.map((r) => r.dataset.depth), ["0", "0", "1"]);
const f2 = L.numberLeaves(p2);
L.fillTocPageNumbers(p2, f2);
assert.deepEqual([...p2.querySelectorAll(".st-toc-heading .st-toc-page")].map((e) => e.textContent), ["1", "2", "2"]);
assert.equal(p2.querySelector(".directory-item > .page-heading > .st-toc-page").textContent, "1");

// --- a table of contents on three pages does not count: the first chapter is page 1 ---
document.body.innerHTML = `<div class="pages">
  <div class="page-num num-start"><ol>${toc("A","A")}${toc("B","B")}</ol></div>
  <div class="page-num num-start st-toc-continued"><ol></ol></div>
  <div class="page-num num-start st-toc-continued"><ol></ol></div>
  <div class="page-num"><article class="journal-entry-page text" data-page-id="A"><section class="journal-page-content"><p>a</p></section></article></div>
  <div class="page-num"><article class="journal-entry-page text" data-page-id="A"><section class="journal-page-content"><p>a2</p></section></article></div>
  <div class="page-num"><article class="journal-entry-page text" data-page-id="B"><section class="journal-page-content"><p>b</p></section></article></div>
</div>`;
const p3 = document.querySelector(".pages");
const n3 = L.numberLeaves(p3);
assert.equal(n3.offset, 2);
assert.equal(n3.firstLeafOf.get("A"), 1);
assert.equal(n3.firstLeafOf.get("B"), 3);
assert.deepEqual([...p3.querySelectorAll(".st-folio")].map((e) => e.textContent), ["1", "2", "3"]);
L.fillTocPageNumbers(p3, n3);
assert.deepEqual([...p3.querySelectorAll(".directory-item .st-toc-page")].map((e) => e.textContent), ["1", "3"]);

// --- TOC grouping ---
assert.deepEqual(T.groupByFit([1,2,3,4,5], (g) => g.length <= 2), [[1,2],[3,4],[5]]);
assert.deepEqual(T.groupByFit([1,2], () => false), [[1],[2]], "always makes progress");
assert.deepEqual(T.groupByFit([], () => true), []);

// --- paginateToc with a fake layout: each entry 10px, title 20px, button 15px, page 100px ---
{
  const win = dom.window;
  Object.defineProperty(win.HTMLElement.prototype, "clientHeight", { configurable: true, get() { return this.matches("nav.pages-list") ? 100 : 0; } });
  Object.defineProperty(win.HTMLElement.prototype, "scrollHeight", { configurable: true, get() {
    if (!this.matches("nav.pages-list")) return 0;
    const leaf = this.closest(".page-num");
    return this.querySelectorAll(":scope > ol > li").length * 10 + (leaf.querySelector(".journal-header") ? 20 : 0) + (leaf.querySelector(".create") ? 15 : 0);
  } });
  const build = (n) => {
    document.body.innerHTML = `<div class="journal-entry-pages"><div class="pages"><div class="page-num num-start"><div class="content-inner">
      <form class="journal-header"><input></form><nav class="pages-list"><ol>${Array.from({ length: n }, (_, i) => toc("p" + i, i)).join("")}</ol></nav>
      <button class="create">Add</button></div></div></div></div>`;
    const leaf = document.querySelector(".page-num");
    return { leaf, host: document.querySelector(".journal-entry-pages"), button: leaf.querySelector(".create") };
  };
  const counts = (leaves) => leaves.map((l) => l.querySelectorAll("nav.pages-list > ol > li").length);

  let t = build(6); // 60 + 20 title + 15 button = 95: fits, unchanged
  assert.equal(T.paginateToc(t.leaf, t.host, { width: 1, height: 1 }).length, 1);

  t = build(25); // 8 + 10 + 7, button fits after the last 7
  let leaves = T.paginateToc(t.leaf, t.host, { width: 1, height: 1 });
  assert.deepEqual(counts(leaves), [8, 10, 7]);
  assert.equal(leaves.at(-1).querySelector(".create"), t.button, "the original button, on the last page");
  assert.equal(document.querySelectorAll(".create").length, 1);
  assert.equal(leaves[1].querySelector(".journal-header"), null, "title only on the first page");
  assert.ok(leaves[1].classList.contains("num-start"));

  t = build(18); // 8 + 10 would leave no room for the button: one entry moves to a new last page
  leaves = T.paginateToc(t.leaf, t.host, { width: 1, height: 1 });
  assert.deepEqual(counts(leaves), [8, 9, 1]);
  assert.equal(leaves.at(-1).querySelector(".create"), t.button);
  assert.equal(document.querySelectorAll("nav.pages-list > ol > li").length, 18, "no entry lost");
  assert.equal(document.querySelectorAll(".page-num[style]").length, 0, "probes removed");
}
console.log("leaves ok");
