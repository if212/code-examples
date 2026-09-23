# Export: formats, multi-board output, delivery

Every format comes from the reviewed render. PNG and PDF are made from the
exact SVG that `d2check` wrote. Other formats re-render the `.d2` with
d2check's flags. Produce only the formats the user asked for (SVG by
default). Working files stay in `D2W`. Board syntax (layers, scenarios,
steps): syntax.md. Sizing for docs and slides: layout.md.

`<target>` is the deliverable path without its extension (`docs/checkout-flow`).
`<flags>` is everything between `d2` and the input file on the `re-render:`
line d2check printed: fonts, `--scale 1` and the ELK spacing flags. That line
reproduces the layout only: d2check also adds `text-rendering:
geometricPrecision` to the SVG and sets mode 644, so a deliverable SVG always
comes from d2check itself. Never add `-l`, `-t` or `--pad`, because they
override d2-config. The environment
variables `D2_LAYOUT`, `D2_THEME`, `D2_DARK_THEME`, `D2_PAD`, `D2_SKETCH` and
`D2_CENTER` override it too, `SCALE` changes the output size, and
`D2_WATCH=true` turns every `d2` call into a server that never exits. If
`env | grep -E '^(D2_(LAYOUT|THEME|DARK_THEME|PAD|SKETCH|CENTER|WATCH)|SCALE)='`
prints anything, clear them in the same command as each `d2` call:
`unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE; d2 ...`.

Raw `d2` writes each output as a temporary file that it renames over the
path you give. The old file's mode is lost (the new file is 600), a symlink
is replaced by a plain file, and `d2 in.d2 /dev/null` replaces `/dev/null`
itself when d2 runs as root, even for one board. Never render to
`/dev/null`: a compile check writes a file in `D2W`, as d2check does.

## 1. Choose the format

| Where it goes | Deliver | Section |
|---|---|---|
| README, wiki, docs site; Notion or Confluence if the upload shows SVG | `<target>.svg` | 2 |
| chat, email, Google Docs or Slides, anything that shows no SVG | `<target>.png` (2x) | 3 |
| print, attachment, review copy | `<target>.pdf` (vector) | 4 |
| steps played in a browser or README | `<target>-animated.svg` | 6 |
| steps where SVG is not shown (Slack, email) | `<target>.gif` | 7 |
| PowerPoint | the PNGs for the user's own deck, or `<target>.pptx` | 3, 7 |
| terminal, plain-text docs, code comments | `<target>.txt` | 8 |

## 2. SVG (default)

d2check writes it. The file has an intrinsic width and height
(`--scale 1`), embedded fonts, bundled icons and mode 644. There is nothing
else to run.

| Embed in | Write |
|---|---|
| Markdown | `![Checkout flow](checkout-flow.svg)` |
| HTML | `<img src="checkout-flow.svg" alt="Checkout flow">` (sizing: layout.md, width and embedding) |
| HTML as inline `<svg>` (clickable links and tooltips) | `sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh <target>.d2 <target>-inline.svg -- --no-xml-tag`; add `--salt <name>` after it if a page shows the same diagram twice |

## 3. PNG

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py <target>.svg --out <target>.png --scale 2
```

- Chromium draws the reviewed SVG exactly: the same fonts, icons and white
  canvas.
- At 2x, text stays sharp on high-density screens. To show the PNG at the
  reviewed size, set the SVG's width on it:
  `<img src="checkout-flow.png" width="640">`.
- Exit 0: ship it. Exit 3 means only rsvg-convert worked: the fonts are
  substitutes with no bold or italic, so the labels do not look or fit as
  reviewed. On exit 3 or 1 (no renderer at all), do not ship the PNG:
  deliver the SVG, say why, and name the fix that
  `sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh` prints.
- Text is antialiased in grayscale, so the PNG has no colour fringes.
- For a multi-board source, make one PNG per board SVG (section 5).
- Do not use `d2 <target>.d2 <target>.png`. It needs d2's driver
  (section 7), it re-renders instead of using the reviewed SVG, and for
  boards it deletes `<target>/` first.

## 4. PDF

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py <target>.svg --out <target>.pdf
```

