import { MODULE_ID } from "../main.mjs";
import { promptDialog } from "./compat.mjs";

/**
 * Alignment of the book artwork and the text area, tuned per cover/page combination
 * with the GM "Align book" dialog. Values are CSS variables (see css/book-skins.css),
 * stored in a world setting so every player sees the same layout.
 * "Copy as CSS" outputs a block to bake the final numbers into css/book-skins.css.
 */
const SETTING = "skinAlignment";
const ALL = "*";

/**
 * key = CSS variable (--st-<key>), unitless: 1 = 1% of the book width ("w") or height ("h").
 * Values must match the defaults in css/book-skins.css.
 */
export const ALIGN_FIELDS = [
  { group: "leaves", key: "leaves-top", unit: "h", min: -5, max: 15, step: 0.05, value: 0 },
  { group: "leaves", key: "leaves-bottom", unit: "h", min: -5, max: 20, step: 0.05, value: 4.45 },
  { group: "leaves", key: "leaves-left", unit: "w", min: -5, max: 20, step: 0.05, value: 4 },
  { group: "leaves", key: "leaves-right", unit: "w", min: -5, max: 20, step: 0.05, value: 4 },
  { group: "pad", key: "pad-top", unit: "h", min: 0, max: 15, step: 0.05, value: 1.99 },
  { group: "pad", key: "pad-bottom", unit: "h", min: 0, max: 15, step: 0.05, value: 0.5 },
  { group: "pad", key: "pad-inner", unit: "w", min: 0, max: 20, step: 0.05, value: 4.34 },
  { group: "pad", key: "pad-outer", unit: "w", min: 0, max: 20, step: 0.05, value: 4.34 },
  { group: "header", key: "header-top", unit: "h", min: 0, max: 12, step: 0.05, value: 2.22 },
  { group: "header", key: "header-side", unit: "w", min: 0, max: 20, step: 0.05, value: 4.3 },
  { group: "nav", key: "nav-size", unit: "h", min: 1, max: 10, step: 0.05, value: 3.4 },
  { group: "nav", key: "nav-x", unit: "w", min: -2, max: 10, step: 0.05, value: 0.72 },
  { group: "nav", key: "nav-y", unit: "h", min: -2, max: 10, step: 0.05, value: 1.07 },
  { group: "nav", key: "toc-top", unit: "h", min: -2, max: 10, step: 0.05, value: 1.3 },
  { group: "nav", key: "toc-side", unit: "w", min: -2, max: 10, step: 0.05, value: 1.0 },
  { group: "nav", key: "folio-y", unit: "h", min: -2, max: 10, step: 0.05, value: 1.2 },
];

export function registerAlignmentSetting() {
  game.settings.register(MODULE_ID, SETTING, {
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: () => {
      // re-render open books: padding changes the page splitting
      for (const app of Object.values(ui.windows ?? {})) {
        if (app.element?.[0]?.classList?.contains("story-sheet")) app.render();
      }
    },
  });
}

const skinKey = ({ coverColor, pageColor }) => `${coverColor}/${pageColor}`;

/** Stored overrides for a skin (specific, else the "all skins" set), or {}. */
export function getAlignment(options) {
  const all = game.settings.get(MODULE_ID, SETTING) ?? {};
  return all[skinKey(options)] ?? all[ALL] ?? {};
}

function setVars(element, values) {
  for (const f of ALIGN_FIELDS) {
    if (values[f.key] === undefined || values[f.key] === null) element.style.removeProperty(`--st-${f.key}`);
    else element.style.setProperty(`--st-${f.key}`, `${values[f.key]}`);
  }
}

/** Book width/height in px: 1 unit is 1% of it (resolution independent). */
function setUnits(element) {
  const { offsetWidth: w, offsetHeight: h } = element;
  if (!w || !h) return;
  element.style.setProperty("--st-w", `${w / 100}px`);
  element.style.setProperty("--st-h", `${h / 100}px`);
}

/** Apply the stored alignment of a book to its sheet element. */
export function applyAlignment(element, options, preview = null) {
  setUnits(element);
  setVars(element, preview ?? getAlignment(options));
}

