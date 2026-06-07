import { MODULE_ID, SHEET_TYPES } from "../main.mjs";

export function registerHotkeys() {
  console.log("Story Teller 2 Journal | Registering Hotkeys");
  game.keybindings.register(MODULE_ID, "journalPageLeft", {
    name: `${MODULE_ID}.hotkeys.journalPageLeft.name`,
    editable: [{ key: "ArrowLeft" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      if (
        ui.activeWindow &&
        SHEET_TYPES &&
        SHEET_TYPES.includes(ui.activeWindow.constructor.name)
      ) {
        ui.activeWindow.Pager.flipPrev();
      }
    },
  });

  game.keybindings.register(MODULE_ID, "journalPageRight", {
    name: `${MODULE_ID}.hotkeys.journalPageRight.name`,
    editable: [{ key: "ArrowRight" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      if (
        ui.activeWindow &&
        SHEET_TYPES &&
        SHEET_TYPES.includes(ui.activeWindow.constructor.name)
      ) {
        ui.activeWindow.Pager.flipNext();
      }
    },
  });
}
