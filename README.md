This is a Rerelease of the StoryTeller 2 module of jfrazier (https://github.com/jfrazierjr/storyteller2) which was a Rerelease of the original StoryTeller module written by Xbozon (https://github.com/Xbozon/storyteller).

# StoryTeller X for Foundry VTT

A small modification that allows you to present the story in the game as an open book. Inspired by the storyteller from Pathfinder: Kingmaker.

This mod is an update to the original Storyteller mod by Xbozon (https://github.com/Xbozon/storyteller). I have changed some of the functionality to fit my own needs as well as to correct a few bugs.

## How it looks

New here? The [user guide](docs/GUIDE.md) explains the whole module step by step, without technical details.

Each Journal Page can be selected by clicking on the page from the Table of Contents index.

Additionally, you may use the page navigation icons in the lower left or right hand corners as well as utilize the left or right arrow keys on your keyboard (editable via the core keybindings within foundry.)

## How it works

**NOTE** While you certainly CAN add a pdf page, I would not recommend it. It just does not look all that great IMHO. Also, if you add a video, I would suggest NOT setting it to play automatically. As part of creating the pages, ALL pages are loaded at once, so this would play your video every time you open the Journal even it's on a page deep within the book.

1. Click "Create Journal Entry" as you normally would
2. Enter a name for your Journal
3. Edit the sheet type via the Sheet button in the top right corner and select Story Sheet.
4. Add Page(s)

**NOTE**: If you are using Monk's Enhanced Journal, there is extra work required as the Sheet button does not show up automatically!

1. Create a new Journal of type Adventure Book -> Text, Image, PDF, or Video as normal.
2. Right click on the newly created journal in either Monk's Enhanced Journal OR the default Journal nav page.
3. Click "Open Outside Enhanced Browser"

This will open the "default" Journal Entry pages just like what would happen if Monk's Enhanced Journal is NOT installed. From there, select the Sheet type Story Sheet as you would normally. The initial entry created by Monk's Enhanced Journal will NOT be navigable via the Table of Contents page until you add at LEAST one additional page.

You may also convert an existing Journal into a Story Sheet, but keep in mind that the default styling assumes that all pages are flat and at level 1. In fact, when adding a page from the Story Sheet interface, I have removed both the Level and the Do not Show heading buttons on the top right corner of the Editor.

## Settings

There are currently two settings (both are scoped to the client NOT the world):

### 1. The size of the Story on the screen. Defaults to 80%.

### 2. Enable book opening sound.

## Book layout (per book)

GMs get a **Book layout** button in the header of every book. The options are stored with the book, so all players see the same layout.

* **Page numbers** - prints a page number on every page and shows it in the table of contents. The world setting "Page numbers by default" is used for books that were never set.
* **Split long pages automatically** - each journal page is a *chapter*. Long text pages are cut into as many book pages as needed, so nothing needs scrolling. Images are scaled down to fit a page. The table of contents lists the chapters with the page they start on, and continues on more pages if it is long.
* **Chapters start on a right-hand page** - adds a blank page where needed.
* **Headings in the table of contents** - lists the headings (levels 1 to 3) of each chapter below it; click one to turn to its page.
* **Text wraps small images (experimental)** - small images float left and right with the text around them. Images you float yourself in the editor are kept as they are.

### Importing books (Project Gutenberg and other EPUBs)

The **Import text document or e-book** button in the journal directory creates a new book from a `.epub` or `.txt` file. Free books are available at [gutenberg.org](https://www.gutenberg.org): open a book and download the *EPUB* (with images).

* **One journal page per chapter.** For an EPUB the chapters come from the book's table of contents, also when several chapters share one file. Without a table of contents the book is cut at its main headings. Text files are cut at lines like "Chapter 1", "Prologue" or "IV".
* **Clean text.** The Project Gutenberg license and title page are left out; markup is reduced to paragraphs, headings, quotes, lists, tables and basic emphasis.
* **Illustrations** are stored in `worlds/<your world>/story-teller-x/<book>/` (turn off with *Import illustrations*).
* The new book uses the Story Sheet with automatic splitting and page numbers switched on.

No extra library is needed to read EPUB files. Very old or protected (DRM) EPUBs may not import.

## Bugs

Almost certainly there are some. I even know of a few and "hope" to be able to fix them.

## Additional Information

If you used the original version of this mod, you will notice that you cannot drag the pages to turn. Nor can you click the pages to turn. This is on purpose. I might be able to bring this back at some point as an option, but for now its turned off. This issue with both of these is that it made it very hard to click on the edit page icon and the original mod failed to allow use of the Table of Contents as links past four entries.

I also plan to bring single page sheets similar to Storyteller-addon-singlesheet in the future.

### Possible future ideas:

1. Setting for a list of possible font styles and possibly default sizes.
2. Some additional sheets (I have a parchment page that is about half way completed).

## Technical Details

The original mod used a library named turn.js. I had to abandon that since the implementation was completely minimized javascript and it was 12 years old. I then utilized [StPageFlip](https://github.com/Nodlik/StPageFlip/releases) by Nodlik, making a number of changes and incorporating bug fixes from other users plus my own.

## Credits

The book covers and pages in `img/book/` come from the [Spellbook template](https://opengameart.org/content/spellbook-template) by [yd](https://opengameart.org/users/yd) on OpenGameArt, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Thank you, yd! See `img/book/LICENSE.md`.
