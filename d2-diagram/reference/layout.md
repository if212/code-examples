# Layout: engines, order, placement, grids, spacing, width

How to get clean, balanced, embeddable layouts from d2 v0.7.1. Measured on
real renders: ELK with its default spacing unless noted, `pad: 24`-`32`, 16
px labels, d2's default font (the bundled IBM Plex Sans adds 2-5% width).
Counts over random graphs ("in 20 random graphs") and sizes of small test
graphs are approximate: their fixtures do not ship, so read them as
tendencies; sizes measured on a template or a named case are exact.
Syntax: `${CLAUDE_SKILL_DIR}/reference/syntax.md`. Symptoms: section 10.

## 1. Engine

| Engine | Use for | Behavior |
|---|---|---|
| `elk` (default) | every diagram | orthogonal edges; containers grow to fit their title; routes container-to-child edges; 2-6 s for 30-120 nodes |
| `dagre` | a small tree where curved edges are acceptable | every edge is a cubic curve; container titles sit ABOVE the box and are not fitted (a 338 px title over a 129 px box); a container-to-descendant edge fails to compile |
| `tala` | nothing | not bundled: `D2_LAYOUT "tala" is not bundled` |

- Pin it in the file: `vars: {d2-config: {layout-engine: elk}}` (both themes
  do). CLI `-l`, `-t` and `--pad` override d2-config (syntax.md section 10),
  and so do the `D2_*` env vars (export.md): render the deliverable once and
  inspect that same SVG.
- TALA-only (render errors on dagre and ELK): locked `top`/`left`, `near:
  <object>` (syntax.md section 6). `direction` on a plain container is
  silently ignored; a grid cell's `direction` works (section 7).

## 2. Direction by medium

One `direction` per board, at the root. Approximate sizes (ELK, `pad: 32`):

| Graph | `direction: down` | `direction: right` |
|---|---|---|
| chain of 5 | 227 x 676 | 1015 x 132 |
| 5 ranks, 1-3-3-3-1 nodes | 392 x 696 | 866 x 304 |
| 3 ranks, 6 parallel lanes | 752 x 404 | 506 x 562 |

- Doc, README or wiki column: `down`. Switch to `right` only when the graph
  is much wider than deep (the lanes row); fan-outs stay narrower in `down`
  (1-4-1 nodes: about 500 px `down`, 630 px `right`). A chain too tall for the
  height budget (section 9) becomes a serpentine grid (section 7).
- 16:9 slide: `right` for up to ~5 ranks (aspect 1.6-2.9 with 3-4 nodes in
  the middle ranks). At 6+ ranks `right` becomes a strip (aspect ~3 and up):
  wrap it as a serpentine grid (section 7) or split the board.

## 3. Order, rank and straight paths (ELK)

| Lever | Effect (measured) |
|---|---|
| Declaration order at the root | ELK ranks by the edges and breaks ties by the order nodes AND edges are declared. Siblings of one source: the target of the first-declared edge goes left (`down`) or top (`right`), whatever the node order. Elsewhere node order counts too: in 20 random graphs node order alone changed the layout about half the time, edge order alone more often. Declare both in reading order |
| Declaration order of container children | kept even when it causes a crossing: declare children in the order of the nodes they connect to (1 crossing -> 0, and 140 px shorter, on the architecture template) |
| Label every sibling edge from a node, or none | a labeled edge takes an extra rank (+91 px): label one of two siblings and its target drops a rank (staircase) |
| `upper <- lower: label` for an edge that points against the flow across containers | `->` leaves the source's bottom and loops around the whole diagram into the target's top; `<-` draws the same arrow as a short edge. ELK only: dagre ignores the trick. Within one container or at the root it is unnecessary: a cycle is drawn cleanly anyway (`test -> build: retry`: a short parallel arrow) |
| `sink <- caller: label` for a node whose only edge comes from deep in the diagram | ELK gets the edge reversed, so the sink no longer ranks under everything: it rises beside the upper tiers and its edge runs up. A C4 database written `db <- api` joined the apps' row (610x1034 -> 680x834); a managed Postgres written `pg <- api` left the bottom band of a Kubernetes diagram. The arrow still points at the sink |
| `owner <- attachment: label` for an attachment whose arrow points at its owner (an HPA scales its Deployment) | `deploy <- hpa: scales` ranks the HPA right under its Deployment, beside the ConfigMap and Secret the Deployment reads, not in the tier of the Deployment's siblings; the arrow still points at the Deployment |
| Side branches off a main path | ELK centers a node between its children, so every 2-way fork shifts the main path half a column (the ghost example below, ghosts removed: 121 px drift over 5 nodes). Alternate branch sides (63 px) or add an invisible third child so the main child is the middle one (0 px, costs a 12 px column) |

