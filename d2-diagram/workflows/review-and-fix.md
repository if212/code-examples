# Review and fix: the rubric, one recipe per finding code, compile errors

d2check lists each finding as `<CODE> xN -> workflows/review-and-fix.md#<code>`,
then one line per instance; `[n]` is its numbered box on `<name>.ann.png`
(lint and node-level S- findings; a finding about the whole diagram or an
edge's meaning has no box). Look a code up with Grep: pattern `^### W-fanout`,
`-A 10`. E- (geometry) and S- (meaning) are errors: fix them all, independent
ones in one cycle. W- are warnings: fix them in polish cycles, in rubric order.
I- is information. Every `Fix:` below was proven on d2 v0.7.1 by a
before/after pair: the code fires on the first file and is gone after the fix.

## Rubric: judge `<name>.col.png`, in this order

| # | Check | Fails when |
|---|---|---|
| 1 | Legible at its width | any E-/W-small-text; text you have to squint at in col.png; W-tall, W-aspect |
| 2 | Accurate | any S- error; an edge on the wrong node, reversed, or in the wrong group; a label that differs from the brief |
| 3 | Clean routing | an edge through a node, label or title; crossings; diagonal or curved edges; labels on bends or borders |
| 4 | One reading direction | the flow doubles back against `direction`; the main path zig-zags (W-long-edge, W-edge-jog) |
| 5 | Focus findable | you cannot point at the brief's focus within a second; a second blue thing competes (S-emphasis) |
| 6 | No clutter | labels repeat group names or restate the obvious; decorative colour; dead space (I-sparse) |
| 7 | Consistent | mixed icon families; uneven tiers (W-sibling-size); un-classed nodes; one-off styles |

Stop when d2check exits 0 and all 7 pass. Anything left goes to the report's
`Open:` line with the reason.

## Legibility

### E-small-text
Seen: text displays under 10px in the column; the canvas is wider than the
column and shrinks (`display:` shows scale < 1).
Fix: make the canvas narrower, not the font bigger: `direction: down` (tiers
side by side instead of ranks in a row), wrap labels near 22 characters with
`\n` (`"Order management\nservice"`). Past about 15 nodes, split into `steps`
boards (playbooks/change.md section 3). Sequence: playbooks/sequence.md rule 8.

### W-small-text
Seen: text displays at 10-12px. At scale < 1 it is the E-small-text case,
milder; at scale 1.00 a `style.font-size` under 12 was set.
Fix: at scale < 1 apply the E-small-text levers; at scale 1.00 delete the
font-size override (the theme sets 14-16px).

### W-tall
Seen: the displayed height passes 1.6x the column (1280px at 800): a long
single column of steps.
Fix: fold the chain into a serpentine grid: `grid-columns: 1` at the root, one
zone per stage with its own `direction: right` / `left`, equal step counts
and one width per step (class `{width: 130}`), turn edges node to node
(reference/layout.md section 7). Or split into `steps` boards.

### W-aspect
Seen: wide content shrinks in the column (ratio over 2.5), or a narrow tower
taller than the column is wide (ratio under 0.4).
Fix: wide: the E-small-text levers. Tall and narrow: the W-tall serpentine,
three rows of three instead of one column of nine.

### E-contrast
Seen: a label below 3:1 against its fill: a raw `style.fill` or
`style.font-color` next to the theme's colours.
Fix: delete the raw colours and use role classes; for a strong fill use
`focal-solid` (white bold text on blue).

### E-contrast-dark
Seen: `[dark mode]` contrast failure: `dark-theme-id` (or `D2_DARK_THEME`) adds
a dark mode, raw fills stay light while default text turns light.
Fix: remove `dark-theme-id` (the design system is light-only: the SVG shows
as a light card on any page) and turn raw fills into role classes. Opt-in
dark mode: reference/design-system.md section 9.

### W-non-ascii
Seen: a label holds a non-ASCII character (arrow, accent, dash, emoji); the
tripwire also names the `.d2` line.
Fix: plain ASCII equivalents (`->`, `e`, `-`); markers come from icons or a
class, never emoji.

## Collisions

### E-label-overlap
Seen: two labels print over each other: two branch labels share one short
run, or two objects share a `near` position.
Fix: wrap each branch label with `\n` so both fit between the edges
(`"payment\nreceived"`); for `near` objects see E-node-overlap.

### E-edge-label-on-node
Seen: an edge label sits on a node: almost always a grid edge that skips a
cell, its label landing on the cell in between.
Fix: the E-edge-through-node fix (no grid for connected nodes).

### E-icon-collision
Seen: an icon touches its label, or a neighbour. The message says which case:
`set height: N` (a grid cell or fixed height) or `icons collide on this shape`.
Fix: icons go on rectangles only: move the icon to a `service` box or drop it.
In a grid, give every cell the height the message prints, once, through a
class (`classes: {cell: {height: 165}}`, `class: [service; cell]`).

### E-label-overflow
Seen: the label spills out of its box, or is pushed outside a fixed box:
`width`/`height` smaller than the text (d2 never grows a fixed box).
Fix: delete the fixed size and wrap the label with `\n`.

### E-node-overlap
Seen: two nodes drawn on top of each other: two objects on the same `near`
constant (the second hides the first).
Fix: one object per `near` position: merge the two notes into one
(`"Writes are idempotent.\nReads go to a replica."`); `top-center` or
`bottom-center` add height instead of an empty side column.

### E-child-outside
Seen: a node sticks out of its container: a fixed `width`/`height` on the
container (often a grid) smaller than its children.
Fix: delete the container's fixed size; the grid sizes itself.

### E-off-canvas
Seen: a node or label crosses the SVG edge and is clipped. d2 0.7.1 sizes the
canvas to fit everything it draws, so this points at an SVG edited or
post-processed after the render. No source change is known to cause it:
re-render through d2check and never hand-edit the SVG.

## Routing

### E-edge-through-node
Seen: an edge runs through a node. In a grid, edges are straight lines between
cells, so one that skips a cell crosses the cell in between (with
E-edge-label-on-node and W-edge-through-container).
Fix: no grid for connected nodes: drop `grid-*`, set `direction: right` (or
down) and let ELK route around. Keep grids for tiles and serpentine rows,
edges only between neighbouring cells.

### E-edge-through-label
Seen: an edge is drawn across a label, usually a container title: d2's centred
title (container without a zone class), or a long one-line `zone` title that
reaches the middle of the box where the edge enters.
Fix: give the container its zone class (title top-left); wrap a long title
so each line stays under about 75px: `"Shop\nplatform\nservices"`. A line that
cannot wrap (a CIDR): widen the first child, since its edge enters 50px plus
half its width from the zone's left edge (136px cleared `10.40.11.0/24`;
subnets: playbooks/infrastructure.md rule 2).

