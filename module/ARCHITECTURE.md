# StoryTeller X Architecture

## System Design
StoryTeller X is a Foundry VTT module that transforms the native Journal Entries into an interactive, flippable book or stack of parchment pages. It hooks into the core `JournalSheet` rendering and provides custom sheet implementations.

## Tech Stack
- **Foundry VTT API:** Core document types, `JournalSheet` classes, Hooks (`init`, `ready`), and Settings.
- **JavaScript (ES6):** Core logic located in `main.mjs` and the `sheets/` directory.
- **StPageFlip:** A third-party 3D page-flip animation library (`scripts/pageflip/page-flip.module.mjs`) used to animate turning pages.
- **CSS:** Custom CSS utilizing fonts (e.g., Kurale), multiple background images (book covers, pages), and specific CSS classes (`.story-sheet`, `.journal-entry-page`) to override standard Foundry VTT styling.
- **Handlebars:** HTML templates in `templates/` for rendering the custom Journal Sheets.

## Core Patterns
- **Sheet Registration:** The module registers a custom `StorySheet` derived from `JournalSheet`.
- **Page Flipping:** `StPageFlip` requires a specific DOM structure (`.page-num` elements wrapping the content). The module parses Foundry's `JournalEntryPage` data and outputs it in the expected format.
- **Socket Syncing:** When the GM changes a page, a socket event (`module.storyteller2`) is emitted to synchronize the page view across connected clients.
