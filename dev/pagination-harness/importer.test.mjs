// Test for scripts/importer-chapters.mjs.
// Run: npm i --no-save jsdom && node dev/pagination-harness/importer.test.mjs
import assert from "node:assert/strict";
const { splitTextIntoChapters, isChapterHeading, escapeHtml, stripGutenbergBoilerplate } = await import(
  new URL("../../scripts/importer-chapters.mjs", import.meta.url).href);

assert.ok(isChapterHeading("Chapter 1: The Beginning"));
assert.ok(isChapterHeading("CHAPTER IV"));
assert.ok(isChapterHeading("XII."));
assert.ok(isChapterHeading("7"));
assert.ok(!isChapterHeading("It was a dark and stormy night."));
assert.ok(!isChapterHeading("Chapter " + "x".repeat(100)));

const text = `My Book\r\n\r\nChapter 1\r\n\r\nFirst line\r\nwrapped here.\r\n\r\nSecond paragraph.\r\n\r\nChapter 2\r\n\r\nThird.\r\n\r\nChapter 3\r\n\r\n`;
let chapters = splitTextIntoChapters(text, "Book");
assert.deepEqual(chapters.map((c) => c.name), ["Book", "Chapter 1", "Chapter 2"], "empty last chapter dropped");
assert.deepEqual(chapters[1].paragraphs, ["First line wrapped here.", "Second paragraph."]);

chapters = splitTextIntoChapters("Just some text.\n\nMore text.", "Whole");
assert.deepEqual(chapters, [{ name: "Whole", paragraphs: ["Just some text.", "More text."] }]);
assert.deepEqual(splitTextIntoChapters("", "x"), []);
assert.equal(escapeHtml('<b> & "q"'), "&lt;b&gt; &amp; &quot;q&quot;");

const gut = "License\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nChapter 1\n\nText.\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nMore license";
assert.equal(stripGutenbergBoilerplate(gut).trim(), "Chapter 1\n\nText.");
assert.equal(stripGutenbergBoilerplate("no markers"), "no markers");
console.log("importer ok");