### W-edge-through-container
Seen: an edge cuts through a container that holds neither of its ends: a grid
edge skipping a cell (see E-edge-through-node).
Fix: the E-edge-through-node fix.

### W-edge-crossing
Seen: two edges cross. Container children keep their declaration order, so a
target declared on the wrong side of its sibling forces a crossing.
Fix: declare each container's children in the order of the nodes they connect
to (orders under web, billing under mobile) and the main path first.

### W-edge-overlap
Seen: two edges run on top of each other: bypass edges in a one-row grid.
Fix: no grid: `direction: right` and ELK routes each bypass on its own track.

### W-edge-label-on-border
Seen: an edge label straddles a container border: a labelled edge that crosses
nested borders puts its midpoint label on one of them.
Fix: move the fact into a node label (`"orders-api :8080\n3 pods"`) and leave
edges that cross borders bare.

### W-diagonal-edge
Seen: an edge runs diagonally or visibly leans: in a grid, a node-to-node
edge whose ends sit in different rows and columns.
Fix: declare the cells so every edge joins neighbours in one row or one
column (row 1: web, cache; row 2: api, db). Gitflow cut and merge lines are
diagonal by design: leave them (playbooks/change.md section 6).

### W-curved-edge
Seen: curved spline edges: dagre drew them, because the file pins no engine
or `-l dagre` was passed.
Fix: `...@neutral-theme` on line 1 (it pins ELK); never pass `-l` or `-t`.
An edited file that keeps its own look: `vars: {d2-config: {layout-engine:
elk}}` instead of the import.

