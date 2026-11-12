import { MODULE_ID, SHEET_TYPES } from "../main.mjs";

export function registerHotkeys() {
  console.log("Story Teller 2 Journal | Registering Hotkeys");
  game.keybindings.register(MODULE_ID, "journalPageLeft", {
    name: "StoryTellerX.Hotkeys.PreviousPage",
    editable: [{ key: "ArrowLeft" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      if (
        ui.activeWindow &&
        SHEET_TYPES &&
        SHEET_TYPES.includes(ui.activeWindow.constructor.name)
      ) {
        ui.activeWindow.Pager?.flipPrev();
      }
    },
  });

  game.keybindings.register(MODULE_ID, "journalPageRight", {
    name: "StoryTellerX.Hotkeys.NextPage",
    editable: [{ key: "ArrowRight" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      if (
        ui.activeWindow &&
        SHEET_TYPES &&
        SHEET_TYPES.includes(ui.activeWindow.constructor.name)
      ) {
        ui.activeWindow.Pager?.flipNext();
      }
    },
  });
}
