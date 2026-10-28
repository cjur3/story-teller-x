export const MODULE_ID = "story-teller-x";

export const STORY_THEMES = Object.freeze({
  book: Object.freeze({
    label: "StoryTeller2.Settings.ThemeBook",
    computerSounds: false,
  }),
  newspaper: Object.freeze({
    label: "StoryTeller2.Settings.ThemeNewspaper",
    computerSounds: false,
  }),
  "captains-log": Object.freeze({
    label: "StoryTeller2.Settings.ThemeShipCaptainsLog",
    computerSounds: false,
  }),
  "starship-captains-log": Object.freeze({
    label: "StoryTeller2.Settings.ThemeStarshipCaptainsLog",
    computerSounds: true,
  }),
});

export const STORY_THEME_IDS = Object.freeze(Object.keys(STORY_THEMES));

export function getStoryThemeChoices() {
  return Object.fromEntries(
    Object.entries(STORY_THEMES).map(([id, theme]) => [id, game.i18n.localize(theme.label)])
  );
}