### W-long-edge
Seen: one edge runs far longer than the rest. Two cases, named in the message:
`back-edge detour` (an edge against the reading direction loops around the
diagram) or `hangs off this one edge` (a node placed far from its only
partner).
Fix: back-edge: write it `consumer <- broker` (`services.notify <-
data.events`); ELK keeps the rank order and draws a short hop. Hanging node:
declare it in the same zone as the node it connects to, when it belongs there
(brief key `zone.node`). If the brief puts it outside, keep it there: the
long edge is the honest shape; list it under Open.

### W-fanout
Seen: one node sends 4+ edges into children of one container; ELK draws a
stair-stepped comb (or fan-in).
Fix: one edge to the container, labelled with what the edges share
(`gateway -> services: routes /auth /cart /orders`). Keep one edge per child in
the brief: semcheck accepts a container edge that covers every child.

### W-edge-jog
Seen: a small kink (under 16px between two bends): siblings of different
widths have centres a few px apart, or a back-edge written `->`.
Fix: one width for the tier through a class (`classes: {tier: {width: 170}}`,
`class: [state; tier]`); a back-edge becomes `upper <- lower`.

### W-label-on-bend
Seen: an edge label sits on an elbow: ELK centres a node between its two
targets, so both edges step sideways and the midpoint label lands on a bend.
Fix: shorten the label to the event (`checks pass`, not `health checks
pass`); it then fits the straight run between the bends. Or add an invisible
third target and declare the three edges so the main one comes second: the
main target is then the middle one, straight below the source
(reference/layout.md section 3): `classes: {ghost: {style.opacity: 0}}`,
`ghost: "" {class: ghost; width: 120}`, `pending -> ghost: {class: ghost}`.
It costs a column and other edges can still pull the layout: keep it only if
col.png reads better.

### W-short-label
Seen: an edge label of 1-2 characters (`/`, `x`) that says nothing at reading
size (real words such as `no`, `ok` and multiplicities are exempt).
Fix: say it in words, or move the fact into the target's label
(`"Web service\npath /"`) and leave the edges bare (every edge of a kind, or
none).

## Consistency and layout balance

### W-title-size
Seen: container titles outshout the node labels: a container without a zone
class keeps d2's 28px title.
Fix: `class: zone` (or `zone-*`, `boundary`): 15px bold uppercase, top-left.

### W-unclassed
Seen: a node or container carries no role class while most of its peers do;
it keeps d2's default look (lavender, 2px).
Fix: add its role class (`queue` for a topic). Tables and UML classes take
none: they are styled by the template's globs (playbooks/erd.md rule 4).

### W-sibling-size
Seen: siblings in one row have different heights (`66/82`): one label wraps
to two lines.
Fix: give the row the larger height through one class
(`classes: {tier: {height: 82}}`, `class: [service; tier]`).

### W-seq-group-ragged
Seen: sequence groups start and end at different x: each group is as wide as
the lifelines its messages touch.
Fix: drop phase groups; number the messages (`"1. open app"`) and name the
phases in the text around the diagram; keep groups for `alt`, `loop`, `opt`
(playbooks/sequence.md rule 5).

### W-remote-image
Seen: an icon stayed a URL (rendered with `--bundle=false`): it does not load
when the SVG is shown through `<img>` (README, docs).
Fix: a local icon file (workflows/icons.md) and no `--bundle=false`: d2
embeds it.

### I-sparse
Seen: a large empty square in the column view (information): a narrow box
centred over a wide tier leaves a corner empty.
Fix: draw the entry point as wide as the tier it feeds (`width: 560` on the
gateway, playbooks/architecture.md rule 7). Keep the info when the gap is the
honest shape of the graph.

## Meaning: the diagram against the brief (semcheck)

### S-missing-node
Seen: a node of the brief is not drawn (error), or (INFO) the request names a
term that no brief label, key or `out:` entry covers.
Fix: draw it with the brief's key (and its edges); a node hidden with
`style.opacity: 0` is not drawn. A hidden grid slot is fine: list the node in it (`t1.x`).
INFO: add the term to the brief, or to `out:` when it is left out on purpose.

### S-extra-node
Seen: a node that is not in the brief: often a typo in an edge end
(`api -> event`), which silently creates a node.
Fix: use the brief's exact keys in every edge; a real addition goes into the
brief, `{inferred}` if the user did not ask for it.

### S-wrong-parent
Seen: a brief node is drawn inside another container: a key declared or used
inside a container block creates a new node there (`vpc.db`).
Fix: declare the node where the brief puts it and write edges that leave a
container at the root with full paths (`vpc.api -> db`).

