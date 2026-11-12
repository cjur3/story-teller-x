import { MODULE_ID } from "../main.mjs";

/** True when DialogV2 may be used: Foundry has it (V13+) and the user did not switch it off. */
export function useDialogV2() {
  if (!foundry.applications?.api?.DialogV2) return false;
  try {
    return game.settings.get(MODULE_ID, "useDialogV2") !== false;
  } catch {
    return true;
  }
}

export function renderTpl(path, data) {
  const fn = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return fn(path, data);
}

/** Root HTMLElement from a hook/render argument (jQuery on V12, HTMLElement on V13). */
export function toElement(html) {
  return html instanceof HTMLElement ? html : html?.[0] ?? html;
}

/**
 * Show a dialog with one confirm button, on DialogV2 or the legacy Dialog.
 * `callback(root)` receives the dialog's root element (and for V2 the form via root.querySelector("form")).
 * Resolves to the callback's return value, or null if closed/cancelled.
 */
export function promptDialog({ title, icon, content, width = 500, okLabel, okIcon, resizable = false, callback, onRender }) {
  if (useDialogV2()) {
    return foundry.applications.api.DialogV2.prompt({
      window: { title, icon, resizable },
      position: { width },
      content,
      rejectClose: false,
      ok: {
        label: okLabel,
        icon: okIcon,
        callback: (event, button, dialog) => callback(dialog.element ?? button.closest(".application")),
      },
      render: (event, dialog) => onRender?.((dialog ?? event.target).element),
    });
  }

  return new Promise((resolve) => {
    let root = null;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    new Dialog(
      {
        title,
        content: `<form>${content}</form>`,
        buttons: {
          ok: {
            icon: `<i class="${okIcon}"></i>`,
            label: okLabel,
            callback: async (html) => {
              const el = toElement(html);
              finish(await callback(el?.closest?.(".app") ?? root ?? el));
            },
          },
        },
        default: "ok",
        render: (html) => {
          root = toElement(html).closest?.(".app") ?? toElement(html);
          onRender?.(root);
        },
        close: () => finish(null),
      },
      { width, resizable }
    ).render(true);
  });
}