Back-edge across containers (the consumer sits above its queue):

```d2
vars: {d2-config: {layout-engine: elk; pad: 24}}
classes: {zone: {label.near: top-left; style.font-size: 16}}
services: Services {class: zone; orders: Orders; notify: Notifications}
data: Data {class: zone; kafka: Kafka {shape: queue}}
services.orders -> data.kafka: publishes
services.notify <- data.kafka: consumes
```

A straight main path with invisible balancing children. A ghost is an
empty-labelled node as tall as its rank-mates and 12 px wide (the themes'
`ghost` class: 48 px tall for `compact` rank-mates; set `height: 66` beside
default boxes), and its edge carries the same label as its sibling so both
stay in one rank. Without a `height`, the empty box is taller than its
rank-mates and every rank below drops (+68 px over the two forks here); a
ghost that keeps its key as its label (`g1.class: ghost`, no `""`) does not
fit 12 px and drops them too (+52 px):

```d2
vars: {d2-config: {layout-engine: elk; pad: 24}}
classes: {ghost: {width: 12; height: 66; style.opacity: 0}}
start -> pending
pending -> cancelled: cancel
pending -> paid: pay
pending -> g1: cancel {class: ghost}
paid -> refunded: refund
paid -> shipped: ship
paid -> g2: refund {class: ghost}
shipped -> delivered: deliver
g1: "" {class: ghost}
g2: "" {class: ghost}
```

## 4. Crossings and fan-outs

1. Reorder (section 3): declaration order at the root, child order in
   containers.
2. Move the node whose edges cross into the other container, or out of its
   own (a container is ordered as one block); render both and keep the one
   with fewer crossings. The move changed the count in about three random
   graphs of four; a node left at the root between the containers crossed most.
3. One edge to a group instead of one per member, when the relation holds
   for every member. ELK widens a hub to 40 px per edge and stacks a fan-out
   band that grows 25 px per edge (80 px for 2 edges, 230 px for 8); one edge
   to a container removes both. Wrap the members with `grid-rows`: 8 in one
   row came out wider than the fan-out (about 970 vs 870 px), in 2 rows
   about 650 px.
4. Split the board (layers, steps: syntax.md section 15).

```d2
vars: {d2-config: {layout-engine: elk; pad: 24}}
gw: API gateway
svc: Services {
  label.near: top-left; style.font-size: 16; grid-rows: 2
  orders; billing; search; users; stock; audit
}
gw -> svc: routes
```

## 5. Container titles and icons