### S-missing-edge
Seen: an edge of the brief is not drawn.
Fix: draw it between the brief's keys.

### S-extra-edge
Seen: an edge the brief does not have.
Fix: delete it; if the user wants it, add it to the brief first.

### S-misrouted-edge
Seen: an edge drawn to a container stands in for an edge to a node inside
it (it meets the container's middle), or one end is a typo.
Fix: connect the real nodes by full path (`src.app -> ingest.fivetran`).

### S-reversed-edge
Seen: the edge points the other way than the brief.
Fix: swap its ends; to keep the layout rank, write `target <- source`.

### S-edge-kind
Seen: drawn with a different operator than the brief (`--`, `->`, `<->`).
Fix: use the brief's operator; ERD relationships use `<->` so both crow's
feet show.

### S-duplicate-edge
Seen: the same edge statement written twice draws two parallel edges.
Fix: write each edge once.

### S-node-label
Seen: a node's text differs from the brief (drifted wording, or a label cut
by an unquoted `#`).
Fix: use the brief's label, in the user's words; quote labels holding `#`.

### S-node-label-case
Seen: the label differs from the brief only in case.
Fix: keep the brief's case (zone titles may render upper-case: that passes).

### S-edge-label
Seen: an edge label differs from the brief (drifted, or cut by `#` or `;`).
Fix: use the brief's label; quote labels holding `#` or `;`.

### S-edge-style
Seen: the brief marks the edge dashed (async, optional) and it is solid, or
the reverse.
Fix: the role class that draws it: `async` (dashed) or `dep`/`flow` (solid).

### S-duplicate-label
Seen: two different nodes show the same text, so they read as one thing (the
same part in both panels of `type: compare` is not flagged).
Fix: give each node its own brief label (or merge them if they are one).

### S-missing-column
Seen: a table or class lacks a column or field the brief lists (`cols:`,
`fields:`).
Fix: add the column or field.

### S-erd-anchor
Seen: a relationship meets the table's middle instead of its FK row: the
diagram was laid out with dagre.
Fix: no `-l` flag: the theme's ELK anchors each end at its column row.

### S-erd-cardinality
Seen: a crow's foot is missing or wrong: `->` drops the source head, or a
nullable FK shows `cf-one-required` ("exactly one").
Fix: `parent.id <-> child.fk` with both heads set: `cf-one` at the parent for a
nullable FK, `cf-one-required` for NOT NULL (playbooks/erd.md rules 1-2).

### S-arrowhead
Seen: an arrowhead differs from the brief (`src:`/`dst:`), e.g. a hollow
diamond where the brief says composition.
Fix: set that end's head: `source-arrowhead: {shape: diamond; style.filled:
true}` (filled = composition, hollow triangle = inheritance/realization).

### S-seq-order
Seen: a message is drawn above one that comes earlier.
Fix: declare messages in time order: declaration order is drawing order.

### S-seq-return
Seen: a reply is drawn solid, so it reads as a new request.
Fix: replies take `class: secondary` (dotted); error replies `failure`.

### S-seq-group
Seen: a message the brief puts in a group (`in: g`) is drawn outside it.
Fix: declare the message inside that group's block.

### S-seq-group-actor
Seen: a group turned into a participant: a key used inside the group was
never declared (often a typo).
Fix: declare every participant at the top; inside a group use their exact
keys only.

### S-seq-actor-order
Seen: participant columns are not in brief order.
Fix: declare all participants first, in reading order (declaration order is
column order).

### S-state-start
Seen: the state machine's initial state is not a bare dot (it shows text or a
box), or the brief marks no single `{start}`.
Fix: `start: "" {class: dot}` and exactly one `{start}` in the brief.

### S-unreachable
Seen: a state or step cannot be reached from the start: a transition is
missing (or points elsewhere).
Fix: draw the missing transition from the brief.

### S-end-has-exit
Seen: an edge leaves a node the brief marks `{end}`.
Fix: remove the edge; if the flow really continues, it is not an end (new
state or new outcome in the brief).

### S-decision
Seen: a decision has fewer than 2 exits, or unlabelled branches.
Fix: label every branch (`yes` / `no`, or the condition).

### S-dead-end
Seen: a flowchart step has no outgoing edge and is not marked `{end}`.
Fix: finish the path with an explicit outcome (a `terminal`, `{end}` in the
brief), or draw the missing edge.

### S-emphasis
Seen: the focus does not stand out: the focus node lacks `focal` (or
`sf-primary`), a class after `focal` repaints it, a focused group is not
`zone-blue`, main-path edges lack `flow`, or a second node is focal. INFO: the
brief has no `focus:` line.
Fix: end the focus node's class list with the modifier (`[service; focal]`,
see Last class wins); a focused group takes `zone-blue` (Snowflake: see
Snowflake has no focus group); main-path edges `flow`; one focal per diagram.

### S-inferred
Seen: information: brief items marked `{inferred}`, not stated by the user.
Fix: list them under `Assumed:` in the report. When the user confirms one,
drop its `{inferred}` from the brief.

### S-src-hash
Seen: an unquoted `#` starts a comment: `sdk: C# SDK {class: actor}` renders
`C` and loses its class. d2check formats first and d2 fmt rewrites the line
to `C # SDK`, so in the loop the slip usually shows as S-node-label or
S-edge-label.
Fix: quote the value: `sdk: "C# SDK" {class: actor}`; quote hex colours too.

