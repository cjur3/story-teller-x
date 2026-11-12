// Logic test for the page splitter using a fake layout (no real rendering).
// Run: npm i --no-save jsdom && node dev/pagination-harness/splitter.test.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
const dom = new JSDOM("<body><div id=c></div></body>");
for (const k of ["document","DOMParser","Node"]) globalThis[k] = dom.window[k] ?? globalThis[k];
globalThis.MessageChannel ??= (await import("node:worker_threads")).MessageChannel;
const ROOT = new URL("../../scripts/pagination/", import.meta.url).href;
const { splitHtmlToPages, getBreakpoints } = await import(ROOT + "splitter.mjs");

const CPL = 40, LH = 10, INLINE = new Set(["SPAN","EM","STRONG","B","I","A"]);
function h(el) {
  let chars = 0, sum = 0;
  for (const c of el.childNodes) {
    if (c.nodeType === 3) chars += c.data.length;
    else if (c.nodeType === 1) {
      if (c.tagName === "IMG") sum += Number(c.getAttribute("height"));
      else if (INLINE.has(c.tagName)) chars += c.textContent.length;
      else sum += h(c);
    }
  }
  return sum + (chars ? Math.ceil(chars / CPL) * LH : 0);
}
const container = document.getElementById("c");
const words = (n, p="w") => Array.from({length:n},(_, i)=>`${p}${i}`).join(" ");
async function run(html, height) {
  const pages = [];
  for await (const p of splitHtmlToPages(html, { container, height, measure: h })) pages.push(p);
  return pages;
}
const text = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g,""); };

// breakpoints
assert.deepEqual(getBreakpoints("ab cd-ef  gh"), [3,6,10]);

// 1. long paragraph
let html = `<p>${words(400)}</p>`;
let pages = await run(html, 100);
console.log("pages",pages.length); assert.ok(pages.length >= 5);
for (const p of pages) { container.innerHTML = p; assert.ok(h(container) <= 100, "overflow"); }
container.replaceChildren();
assert.equal(pages.map(text).join(""), text(html));

// 2. mixed content, heading keep-with-next, list numbering
html = `<h1>Title</h1><p>${words(60)}</p><h2>Sub</h2><p>${words(30,"x")}</p><ol>${Array.from({length:12},(_,i)=>`<li>item ${i} ${words(10)}</li>`).join("")}</ol><p>end</p>`;
pages = await run(html, 80);
assert.equal(pages.map(text).join(""), text(html));
for (const p of pages) { container.innerHTML = p; assert.ok(h(container) <= 80); const last = container.lastElementChild; if (container.children.length>1) assert.ok(!/^H\d$/.test(last.tagName), "trailing heading"); }
container.replaceChildren();
const starts = pages.flatMap(p => [...p.matchAll(/<ol[^>]*start="(\d+)"/g)].map(m=>+m[1]));
assert.ok(starts.length >= 1 && starts[0] > 1, "ol start: " + starts);

// 3. oversized image alone, no infinite loop
html = `<p>${words(20)}</p><img height="500"><p>${words(20,"z")}</p>`;
pages = await run(html, 100);
assert.equal(pages.length, 3);
assert.ok(pages[1].includes("<img"));

// 3c. title followed by a picture taller than the room left: the picture shrinks and
// stays with the title, instead of the title standing alone on the first page
html = `<header><h1>Title</h1></header><img height="95">`;
pages = await run(html, 100);
assert.equal(pages.length, 1, "title and picture share the page");
container.innerHTML = pages[0]; assert.ok(h(container) <= 100, "fits"); container.replaceChildren();
html = `<header><h1>Title</h1></header><p><img height="95"></p><p>${words(10)}</p>`;
pages = await run(html, 100);
assert.ok(pages[0].includes("<img"), "picture in a paragraph shrinks too");
// but not to a sliver: with almost no room left the old behaviour stays
html = `<header><h1>Title</h1></header><p>${words(70)}</p><img height="95">`;
pages = await run(html, 100);
assert.ok(!pages[0].includes("<img"), "text before the picture: no shrinking");

// 4. unbreakable super long word, nested divs/blockquote
html = `<div><blockquote><p>${"a".repeat(500)} ${words(50)}</p></blockquote></div>`;
pages = await run(html, 50);
assert.equal(pages.map(text).join(""), text(html));

// 3b. a float at the bottom of a page moves to the next page, next to its text
html = `<p>${"x ".repeat(160)}</p><img class="st-float" height="15"><p>${words(120,"y")}</p>`;
pages = await run(html, 100);
assert.ok(!pages[0].includes("<img"), "float not stranded at page end");
assert.ok(pages[1].startsWith("<img"), "float leads the next page");

// 5. empty / whitespace input
assert.deepEqual(await run("", 100), []);
assert.deepEqual(await run("  \n ", 100), []);

// 6. abort
const ac = new AbortController(); ac.abort();
await assert.rejects(async () => { for await (const _ of splitHtmlToPages("<p>x</p>", { container, height: 10, measure: h, signal: ac.signal })); }, /Abort/);
assert.equal(container.childNodes.length, 0, "container cleaned");

console.log("all ok");
