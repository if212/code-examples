# Playbook: code - a short snippet in the picture

`workflows/route.md` picks the type; each `templates/<type>.d2` fits 800px as it is.
A snippet belongs in a diagram only when the picture adds what a fenced code block
cannot: numbered notes on its lines, the systems it reaches, two versions side by
side, the files one request runs through.

| Type | The reader asks | Holds at 800px |
|---|---|---|
| code-annotated | What do these lines do? | 15 lines, 6 callouts |
| code-calls | What does this code reach, in what order? | 8 lines, 5 calls |
| code-compare | What changed in this code, and why? | 36 characters a side (86 stacked), 8 lines a side |
| code-walkthrough | Which code runs at each step of one request? | 3 cards, 15 lines in all |

Not a code diagram: a listing past 15 lines, a unified diff or a payload dump (a
fenced block in the doc); the logic of a function (flowchart); a payload on a
sequence message (a short label: `POST /orders {sku, qty}`).

## 1. The snippet

- Verbatim from the user or the repo. The brief lists it as `key.src: * {code}`
  and cites where it came from in a comment (`# routes/orders.ts:14-24`). No code
  given and none in the repo: ASK for it (route.md). Never invent code, never
  "fix" it, never rename what the user wrote.
- Cut to the lines that matter; a cut is a line of its own, `// ...` in the
  language's comment. Keep the indentation, expand tabs to 4 spaces (the
  tripwire rejects tabs: every Go snippet), plain ASCII (an accent or an arrow in
  a string: its ASCII twin, said under `Assumed:`).
- Size at 14px: 8.4 px a character, 18.2 px a line. A block is 8.4 x its longest
  line + 14 wide, a card + 24 (and a 28 px title). The 800px column holds 86
  characters a line in one card, 36 a side in a compare. Lines never wrap:
  break a long one in the source (E-code-overflow and W-code-wide name it).
- The block: ``src: |`ts ... `| {class: code}``. The backtick delimiters
  survive `|` and `||` in the code (a bare `|ts` ends at the first pipe).
- The card: ``key: "routes/orders.ts" {class: code-file; src: |`ts ... `| {class: code}}``,
  titled with the path from the repo root (40 characters at most, else
  `.../handlers/orders.go`); a snippet with no file is titled with what it is
  (`POST /orders body`). One block per card. Edges attach to the card (`key`),
  never to `key.src`: ELK cannot see into the card, so the edge crosses it.
- Language tags that highlight: go, python, ts, tsx, js, sql, json, yaml, bash,
  sh, console, hcl, dockerfile, rust, java, kotlin, csharp, cpp, ruby, php,
  graphql, proto, nginx, make, swift, scala, css, html, xml, lua, r, ini; `text`
  for output. Not `md` (renders as prose), `http` (drops the body), `diff`
  (no colours: code-compare), `toml` (colours only numbers).
- Nothing else on a block: 14px (the size math above), no icon, tooltip, `near`
  or fill (d2 ignores most of them). Never a block as an edge label (drawn on
  the line, no background) or a sequence note (sized as prose: the code
  overflows its box).
- d2check paints it (reference/design-system.md section 2): keywords and keys
  teal, literals amber, comments slate, the rest near-black, never bold; a white
  body, the card's title bar slate-50.

## 2. Markers

A marker is a trailing comment that holds only the marker: `// <1>` (TS, JS,
Go, Java, JSON), `# <1>` (Python, YAML, shell, HCL), `-- <1>` (SQL); at the end
of a real comment it works too (`// 401 if bad <2>`). d2check removes it and draws:

| Marker | Draws | Where |
|---|---|---|
| `<1>` ... `<9>` | a numbered badge, in one column after the longest marked line | code-annotated, code-calls |
| `<+>` / `<->` | an added (green) / removed (red) line band | code-compare: `<->` on the before side, `<+>` on the after side |
| `<!>` | a blue band: the line the request asks the reader to look at | only with the brief's focus on that card (S-emphasis), 2 lines at most |