Chromium (Playwright, else a Chrome binary) prints the SVG as one vector page
the size of the SVG. Text stays selectable and sharp at any zoom, and the
fonts are embedded. There is no approximate route: on any non-zero exit
there is no PDF, so deliver the SVG, say why, and name the fix that
`sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh` prints. d2's own `.pdf` is a
screenshot inside a PDF and needs the driver (section 7). For a multi-board
source, make one PDF per board SVG.

## 5. Multi-board sources: layers, scenarios, steps

A source with `layers`, `scenarios` or `steps` renders to a DIRECTORY named
after the output file, never to one file. The usual d2check call
(`sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh --brief D2W/<name>.brief <target>.d2`)
writes `<target>/`:

| Boards in the source | Files written |
|---|---|
| one kind (only steps, only layers or only scenarios) | `<target>/index.svg`, `<target>/<key>.svg` |
| more than one kind | `<target>/index.svg`, `<target>/layers/<key>.svg`, `<target>/steps/<key>.svg`, ... |
| a board with boards of its own | `<target>/<key>/index.svg`, `<target>/<key>/<child>.svg` |

- d2check renders in `D2W`, then copies each board into `<target>/` with
  mode 644. Other files in `<target>/` are kept. It lints and rasterizes
  every board.
- DATA LOSS with raw `d2`: before writing, `d2 <src> X.svg` DELETES the
  directory `X/` and everything in it, so `docs.svg` wipes an existing
  `docs/`. This also happens with `--animate-interval` and with `.png` or
  `.txt` outputs, and an output path with no extension is itself replaced
  by that directory. PDF, PPTX and GIF outputs, one-board `--target`
  renders and failed compiles delete nothing. Point raw `d2` only at the
  names in section 10.
- Board keys become file names (`"Data plane"` gives `Data plane.svg`), so
  keep keys short and kebab-case.
- List everything that was written, and report all of it:
  `find <target> -name '*.svg' | sort`.
- One PNG per board, written next to each board SVG:
  `find <target> -name '*.svg' | while read -r f; do python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py "$f" --out "${f%.svg}.png" --scale 2; done`
- A `link: layers.x` becomes a relative link to that board's file. It is
  clickable only when the SVG file is opened directly, not inside `<img>`.
- One board as one file: copy its reviewed SVG (`index.svg` is the base
  board): `cp <target>/2.svg <target>-step-2.svg`. For a PNG of one board,
  run section 3 on that board's SVG.
- Every board in one file: an animated SVG (section 6).

## 6. Animated SVG

```sh
sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh <target>.d2 <target>-animated.svg -- --animate-interval 2000
```

- This writes one SVG that switches board every 2 s. d2check lints and
  rasterizes its first frame (the base board); review the boards themselves
  with the usual d2check run (section 5). The order is always
  base, then layers, then scenarios, then steps, whatever the order in the
  file. For an animation, keep the source to the base board plus steps.
- It plays in browsers, also inside `<img>` (Markdown images). Give each
  board 1500-3000 ms.
- If every frame looks the same, check how the steps assign classes. When a
  step sets a class list on a node that already has a class, d2 ignores it.
  A single class replaces the node's classes, including a cylinder shape
  that came from a class. Reset the class, then assign the list, and undo
  the previous step's highlight the same way:
  `db.class: null; db.class: [datastore; focal]`.
- Its name must differ from the board directory: a raw `d2` render to
  `<target>.svg` deletes `<target>/` (section 5).

## 7. d2's own PNG, PDF, PPTX and GIF

These d2 exports need Playwright-Go's driver 1.47.2, and its download host is
gone: all three mirrors return 404 (`failed to install Playwright: could not
install driver`).
PNG and PDF have the Chromium routes above. For PPTX or GIF, get the user's
go-ahead, then install the driver from npm (this needs node and npm). The
first export then downloads Chromium 129 once: about 170 MB, 550 MB on disk.

