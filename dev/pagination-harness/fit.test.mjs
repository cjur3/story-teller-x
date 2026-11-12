// Test for scripts/pagination/fit.mjs.
// Run: npm i --no-save jsdom && node dev/pagination-harness/fit.test.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
const dom = new JSDOM("<body></body>");
globalThis.DOMParser = dom.window.DOMParser;
const { fitMedia } = await import(new URL("../../scripts/pagination/fit.mjs", import.meta.url).href);

const max = { width: 400, height: 500, captionAllowance: 60 };
const parse = (html) => new DOMParser().parseFromString(html, "text/html").body;
const dims = (el) => [Number(el.getAttribute("width")), Number(el.getAttribute("height"))];

// tall image: limited by height, ratio kept
let img = parse(fitMedia('<img src="a.png">', max, new Map([["a.png", { width: 1000, height: 3000 }]]))).querySelector("img");
assert.deepEqual(dims(img), [166, 500]);
assert.ok(img.style.width === "166px");

// wide image: limited by width
img = parse(fitMedia('<img src="b.png">', max, new Map([["b.png", { width: 2000, height: 1000 }]]))).querySelector("img");
assert.deepEqual(dims(img), [400, 200]);

// small image is not enlarged
img = parse(fitMedia('<img src="c.png">', max, new Map([["c.png", { width: 100, height: 50 }]]))).querySelector("img");
assert.deepEqual(dims(img), [100, 50]);

// author's explicit width wins over natural size, height derived from ratio
img = parse(fitMedia('<img src="d.png" width="300">', max, new Map([["d.png", { width: 600, height: 1200 }]]))).querySelector("img");
assert.deepEqual(dims(img), [250, 500], "300x600 does not fit 500 high -> scaled");

// explicit width+height, both too big
img = parse(fitMedia('<img src="e.png" style="width: 800px; height: 1000px">', max)).querySelector("img");
assert.deepEqual(dims(img), [400, 500]);

// percent width relative to the content width
img = parse(fitMedia('<img src="f.png" style="width: 50%">', max, new Map([["f.png", { width: 10, height: 10 }]]))).querySelector("img");
assert.deepEqual(dims(img), [200, 200]);

// figure with caption leaves room for the caption
let fig = parse(fitMedia('<figure><img src="g.png"><figcaption>x</figcaption></figure>', max, new Map([["g.png", { width: 500, height: 2000 }]])));
assert.deepEqual(dims(fig.querySelector("img")), [110, 440]);

// unknown size (failed load): capped by css only
img = parse(fitMedia('<img src="broken.png">', max)).querySelector("img");
assert.equal(img.style.maxHeight, "500px");
assert.equal(img.hasAttribute("width"), false);

// iframe with attributes, inline svg with viewBox
assert.deepEqual(dims(parse(fitMedia('<iframe width="800" height="1000"></iframe>', max)).querySelector("iframe")), [400, 500]);
assert.deepEqual(dims(parse(fitMedia('<svg viewBox="0 0 100 400" width="100"><path/></svg>', max)).querySelector("svg")), [100, 400]);

// --- floats ---
const nat = (src, w, h) => new Map([[src, { width: w, height: h }]]);

// existing float is kept, capped to half the width / 60% of the height, and gets a margin
let out = parse(fitMedia('<p>text <img src="h.png" style="float:right"> more</p>', max, nat("h.png", 1000, 1000)));
img = out.querySelector("img");
assert.deepEqual(dims(img), [200, 200], "half of 400 wide");
assert.equal(img.style.float, "right");
assert.ok(img.classList.contains("st-float"));
assert.match(img.style.margin, /1em/);

// tall float is limited to 60% of the height (300), not the full 500
img = parse(fitMedia('<img src="i.png" align="left">', max, nat("i.png", 100, 1000))).querySelector("img");
assert.deepEqual(dims(img), [30, 300]);
assert.equal(img.style.float, "left");
assert.equal(img.hasAttribute("align"), false);

// float on the figure around the image
out = parse(fitMedia('<figure style="float:left"><img src="j.png"><figcaption>c</figcaption></figure>', max, nat("j.png", 100, 100)));
assert.ok(out.querySelector("figure").classList.contains("st-float"));
assert.equal(out.querySelector("img").classList.contains("st-float"), false);

// not floated by default
img = parse(fitMedia('<p><img src="k.png"></p>', max, nat("k.png", 100, 100))).querySelector("img");
assert.equal(img.style.float, "");

// autoFloat: small images alternate, big and table images do not
out = parse(fitMedia(
  '<p><img src="s1.png"></p><p><img src="s2.png"></p><p><img src="big.png"></p><table><tr><td><img src="s1.png"></td></tr></table>',
  max, new Map([["s1.png", { width: 100, height: 100 }], ["s2.png", { width: 100, height: 100 }], ["big.png", { width: 380, height: 100 }]]),
  { autoFloat: true }));
const [a, b, c, d] = out.querySelectorAll("img");
assert.deepEqual([a.style.float, b.style.float, c.style.float, d.style.float], ["left", "right", "", ""]);

// text untouched
assert.equal(fitMedia("<p>hello</p>", max), "<p>hello</p>");
console.log("fit ok");
