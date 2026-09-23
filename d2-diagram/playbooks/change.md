# Playbook: change and time - walkthrough, compare, steps, timeline, roadmap, gitflow

`workflows/route.md` picks the type; each `templates/<type>.d2` fits 800px as it is.

| Type | The reader asks | Holds at 800px |
|---|---|---|
| walkthrough | Which path does ONE request take through the parts? | 5 hops, 9 parts |
| compare | What changes between A and B? | 2 boxes per row per panel |
| steps | How does the picture change from one step to the next? | 5 boards, 8 nodes |
| timeline | What happened when, in what order? | 8 events |
| roadmap | What ships when, per stream? | 4 periods x 5 streams |
| gitflow | Which branch is cut from where, and merged where? | 4 branches x 7 moments |

Grid templates (compare, timeline, roadmap, gitflow; swimlane in flowchart.md):
- `grid-rows` before `grid-columns`. Same gaps and cell sizes in every row: columns
  line up, and an edge between aligned cells is straight.
- A grid stretches its cells: a bare `dot` becomes an oval, a `caption` sticks to the
  top. Wrap either in a slot, a hidden one-cell grid (`label: ""; grid-rows: 1;
  style.opacity: 0`) whose gaps are its padding: child + 2 x gap = row height centres it.
- The brief lists the visible nodes in slots (`t1.x`, `d1.p`), never slots or spacers.
  Local classes set geometry only, after the base role: `[service; event; focal]`.

## 1. Walkthrough

One request through the real parts, numbered (C4 dynamic). Not: returns, timing or 3+
exchanges between two parties (sequence); several requests or states (steps).
- The architecture layout, `direction: down`, the client (`actor`) on top, one zone,
  every box `compact`, `"Name\nTechnology"` with `tech`, one width per row. The path is
  `flow`, labelled `"N. verb object"` (22 characters at most), 1..N in path order; parts
  off it are `muted`, their edges `secondary` and labelled too (`/orders`): a label takes
  a rank, so bare and labelled edges out of one row end on different rows.
- Keep the path one straight line with no fork (a fork steps sideways, `W-dogleg`): a
  node routing to several spans them (the gateway, `width: 530` over three 150px cards),
  declared left to right (off, path, off), so the path is the middle branch. Give the
  parts off the path what they own too (their stores): every row stays full.
- Request direction only (an upward edge detours round the diagram). The reply is a
  `[note; compact]` numbered next, beside the part it is about: a hidden edge from the
  client (`{class: ghost}`, labelled like hop 1) puts it in that row; a `ghost` opposite.
- Key: the parts off the path, the path, the other routes (`vars.d2-legend`). The
  template (4 hops and the reply, 9 parts) is 785 x 891; more hops: sequence or steps.

## 2. Compare, and the delta variant

Before/after, current/target, option A/B, a PR. Not: scored options (a table); 3+ states (steps).
- Root `grid-rows: 2` then `grid-columns: 2` (rows first, or cells fill column by column):
  before | after, then the key. Both panels plain `zone`, `direction: down`, no edge
  between them. Same keys and order on both sides, one `width` class for every box and
  one height for a row mixing a cylinder and a box; a replacement takes its predecessor's
  slot, an edge on one side only gets a hidden twin on the other: one graph, one layout.