### S-src-semicolon
Seen: an unquoted `;` ends the statement: `api -> db: read; write` draws the
label `read` and a node `write` (after d2 fmt: S-extra-node plus
S-edge-label).
Fix: quote the label: `api -> db: "read, write"`.

### S-src-icon-family
Seen: icons from more than one family (lucide line icons next to a logos
brand icon).
Fix: one family per diagram (lucide by default, workflows/icons.md); the
product name stays in the label.

### S-src-cli-engine
Seen: the file pins no layout engine (no theme import, no `layout-engine`), so
d2 falls back to dagre: curved edges (W-curved-edge).
Fix: `...@neutral-theme` as line 1: ELK, `pad: 24` and the role classes. An
edited file that keeps its own look (no restyle asked): `vars: {d2-config:
{layout-engine: elk}}`, and say so under Assumed.

### S-src-class
Seen: a class that no theme or local `classes:` block defines: d2 compiles it
silently and draws a default box. The message says which case it is.
Fix: by the message. `did you mean 'datastore'?`: use that name (the theme's
classes: reference/design-system.md section 2). `a neutral-theme class; this
file uses snowflake-brand`: write the twin it names (`focal` -> `sf-primary`,
and back). `put ...@neutral-theme on line 1`: add the import and copy the
theme next to the file. `one name, not a list`: `class: [service; focal]`.
`the row vanishes`: a table column named `class`; quote it, `"class": varchar`.
`no snowflake-brand twin`: keep an `sf-*` class and set the shape it names on
the object (`shape: diamond`), or drop a colour-only class
(reference/brand-snowflake.md section 3).

## Class traps

### Last class wins
`class: [a; b]` applies left to right, and the later class wins every key
both set. `[focal; service]` draws a plain white service box; write base role
first, modifier last: `[service; focal]`, `[datastore; focal]`. `terminal`
only shapes, so it goes last: `[success; terminal]` is a green pill,
`[terminal; success]` a green box. semcheck names the order
(`write class: [service; focal]`) under S-emphasis.

### Snowflake has no focus group
The Snowflake theme has no blue group class: `sf-primary` on a container
floods the whole group with signature blue. When the brief's focus is a
group, move `focus:` to the node inside it that matters most and give that
node `sf-primary` (at most 3 per diagram, reference/brand-snowflake.md).

## Compile and command errors

d2check shows d2's message and a `hint:` line; the render exit code is the
compile gate (`d2 validate` passing proves nothing). Each row below was
reproduced with d2 0.7.1.

