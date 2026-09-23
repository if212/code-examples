# Playbook: state machines

Use for the lifecycle of one thing: an order, a deployment, a subscription,
a pull request, a ticket. Not for a process with decisions and parallel steps
(`playbooks/flowchart.md`) or messages between systems
(`playbooks/sequence.md`). Template: `templates/state.d2` (initial dot,
a composite state, two final states coloured by outcome).

## Skeleton

| Part | How |
|---|---|
| Direction | `direction: down`; the main path is the spine |
| Initial state | `start: "" {class: dot}`: one filled dot, no label |
| States | `state` boxes, named as conditions: `Queued`, `In review`, `Paid` |
| The state that matters | `[state; focal]` |
| Composite state | a `zone` holding its substates |
| Final states | `{class: [success; terminal]; style.double-border: true}`; `danger` for failure outcomes, `muted` for neutral ones |
| Transitions | main path `flow`; failure exits `failure`; others `dep` |

## Budget at 800px

A state machine is narrow: the template (initial dot, 3 states, 2 finals) is
270x781px, and each further state with a labelled transition adds about
160px. About seven states on the spine fill the 1280px height budget; past
that, split into a composite overview plus one diagram per composite.

## Notation checklist

- [ ] Exactly one initial dot, no label (`S-state-start`).
- [ ] Every state reachable from it (`S-unreachable`).
- [ ] Nothing leaves a final state (`S-end-has-exit`).
- [ ] Every transition labelled with its event; guards in brackets, quoted.
- [ ] Outcomes readable by colour AND by name (`Live`, `Failed`).

## Rules

### 1. Initial dot without a label, finals as double-bordered pills

```d2
# cwd: ../templates
...@neutral-theme
direction: down
start: "" {class: dot}
pending: Pending {class: state}
paid: Paid {class: [success; terminal]; style.double-border: true}
expired: Expired {class: [muted; terminal]; style.double-border: true}
start -> pending: {class: flow}
pending -> paid: pay {class: flow}
pending -> expired: "timeout [15 min]" {class: dep}
```

A labelled `start` or a plain box for the end is improvised notation. The
modifier goes before `terminal` (`[success; terminal]`), or the pill turns
back into a box. The pill's inner border is concentric; a box's is not.

### 2. Main path first, as flow

Declare the states top to bottom, then the main-path transitions (`flow`),
then the exits. ELK ranks in declaration order.

### 3. Shared exits: one transition out of a composite state

When several states can fail, cancel or time out the same way, put them in a
`zone` and draw ONE transition from the zone (the template's `active ->
failed: any step fails`). The spine stays straight. Measured on an order
lifecycle with its own exit from each state: ELK centres every branching
state between its two successors, so the spine stepped sideways by 40-80px
at every branching state.

### 4. Other exits: one side column, main path unbroken

Exits that belong to one state only sit to the right of the spine, in the
order they happen. Keep every exit dashed (`failure` or `dep`) and every
main-path hop solid blue, so the path stays readable even when the spine
steps sideways.

### 5. Labels are events; guards are quoted

`pay`, `ship`, `health checks pass`: the event that fires the transition.
UML form `"event [guard] / action"`; quote it, because an unquoted `[` is a
syntax error. The initial transition carries no label.

```d2-bad
# expect: unexpected text
pending -> paid: pay [card ok]
```

### 6. Loops: back two ranks with `<-`, no neighbour 2-cycles

A pair of opposite transitions between neighbours puts both labels side by
side at one height: `submit` and `request changes` read as one phrase.
Route rework back to a state two ranks up and write it with `<-`
(`draft <- testing: tests fail`): it runs up the side, clear of the spine.
The `->` form draws the same line but trips `W-long-edge`. A labelled
self-transition (`pending -> pending: retry`) always sets its label on the
loop (`W-label-on-bend`, no recipe clears it): use one only when staying put
is the point, and name it in one word.

### 7. Colour by outcome, not by taste

Green (`success`) only for the good end, red (`danger`) only for failure,
`muted` for neutral ends such as `Expired` or `Cancelled`. One `focal` state
at most.

### 8. Legend only when colour carries more than two meanings

The outcome colours and the dashed exits explain themselves through their
labels. Add a `vars.d2-legend` (`reference/design-system.md` section 8) only
when a third encoding appears, and check the width budget first.
