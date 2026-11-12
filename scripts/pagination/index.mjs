import { splitHtmlToPages } from "./splitter.mjs";

export { splitHtmlToPages } from "./splitter.mjs";
export { measureContentArea } from "./measure.mjs";
export { preloadImages } from "./images.mjs";
export { groupByFit, paginateToc } from "./toc.mjs";
export { fitMedia } from "./fit.mjs";

/**
 * Split `html` into pages for a measured area. Always splits afresh: results
 * depend on fonts, theme and window size, so nothing is cached.
 *
 * @param {string} html
 * @param {Awaited<ReturnType<import("./measure.mjs").measureContentArea>>} area
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<string[]>} the HTML of every page
 */
export async function paginate(html, area, options = {}) {
  const pages = [];
  for await (const page of splitHtmlToPages(html, {
    ...options,
    container: area.container,
    height: area.height,
  })) {
    pages.push(page);
  }
  return pages;
}
