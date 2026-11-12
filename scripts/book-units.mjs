/**
 * The layout of the book (page area, padding, title bar, arrows, ...) is written in
 * css/book-skins.css in units of 1% of the book width (--st-w) and height (--st-h), so
 * it scales with the book and with the resolution of the artwork. The sheet sets the
 * two units from its real size.
 */
export function setBookUnits(element) {
  const { offsetWidth: w, offsetHeight: h } = element;
  if (!w || !h) return;
  element.style.setProperty("--st-w", `${w / 100}px`);
  element.style.setProperty("--st-h", `${h / 100}px`);
}
