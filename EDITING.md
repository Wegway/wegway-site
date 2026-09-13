# Editing wegway.ca yourself

This site is plain HTML/CSS — no build step, no framework. What's in
the file is what ships. Shared styling lives in `style.css`. Most
pages are hand-written HTML; the Work gallery (`index.html` +
`gallery_data.js`) and Writing (`substack.html` +
`writing_posts_data.js`) assemble themselves from data files instead.

Publishing = getting a change onto the `main` branch of
`github.com/Wegway/wegway-site`. GitHub Pages redeploys automatically,
usually within a minute or two of a push.

## The easy way: edit on GitHub directly (no software)

1. Go to `https://github.com/Wegway/wegway-site/blob/main/<file>.html`
   (e.g. `cv.html`).
2. Click the pencil icon (top right of the file view).
3. Edit the text in the browser.
4. Scroll down, click **Commit changes**.

No local files, no GitHub Desktop, no preview. GitHub Pages picks it
up and wegway.ca updates itself. You just don't see the result until
it's live, so it's best for small, low-risk text edits.

## The local way

1. Open the `.html` file in a code editor — not TextEdit, which
   silently mangles quotes/dashes and can break the markup. Free
   options: VS Code, or BBEdit in its free mode. If you must use
   TextEdit, do **Format → Make Plain Text** first.
2. Make your edit, save.
3. Preview: double-click the saved `.html` file to open it in your
   browser. This works for most pages (cv, magazine issues, contact,
   nft). It does *not* work for `index.html` or `substack.html`,
   which load data files and need a local server — run
   `python3 -m http.server 8000` from this folder in Terminal, then
   visit `http://localhost:8000/index.html`.
4. In GitHub Desktop: the change appears in the Changes list, type a
   short summary, click **Commit to main**, then **Push origin**.

## Adding a line to the C.V.

Every C.V. entry is one line, same shape:

```html
<div class="entry-row"><span class="yr">2025</span><span>June 7 – Aug 15, Gallery 1313 Window, 1313 Queen Street West, Toronto, ON</span></div>
```

To add one:

1. Find the right `<h2>` section (Solo exhibitions, Group
   exhibitions, Awards, etc.) in `cv.html`.
2. Copy an existing line in that section and paste it where the new
   one should go — entries display in file order, newest usually at
   the top of each section.
3. Change the year inside `<span class="yr">…</span>` and the
   description inside the second `<span>…</span>`.
4. Leave the `<div>`/`<span>` tags exactly as they are.

Watch for one character: type an ampersand as `&amp;` (e.g.
`Art &amp; Design`). Curly quotes, apostrophes, and en/em dashes
(`–` `—`) can be pasted in normally. For an undated entry, use
`<span class="yr">—</span>`.

To edit an entry, change the text between the tags. To remove one,
delete its whole `<div class="entry-row">…</div>` line.

The same `entry-row` pattern is used on the Magazine pages. Headings
elsewhere are `<h2>Some heading</h2>`; a normal paragraph is
`<p>Some text.</p>`.