- Status is the class: added `success`, removed `muted` (before side only), changed
  `focal` (`focus: after.api  # "Mark what is added, removed and changed"`). The key is a
  `key` container of `chip`s in those classes (a legend swatch cannot show text weight):
  786 x 536. Wider: stack the panels or draw the delta (a removed part's edge `secondary`):

```d2
# cwd: ../templates
...@neutral-theme
direction: down
classes: {box: {width: 184}; low: {height: 108}}
api: "Orders API\nwrites order events" {class: [service; tech; box; focal]}
audit: "Audit table\nPostgres" {class: [datastore; tech; box; low; muted]}
events: "order-events\nKafka" {class: [queue; tech; box; low; success]}
billing: Billing {class: [service; box]}
search: "Search indexer" {class: [service; box; success]}
api -> audit: {class: secondary}
api -> events: {class: dep}
events -> billing: {class: dep}
events -> search: {class: dep}
key: {
  class: key
  near: bottom-center
  added: Added {class: [service; chip; success]}
  removed: Removed {class: [muted; chip]}
  changed: Changed {class: [service; chip; focal]}
}
```

## 3. Steps: one layout for every board

d2 lays out each board on its own, so a board that adds edges moves the nodes. The base
board is step 1 and declares every node AND every edge (an edge not yet there hidden with
`style.opacity: 0`); each step changes only classes, labels and opacity, so every board
keeps one layout (`templates/steps.d2`: a failover in three boards, 422 x 541).
- A node that changes state: `x.class: null`, then the new list (`x.class: [datastore;
  tech; box; danger]`). A list over a single class is silently ignored and every check
  still passes; give nodes list classes from the start.
- An edge that moves: hide the old one (`(proxy -> primary)[0].style.opacity: 0`), show
  and relabel the new one (`(proxy -> replica)[0]: writes and reads {class: ok}`).
- Step 1 is the normal state, unmarked; a later step marks what it changes by outcome
  (`danger`/`failure` breaks, `success`/`ok` takes over): no focus (`focus: none`).
- A one-line status note under the diagram (`near: bottom-center`) says what the board
  shows; its text changes per step (brief: `status: * {note}`).
- Steps `"2"`, `"3"` after the base board: the output is a FOLDER, `index.svg` (step 1),
  `2.svg`, `3.svg`, each linted; files, animation: `reference/export.md` sections 5, 6, 10.

## 4. Timeline, and phase rows

- ASK for the events and times unless given. A row per event: time (`caption` in a slot)
  | `dot` in a slot | event box; spine: `dep` edges written `--` (no arrowheads).
- Times strictly increase, one format; date and zone go in the page caption. Impact
  `danger`, recovery `success`, the rest `service`; `focal` only on the event the request
  highlights. A duration goes in an event ("33 min of impact") or a phase title. Past 8
  events, phase rows:

```d2
# cwd: ../templates
...@neutral-theme
grid-rows: 2
vertical-gap: 12
classes: {ev: {width: 172}}
detect: "Detect: 14:02-14:14, 12 min" {
  class: zone
  direction: right
  e1: "14:02\nDeploy 481 ships" {class: [service; ev]}
  e2: "14:05\n5xx rate at 12%" {class: [service; ev; danger]}
  e1 -> e2: {class: dep}
}
mitigate: "Mitigate: 14:14-14:38, 24 min" {
  class: zone
  direction: right
  e5: "14:31\n481 rolled back" {class: [service; ev]}
  e6: "14:38\nErrors at baseline" {class: [service; ev; success]}
  e5 -> e6: {class: dep}
}
```

## 5. Roadmap

- ASK for the items unless given. A real Gantt (exact dates, durations, dependencies):
  ask, and offer Mermaid `gantt` or a spreadsheet.
- Rows: hidden period ticks (`caption`), a `zone` per stream (title = stream), the status
  key; no edges. Same gaps in every row, so a bar over n periods is n x 168 + (n - 1) x 12
  px (168, 348, 528, 708) and ends on a tick; an empty period is a hidden spacer. A 168px
  bar holds ~17 characters a line; 8 week columns: 78px, 8 characters.
- Status is the class: done `success`, in progress `service`, planned `muted`, at risk
  `danger`, named by the last row, a `key` container of `chip`s. The item the plan hinges
  on is `focal` when the request highlights it: its date and status go in its label.

## 6. Gitflow

- A `zone` frame holding one flat grid: a tag row, then a row per branch; a column per
  moment, time running right; the frame's gaps are its padding. Commits are 14px `[dot;
  commit]`s in slots, tags small `service` chips in their own row (a label on a dot moves
  it), branch names verbatim, left-aligned in a transparent 112 x 24 box (`label.near:
  center-left`; `caption` would uppercase them).
- Lines are `--` at 2px (`[dep; line]`): the lines outweigh the dots. The working branch
  is `flow` when the request names it (`focus: <its chain>  # "we work on develop"`),
  else every line `dep`. A cut or merge line never passes over another branch's commit;
  it is diagonal by design (one `W-diagonal-edge` each, the template's six included).
- 4 branches x 7 moments = 79 lines, +8 per row; 12 moments go under 12px: split by release.
