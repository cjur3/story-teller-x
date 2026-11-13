# Changelog

All notable changes to this module are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2.1.1
- fix: stop reloading story book when switching to a different sheet

## 2.1.0

### Added
- `docs/GUIDE.md`: a plain-language user guide that replaces the need for animated demos.
- `CONTRIBUTING.md`, `CHANGELOG.md`, a PR template and CI checks (changelog, `!important` usage, image licenses).
- Chapter settings: a gear in the table of contents and below the contents icon of every page (for owners) opens a dialog with "Show chapter title" and a page filter. The filter lays the page texture over the chapter's pages with a blend mode (darken, multiply, overlay, ...).
- Importer: choose the sheet type (Story Book or default journal), cover and page color for a Story Book, and the text color. The page color prefills the text color.
- The layout of the book (page area, text padding, title bar, arrows, page numbers) is written in units of the book size, so higher-resolution artwork works unchanged.
- New CC0 book assets (covers and pages in several colors) by yd, see `img/book/LICENSE.md`.

### Changed
- Image pages show no title, no frame, and keep about 10px off the bottom edge; the picture is as large as the page allows, centered, with its aspect ratio kept.
- The loading screen shows a rounded progress bar with a percentage while the chapters are split into pages, and no longer has a background box: text and bar carry a shadow that contrasts with the text color.
- Book settings: choose the cover color (brown, brown with seam, black, blood red, khaki) and page color (beige, white, black), and the text color. Black pages default to bright grey text.
- The release is now built when a tag is pushed, and the release notes come from this changelog.
- The book uses the new cover and page images.

### Fixed
- Any change to a book (its layout or colors, a chapter or its settings, a page edit) rebuilds the whole book, with the loading screen. A reload keeps the reader's page and plays no opening sound.
- A chapter whose title is followed by a picture taller than the rest of the page no longer starts on the next page: the picture shrinks to fit below the title.
- The "Add Chapter" button no longer overlaps the page turn arrows.
- Turning a page no longer clips the page or flashes a scrollbar.
- Releases no longer ship a `module.json` with an unreplaced `#{VERSION}#`.

### Removed
- The unfinished newspaper theme and fullscreen sheet: their styles, the fullscreen sheet and template, and the strings that belonged to them.
- All images without a clear license (old book, parchment, scroll, clean/worn/ragged/pristine and newspaper images). The sheets that used them now use plain CSS backgrounds.