In `direction: down`, edges enter a container through its top edge, and that
is where the title sits. Share of 40 random zone diagrams (2-4 stacked
containers, d2check's flags; approximate) where an edge runs through a title:

| Title | Hit |
|---|---|
| ELK default: inside top-center, 28 px | 37/40 |
| `zone` class (top-left, 15 px bold uppercase): one word of up to 8 characters (39-72 px) | 2/40 |
| same, one 9-character word (83-89 px) | 25/40 |
| same, two words on one line (96-128 px) | 36/40 |
| same, two words, one per line (`"Core\nservices"`, 53-76 px) | 4/40 |
| two words on one line, `--elk-padding "[top=50,left=100,bottom=50,right=50]"` | 7/40, 50 px wider |
| `direction: right`, any placement or length (20 diagrams) | 0-1/20 |

ELK puts the first child 50 px inside the box (`--elk-padding` left) and edges
drop into it right under a top-left title. Keep titles `top-left` (the
`zone*`, `boundary` and `sf-container` classes set it) and every title line
under ~75 px: one short word, longer titles wrapped one word per line with
`\n`; else pass the wider padding to d2check (section 8). Less padding brings
the hits back (one-word titles: 17/40 at 30, 23/40 at 20). On dagre titles
float above the box: crossed in 12-20 of 30 diagrams, any placement.

Outside titles (`outside-top-*`, `outside-bottom-*`) leave the box. In
`direction: right` the edges that cross its border turn diagonal (9 of 13 on
the architecture template, `W-diagonal-edge`); in `down` edges stay straight (0 of
33 on four templates), but the title floats in the gap between ranks, loosely
tied to its box. `border-*` titles bent no edge in either direction.

Container icons (20 random zone diagrams, ELK `down`, one-word titles;
approximate):

| Combination | Clean |
|---|---|
| `label.near: top-left` + `icon.near: top-right` | 19/20 |
| icon only (ELK puts the icon top-left, the title top-right) | 18/20 |
| `icon.near: top-left` with the title left at top-center | 2/20 |
| title and icon in the same corner | 0/20: overlap |
| `label.near: outside-top-left` + `icon.near: top-right` | 0/20: the icon sits on the child below it |
| any combination on dagre | 12/20 at best |

```d2
# cwd: ../assets/icons
vars: {d2-config: {layout-engine: elk; pad: 24}}
classes: {zone: {label.near: top-left; icon.near: top-right; style: {font-size: 16; bold: true}}}
client: Client
cloud: AWS {
  class: zone
  icon: ./cloud.svg
  api: API
  db: Orders DB {shape: cylinder}
  api -> db
}
client -> cloud.api
```

## 6. Leaf nodes with an icon

With an icon the label goes to the top and the icon (up to 64 px) to the
vertical center; whether they collide depends on the shape and the layout:

| Laid out by | rectangle, queue, stored_data, page, step, parallelogram, circle | cylinder, hexagon, oval, cloud, diamond, document, package |
|---|---|---|
| ELK (any direction), dagre `right`/`left` (also inside a grid cell laid out that way) | node grows: set nothing | label overlaps or touches the icon on both engines until 140-310 px height: drop the icon (the shape already says what it is) or use a rectangle |
| dagre `down`/`up`, a DIRECT child of a grid (both engines) | overlap: set `height` from the table | same |

`height` for rectangles under dagre `down`/`up` or as direct grid children
(label 3-15 px clear of the icon, descenders included, both engines; 10 px
less leaves 0-9 px):

| Label lines \ font px | 14 | 16 | 18 | 20 | 24 |
|---|---|---|---|---|---|
| 1 | 110 | 120 | 125 | 135 | 165 |
| 2 | 155 | 165 | 175 | 185 | 205 |
| 3 | 185 | 205 | 215 | 230 | 260 |

Icon-left card (`icon.near: center-left`, `label.near: center-center`, fixed
`width`, `height: 56`) on ELK: at `width: 260` one-line labels up to 20
characters clear the icon by 10-47 px, and a two-line label makes the card
98 px tall against 82; at 200, labels of 17+ characters hit the icon, at 160
even 9-character ones; dagre ignores the width (+74 px). So no theme class
has it (`${CLAUDE_SKILL_DIR}/reference/design-system.md` section 7). The
icon-top card (`${CLAUDE_SKILL_DIR}/reference/icons.md` section 5) does not
collide at widths 140-260. With either card, give peers the same line count.

## 7. Grids

Fill order and gaps: syntax.md section 14. Keep items = rows x columns:
`grid-columns: 3` with 7 items stretches 4 of them. A row with fewer items is
left-aligned in a stretched cell (lopsided): give rows equal counts.

Grid edges are drawn as straight lines between cells, not routed:

| Edge | Result |
|---|---|
| container to container, adjacent cells | clean straight arrow |
| skips a cell | runs through the middle cell and its title |
| back-edge between the same two cells | on top of the forward edge; labels overprint |
| node to node across cells | diagonal, unless both ends line up exactly |
| outside node to a grid descendant | a straight line through the titles; the outer `direction` is ignored |
| outside node to the grid container | routed normally |

A labeled edge between cells needs `vertical-gap` / `horizontal-gap` 60+:
the default 40 leaves a few px of arrow around a 20 px label.

Serpentine: each row is a cell with its own `direction`. Equal counts and
equal widths line up the row ends, so the turn edge is vertical:

```d2
vars: {d2-config: {layout-engine: elk; pad: 24}}
classes: {step: {width: 120}; row: {label.near: top-left; style.font-size: 16}}
grid-columns: 1
vertical-gap: 60
s1: Ingest {
  class: row
  direction: right
  a: Parse {class: step}
  b: Validate {class: step}
  c: Enrich {class: step}
  a -> b -> c
}
s2: Serve {
  class: row
  direction: left
  d: Index {class: step}
  e: Cache {class: step}
  f: Publish {class: step}
  d -> e -> f
}
s1.c -> s2.d
```

650 x 432 for 6 steps (the same nodes: 1120 x 111 as a `right` chain, 170 x
766 as `down`). Rows of 3 and 2 steps turn this edge into a 134 px diagonal:
keep counts equal, or turn at the left end (row 1 `direction: left`, read
right to left), where left-aligned rows keep it vertical. A row-to-row edge
(`s1 -> s2`) is straight but ends at the rows' middles and loses the real
endpoint. A root grid has no wrapper box; with outside nodes, wrap the rows in
a container and connect the outside nodes to it.

## 8. Spacing flags (CLI only)

d2check adds `--elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20
--elk-padding "[top=50,left=50,bottom=30,right=50]"` to every ELK render (d2-config
rejects them: render error, `d2 validate` passes); 72 between layers when a
source has a `sql_table` (crow's feet need the room), and bottom=50 when a
container title sits at `bottom-*`. Flags after `--` come later
and win: `sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh in.d2 out.svg -- --elk-padding "[top=50,left=100,bottom=30,right=50]"`.
Its `re-render:` line records the flags and the post step for raw exports
(export.md sections 7-8). The report names the d2check command instead
(SKILL.md step 6): for a layers/steps source the raw line first deletes
`<target>/` and everything in it (export.md section 5), and writes mode 600.

| Flag (default) | Controls | 3-zone diagram, `down` | same, `right` |
|---|---|---|---|
| `--elk-nodeNodeBetweenLayers` (70) | gap between ranks | 40: -60 px height | 40: -60 px width |
| `--elk-edgeNodeBetweenLayers` (40) | edge-to-node gap between ranks | 20: -50 px height | 20: -20 px width |
| `--elk-padding` (`[top=50,left=50,bottom=50,right=50]`; d2check: bottom=30) | container inner padding | 20: -60 w, -147 h | 20: -180 px width |
| `--dagre-nodesep` (60) | gap between siblings | 30: -69 px width | 30: -65 px height |

- The two layer flags took about 140 and 290 px off two 3-zone diagrams
  (`down`; the same width off in `right`); all three ELK flags at 40/20/20:
  about 470 x 1110 -> 410 x 820. `--dagre-edgesep` gained nothing; the gap
  between siblings in one ELK rank is fixed at 20 px.
- Lower `--elk-padding` only when containers have no title; raise its `left`
  value for long titles (section 5).

## 9. Width, height and embedding

- Displayed px = authored px x displayed width / SVG width. `pad` (default
  100 per side) counts: `pad: 24` (both themes set it) saves 152 px.
- Without `--scale 1` a d2 SVG has only a viewBox, and `<img>` (Markdown,
  wiki, HTML) stretches it to the column, UP or down (a 119 px wide diagram
  showed 800 px wide in an 800 px column). d2check renders with `--scale 1`:
  width and height are written, so the image keeps its size and only shrinks.
- At 800 px, 12.6-13.3 px labels read well, 11 px is small, at 8.4 px
  letters merge. Widest SVG for a smallest label: column x font px / 12
  (16 px labels in 800: 1067; 14 px edge labels: 933).

The budget d2check holds at the brief's column (`--column`, 800 by default):

| Check | Doc column (under 1200 px) | Slide column (1200 px and up) |
|---|---|---|
| text | 12 px or more (`W-small-text`), never under 10 (`E-small-text`) | the same |
| height | aim for 1.125x the column (900 at 800); `W-tall` past 1.25x (1000) | `W-tall` past 0.55x (880 at 1600) |
| shape: content width / height | `W-aspect` under 0.6 once the height reaches 0.75x the column, over 2.5 once the width does | under 1.2 once the height reaches 0.3x (480 at 1600), over 3.2 once the width reaches 0.75x |
| dead space | `I-sparse`: an empty square of max(160 px, a quarter of the displayed width); a container whose children fill under half of it with 160 px or more empty | the same |

A 16:9 slide body (about 1700 x 850 px on a 1920 x 1080 slide, 1 pt = 2 px)
shows 16 px labels at 14 pt only when the SVG is at most ~950 px wide: raise
font sizes for wider ones. A picture for both a slide and a doc: 800 px,
landscape (workflows/brief.md section 2).

Compaction, by type (d2 v0.7.1, the bundled font, column 800):

| Type | Lever | Measured |
|---|---|---|
| any spine of one-line boxes | the theme class `compact` (48 px tall, not 66) and one width class for the spine | 18 px less per rank |
| flowchart past 7 ranks | the 2x2 fold: row 1 the build zone and the release boundary (grid cells, each `direction: down`), row 2 a hidden hole and the failure end, `vertical-gap: 80`; one step class `{width: 184; height: 48}`; `-- --elk-padding "[top=44,left=24,bottom=20,right=24]"` (workflows/review-and-fix.md#w-tall) | 10-rank CI/CD: 550x1263 -> 754x657 |
| sequence | d2 fixes the message pitch (about 88 px) and nothing in the source changes it: compact by rows. At most 9 messages and one one-line note (`[note; compact]`: 41 px less), or 7 messages and one two-operand `alt`; prune inferred replies, then notes; split a longer protocol into two diagrams by phase | a default note row costs about 169 px |
| state | the happy path down a spine of `compact` states in one width class, exits in one side column, a `ghost` opposite each 2-way fork (section 3) | order lifecycle: 356x779 -> 395x599 |
| C4 container | `db <- api` (section 3), a `title` node and a key | without title and key: 610x1034 -> 680x834 |
| ERD | the key goes under the diagram (height, not width); d2check sets the layer gap to 72 so crow's feet stay apart | - |
| pipeline | serpentine rows only when each row is one stage; else stage zones stacked `down`, at most 6 ranks | - |
| wide fan-out | one edge to a grid container (section 4) | 8-way fan-out: about 910 -> 670 px wide |

Other levers:

| Lever | Measured |
|---|---|
| `direction: down` | 1-3-3-3-1 nodes: about 870 -> 390 px wide |
| `\n` in long labels / shorter labels | 3 siblings: about 910 -> 540 px wide |
| short edge labels in `right` | one 203 px label: ELK about +160 px; dagre about +600 px (one long label widens every dagre rank gap: 100 -> 263 px beside a 486 px labelled gap) |
| spacing flags (section 8) | about 1190 -> 870 px wide (`right`); 1110 -> 820 px tall (`down`) |
| serpentine grid (section 7) | 6-step chain: 1120 x 111 (`right`) or 170 x 766 (`down`) -> 650 x 432 |
| split the board | layers, steps: syntax.md section 15 |

## 10. Symptom -> lever (layout only)

| Symptom | Lever | Section |
|---|---|---|
| curved edges; layout differs from the inspected one | `layout-engine: elk` in d2-config; no `-l`/`-t`/`--pad` | 1 |
| one sibling sits a rank lower (staircase) | label all sibling edges or none | 3 |
| main path zig-zags | declaration order; alternate branch sides; invisible third child | 3 |
| edge loops around the whole diagram | `upper <- lower` | 3 |
| a node hangs far below its only partner | `sink <- caller` | 3 |
| crossing inside a container | reorder its children | 3 |
| crossing between containers | move the node, one edge to the group, split | 4 |
| tall stepped band under a hub | one edge to a container of the targets | 4 |
| edge through a container title | title `top-left`; lines under ~75 px (`\n`); `--elk-padding` left 100 | 5 |
| edges turn diagonal into a container (`right`) | title `top-left`, not `outside-*` | 5 |
| container icon on its title | title `top-left` + icon `top-right`; no container icons on dagre | 5 |
| icon over a leaf label | ELK; `height` table; icons only on rectangle-like shapes | 6 |
| diagonal or overlapping edge in a grid | adjacent cells only; equal row counts and widths; connect outside nodes to the grid | 7 |
| grid edge label hides the arrow | gap 60+ | 7 |
| lopsided grid row | equal counts | 7 |
| text too small in the column (`W-small-text`, `E-small-text`) | width levers | 9 |
| too tall, a tower or sparse (`W-tall`, `W-aspect`, `I-sparse`) | the compaction table of the type; lift a sink with `sink <- caller`; serpentine grid; split | 3, 7-9 |
| small diagram blown up in a doc | render through d2check (`--scale 1`) | 9 |
