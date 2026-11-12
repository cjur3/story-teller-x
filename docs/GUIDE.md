# StoryTeller X: user guide

StoryTeller X turns a journal into a book that opens on screen: a cover, a table of contents and pages you turn. This guide tells you how to use it, without any technical details.

## Your first book

1. Create a journal entry as usual and give it a name.
2. Open the sheet menu in the top right corner of the journal (the button called *Sheet*) and choose **Story Book**.
3. Add pages. Every page of the journal becomes one **chapter** of the book.

The book opens with a blank page on the left and the table of contents on the right, the way a real book falls open.

*Using Monk's Enhanced Journal?* The sheet button does not show up there. Right-click the journal and choose **Open Outside Enhanced Browser**, then pick the Story Book sheet as above.

## Reading

- **Turn pages** with the arrow icons in the lower corners of a page, or with the left and right arrow keys on the keyboard. (You can change those keys in Foundry's key settings.) Pages cannot be dragged or clicked, on purpose.
- **Jump to a chapter** by clicking its name in the table of contents.
- **Go back to the contents** with the small open-book icon in the top corner of every page.
- The book remembers where each reader stopped and opens there next time.

## The table of contents

The first page lists all chapters, with the page each one starts on. A long list continues on the next page. Players see the chapters they are allowed to see.

If you own the book, there is an **Add Chapter** button at the bottom of the contents page. It asks for a name and a type, and puts the new chapter at the end of the book.

## Chapters

A chapter is a normal journal page, so everything you know from journals works: text, pictures, links.

- **Edit a chapter** with the little feather next to its title.
- **Long chapters** are cut into book pages for you (if you keep *Split long pages automatically* switched on, see below), so nobody needs to scroll. Pictures are shrunk to fit a page.
- **Picture pages** (the journal page type *Image*) show no title. The picture is as large as the page allows and sits in the middle.
- **Video and PDF pages** work, but I would not recommend them. All pages load at once, so a video would start even when its page is deep inside the book.

### Chapter settings

Owners see a small gear next to a chapter's name in the table of contents, and under the open-book icon on each page of the chapter. It opens the chapter settings:

- **Show chapter title** prints the name of the chapter at the top of its first page.
- **Page filter** lays the paper texture over the whole chapter, so text and pictures look as if they were printed on the paper. Try *Darken* or *Multiply* first for a soft, printed look. Others like *Overlay* or *Color burn* are stronger. With *None* the page stays clean.

## Making the book look right

If you are the GM, the header of the book has a **Book layout** button. What you set there is saved with the book, so all players see the same.

**Look**
- **Cover color:** brown, brown with a seam, black, blood red or khaki.
- **Page color:** beige, white or black.
- **Text color:** by default it follows the page color: dark brown on light pages, bright grey on black pages. Untick *Use the default* to pick any color.
- **Font:** the font of the book text.

**Layout**
- **Page numbers** prints a number on every page and shows it in the table of contents.
- **Split long pages automatically** cuts long chapters into book pages.
- **Chapters start on a right-hand page** adds a blank page where needed, like a printed novel.
- **Headings in the table of contents** lists the headings inside each chapter below it. Click one to jump straight there.
- **Hide numbers in the table of contents** keeps the list of chapters clean, without page numbers.
- **Text wraps small images** lets small pictures sit to the left and right with the text flowing around them. This one is experimental.

## Importing a book

Do you want to read a whole novel at the table, or hand out a handout in book form? The **Import text document or e-book** button in the journal directory builds a book from a file.

1. Download an e-book (`.epub`) or a plain text file. Free books are at [gutenberg.org](https://www.gutenberg.org): open a book and take the *EPUB* with images.
2. Press the import button and choose the file.
3. Decide how it should look: whether to include the illustrations, the font, the sheet type, and for a Story Book the cover and page color and the text color. The page color suggests a matching text color.
4. Press **Import**. Every chapter becomes a page of a new journal, and the book opens when it is ready.

Chapters are taken from the book's own table of contents. Licence texts and title pages from Project Gutenberg are left out. Very old or copy-protected e-books may not import.

## Showing the book to your players

Use the **Show Players** button in the header, as with any journal. The players' books open on the page you are on.

## Player settings

Every player can change these in the module settings (they only affect their own screen):

- **Size of the story:** how much of the screen the book takes, from 70% to 100%.
- **Book opening sound** and **page turn sound.**
- **Image filter:** a sepia, grayscale or inverted look for the pictures in the book.

## When something looks odd

- Changed fonts, window size or settings? Close the book and open it again.
- A book does not show the Story Book sheet? Check the *Sheet* menu of the journal.
- Still stuck? Tell us on the [issue tracker](https://github.com/cjur3/story-teller-x/issues).
