# D2 syntax reference (d2 v0.7.1)

Every d2 code block compiles alone with a real render (`# cwd: <dir>` =
needs the files in that dir). `d2 validate` only parses (section 17).

| Not here | Home |
|---|---|
| engines, direction, grid behavior, spacing, width | `${CLAUDE_SKILL_DIR}/reference/layout.md` |
| palette, theme codes, role classes, dark mode | `${CLAUDE_SKILL_DIR}/reference/design-system.md` |
| recipes per diagram type | `${CLAUDE_SKILL_DIR}/playbooks/<type>.md` |
| icon names, sources, colors | `${CLAUDE_SKILL_DIR}/reference/icons.md` |
| multi-board output, PNG/PDF/GIF | `${CLAUDE_SKILL_DIR}/reference/export.md` |

Contents: 1 keys, labels, quoting - 2 shapes - 3 connections - 4 containers - 5 style
- 6 positions, sizes - 7 classes - 8 vars - 9 globs - 10 imports, d2-config - 11 legend
- 12 sql_table, class - 13 sequence - 14 grid - 15 boards - 16 keywords, case - 17 validate

## 1. Keys, labels, quoting, comments

```d2
# key: label - edges and paths use the key; the label is what renders
api: API Gateway
db: "Orders DB\n(Postgres)"
api -> db: SQL
db.shape: cylinder
```

- Declare labels first, then chain keys only: `a: Parse -> b: Check` is ONE
  node labeled `Parse -> b: Check`.
- `a -> b -> c: next {style.stroke-dash: 3}` gives the label and the map to
  every edge of the chain.
- A second `a -> b` is a SECOND edge. Edit one by index:
  `(a -> b)[0].style.stroke: red`; delete it: `(a -> b)[0]: null`.
  `x: null` deletes x and its edges.
- Keys: snake_case. Quote keys holding `.` or `--`: `v1.2` is `2` inside
  `v1`, `a--b` is an edge.
- `\n` breaks lines in unquoted and double-quoted labels. Single quotes are
  literal (no `\n`, no `${}`; `''` is a quote). Comments: `#` to end of
  line, or a block between two `"""` lines.

| Label contains | Unquoted result | Write |
|---|---|---|
| `#` | comment from `#` on: `C# SDK` renders `C` | `"C# SDK"` |
| `{` | starts a map: `f{x}` = label `f` + child `x` | `"f{x}"` |
| `;` | ends the statement | `"a; b"` |
| `$5`, `[`, `]`, `}` | syntax error | `\$5`, `'$5'`, `"List[Item]"` |
| leading `@` or pipe | import / block string | `"@home"` |
| exactly `null` | deletes the object | `"null"` |

`:` `,` `'` `"` `%` `->` inside a label are fine unquoted (`a: ratio 1:2`).

## 2. Shapes

```d2
user: Customer {shape: person}
topic: Orders topic {shape: queue}
db: Orders DB {shape: cylinder}
user -> topic -> db
```

| shape | use for |
|---|---|
| `rectangle` (default), `square` | services, components, steps |
| `cylinder` / `queue` / `stored_data` | databases / queues, topics, streams / buckets, files |
| `page`, `document` / `package` | file, report, config / library, build artifact |
| `person` (label below) / `c4-person` (label inside) | human actors |
| `cloud` / `hexagon` | internet, SaaS / external system, hub |
| `diamond`, `oval`, `parallelogram`, `circle` | decision, terminal, input/output, state dot |
| `step` / `callout` | pipeline chevron / annotation bubble |
| `text` / `image` | title, caption, no box (6) / icon only, needs `icon:` (icons.md) |
| `sql_table`, `class` / `sequence_diagram` | section 12 / section 13 |

No `note`, `database`, `actor`, `server` or `triangle` shape (render error):
use `page` or `callout`, or a sequence note (13). Markdown `|md ...|` labels
clip words in Chromium and vanish in rsvg, so titles and captions are
`shape: text` with a plain label. Code blocks `|python ...|` render fine.

## 3. Connections and arrowheads

```d2
a -> b: one way
c <- d: head at c
e <-> f: both ends
g -- h: no heads
i -> j: {target-arrowhead: {shape: diamond; style.filled: true}}
k -> l: extends {target-arrowhead: {shape: triangle; style.filled: false}}
m <-> n: {source-arrowhead.label: 1; target-arrowhead.label: "0..*"}
o -> p: pill {style: {fill: "#FEF3C7"; font-color: "#78350F"}}
q -> r: async {style.stroke-dash: 3}
```

