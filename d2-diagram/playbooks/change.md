# Playbook: change and time - walkthrough, compare, steps, timeline, roadmap, gitflow

`workflows/route.md` picks the type; each `templates/<type>.d2` is clean at 800px.

| Type | The reader asks | Holds at 800px |
|---|---|---|
| walkthrough | Which path does ONE request take through the parts? | 6 hops, 9 nodes |
| compare | What changes between A and B? | 2 boxes per row per panel |
| steps | How does the picture change from one step to the next? | 5 boards, 8 nodes |
| timeline | What happened when, in what order? | 8 events |
| roadmap | What ships when, per stream? | 4 periods x 5 streams |
| gitflow | Which branch is cut from where, and merged where? | 4 branches x 7 moments |

Grid templates (timeline, roadmap, gitflow; swimlane in flowchart.md):
- `grid-rows` before `grid-columns`. Same gaps and cell sizes in every row: columns
  line up, and an edge between aligned cells is straight.
- A grid stretches its cells: a bare `dot` becomes an oval, a `caption` sticks to the
  top. Wrap either in a slot, a hidden fixed-width one-cell grid (`label: "";
  grid-rows: 1; style.opacity: 0`) whose gaps are its padding: child + 2 x gap = row
  height centres it.
- The brief lists the visible nodes in slots (`t1.x`, `d1.p`), never slots or spacers.
  Local classes set geometry only, after the base role: `[service; event; focal]`.

## 1. Walkthrough

One request through the real parts, numbered (C4 dynamic). Not: returns, timing or 3+
exchanges between two parties (sequence); several requests or states (steps).
- The architecture layout, `direction: down`, client (`actor`) on top, two zones at
  most. The path is `flow`, labelled `"N. verb object"` (22 characters at most),
  declared in path order, 1..N without gaps; off it `muted` nodes, unlabelled
  `secondary` edges. The part the reader cares about is focal.
- Keep the path one straight line: one `width` class for all boxes; a node with two
  outgoing hops spans both targets (`width: 300`); a node that routes to one of several
  declares its edges left to right (muted, path, muted): the muted pair flank the label.
- Request direction only: an upward edge detours round the diagram. The reply goes in a
  `note` numbered next (height = the top node's, so the row lines up) or the last label.
- A labelled hop adds a label layer: 6 hops are 1186px tall. More: sequence or steps.

## 2. Compare, and the delta variant

Before/after, current/target, option A/B, a PR. Not: scored options (a table); 3+ states (steps).
- Root `grid-columns: 2`: before `zone`, after `zone-blue`, each `direction: down`, no
  edge between them. Same keys and order on both sides, one `width` class for every box;
  a replacement takes its predecessor's slot, and an edge on one side only gets a hidden
  twin (`style.opacity: 0`) on the other: same graph, so both panels get one layout.
- Added `success`, removed `muted` (before side only), changed `focal`: one change is
  the focus, the title names the others. A `d2-legend` is required: green means added.
- The legend takes about 150px: 2 boxes of 104px per row per panel fill 800px at 13px.
  Wider: stack the panels (`grid-rows: 2`) or draw the delta variant, one diagram:

```d2
# cwd: ../templates
...@neutral-theme
direction: down
vars: {
  d2-legend: {
    a: Added {class: [service; success]}
    r: Removed {class: muted}
    c: Changed {class: [service; focal]}
  }
}
api: "Orders API\nenqueues charges" {class: [service; focal]}
jobs: "payment-jobs\nSQS" {class: [queue; success]}
worker: Charge worker {class: [service; success]}
cron: Retry cron {class: muted}
stripe: Stripe {class: [service; external]}
api -> jobs -> worker: {class: async}
worker -> stripe: {class: dep}
cron -> stripe: {class: secondary}
```

## 3. Steps: one layout for every board

d2 lays out each board on its own, so a board that adds edges moves the nodes. Declare
every node AND edge in the base board, edges hidden, then reveal one per step:

```d2
# cwd: ../templates
...@neutral-theme
direction: down
user: User {class: actor}
api: API {class: focal}
db: DB {class: datastore}
user -> api: 1. request {class: dep; style.opacity: 0}
api -> db: 2. query {class: dep; style.opacity: 0}
steps: {
  "1": {(user -> api)[0]: {class: flow; style.opacity: 1}}
  "2": {
    (user -> api)[0].class: dep
    (api -> db)[0]: {class: flow; style.opacity: 1}
  }
}
```

The output is a FOLDER (`flow/index.svg`, `flow/1.svg`, ...); d2check lints every board.
Board files, animation, names: `reference/export.md` sections 5, 6 and 10.

## 4. Timeline, and phase rows

- ASK for the events and times unless given. A row per event: time (`caption` in a
  slot) | `dot` in a slot | event box; spine: `dep` edges written `--` (no arrowheads).
- Times strictly increase, one format; date and zone go in the page caption. Impact
  `danger`, mitigation `focal`, recovery `success`, the rest `service`. A duration goes
  in an event ("33 min of impact") or a phase title. Past 8 events, phase rows:

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
  e5: "14:31\n481 rolled back" {class: [service; ev; focal]}
  e6: "14:38\nErrors at baseline" {class: [service; ev; success]}
  e5 -> e6: {class: dep}
}
```

## 5. Roadmap

- ASK for the items unless given. A real Gantt (exact dates, durations, dependencies):
  ask, and offer Mermaid `gantt` or a spreadsheet.
- Rows: hidden period ticks (`caption`), a `zone` per stream (title = stream), the
  status key; no edges. Same gaps in every row, so a bar over n periods is n x 168 +
  (n - 1) x 12 px (168, 348, 528, 708) and ends on a tick; an empty period is a hidden
  spacer. A 168px bar holds ~17 characters a line; 8 week columns: 78px, 8 characters.
- Status is the class: done `success`, in progress `service`, planned `muted`, at risk
  `danger`, shown as key chips (a `d2-legend` swatch cannot tell `service` from `muted`).
  The item the plan hinges on is `focal`: its date and status go in its label.

## 6. Gitflow

- A `zone` frame holding one flat grid: a tag row, then a row per branch; a column per
  moment, time running right; the frame's gaps are its padding. Commits are `dot`s in
  slots, tags small `service` chips in their own row (a label on a dot moves it), branch
  names verbatim as plain text (`[service; branch]`: `caption` would uppercase them).
- Lines are `--`: the working branch's line is `flow` (the one focus), the rest `dep`. A
  cut or merge line never passes over another branch's commit (check the columns it
  crosses); each is one expected `W-diagonal-edge`, and nothing else is.
- 4 branches x 7 moments = 76 lines, +8 per row (feature: under develop). 12 moments
  put text under 12px at 800: split by release.
