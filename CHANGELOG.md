# Changelog

All notable changes to this module are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `CONTRIBUTING.md`, `CHANGELOG.md`, a PR template and CI checks (changelog, `!important` usage, image licenses).
- Chapter settings: a gear in the table of contents and below the contents icon of every page (for owners) opens a dialog with "Show chapter title" and a page filter. The filter lays the page texture over the chapter's pages with a blend mode (darken, multiply, overlay, ...).
- Importer: choose the sheet type (Story Book or default journal), cover and page color for a Story Book, and the text color. The page color prefills the text color.
- "Align book" dialog (GM): sliders for the page area, text padding, title bar, page turn arrows, contents icon and page number, with live preview, per cover/page combination, and a "Copy as CSS" button. All values scale with the book size, so higher-resolution artwork works unchanged.
- New CC0 book assets (covers and pages in several colors) by yd, see `img/book/LICENSE.md`.

### Changed
- Book settings: choose the cover color (brown, brown with seam, black, blood red, khaki) and page color (beige, white, black), and the text color. Black pages default to blood red text.
- The release is now built when a tag is pushed, and the release notes come from this changelog.
- The book uses the new cover and page images.
- Showcase screenshots moved from `.github/` to `img/git/`.

### Fixed
- A chapter whose title is followed by a picture taller than the rest of the page no longer starts on the next page: the picture shrinks to fit below the title.
- The "Add Chapter" button no longer overlaps the page turn arrows.
- Turning a page no longer clips the page or flashes a scrollbar.
- Releases no longer ship a `module.json` with an unreplaced `#{VERSION}#`.

### Removed
- All images without a clear license (old book, parchment, scroll, clean/worn/ragged/pristine and newspaper images). The sheets that used them now use plain CSS backgrounds.
