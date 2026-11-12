// Test for scripts/zip.mjs and scripts/epub.mjs with two small EPUB fixtures.
// Run: npm i --no-save jsdom && node dev/pagination-harness/epub.test.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.DOMParser = new JSDOM("").window.DOMParser;
const dir = new URL("../../scripts/", import.meta.url).href;
const { ZipReader } = await import(dir + "zip.mjs");
const { parseEpub, resolvePath, tidyTitle, dropNumberedSections } = await import(dir + "epub.mjs");
const fixture = (name) => new ZipReader(fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

// paths and titles
assert.equal(resolvePath("OEBPS/a/b.xhtml", "../img/x%20y.png#frag"), "OEBPS/img/x y.png");
assert.equal(resolvePath("content.opf", "ch1.xhtml"), "ch1.xhtml");
assert.equal(tidyTitle("CHAPTER IV."), "Chapter IV.");
assert.equal(tidyTitle("CHAPTERXXVII."), "Chapter XXVII.");
assert.equal(tidyTitle("THE MILD END"), "The Mild End");
assert.equal(tidyTitle("The Quiet Man"), "The Quiet Man");
assert.equal(tidyTitle("II. THE RED-HEADED LEAGUE"), "II. The Red-headed League");
assert.equal(tidyTitle("I. A SCANDAL IN BOHEMIA"), "I. A Scandal in Bohemia");
assert.equal(tidyTitle("CHAPTER I. Down the Rabbit-Hole"), "Chapter I. Down the Rabbit-Hole");

// sub entries that are only numbers are sections of their story, not chapters
const toc = [
  { title: "I. A SCANDAL IN BOHEMIA", depth: 0 }, { title: "I.", depth: 1 }, { title: "II.", depth: 1 },
  { title: "II. THE RED-HEADED LEAGUE", depth: 0 }, { title: "Part One", depth: 0 }, { title: "Chapter 1", depth: 1 },
];
assert.deepEqual(dropNumberedSections(toc).map((e) => e.title), ["I. A SCANDAL IN BOHEMIA", "II. THE RED-HEADED LEAGUE", "Part One", "Chapter 1"]);

// zip: stored and deflated entries
const zip = fixture("with-toc.epub");
assert.ok(zip.names.includes("OEBPS/one.xhtml"));
assert.equal(await zip.text("mimetype"), "application/epub+zip");
assert.match(await zip.text("OEBPS/one.xhtml"), /CHAPTER II/);
await assert.rejects(zip.bytes("nope"), /not in archive/);
assert.throws(() => new ZipReader(new Uint8Array(100)), /Not a ZIP/);

// book with a table of contents; two chapters share one file
let book = await parseEpub(zip);
assert.equal(book.title, "Mini Book");
assert.equal(book.author, "A. Writer");
assert.deepEqual(book.chapters.map((c) => c.name), ["Chapter I.", "Chapter II.", "epilogue"], "cover skipped, names from headings (only ALL-CAPS ones are rewritten)");
const [one, two, three] = book.chapters.map((c) => c.html);
assert.match(one, /^<p>Text one <em>em<\/em> &amp; more\.<\/p>$/, "own heading removed, markup kept");
assert.match(two, /<em>A caption<\/em>/, "caption of the heading kept as text");
assert.match(two, /<p>When it began\.<\/p>/, "drop cap picture became the letter");
assert.match(two, /<img src="epub-image:OEBPS%2Fimg%2Fpic\.png" alt="pic">/);
assert.match(two, /<blockquote><p>A quote<\/p><\/blockquote>/);
assert.match(two, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
assert.equal(three, "<p>The end.</p>");
assert.doesNotMatch([one, two, three].join(""), /junk|GUTENBERG/);
assert.deepEqual(book.images, ["OEBPS/img/pic.png"], "only used pictures, not the drop cap");

book = await parseEpub(zip, { includeImages: false });
assert.doesNotMatch(book.chapters[1].html, /<img/);
assert.deepEqual(book.images, []);

// no table of contents: cut at the repeated h2
book = await parseEpub(fixture("no-toc.epub"));
assert.deepEqual(book.chapters.map((c) => c.name), ["First Part", "Second Part", "Third Part"]);
assert.equal(book.chapters[1].html, "<p>Beta.</p>");
console.log("epub ok");
