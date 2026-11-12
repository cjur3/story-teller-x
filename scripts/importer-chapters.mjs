/**
 * Turning imported text into chapters. No Foundry globals, so it can be tested.
 */

export function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const KEYWORD_HEADING =
  /^(chapter|kapitel|chapitre|capítulo|capitolo|part|teil|book|buch|prologue|prolog|epilogue|epilog|preface|foreword|introduction|appendix)\b.{0,70}$/i;
const ROMAN_HEADING = /^[IVXLCDM]{1,8}\.?$/;
const NUMBER_HEADING = /^\d{1,3}\.?$/;

/** Is this one-line block the heading of a chapter? */
export function isChapterHeading(line) {
  const text = line.trim();
  if (!text || text.length > 80) return false;
  return KEYWORD_HEADING.test(text) || ROMAN_HEADING.test(text) || NUMBER_HEADING.test(text);
}

/**
 * Split plain text into chapters. Blocks are separated by blank lines; a block
 * that is a single chapter-like line starts a new chapter. Lines that were
 * wrapped inside a block are joined.
 * @param {string} text
 * @param {string} [fallbackName] name of text before the first heading, or of a
 *        book without any chapter headings
 * @returns {{name:string, paragraphs:string[]}[]}
 */
export function splitTextIntoChapters(text, fallbackName = "Text") {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((l) => l.trim()).filter(Boolean).join(" "))
    .filter(Boolean);

  const chapters = [];
  let current = null;
  for (const block of blocks) {
    const singleLine = !block.includes("\n");
    if (singleLine && isChapterHeading(block)) {
      current = { name: block, paragraphs: [] };
      chapters.push(current);
      continue;
    }
    if (!current) {
      current = { name: fallbackName, paragraphs: [] };
      chapters.push(current);
    }
    current.paragraphs.push(block);
  }
  // a heading without text below it (e.g. a lone "I" before the real heading) is dropped
  return chapters.filter((c) => c.paragraphs.length > 0);
}

/**
 * Project Gutenberg text files wrap the book in license text. Keep only what is
 * between the START and END markers (all of it if there are none).
 */
export function stripGutenbergBoilerplate(text) {
  const start = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i.exec(text);
  let body = start ? text.slice(start.index + start[0].length) : text;
  const end = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i.exec(body);
  if (end) body = body.slice(0, end.index);
  return body;
}