| `shape:` | look; effect of `style.filled` |
|---|---|
| `triangle` (default) | solid; `false` = hollow (UML extends) |
| `arrow` | pointier solid triangle; `filled` ignored |
| `diamond`, `circle`, `box` | hollow; `true` = solid |
| `cross` / `none` | X / no head |
| `cf-one`, `cf-one-required` | crow's foot 0..1, exactly 1 |
| `cf-many`, `cf-many-required` | crow's foot 0..N, 1..N |

- A head draws only where the operator has an arrow: `source-arrowhead` needs
  `<-` or `<->`, `target-arrowhead` needs `->` or `<->`, `--` draws none, so
  crow's feet on both ends need `<->`. Arrowhead `label`s show head or not.
- "source" is the FIRST key as written, also in `c <- d`. `c <- d` points at
  c, yet ELK still ranks c first (dagre ranks d first): write back-edges as
  `upstream <- downstream` (layout.md).
- Edge `style.fill` paints a rounded pill behind the label; pair it with
  `font-color` (dark mode: design-system.md). Edge `label.near` does nothing.
  Edge keys: `stroke stroke-width stroke-dash opacity fill animated` (moving
  dashes, browser SVG only) and the label keys `font-color font-size bold
  italic underline text-transform font`; node keys (`shadow`, `3d`) do nothing.

## 4. Containers and paths

```d2
cloud: AWS {
  vpc: VPC {
    api: API
    db: Postgres {shape: cylinder}
    api -> db
    api -> _.s3: uploads
  }
  s3: S3
}
user -> cloud.vpc.api: HTTPS
cloud.vpc.api.label: API server
```

- Any key with children is a container. Add children inside `{}` or by path
  (`cloud.vpc.api`) from anywhere. Keys resolve inside their container:
  `aws: {api -> db}` makes a NEW `aws.db` beside a root `db`; reach out with
  `_` (parent: `_.db`, `_._.x`). An edge to a container ends at its border.
- `direction: up|down|left|right` goes at the root; inside a container ELK
  ignores it (S-src-direction), a grid cell's works: layout.md.

## 5. Style keys and ranges

```d2
svc: Orders {style: {fill: "#F8FAFC"; stroke: "#334155"; border-radius: 8}}
pool: Workers {style.multiple: true}
legacy: Legacy CRM {style: {stroke-dash: 3; opacity: 0.6}}
svc -> pool: {style.stroke-width: 2}
svc -> legacy
```

| key | valid values (anything else fails the render, not validate) |
|---|---|
| `fill`, `stroke`, `font-color` | a color (below); on sql_table/class see 12 |
| `stroke-width` / `stroke-dash` | integer 0-15 / integer 0-10 |
| `border-radius` | integer >= 0; 99 = pill ends |
| `font-size` / `opacity` | integer 8-100 / 0.0-1.0 |
| `bold`, `italic`, `underline` | `true` `false`; defaults: leaf labels bold, container labels regular, edge labels italic |
| `text-transform` | `none` `uppercase` `lowercase` `capitalize` (not `title`) |
| `font` | `mono` only |
| `fill-pattern` | `none` `dots` `lines` `grain` `paper` |
| `shadow`, `multiple` | `true` `false`, any shape; `multiple` = stacked copies |
| `3d` | rectangle, square, hexagon only |
| `double-border` | rectangle, square, circle, oval only |
| `animated` / `filled` | edges / arrowheads (section 3) |

Colors: quoted `"#RGB"` or `"#RRGGBB"` (unquoted `#` is a comment), CSS names
(`red`, `lightsteelblue`, `transparent`), `"linear-gradient(#E0E7FF,
#FFFFFF)"`, `"radial-gradient(...)"`. Render errors: `rgb()` `rgba()`
`hsl()`, 8-digit hex, `none`, non-CSS names (`slate`), theme codes (`N1`:
they belong in theme-overrides, design-system.md).

## 6. Positions and sizes

```d2
# cwd: ../assets/icons
vars: {d2-config: {layout-engine: elk}}
title: Checkout {shape: text; near: top-center; style: {font-size: 24; bold: true}}
zone: Services {label.near: top-left; icon: ./server.svg; icon.near: top-right}
zone.api: API {icon: ./server.svg; label.near: bottom-center}
zone.worker: Worker {width: 160}
start: {shape: circle; width: 16; height: 16; label.near: outside-top-center}
start -> zone.api -> zone.worker
```

`label.near` and `icon.near` take 9 inside values (`top-left` ...
`center-center` ... `bottom-right`), 12 outside values
(`outside-{top,bottom}-{left,center,right}`,
`outside-{left,right}-{top,center,bottom}`) and the same 12 with `border-`
(on the border line). `left-center` or `center`: error.

