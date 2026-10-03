import { MODULE_ID } from "./constants.js";

function getActiveStoryPager() {
  const activeWindow = ui.activeWindow;
  if (!activeWindow?.element?.classList?.contains("story-sheet")) return null;
  return activeWindow.Pager ?? null;
}

export function registerHotkeys() {
  console.log("Story Teller 2 Journal | Registering Hotkeys");
  game.keybindings.register(MODULE_ID, "journalPageLeft", {
    name: `${MODULE_ID}.hotkeys.journalPageLeft.name`,
    editable: [{ key: "ArrowLeft" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      getActiveStoryPager()?.flipPrev();
    },
  });

  game.keybindings.register(MODULE_ID, "journalPageRight", {
    name: `${MODULE_ID}.hotkeys.journalPageRight.name`,
    editable: [{ key: "ArrowRight" }],
    restricted: false,
    onDown: () => {},
    onUp: () => {
      getActiveStoryPager()?.flipNext();
    },
  });
}
