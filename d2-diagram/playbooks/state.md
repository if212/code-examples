# Playbook: state machines

The lifecycle of one thing: an order, a deployment, a subscription, a pull request, a
ticket. Not a process with decisions and parallel steps (`playbooks/flowchart.md`) or
messages between systems (`playbooks/sequence.md`). Template: `templates/state.d2` (an
order: initial dot, a straight main path, one exit per state in a side column, keyed).

## Skeleton

| Part | How |
|---|---|
| Direction | `direction: down`; the main path is one straight spine |
| Initial state | `start: "" {class: dot}`: one filled dot, no label |
| States | `[state; compact; box]`, one local `box: {width: 140}`; named as conditions: `Pending`, `In review` |
| Final states | `[<outcome>; compact; box; terminal]` + `style.double-border: true` (rule 7) |
| Transitions | the main path `flow` when the request writes it as a chain; exits `dep`, failures `failure` |
| Balance | a `ghost` on the far side of every state with a side exit (rule 3) |
| Key | `vars.d2-legend`: the line classes, plus the dot and the double border when the request asks to mark them (rule 8) |

## Budget at 800px (measured on the template)

A compact state and its labelled transition take about 146px of height: the template
(dot, 3 states on the spine, 4 finals) is 630 x 598 with its key beside it. About 7
states on the spine reach 1000px; past that, draw an overview with composite states and
one diagram per composite.

## Notation checklist

- [ ] Exactly one initial dot, no label (`S-state-start`); every state reachable
      (`S-unreachable`); nothing leaves a final state (`S-end-has-exit`).
- [ ] Every transition labelled with its event; guards in brackets, quoted.
- [ ] Outcomes readable by color AND by name (`Delivered`, `Cancelled`).
- [ ] `flow` only on a chain the request writes (`workflows/brief.md` section 3); one
      `focal` state at most, and only when the request highlights it.

## Rules

### 1. Initial dot without a label, finals as double-bordered pills

A labelled `start` or a plain box for an end is improvised notation. The modifier goes
before `terminal` (`[success; compact; box; terminal]`), or the pill turns back into a
box; the pill's inner border is concentric, a box's is not.

### 2. Main path first, as flow

ELK ranks by the edges; declaration order breaks ties: which sibling goes left, which
branch is the spine (`reference/layout.md` section 3). Declare the states top to bottom,
then each state's transitions: the main-path one first, its exit after it.

### 3. A straight spine: one ghost across every side exit

ELK centres a state between its two successors, so the spine steps sideways at every
state with an exit (40-80px, `W-dogleg`). Give each such state a theme `ghost` on the
far side and label its edge like the main-path one: the next state is then the middle
successor and stays on the axis. One ghost balances a 2-way fork; a ghost is as tall as
its rank-mates (48 beside `compact` states: `reference/design-system.md` section 7).

```d2
# cwd: ../templates
...@neutral-theme
direction: down
classes: {box: {width: 140}}
start: "" {class: dot}
pending: Pending {class: [state; compact; box]}
paid: Paid {class: [success; compact; box; terminal]; style.double-border: true}
expired: Expired {class: [compact; box; terminal]; style.double-border: true}
g1: "" {class: ghost}
start -> pending: {class: flow}
pending -> g1: pay {class: ghost}
pending -> paid: pay {class: flow}
pending -> expired: "timeout [15 min]" {class: dep}
```

### 4. Exits: one side column, solid, in the order they happen

Exits sit right of the spine in the order they happen, each final one rank below the
state it leaves: the column fills rank by rank, beside the key. Two exits into one final
share it (`paid -> refunded`, `shipped -> refunded`); that final then drops to the lower
source's rank and leaves a gap in the column. A neutral exit is `dep` (solid slate), a
failure `failure` (red, dashed); the main path stays the only blue line. d2check moves an
exit's label off its bend. When several states fail the same way, put them in a `zone`
and draw ONE transition from the zone (`active -> failed: any step fails`).

### 5. Labels are events; guards are quoted

`pay`, `ship`, `health checks pass`: the event that fires the transition. UML form
`"event [guard] / action"`; quote it, because an unquoted `[` is a syntax error. The
initial transition carries no label.

```d2-bad
# expect: unexpected text
pending -> paid: pay [card ok]
```

### 6. Loops: back two ranks with `<-`, no neighbour 2-cycles

A pair of opposite transitions between neighbours puts both labels side by side at one
height: `submit` and `request changes` read as one phrase. Route rework back to a state
two ranks up and write it with `<-` (`draft <- testing: tests fail`): it runs up the side,
clear of the spine; the `->` form draws the same line and trips `W-long-edge`. A labelled
self-transition sets its label on the loop: use one only when staying put is the point,
named in one word.

### 7. Finals: full weight, colored by outcome

A good end is `success` (green), a bad end `danger` (red), a neutral end (`Cancelled`,
`Refunded`, `Expired`) a plain `terminal`: white, slate outline, bold, as heavy as the
states. `muted` is only for a state the request does not name (inferred) or leaves out of
scope: never for an outcome the reader must notice.

### 8. The key: line classes, and the markers when the request asks

Two line classes (`flow`, `dep`) already need a key (`S-key`): one `vars.d2-legend` line
each, named by meaning (`main path`, `side exit`). When the request asks to mark the start
and final states, the same legend shows the dot (`s: start {class: dot}`) and names the
double border its swatch cannot show (`f: final state (double border) {class: [compact;
box; terminal]; style.double-border: true}`), as in the template. d2check restyles and
places it.