| element (ELK) | good | avoid |
|---|---|---|
| container label, icon | label `top-left`, icon `top-right` (layout.md section 5) | `outside-*` titles; icon and label in one corner |
| leaf with icon | default (label top) or `label.near: bottom-center` | `icon.near: top-left`: hits the label |
| 16 px dot | `label.near: outside-top-center` (`direction: down`; in `right` put the name on the outgoing edge or leave the dot unlabelled) | default or `outside-right-center`: the edge leaves from the label |

- `near` places a ROOT-level object: `top-left` `top-center` `top-right`
  `center-left` `center-right` `bottom-left` `bottom-center` `bottom-right`
  (no `center-center`); nested objects: error. `near: <object>` and the
  locked positions `top`/`left` are TALA-only (errors on dagre and ELK).
  Edges to a `near` object are unrouted diagonals: never connect them.
- `width`, `height`: integers. A leaf too narrow for its label keeps the width
  and pushes the label below the box. Containers: ELK treats them as a
  minimum (`width: 60; height: 60` around two nodes came out 153 x 302); a
  grid container keeps them exactly, so its cells stick out
  (E-child-outside); dagre refuses to compile. Grid cells stretch children
  (layout.md).

## 7. Classes

```d2
classes: {
  store: {shape: cylinder; style.border-radius: 8}
  focus: {style: {stroke: "#4F46E5"; stroke-width: 3}}
  async: {style.stroke-dash: 3}
  wide: {width: 180}
}
api: API {class: [focus; wide]}
db: Orders DB {class: store}
api -> db: writes {class: async}
```