| d2 says | Cause | Fix |
|---|---|---|
| `reserved keywords are prohibited in edges` | a keyword (`left` `right` `top` `label` `shape` `style` `icon` `near` `class` `link` ...) as an edge end | rename the key, keep the word in the label: `left_panel: Left panel` |
| `non-integer top` / `non-integer left` | `top`/`left` as a root key: they are position keywords | rename the key: `top_bar: Top bar` |
| `non-integer width` / `non-integer height` | a unit on a size (`160px`) | bare integer: `width: 160` |
| `substitutions must begin on {` | `$` in a label, even in double quotes | single quotes: `'costs $5 per call'` |
| `unexpected text after map`, `edge map keys must be reserved keywords` | an unquoted `{` in a label | quote the whole label: `"GET /users/{id}"` |
| `unexpected text after unquoted string` | an unquoted `[` in a label (a guard) | quote it: `"pay [card ok]"` |
| `missing value after colon` (with `maps must be terminated with }`) | an unquoted hex colour: `#` starts a comment | quote it: `"#1E293B"`, or use a role class |
| `maps must be terminated with }` | an unclosed `{` | close it; look for an unquoted `#` that commented out a `}` |
| `block string must be terminated` | an unclosed `\|md` block | `shape: text` with a plain label |
| `is not a valid config` | an ELK flag or unknown key in `d2-config` | remove it; valid keys: `theme-id dark-theme-id layout-engine pad center sketch theme-overrides dark-theme-overrides`; ELK spacing flags go after `--` on d2check |
| `is not a valid theme ID` | a `theme-id` the file does not need | delete it: the theme file sets theme 0 |
| `failed to import` | the theme is not next to the `.d2` (imports resolve from the importing file) or its name is misspelled | `cp ${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2 <dir>/`; `...@neutral-theme` |
| `failed to bundle local images` | a local icon path that does not exist (paths resolve from the `.d2`) | fix the path, or fetch it: `sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh get lucide:<name> <dir>/icons/` |
| `unknown shape` | a misspelled shape or arrowhead | the role class sets the shape (`datastore` = cylinder) |
| `to be a valid named color` | a theme code (`B1`, `N2`) or bad colour in `style` | a role class; colours are CSS names or quoted hex |
| `invalid style keyword` | a misspelled style key (`style.fil`) | fix it, or let the role class set it |
| `must be style.` | a bare style key (`fill:`) or a capitalised `Style.fill` | `style.fill`, lowercase |
| `to be a number between` | out of range: `stroke-width` is an integer 0-15, `opacity` 0-1, `font-size` 8-100 | a value in range |
| `to be true or false` | a boolean written `yes`/`no` | `true` / `false` |
| `can only be applied to` | `3d`/`double-border` on a shape that lacks it | drop it (the design system uses no 3d) |
| `goes from a container to a descendant` | dagre (`-l dagre`, or no engine pinned) cannot draw it | no `-l`; the theme pins ELK |
| `must be the absolute path to a shape or one of` | an unknown `near` value | `top-left` ... `bottom-right`; `top-center`/`bottom-center` keep the column narrow |
| `"style" expected to be set to a map` | `style` with no key after it (`a.style`, `**.style`) | `style.opacity: 0.4` or `style: {...}` - better, a role class |
| `Did you mean to use ";"` | classes separated by a comma | `class: [service; focal]` |
| `could not resolve variable` | an undefined `${var}`: a typo, or the theme import is missing | fix the name or the import; prefer a role class |
| `direction must be one of` | an unknown direction | `up`, `down`, `right` or `left` |
| `failed to bundle remote images` (`got 404`, `429`) | an icon URL that does not resolve, or rate limiting | fetch a verified icon locally: workflows/icons.md |

| d2check says | Do |
|---|---|
| `reviewed: approximate (rsvg)` | Only rsvg-convert worked: fonts are substitutes. Judge topology and colour, claim nothing about label fit; report `Reviewed: approximate (rsvg)`. |
| `reviewed: NOT visually reviewed` | No rasterizer: no quality claims; report it and name the fix from `sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh`. |
| `d2 is not on PATH` | Run `sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh`: it prints the install command. |
| `fmt: reformatted ... Read it again` | d2 fmt rewrote the file: Read it before the next Edit. |
| `warning: '-l' overrides the file's vars.d2-config` | Drop the flag after `--`; the engine and theme belong in `vars.d2-config`. |
| `warning: ignored d2 settings from the environment` | Nothing to do for d2check, which already ignores them. Raw `d2` calls read them: `unset` them in the same command (reference/export.md). |
| a raw `d2` call that never returns | `D2_WATCH` is set, or `-w` was passed: stop it, and clear the variable in the same command as each raw `d2` call (reference/export.md, top); watch mode only in the background (export.md section 9). d2check ignores `D2_WATCH`. |
