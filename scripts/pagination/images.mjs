/**
 * Images have no height until they are loaded, so a page that is measured
 * before that looks shorter than it will be. Load them first, so that the
 * measuring container finds them in the cache and knows their size.
 */

/**
 * Load every image of `html` and report its natural size.
 * @param {string} html
 * @param {AbortSignal} [signal]
 * @param {number} [timeoutMs]  per image; a broken link must not block the book
 * @returns {Promise<Map<string, {width:number,height:number}>>}
 *   keyed by the `src` attribute exactly as written in the HTML; images that
 *   failed to load are missing from the map
 */
export async function preloadImages(html, signal, timeoutMs = 5000) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sources = [...new Set([...doc.querySelectorAll("img[src]")].map((img) => img.getAttribute("src")))];
  const sizes = new Map();
  await Promise.all(
    sources.map(async (src) => {
      const size = await loadImage(src, signal, timeoutMs);
      if (size) sizes.set(src, size);
    })
  );
  return sizes;
}

function loadImage(src, signal, timeoutMs) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(null);
    const img = new Image();
    const done = () => {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null);
    };
    const timer = setTimeout(done, timeoutMs);
    img.onload = img.onerror = done;
    img.src = new URL(src, document.baseURI).href;
  });
}