export function alignmentCss(options, values) {
  const sel = `.story-sheet.st-cover-${options.coverColor}.st-page-color-${options.pageColor}`;
  const lines = ALIGN_FIELDS.map((f) => `  --st-${f.key}: ${values[f.key] ?? f.value};`);
  return `${sel} {\n${lines.join("\n")}\n}`;
}

/** Dialog with sliders; changes preview live on the open sheet. */
export async function openAlignmentDialog(sheet, options) {
  const t = (k) => game.i18n.localize(k);
    const stored = getAlignment(options);
  const current = Object.fromEntries(ALIGN_FIELDS.map((f) => [f.key, stored[f.key] ?? f.value]));

  // one collapsible section per group; only the first is open, the dialog scrolls
  const groups = [...new Set(ALIGN_FIELDS.map((f) => f.group))];
  const rows = groups
    .map((group, i) => {
      const fields = ALIGN_FIELDS.filter((f) => f.group === group)
        .map(
          (f) => `<div class="form-group">
      <label>${t(`STORYTELLER.Align.${f.key}`)}</label>
      <div class="form-fields">
        <input type="range" name="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${current[f.key]}">
        <output data-for="${f.key}">${current[f.key]}</output>
      </div></div>`
        )
        .join("");
      return `<details ${i === 0 ? "open" : ""}><summary>${t(`STORYTELLER.Align.group.${group}`)}</summary>
        <p class="hint">${t(`STORYTELLER.Align.group.${group}Hint`)}</p>${fields}</details>`;
    })
    .join("");
  const extra = `<div class="form-group">
      <label>${t("STORYTELLER.Align.allSkins")}</label>
      <div class="form-fields"><input type="checkbox" name="allSkins"></div>
      <p class="hint">${t("STORYTELLER.Align.allSkinsHint")}</p></div>
    <div class="form-group"><div class="form-fields">
      <button type="button" data-action="copy"><i class="fas fa-copy"></i> ${t("STORYTELLER.Align.copyCss")}</button>
      <button type="button" data-action="reset"><i class="fas fa-undo"></i> ${t("STORYTELLER.Align.reset")}</button>
    </div></div>`;

  const read = (root) =>
    Object.fromEntries(
      ALIGN_FIELDS.map((f) => [f.key, Number(root.querySelector(`input[name="${f.key}"]`).value)])
    );

  const result = await promptDialog({
    title: t("STORYTELLER.Align.title"),
    icon: "fas fa-ruler-combined",
    width: 460,
    resizable: true,
    content: `<div class="st-align-dialog">${rows}${extra}</div>`,
    okLabel: t("STORYTELLER.BookOptionsSave"),
    okIcon: "fas fa-save",
    onRender: (root) => {
      let timer;
      const sync = () => {
        const values = read(root);
        for (const f of ALIGN_FIELDS) root.querySelector(`output[data-for="${f.key}"]`).textContent = `${values[f.key]}`;
        sheet._alignPreview = values;
        clearTimeout(timer);
        // the page size is measured when the book renders, so re-layout after the slider rests
        timer = setTimeout(() => {
          sheet._silentRender = true;
          sheet.render();
        }, 250);
      };
      root.addEventListener("input", sync);
      root.querySelector('[data-action="copy"]').addEventListener("click", async () => {
        await navigator.clipboard.writeText(alignmentCss(options, read(root)));
        ui.notifications.info(t("STORYTELLER.Align.copied"));
      });
      root.querySelector('[data-action="reset"]').addEventListener("click", () => {
        for (const f of ALIGN_FIELDS) root.querySelector(`input[name="${f.key}"]`).value = f.value;
        sync();
      });
    },
    callback: (root) => ({
      values: read(root),
      allSkins: root.querySelector('input[name="allSkins"]').checked,
    }),
  });

  sheet._alignPreview = null;
  if (!result) {
    sheet._silentRender = true;
    sheet.render(); // cancelled: drop the preview
    return;
  }
  const all = foundry.utils.deepClone(game.settings.get(MODULE_ID, SETTING) ?? {});
  all[result.allSkins ? ALL : skinKey(options)] = result.values;
  await game.settings.set(MODULE_ID, SETTING, all); // re-renders open books
}