- A class holds any field (`shape`, `style`, `width`, `label.near`, `icon`)
  and applies to nodes and edges. Names are case-insensitive; a name that
  nothing defines (a typo, the other theme's class) is silently ignored:
  semcheck reports it (`S-src-class`).
- `class: [a; b]`: the LATER class wins a conflict. The object's own map and
  any matching glob (section 9) beat every class, whatever the line order.
  But a class `label` beats the shorthand label (`x: Text {class: c}` shows
  the class label): keep labels out of classes.
- Assigning again (a later line, a steps board): one class REPLACES the classes
  (a cylinder set by the old class becomes a box); a list replaces an earlier
  list, but a list on an object whose class is a single name is IGNORED, and
  nothing warns. Reset first in either case: `db.class: null` then
  `db.class: [datastore; danger]` (semcheck: S-src-class).
- Never name a class `link`: importing a file that defines one crashes d2.

## 8. Vars

```d2
vars: {
  accent: "#4F46E5"
  team: Payments
  c: {warn: "#B45309"}
}
api: ${team} API {style.stroke: ${accent}}
alert: "Alerts: ${team}" {style: {fill: ${c.warn}; font-color: white}}
raw: 'kept literally: ${team}'
api -> alert
```

`${x}` works unquoted and in double quotes, not in single quotes; nested paths
(`${c.warn}`) and vars built from vars work. Vars are scope-wide (use before
declaration is fine); a container's own `vars` shadow outer ones. Undefined
var: render error. Reserved names: `d2-config` (10), `d2-legend` (11).

## 9. Globs

```d2
vars: {d2-config: {layout-engine: elk}}
classes: {store: {shape: cylinder}}
g: Group {a -> b}
db: DB {class: store}
db <- g.b
***.style.border-radius: 8
(** -> **)[*].style.stroke: "#334155"
(** <- **)[*].style.stroke: "#334155"
***: {&class: store; style.fill: "#EEF2FF"}
```

| glob | matches |
|---|---|
| `*` / `x.*` | direct children of this scope / of x |
| `**` / `x.**` | every object at any depth, containers included / inside x |
| `***` | like `**`, also inside layers (scenarios and steps inherit `**` globs) |
| `(** -> **)[*]` | `->` edges at any depth; `(* -> *)[*]` only between this scope's children |

`<-`, `<->` and `--` edges each need their own edge glob. Filters in a glob
map: `&shape: X`, `!&shape: X`, `&leaf: true` (no children), `&leaf: false`
(containers), `&class: X`, `&label: X`.

- At the root write `***`, not `**`: a root `**` also walks into `vars` and
  `classes`. With any d2-config (own or imported: every file here) it fails
  the render (`"style" needs a value`) unless filtered to leaves, and setting
  `class` through it fails (`"class" is not a valid config`) or, filtered to
  leaves, crashes d2. `***`, `x.**` and edge globs are safe.
- A glob beats every class (section 7); between a glob and an object's own
  map the later line wins. Globs in an imported file do not reach this file
  (only `***` does). House style: globs after the imports.
- Globs also hit objects declared later, but a filter tests the object as
  first declared: a filtered glob ABOVE `db: {shape: cylinder}` still matches
  `&shape: rectangle`, and `&leaf: true` matches a container whose children
  come later. Put filtered globs LAST. A shape set by a class is seen as
  `rectangle` by every shape filter: `&shape: rectangle` matches it,
  `!&shape: rectangle` skips it, and `&shape: cylinder` never matches a
  `datastore`. Filter those on `&class`.
- Shape-restricted keys in a broad glob fail the render
  (`***.style.3d: true` with any cylinder present).

## 10. Imports and d2-config

```d2
# cwd: ../templates
...@neutral-theme
vars: {d2-config: {layout-engine: elk; pad: 24}}
api -> db
```

- `...@file` (spread) merges the file's vars, classes, d2-config and objects
  into this board, not its globs (section 9). `x: @file` makes the file the
  contents of object `x`; such a file must not contain `d2-config` (error).
- Paths resolve from the importing file, not the shell cwd; `.d2` suffix
  optional; absolute paths work; `.d2` files only (`@notes.txt` looks for
  `notes.d2`). A missing file is a render error.
- Imported d2-config merges with the file's own, nested maps included; on
  the same key the LATER one wins: import first, override after.
- d2-config keys, only these (others such as `elk-nodeNodeBetweenLayers`,
  `font`, `scale` fail the render): `layout-engine` (`dagre` or `elk`; `tala`
  is not bundled), `theme-id`, `dark-theme-id` (unknown ids fail), `pad`,
  `center`, `sketch`, `theme-overrides`, `dark-theme-overrides` (maps of
  theme codes: design-system.md), `data` (a free-form map for plugins; this
  skill does not use it).
- CLI `-l`, `-t` and `--pad` override d2-config: keep settings in the file and
  render without those flags.

## 11. Legend

```d2
vars: {
  d2-legend: {
    svc: Service
    db: Datastore {shape: cylinder}
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: async event {style.stroke-dash: 3}
  }
}
api -> pg: async event {style.stroke-dash: 3}
pg: Postgres {shape: cylinder}
```

d2 draws a shadowed "Legend" card right of the diagram (`near` and
`position` inside `d2-legend` are ignored): one row per object (shape and
style swatch), one line sample per edge. Edge endpoints are rows too: hide
them with `style.opacity: 0`. d2check's post step restyles the card as the
design system's KEY and moves it under the diagram when the two do not fit
the column side by side. When to add one, with the theme's classes:
design-system.md section 8.

## 12. sql_table and class

```d2
vars: {d2-config: {layout-engine: elk}}
users: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  email: varchar(255) {constraint: unique}
  "label": text
  org_id: uuid {constraint: [foreign_key; nullable]}
}
memberships: {shape: sql_table; user_id: uuid {constraint: [primary_key; foreign_key]}}
users.id <-> memberships.user_id: {
  source-arrowhead.shape: cf-one-required
  target-arrowhead.shape: cf-many
}
```

- Row: `column: type {constraint: ...}`. `primary_key` prints PK,
  `foreign_key` FK, `unique` UNQ, other words verbatim (`nullable`); a list
  prints "PK, FK". Quote a column named like a keyword (16): unquoted
  `label: text` silently becomes the TABLE title.
- `a.col -> b.col`: ELK attaches the edge to the rows, dagre to the table.
- sql_table and class: `style.fill` = header, `style.font-color` = header
  text, `style.stroke` = BODY background (unreadable rows). Use fill and
  font-color only.

```d2
Order: {
  shape: class
  +id: UUID
  -items: "List[Item]"
  "#status": Status
  +add(item Item, qty int): void
}
```

`+` public, `-` private, `"#..."` protected: unquoted `#status` is a comment
and the row vanishes. A key ending in `(...)` is a method; its value is the
return type. Inheritance: hollow `triangle` head (section 3).

## 13. Sequence diagrams

```d2
shape: sequence_diagram
user: User
app: Web App
auth: Auth Server
user -> app: Log in
app.t1 -> auth: POST /token
auth -> app.t1: JWT {style.stroke-dash: 3}
app."Caches token 15 min"
refresh: "alt: token expired" {
  app -> auth: refresh
  auth -> app: 401 {style.stroke-dash: 3}
}
```

- Actor columns follow first appearance: declare every actor first, in
  order, with a label, all one box shape. Messages run down in source order.
- Span (activation bar): a message to or from `actor.<any key>` (`app.t1`).
- Group: a map of messages whose label is the fragment title, so prefix it
  (`alt:`, `loop:`, `opt:`). Keys inside refer to the top-level actors.
- Note: a child of an actor with no edges (`app."text"`), drawn on the
  lifeline. Attach it to the actor, and declare it before the span opens or
  after it closes: one declared between two messages of an open span
  (`app.t1`) is drawn over the activation bar and cuts it, and on the span
  itself (`app.t1."..."`) it covers the bar too. There is no `shape: note`.
- A self-message `app -> app: x` draws a loop whose label straddles its right
  side and can spill past a group: keep it to 1-2 words or use a note.

## 14. Grid basics

```d2
grid-rows: 2
grid-columns: 3
horizontal-gap: 40
vertical-gap: 60
a; b; c; d; e; f
```

The key declared first sets the fill order: `grid-rows` first (or alone)
fills row by row (a b c / d e f); `grid-columns` first (or alone) fills column
by column (a c e / b d f). `grid-gap` sets both gaps (`0` = table look). Works
on the root or any container. Cell stretching, edges between cells, per-cell
`direction`: layout.md.

## 15. Layers, scenarios, steps, links

```d2
api: API {link: layers.internals}
api -> db
layers: {internals: {back: Overview {link: _}; router -> handler}}
scenarios: {outage: {api -> cache: fallback}}
steps: {
  s1: {client -> api: request}
  s2: {api -> queue: enqueue}
}
```

- `layers.x` starts EMPTY; `scenarios.x` starts from the base board; `steps.x`
  from the base plus ALL previous steps. In an inheriting board `x: null`
  removes and `(a -> b)[0].style...` restyles an inherited item.
- `link: layers.x` (or a URL) makes a node clickable in the SVG; `link: _`
  goes to the parent board. `link` and `tooltip` add badge icons: use them
  only for SVG viewed in a browser.
- Boards render to a DIRECTORY (`out/index.svg` plus one SVG per board), not
  one file: export.md.

## 16. Reserved keywords and case

Keywords: `label shape icon style class classes vars link tooltip near width
height top left direction constraint grid-rows grid-columns grid-gap
vertical-gap horizontal-gap layers scenarios steps source-arrowhead
target-arrowhead`, plus every style key (`fill stroke opacity shadow 3d ...`).

| Keyword as a key, column or endpoint | Result |
|---|---|
| `a -> left`, `a -> link` | render error: `reserved keywords are prohibited in edges` |
| `a -> fill`, `a -> opacity`, `a -> classes` | render error: `cannot connect to reserved keyword` |
| `Shape -> b` (a capitalized keyword as an endpoint) | render error: `reserved field "Shape" must have a value` |
| `left: Panel`, `width: X`, `shadow: X`, `Shape: {...}` | render error |
| `label: X`, `link: X`, `icon: X`, `near: X`, `class: X` | compiles as a property: NO node |
| capitalized at the root: `Shape: Circle`, `Label: X`, `Left: Panel` | compiles: NO node, no error |

Fix: rename (`left_panel: Left`) or quote at every use (`"left": Left`,
`a -> "left"`; `d2 fmt` keeps the quotes). Safe keys: `right bottom center
source target start end input output data`.

Case: IDs are case-insensitive (`API` and `api` are one node; unlabeled, it
shows the first spelling). A keyword in capitals is still read as that
keyword, and then dropped: `a.Shape: cylinder`, `a.Label: X` and `{Near:
...}` are silently ignored; `a.style.Fill` and `a.Style.fill` fail.

## 17. validate vs compile

`d2 validate` only parses. The gate is a real compile:
`d2 in.d2 "$tmp/out.svg"` (exit code; a multi-board file writes a directory).

| Mistake | validate | render |
|---|---|---|
| unknown shape, bad color, style value out of range or misspelled key | pass | error |
| `3d`/`double-border` on another shape, container size on dagre | pass | error |
| keyword as edge endpoint, nested or object `near` | pass | error |
| missing import or local icon, undefined `${var}` | pass | error |
| unquoted `$` `[` `}`, unclosed `{` | error | error |
| `#` or `{` in an unquoted label, labels inside a chain | pass | pass: text lost, merged node |
| capitalized keyword (`a.Shape`, root `Label: X`); a class nothing defines | pass | pass: ignored (the class: `S-src-class`) |
| root `**` glob with d2-config or setting `class`; imported class `link` | pass | error or crash |

`d2 fmt` (d2check runs it) rewrites `a -> b {class: c}` as `a -> b: {class: c}`:
re-read the file before scripted edits. `d2 fmt --check` exits 1 if unformatted.
