# Playbook: sequence diagrams

Use for messages over time between 2-6 participants: an API call chain, a
login or OAuth handshake, a checkout. Not for what connects to what
(`playbooks/architecture.md`), lifecycles (`playbooks/state.md`) or branching
logic (`playbooks/flowchart.md`).

Template: `templates/sequence.d2` (4 participants, 9 numbered messages, one
note, one `alt` with two operands). Syntax of spans, notes and groups:
`reference/syntax.md` section 13.

## Skeleton

| Part | How |
|---|---|
| Participants | declared first, in reading order; all `actor`; the subject `[actor; focal]`; third parties `[actor; external]` |
| Messages | in time order, one line each, numbered `1.` `2.`; requests `dep`, the key path `flow` if it matters |
| Returns | `{class: secondary; style.stroke-dash: 3}`; error returns `failure` |
| Activation bar | send to or from `api.t` (any child key) to draw the bar on `api` |
| Notes | `api.idem: One short line {class: note}`: a child with no edges |
| Fragments | a `zone` group, label quoted; a guard adds `style: {text-transform: none; bold: false}`: `retry: "loop [n < 3]"`; `alt` operands are nested groups (rule 6) |

## Budget at 800px (measured on the template)

- Each message adds 88px of height, each note about 165px, each group title
  30-60px. The template (9 messages, one note, a two-operand `alt`) is
  1214px tall: that is the limit of the 1280px budget. Without notes and
  groups, 12 messages fit.
- A participant column is 150-200px; a label wider than the gap widens it.
  Four or five participants with 40-character labels fill 800px.
- Longer protocols: two diagrams, or `steps` boards (`playbooks/flowchart.md`).

## Notation checklist

- [ ] Every participant declared before the first message (`S-seq-actor-order`).
- [ ] Messages in time order (`S-seq-order`); every return dashed (`S-seq-return`).
- [ ] Fragments hold only declared participants (`S-seq-group-actor`).
- [ ] Numbers run on; the operands of one `alt` restart at the same number.
- [ ] One focus: `[actor; focal]` on the participant; `flow` on its key messages optional.
- [ ] No `person` shape, no self-message loops, labels in plain ASCII.

## Rules

### 1. Declare participants first, all in one box shape

Column order is declaration order. `shape: person` is a 125px figure with the
label under it: the header row no longer lines up. Mark the participant the
diagram is about with `focal`: its box and lifeline turn blue.

```d2
# cwd: ../templates
...@neutral-theme
shape: sequence_diagram
spa: Web app {class: actor}
api: Orders API {class: [actor; focal]}
stripe: Stripe {class: [actor; external]}
spa -> api.t: "1. POST /orders" {class: dep}
api.t -> stripe: "2. POST /charges" {class: dep}
```

### 2. One message is one line of at most 40 characters

Write the method, the path and the one parameter that matters: `3. POST
/charges`. d2 centres a label on its arrow, so a 3-line label splits the
arrow into stubs. Other parameters go in a note on the receiving participant.

### 3. Returns are dashed and quieter; failed returns are red

```d2
# cwd: ../templates
...@neutral-theme
shape: sequence_diagram
api: Orders API {class: actor}
psp: Payment provider {class: [actor; external]}
api -> psp: "3. POST /charges" {class: dep}
psp -> api: "4. 201 charge_id" {class: secondary; style.stroke-dash: 3}
```

A solid return reads as a new request and fails `S-seq-return`. Use
`failure` (red, dashed) for an error reply such as `402 card_declined`.

### 4. Self-calls and parameter lists become notes

A note is one row on its participant's lifeline. A self-message draws a loop
whose label straddles the lifeline; write `api.check: Validates the cart
{class: note}` instead. Keep a note to one short line.

### 5. Phases: number the messages; groups only for alt, loop and opt

A group is exactly as wide as the lifelines its messages touch (`width` on a
group is ignored; a note inside widens it by the note width). Tested on two
OAuth flows: phase groups came out 150-185px ragged (`W-seq-group-ragged`);
touching both outer participants with notes in every phase still left them
33-76px ragged and added about 500px of height. So number the messages (`1.` to
`n.`) and name the phases in the text around the diagram. Phase bands only
work when every phase already has messages touching the leftmost and the
rightmost participant.

### 6. alt: one nested zone per outcome, each touching the same participants

```d2
# cwd: ../templates
...@neutral-theme
shape: sequence_diagram
api: Orders API {class: actor}
psp: Payment provider {class: [actor; external]}
db: Orders DB {class: actor}
api.t -> psp: "3. POST /charges" {class: dep}
alt: "alt" {
  class: zone
  ok: "[approved]" {
    class: zone
    style: {text-transform: none; bold: false}
    psp -> api.t: "4. 201 charge_id" {class: secondary; style.stroke-dash: 3}
    api.t -> db: "5. UPDATE order (paid)" {class: dep}
  }
  declined: "[declined]" {
    class: zone
    style: {text-transform: none; bold: false}
    psp -> api.t: "4. 402 card_declined" {class: failure}
    api.t -> db: "5. UPDATE order (failed)" {class: dep}
  }
}
```

Both operands touch `psp` and `db`, so they are equally wide. An operand that
stops short looks unfinished. Every group is a `zone`: d2 draws group frames
see-through, so the lifelines show; only the title's background, painted in
the group's fill, hides them. A `boundary` has no fill: the leftmost lifeline
strikes through its title. A title holding a guard gets
`style: {text-transform: none; bold: false}`: the guard stays as written
(`[retries < 3]`, not `[RETRIES < 3]`), and d2 sizes a group title for
regular text, so a long bold one spills onto the frame. Quote group labels:
an unquoted `[` fails to compile.

### 7. Inside a group, use only declared participants

A key inside a group that is not a declared participant creates a new
participant with its own lifeline, and the group frame disappears
(`S-seq-group-actor`). Declare every participant at the top.

### 8. Prune notes before shrinking anything else

Every note costs a 165px row. Keep the ones that change how the reader
understands the flow (idempotency, retries, token lifetime); move the rest
to the text around the diagram.
