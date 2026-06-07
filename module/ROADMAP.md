# Roadmap: StoryTeller X

## Vision
To provide the most immersive, in-world reading experience for Foundry VTT, complete with realistic book visuals, page-turning physics, sounds, and seamless media integration.

## Completed Features
- Custom StorySheet replacing standard Journal Sheets.
- StPageFlip integration for page-turning animation.
- Table of Contents rendering.
- Socket synchronization for GM-directed reading.
- Settings for book size and open sound.

## Planned Features (Short-Term)
- Fix Table of Contents styling (center alignment to avoid cut-off).
- Add "Back to TOC" navigation button on every page.
- Add optional page-turn sound effects between pages.
- Implement split-page rendering for PDFs (so each PDF page acts as a flip book page).

## Planned Features (Long-Term / Backlog)
- [x] **New immersive page controls**: Implemented native StPageFlip curling physics via mouse hover/drag.
- [x] **Themes (including Demonic)**: Implemented a robust CSS theme system with AI-generated Demonic and Fairy Tale book assets.
- [x] **Automatic Page Splitting**: Implemented algorithmic DOM node pagination to prevent vertical scrolling for long HTML text entries.
- [x] **E-Book Importer**: Built a custom Foundry UI hook allowing `.txt` and `.epub` uploads to automatically split into paginated journals.
- [x] **CSS Image Filters**: Added Sepia, Grayscale, and Invert settings to blend images into the old parchment.