```sh
D="$HOME/.cache/d2-playwright/ms-playwright-go/1.47.2"
mkdir -p "$D" && (cd "$D" && npm pack playwright-core@1.47.2 && tar xzf playwright-core-1.47.2.tgz && ln -sf "$(command -v node)" node)
PLAYWRIGHT_DRIVER_PATH="$HOME/.cache/d2-playwright" d2 <flags> --scale 2 <target>.d2 <target>.pptx
PLAYWRIGHT_DRIVER_PATH="$HOME/.cache/d2-playwright" d2 <flags> --animate-interval 2000 <target>.d2 <target>.gif
```

- Both draw their images at 2x the SVG size. `--scale 2` after `<flags>`
  (the last `--scale` wins) makes them 4x, so slides stay sharp when a
  small diagram is enlarged to fill one.
- PPTX: one slide per board, and each slide is a PNG image, not editable
  shapes. The image is fitted into a 16:9 slide, so a tall diagram becomes
  a narrow strip. Lay slides out with `direction: right` (layout.md).
- GIF: needs `--animate-interval`, even for one board.
- Both formats re-render the source in d2's Chromium. They match the
  reviewed SVG only when you pass the same `<flags>`.

## 8. ASCII text

```sh
d2 --ascii-mode standard --target='' <target>.d2 <target>.txt
```

`standard` draws with plain ASCII (`+ - | < > v`). The default, `extended`,
uses Unicode box drawing. `--target=''` renders only the base board and
works for every source (another board: `--target='steps.2'`). Only small
box-and-arrow graphs come out readable, so `cat` the file before you ship
it:

| In the source | In the text |
|---|---|
| `sql_table`, `class` | empty boxes: no names, no rows |
| `\n` in a label | the text escapes its box and shifts the grid |
| fixed `width` or `height` | labels spill out and boxes overlap |
| a long edge label | overwrites the arrow |
| icons, colors, dashes, opacity, styles | dropped: hidden edges show |
| layers, scenarios, steps, no `--target` | deletes `<target>/`, then fails |

For a readable text version, render a copy in D2W with one-line labels and
no fixed `width` or `height`.

## 9. Watch mode (a live preview for the user)

`d2 -w` never returns, so never run it in the foreground. Start it in the
background with no browser, in one command that also saves its pid:

```sh
nohup d2 -w --browser 0 <flags> <target>.d2 D2W/watch.svg > D2W/watch.log 2>&1 & echo $! > D2W/watch.pid
```

- `grep -m 1 'listening on' D2W/watch.log` prints
  `success: listening on http://127.0.0.1:<port>`: give the user that URL.
  `-p 8080` fixes the port.
- It re-renders whenever the `.d2` file or a file it imports is saved.
- It is only a preview. The deliverable still comes from d2check.
- To stop it: `kill "$(cat D2W/watch.pid)"`.

## 10. Deliver

| What | Name |
|---|---|
| source | `<target>.d2`, with the theme file it imports beside it |
| diagram | `<target>.svg`, or `<target>/` for boards |
| PNG, PDF | `<target>.png`, `<target>.pdf`; per board, beside each board SVG |
| other formats | `<target>-animated.svg`, `<target>.gif`, `<target>.pptx`, `<target>.txt` |

- Name `<target>` after the subject, in lowercase kebab-case
  (`checkout-flow`). Add no version or `final` suffix, so a re-render
  overwrites it in place.
- After any change, re-run d2check and remake every other format you
  deliver: a PNG or PDF made from an older SVG is stale.
- d2check and d2raster.py write mode 644. Raw `d2` writes SVG,
  PNG, GIF, TXT and board files readable by their owner only (mode 600),
  and `cp` keeps the mode; its PDF and PPTX are 644. Run `chmod 644 <file>`
  on each raw `d2` file you deliver, or `chmod -R a+rX <target>/` for a
  board directory, before you hand it over.
- Report every delivered path. For boards, include the `find` list from
  section 5.
