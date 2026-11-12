/**
 * EPUB parsing: turns an EPUB (as a ZipReader) into chapters of simple HTML.
 *
 * - Reading order comes from the OPF spine.
 * - Chapters are cut at the targets of the table of contents (EPUB 3 nav or
 *   NCX), also when several chapters share one big file. Without a usable table
 *   of contents, the book is cut at its top-level headings.
 * - Project Gutenberg's license text and title page are left out.
 * - Markup is reduced to paragraphs, headings, quotes, lists, tables, basic
 *   emphasis and images. Images are returned as placeholders
 *   (`epub-image:<encoded zip path>`) so the caller can store them.
 *
 * Needs a DOMParser (browser, or jsdom in tests). No Foundry globals.
 */

import { escapeHtml } from "./importer-chapters.mjs";

export const IMAGE_SCHEME = "epub-image:";

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "UL", "OL", "TABLE", "PRE", "HR"]);
const CONTAINER_TAGS = new Set([
  "DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE", "HEADER", "FOOTER", "FIGURE", "FIGCAPTION",
  "CENTER", "BODY", "DL", "DD", "DT", "SPAN", "A", "NAV",
]);
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "HEAD", "NAV", "SVG", "AUDIO", "VIDEO", "IFRAME", "OBJECT"]);
const INLINE_KEEP = new Set(["EM", "I", "STRONG", "B", "U", "SUP", "SUB"]);
const BOILERPLATE = ".pg-boilerplate, #pg-header, #pg-footer";
const SKIP_TITLE = /^(cover|title page|copyright|contents|table of contents|list of illustrations)\.?$|gutenberg|full license|colophon|transcriber/i;
const KEYWORDS = new Set(["chapter", "book", "part", "volume", "canto", "act", "scene", "section", "letter"]);

/* ---------- paths ---------- */

/** Resolve `href` (relative to the file `base`) to a path inside the archive. */
export function resolvePath(base, href) {
  const clean = href.split("#")[0].split("?")[0];
  const parts = clean.startsWith("/") ? [] : base.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  const path = parts.join("/");
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

const fragmentOf = (href) => (href.includes("#") ? decodeURIComponent(href.split("#")[1]) : "");
const normalize = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const collapse = (text) => text.replace(/\s+/g, " ").trim();

const SMALL_WORDS = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "and", "or", "for", "with", "by", "from", "but", "as", "is"]);
const DIVISION = /^(CHAPTER|BOOK|PART|VOLUME|CANTO|ACT|SCENE|LETTER)\b/;

/**
 * Tidy a chapter name: "CHAPTER IV." -> "Chapter IV.", "II. THE RED-HEADED LEAGUE"
 * -> "II. The Red-headed League". Titles in normal case are left alone, except
 * that a shouting division word ("CHAPTER I. Down the Rabbit-Hole") is calmed.
 */