- Numbers run 1..N from the top, once each in the code and once in the callouts
  or the edges that explain them (S-code-marker). The marker counts toward the
  width (7 characters for ` // <1>`).
- A marker the lexer does not read as a comment stays in the code as text
  (S-code-marker names it): languages whose comments cannot trail code
  (Dockerfile, INI) take no markers.

## 3. code-annotated

- The card on top; under it a `callouts` grid with `grid-rows` (half the
  callouts, rounded up) BEFORE `grid-columns: 2`, so they read 1 2 / 3 4.
  Two callouts under 5 lines or fewer: one column (`grid-rows: 2` alone), as
  a row of two they make a strip (W-aspect).
- One `callout` per badge, "N. what the line does, and why": two lines of about
  30 characters (a callout is 264 x 48); a third line: `height: 64` on every
  callout. d2check turns "N." into the badge the code shows.
- 2 to 6 markers on at most 15 lines. More to say: a numbered list under a
  fenced block in the doc.
- No edges and no key: the numbers carry the link.

## 4. code-calls

- The card on top; one row of what it reaches under it, left to right in call
  order: services, stores (`datastore`), topics (`queue`), third parties
  (`external`, which needs its key line).
- A badge on each call line; the edge to what that call reaches is labelled
  "N. verb" with the call's own verb (`4. save` for `orders.save(...)`, never
  `4. INSERT`), `dep` (`async` for a publish, with its key line). The call the
  request highlights: `flow` on its edge, `focal` on its callee (brief focus).
- The card spans the row, so every call drops straight: one width for both,
  n x w + (n - 1) x 20 with callee width w (150 for 4 callees, 130 for 5; a
  queue or a two-line label needs 175), and at least the code's own width
  (widen w to (width - (n - 1) x 20) / n). A cylinder in the row sets the row's
  height (90).
- One callee per call; a call made twice is one badge and one edge. Past 5
  calls or 8 lines: split by phase, or code-annotated.
- The same shape serves a manifest and what it creates (`replicas: 3 # <1>`
  with the edge `1. keeps 3`) and a query and the tables it touches.

## 5. code-compare

- Root `grid-rows: 2` then `grid-columns: 2`: the captions "Before" and "After"
  (`caption`), then the two blocks. The note under them says why it changed, in
  two lines of about 40 characters (`[note; why]`, `why: {height: 66}`,
  `near: bottom-center`).
- One file: bare `code` blocks (the page caption names the file). Two files: a
  `code-file` card on each side, titled with its path.
- One width class for both sides: 8.4 x the longest line of either + 14 (a card
  + 24). Past 36 characters a side, stack them: `grid-columns: 1` alone, cells
  in the order Before, before, After, after (653x374 for 60-character lines).
- Mark what changed and only that: `<->` on the before side, `<+>` on the after
  side. No key: the captions and the diff colours say it.
- A before/after pair shown at full scale is a strip by nature: W-aspect does
  not count it.

## 6. code-walkthrough

- `direction: down`: the caller (`actor`, `compact`), one card per step in call
  order, the store (`datastore`), `dep` edges. Label the first hop (the request)
  and the last (what it does to the store); the code names the hops between
  (`next()`, `repo.find`).
- One `card` width class on every card: the widest code (8.4 x its longest
  line + 24), at least 500, so the spine stays straight and the figure keeps
  a doc shape (0.6 wide per 1 tall). The caller and the store 160 wide (the
  store 106 tall: a two-line cylinder label clears its rims).
- 2 or 3 cards, 15 lines in all (about 860px tall). More steps: code-calls for
  the one function that matters, or split. The parts around the path belong in
  walkthrough.d2.

## 7. Snowflake brand

The same four classes exist in `snowflake-brand.d2`: white body, `#F4FAFD`
title bar, `#BCE3F7` frame; keywords Mid-Blue, literals Purple Moon, comments
gray, badges Mid-Blue; added lines a blue tint, removed First Light, the
highlighted line Valencia Orange. Nodes and edges take their `sf-*` twins
(reference/brand-snowflake.md).