export function tidyTitle(title) {
  // "CHAPTERXXVII." (no space in the source) -> "CHAPTER XXVII."
  let text = collapse(title).replace(/^(chapter|book|part|volume|canto)(?=[IVXLCDM]+[.,:]?$)/i, "$1 ");
  const shouting = text.length >= 2 && text === text.toUpperCase() && /\p{Lu}/u.test(text);
  if (!shouting) return text.replace(DIVISION, (word) => word.charAt(0) + word.slice(1).toLowerCase());

  const words = text.split(" ");
  const wholeRoman = /^[IVXLCDM]+[.,:]?$/.test(text);
  return words
    .map((word, i) => {
      const roman = /^[IVXLCDM]+[.,:]?$/.test(word);
      const afterDivision = i === 1 && KEYWORDS.has(words[0].toLowerCase().replace(/\W/g, ""));
      if (roman && (wholeRoman || afterDivision || (i === 0 && /\.$/.test(word)))) return word;
      const lower = word.toLowerCase();
      const afterNumeral = i === 1 && /^[IVXLCDM]+[.,:]$/.test(words[0]);
      if (i > 0 && !afterNumeral && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/* ---------- XML helpers ---------- */

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid XML in EPUB");
  return doc;
}

const first = (doc, tag) => doc.getElementsByTagName(tag)[0] ?? null;

/** Parse a content document: XHTML as XML (self-closing tags are common), else as HTML. */
function parseContent(markup, type) {
  if (/xhtml|xml/i.test(type)) {
    const doc = new DOMParser().parseFromString(markup, "application/xhtml+xml");
    if (!doc.getElementsByTagName("parsererror").length && doc.body) return doc;
  }
  return new DOMParser().parseFromString(markup, "text/html");
}

/* ---------- package (OPF) and table of contents ---------- */

async function readPackage(zip) {
  const container = parseXml(await zip.text("META-INF/container.xml"));
  const opfPath = first(container, "rootfile")?.getAttribute("full-path");
  if (!opfPath || !zip.has(opfPath)) throw new Error("EPUB has no package file");
  const opf = parseXml(await zip.text(opfPath));

  const manifest = new Map();
  for (const item of opf.getElementsByTagName("item")) {
    manifest.set(item.getAttribute("id"), {
      id: item.getAttribute("id"),
      path: resolvePath(opfPath, item.getAttribute("href") ?? ""),
      type: item.getAttribute("media-type") ?? "",
      properties: item.getAttribute("properties") ?? "",
    });
  }
  const spine = [...opf.getElementsByTagName("itemref")]
    .map((ref) => manifest.get(ref.getAttribute("idref")))
    .filter(Boolean);

  return {
    opfPath,
    manifest,
    spine,
    tocId: first(opf, "spine")?.getAttribute("toc") ?? null,
    title: collapse(first(opf, "dc:title")?.textContent ?? ""),
    author: collapse(first(opf, "dc:creator")?.textContent ?? ""),
    language: collapse(first(opf, "dc:language")?.textContent ?? ""),
  };
}

/** @returns {{title:string, path:string, fragment:string}[]} */
function readNav(markup, navPath) {
  const doc = new DOMParser().parseFromString(markup, "text/html");
  const nav = [...doc.querySelectorAll("nav")].find((n) => (n.getAttribute("epub:type") ?? "").includes("toc")) ?? doc.querySelector("nav");
  if (!nav) return [];
  return [...nav.querySelectorAll("a[href]")].map((a) => {
    let depth = -1;
    for (let n = a.parentElement; n && n !== nav; n = n.parentElement) if (n.tagName.toUpperCase() === "OL") depth++;
    return {
      title: collapse(a.textContent),
      path: resolvePath(navPath, a.getAttribute("href")),
      fragment: fragmentOf(a.getAttribute("href")),
      depth: Math.max(0, depth),
    };
  });
}

function readNcx(markup, ncxPath) {
  const doc = parseXml(markup);
  return [...doc.getElementsByTagName("navPoint")].map((point) => {
    const src = first(point, "content")?.getAttribute("src") ?? "";
    let depth = 0;
    for (let n = point.parentNode; n; n = n.parentNode) if (n.nodeName === "navPoint") depth++;
    return {
      title: collapse(first(first(point, "navLabel") ?? point, "text")?.textContent ?? ""),
      path: resolvePath(ncxPath, src),
      fragment: fragmentOf(src),
      depth,
    };
  });
}

const BARE_NUMBER = /^(?:[IVXLCDM]+|\d{1,3})\.?$/i;

/**
 * "I. A Scandal in Bohemia" with sub entries "I.", "II.", "III." (the sections of
 * that story): the sections are not chapters of their own, they stay inside.
 */
export function dropNumberedSections(entries) {
  const kept = [];
  entries.forEach((entry, i) => {
    const isSection =
      (entry.depth ?? 0) > 0 &&
      BARE_NUMBER.test(entry.title) &&
      entries.slice(0, i).some((e) => (e.depth ?? 0) < entry.depth && !BARE_NUMBER.test(e.title));
    if (!isSection) kept.push(entry);
  });
  return kept;
}

async function readToc(zip, pkg) {
  const nav = [...pkg.manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const ncx = (pkg.tocId && pkg.manifest.get(pkg.tocId)) || [...pkg.manifest.values()].find((i) => i.type === "application/x-dtbncx+xml");
  const attempts = [];
  if (nav && zip.has(nav.path)) attempts.push(async () => readNav(await zip.text(nav.path), nav.path));
  if (ncx && zip.has(ncx.path)) attempts.push(async () => readNcx(await zip.text(ncx.path), ncx.path));
  for (const attempt of attempts) {
    try {
      const entries = dropNumberedSections((await attempt()).filter((e) => e.path));
      if (entries.length >= 2) return entries;
    } catch (error) {
      console.warn("Story Teller X | could not read the EPUB table of contents", error);
    }
  }
  return [];
}

/* ---------- content blocks ---------- */

/**
 * Walk a document body and produce simple blocks in reading order.
 * @returns {{tag:string, html:string, text:string, ids:string[]}[]}
 */
export function extractBlocks(body, { docPath, zip, includeImages, images }) {
  const blocks = [];
  let pendingIds = [];

  const idsOf = (el) => {
    const ids = [];
    if (el.id) ids.push(el.id);
    if (el.tagName.toUpperCase() === "A" && el.getAttribute("name")) ids.push(el.getAttribute("name"));
    el.querySelectorAll?.("[id],a[name]").forEach((d) => ids.push(d.id || d.getAttribute("name")));
    return ids;
  };

  const inline = (nodes) => {
    let out = "";
    for (const node of nodes) {
      if (node.nodeType === 3) {
        out += escapeHtml(node.data.replace(/\s+/g, " "));
      } else if (node.nodeType === 1) {
        const tag = node.tagName.toUpperCase();
        if (SKIP_TAGS.has(tag)) continue;
        if (tag === "BR") out += "<br>";
        else if (tag === "IMG") out += imageHtml(node);
        else {
          const inner = inline(node.childNodes);
          const lower = tag.toLowerCase();
          out += INLINE_KEEP.has(tag) && inner.trim() ? `<${lower}>${inner}</${lower}>` : inner;
        }
      }
    }
    return out;
  };

  const imageHtml = (img) => {
    if (!includeImages) return "";
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) return "";
    const path = resolvePath(docPath, src);
    if (!zip.has(path)) return "";
    const alt = collapse(img.getAttribute("alt") ?? "");
    // an illuminated initial: the picture of a letter, with the letter as alt text
    if (alt.length > 0 && alt.length <= 2 && /^[\p{L}\u201c\u2018"']+$/u.test(alt)) return escapeHtml(alt);
    images.add(path);
    return `<img src="${IMAGE_SCHEME}${encodeURIComponent(path)}"${alt ? ` alt="${escapeHtml(alt)}"` : ""}>`;
  };

  const emit = (tag, html, text, el, extra = {}) => {
    blocks.push({ tag, html, text, ids: [...pendingIds, ...idsOf(el)], ...extra });
    pendingIds = [];
  };

  const emitInline = (nodes, anchorEl) => {
    let html = inline(nodes).trim();
    const text = collapse(nodes.map((n) => n.textContent).join(""));
    // line breaks alone are spacing, not content
    if (!text && !html.includes("<img")) html = "";
    if (!html) {
      // nothing to show, but its anchors still mark a place in the book
      for (const n of nodes) if (n.nodeType === 1) pendingIds.push(...idsOf(n));
      return;
    }
    emit("P", `<p>${html}</p>`, text, anchorEl);
  };

  const walk = (parent) => {
    let run = [];
    const flush = () => {
      if (run.length) emitInline(run, parent);
      run = [];
    };

    for (const node of parent.childNodes) {
      if (node.nodeType === 3) {
        run.push(node);
        continue;
      }
      if (node.nodeType !== 1) continue;
      const tag = node.tagName.toUpperCase();
      if (SKIP_TAGS.has(tag) || node.matches(BOILERPLATE)) continue;

      if (BLOCK_TAGS.has(tag)) {
        flush();
        block(node, tag);
      } else if (CONTAINER_TAGS.has(tag) && [...node.children].some((c) => BLOCK_TAGS.has(c.tagName.toUpperCase()) || CONTAINER_TAGS.has(c.tagName.toUpperCase()))) {
        flush();
        pendingIds.push(...(node.id ? [node.id] : []));
        walk(node);
      } else {
        run.push(node); // inline content, including images and anchors
      }
    }
    flush();
  };

  const block = (el, tag) => {
    const text = collapse(el.textContent);
    if (tag === "HR") return emit("HR", "<hr>", "", el);
    if (tag === "UL" || tag === "OL") {
      const items = [...el.querySelectorAll(":scope > li")]
        .map((li) => inline(li.childNodes).trim())
        .filter(Boolean);
      if (!items.length) return void pendingIds.push(...idsOf(el));
      const lower = tag.toLowerCase();
      return emit(tag, `<${lower}>${items.map((i) => `<li>${i}</li>`).join("")}</${lower}>`, text, el);
    }
    if (tag === "TABLE") {
      const rows = [...el.querySelectorAll("tr")]
        .map((tr) => [...tr.children].filter((c) => /^(TD|TH)$/.test(c.tagName)).map((c) => `<td>${inline(c.childNodes).trim()}</td>`).join(""))
        .filter((r) => r);
      if (!rows.length) return void pendingIds.push(...idsOf(el));
      return emit("TABLE", `<table>${rows.map((r) => `<tr>${r}</tr>`).join("")}</table>`, text, el);
    }
    if (tag === "PRE") {
      return text ? emit("PRE", `<pre>${escapeHtml(el.textContent.replace(/\n+$/, ""))}</pre>`, text, el) : void pendingIds.push(...idsOf(el));
    }
    if (tag === "BLOCKQUOTE") {
      // a quote that holds paragraphs keeps them
      const innerBlocks = [...el.children].some((c) => BLOCK_TAGS.has(c.tagName.toUpperCase()));
      if (innerBlocks) {
        const saved = blocks.length;
        walk(el);
        for (let i = saved; i < blocks.length; i++) {
          if (blocks[i].tag === "P") blocks[i].html = `<blockquote>${blocks[i].html}</blockquote>`;
        }
        return;
      }
    }
    if (/^H[1-6]$/.test(tag)) {
      // Chapter headings often hold an illustration with its caption. The heading
      // keeps only its own words; picture and caption are kept for the chapter.
      const clone = el.cloneNode(true);
      const captions = [...clone.querySelectorAll(".caption")].map((c) => collapse(c.textContent)).filter(Boolean);
      clone.querySelectorAll(".caption").forEach((c) => c.remove());
      const withImages = inline(clone.childNodes).trim();
      const pictures = withImages.match(/<img [^>]*>/g) ?? [];
      clone.querySelectorAll("img").forEach((i) => i.remove());
      const words = inline(clone.childNodes).trim();
      if (!words && !pictures.length) return void pendingIds.push(...idsOf(el));
      const lower = tag.toLowerCase();
      return emit(tag, `<${lower}>${words}</${lower}>`, collapse(clone.textContent), el, {
        pictures,
        caption: captions.join(" "),
      });
    }
    const inner = inline(el.childNodes).trim();
    if (!inner) return void pendingIds.push(...idsOf(el));
    const lower = tag.toLowerCase();
    emit(tag, `<${lower}>${inner}</${lower}>`, text, el);
  };

  walk(body);
  return blocks;
}

/* ---------- putting it together ---------- */

function cutBoilerplate(blocks) {
  let start = 0;
  let end = blocks.length;
  const START = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i;
  const END = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i;
  const s = blocks.findIndex((b) => START.test(b.text));
  if (s >= 0) start = s + 1;
  const e = blocks.findIndex((b, i) => i >= start && END.test(b.text));
  if (e >= 0) end = e;
  return blocks.slice(start, end);
}

/** Block indexes where chapters start, with the table of contents title. */
function chapterStartsFromToc(blocks, entries) {
  const fileTargets = new Map(); // path -> first entry index
  const fragmentTargets = new Map(); // path#id -> first entry index
  entries.forEach((entry, index) => {
    if (entry.fragment) {
      const key = `${entry.path}#${entry.fragment}`;
      if (!fragmentTargets.has(key)) fragmentTargets.set(key, index);
    } else if (!fileTargets.has(entry.path)) fileTargets.set(entry.path, index);
  });

  const starts = new Map(); // block index -> entry index
  const used = new Set();
  let lastPath = null;
  blocks.forEach((block, i) => {
    const hits = [];
    if (block.path !== lastPath && fileTargets.has(block.path)) hits.push(fileTargets.get(block.path));
    lastPath = block.path;
    for (const id of block.ids) {
      const hit = fragmentTargets.get(`${block.path}#${id}`);
      if (hit !== undefined) hits.push(hit);
    }
    const entry = hits.filter((h) => !used.has(h)).sort((a, b) => a - b)[0];
    if (entry !== undefined) {
      used.add(entry);
      starts.set(i, entry);
    }
  });
  return [...starts.entries()].sort((a, b) => a[0] - b[0]).map(([block, entry]) => ({ block, title: entries[entry].title }));
}

/** Without a table of contents: cut at the top-level heading that appears at least twice. */
function chapterStartsFromHeadings(blocks) {
  for (const tag of ["H1", "H2", "H3"]) {
    const matches = blocks.map((b, i) => [b, i]).filter(([b]) => b.tag === tag && b.text);
    if (matches.length >= 2) return matches.map(([b, i]) => ({ block: i, title: b.text }));
  }
  return [];
}

function buildChapters(blocks, starts, bookTitle) {
  const chapters = [];
  starts.forEach((start, n) => {
    const end = n + 1 < starts.length ? starts[n + 1].block : blocks.length;
    let body = blocks.slice(start.block, end);

    // The real heading is nicer than a table of contents label that picked up
    // a caption or other neighbouring text.
    let name = start.title;
    const labelNorm = normalize(start.title);
    const headingIndex = body.slice(0, 4).findIndex((b, i) => {
      if (!/^H[1-4]$/.test(b.tag) || !b.text) return false;
      const headNorm = normalize(b.text);
      return i <= 1 || (labelNorm && (labelNorm.includes(headNorm) || headNorm.includes(labelNorm)));
    });
    let lead = "";
    if (headingIndex >= 0) {
      const heading = body[headingIndex];
      name = heading.text;
      body = body.filter((_, i) => i !== headingIndex);
      // keep the heading's illustration, it is part of the chapter
      if (heading.pictures?.length) lead += `<p>${heading.pictures.join("")}</p>`;
      if (heading.caption) lead += `<p><em>${escapeHtml(heading.caption)}</em></p>`;
    } else if (body[0] && /^H[1-6]$/.test(body[0].tag) && normalize(body[0].text) === labelNorm) {
      body = body.slice(1); // the page title already says it
    }

    name = tidyTitle(name || `Chapter ${chapters.length + 1}`);
    const html = lead + body.map((b) => b.html).join("");
    const visibleText = html.replace(/<[^>]*>/g, "").trim();
    const nameNorm = normalize(name);
    const bookNorm = normalize(bookTitle);
    // title page leftovers: the book's own title or a part of it ("or, the Modern Prometheus")
    const titlePage =
      nameNorm && bookNorm && (nameNorm === bookNorm || (nameNorm.length > 3 && bookNorm.includes(nameNorm)));
    const empty = !visibleText && !html.includes("<img");
    if (SKIP_TITLE.test(name) || titlePage || empty) return;
    chapters.push({ name, html });
  });
  return chapters;
}

/**
 * @param {import("./zip.mjs").ZipReader} zip
 * @param {{includeImages?: boolean}} [options]
 * @returns {Promise<{title:string, author:string, language:string, chapters:{name:string,html:string}[], images:string[]}>}
 */
export async function parseEpub(zip, { includeImages = true } = {}) {
  const pkg = await readPackage(zip);
  const images = new Set();

  const blocks = [];
  for (const item of pkg.spine) {
    // Note: a manifest id like "pg-header" can be a file that also holds the start of the book
    if (!/x?html/i.test(item.type) || !zip.has(item.path)) continue;
    const doc = parseContent(await zip.text(item.path), item.type);
    const fromDoc = extractBlocks(doc.body, { docPath: item.path, zip, includeImages, images });
    fromDoc.forEach((block) => blocks.push({ ...block, path: item.path }));
  }

  const body = cutBoilerplate(blocks);
  const entries = await readToc(zip, pkg);

  let starts = chapterStartsFromToc(body, entries);
  if (starts.length < 2) starts = chapterStartsFromHeadings(body);
  if (starts.length === 0 && body.length > 0) starts = [{ block: 0, title: pkg.title || "Text" }];

  const chapters = buildChapters(body, starts, pkg.title);
  if (!chapters.length) throw new Error("No readable chapters found in this EPUB");

  // Only images that survived into a chapter need to be stored.
  const used = new Set();
  for (const chapter of chapters) {
    for (const match of chapter.html.matchAll(new RegExp(`${IMAGE_SCHEME}([^"]+)`, "g"))) {
      used.add(decodeURIComponent(match[1]));
    }
  }

  return {
    title: pkg.title,
    author: pkg.author,
    language: pkg.language,
    chapters,
    images: [...used],
  };
}
