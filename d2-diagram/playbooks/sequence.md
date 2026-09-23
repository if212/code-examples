# Playbook: sequence diagrams

Messages over time between 2-6 participants: an API call chain, an OAuth handshake, a
checkout. Not structure (`playbooks/architecture.md`), a lifecycle (`playbooks/state.md`)
or branching (`playbooks/flowchart.md`). Template: `templates/sequence.d2` (4
participants, 7 messages, activation bars, a two-outcome `alt`); syntax:
`reference/syntax.md` section 13. Variants: a saga (rule 9), a protocol artifact (rule
10), an agent's tool calls (a `loop`: model -> app `tool_use`, app -> tool, app -> model
`tool_result`; the app calls tools, never the model).

## Skeleton

| Part | How |
|---|---|
| Participants | declared first, in reading order; all `actor` with one width class (`box: {width: 120}`); third parties too, named in the label |
| Focus | the participant the request is told from or names: `[actor; box; focal]`; a protocol's artifact: `flow` on its messages (rule 10) |
| Messages | time order, one line each, numbered `1.` `2.`; requests `dep` |
| Returns | `{class: secondary; style.stroke-dash: 3}`; an error reply `failure` |
| Activation bars | a message to a child key (`db.a`) draws a bar: on every participant that does work, one key per activation, or on none |
| Notes | `api.x: One short line {class: [note; compact]}`: a child with no edges (rule 4) |
| Fragments | a `zone` titled with its question (`"alt: charge result"`); outcomes are nested zones (rule 6) |

## Budget at 800px (measured)

- A message row is about 88px, a compact note about 110, a group title 30-45. The
  template (4 participants, 7 messages, a two-operand `alt`) is 774 x 878.
- At most 9 messages and one note, or 7 messages and one two-operand `alt`. Longer:
  two diagrams, one per phase, or `steps` boards (`playbooks/change.md` section 3).
- Gaps follow the longest label between neighbours: four participants with 25-character
  labels fill 800px; a 120px participant box holds about 12 characters.

## Notation checklist

- [ ] Every participant declared before the first message (`S-seq-actor-order`).
- [ ] Messages in time order (`S-seq-order`); every return dashed (`S-seq-return`).
- [ ] Fragments hold only declared participants (`S-seq-group-actor`).
- [ ] Numbers run on; the operands of one `alt` restart at the same number.
- [ ] Emphasis from the brief (`workflows/brief.md` section 3): no `focal`, no `flow`
      unless its focus quotes the request.

## Rules

### 1. Participants first, one box shape, one width

Column order is declaration order; one width class gives an even header row. `shape:
person` sizes itself by its label (about 100 x 146 for one word), label below: the header
row no longer lines up. `actor` is light chrome and the lifelines take its outline, so the
messages carry the weight; a focal participant's box and lifeline turn blue. A third party
is a plain `actor` (`external`'s dark dashed outline would be the heaviest lifeline).

### 2. One message is one line of at most 40 characters

The method, the path, parameters in parentheses: `POST /token (code, code_verifier)`.
A placeholder names the value (`302 code=AUTH_CODE`), never `...`. d2 centres a label on
its arrow; a label that crosses a participant it does not touch slides into the widest
gap on its way (d2check).

### 3. Returns are dashed and quieter; failed returns are red

`secondary` + `style.stroke-dash: 3`; a solid return reads as a new request and fails
`S-seq-return`. An error reply (`402 card_declined`) is `failure`.

### 4. Notes: one line, compact, off the bars

A note is a row on its participant: `[note; compact]` keeps it one line and 48px tall.
Place it before a bar opens or after it closes (declare it between those messages): over
an open bar it cuts the bar in two. A self-call becomes a note (`api.check: Validates
the cart`); a parameter becomes part of its message.

### 5. Phases: number the messages; groups only for alt, loop and opt

A group is as wide as the lifelines its messages touch (`width` is ignored): phase groups
come out ragged. Number the messages; name phases around the diagram or split by phase.

### 6. alt: one nested zone per outcome, each touching the same participants

The outer zone's title names the question (`"alt: charge result"`, `style:
{text-transform: none}`); each outcome is a nested zone titled with its guard, `style:
{text-transform: none; bold: false}` (`[approved]`). Every outcome touches the same
participants, and a note in one gets its twin on the same participant in the other: the
frames come out equally wide (`W-seq-group-ragged`). Quote group labels (an unquoted `[`
fails to compile); d2check matches title chips to their frames and slides them off lifelines.

### 7. Inside a group, use only declared participants

An undeclared key inside a group becomes a new participant and the frame disappears
(`S-seq-group-actor`).

### 8. Prune rows before shrinking anything else

Every row costs 88-110px. Prune replies the request does not state first, then notes that
close no requested path; keep what the request names (an outcome, a retry, a lifetime).

### 9. Saga: both outcomes end on the orchestrator, compensations marked

Success is a `zone-green` operand, failure a `zone-amber` one, each ending in a note on the
same participant after its reply (an operand with no message loses its frame); compensations
`failure`, `compensate: ...`. Told from the orchestrator (`focus: order  # "the Order service
creates an order"`), no bars: 677 x 952; a creation note on top makes it 1070 (`W-tall`):

```d2
# cwd: ../templates
...@neutral-theme
shape: sequence_diagram
classes: {box: {width: 136}}
order: Order service {class: [actor; box; focal]}
payment: Payment service {class: [actor; box]}
inventory: Inventory service {class: [actor; box]}
order -> payment: "1. charge card" {class: dep}
order -> inventory: "2. reserve stock" {class: dep}
alt: "alt: stock reserved?" {
  class: zone
  style: {text-transform: none}
  ok: "[reservation succeeds]" {
    class: zone-green
    style: {text-transform: none; bold: false}
    inventory -> order: "3. stock reserved" {class: secondary; style.stroke-dash: 3}
    order.done: Order confirmed {class: [note; compact]}
  }
  failed: "[reservation fails]" {
    class: zone-amber
    style: {text-transform: none; bold: false}
    inventory -> order: "3. reservation failed" {class: failure}
    order -> payment: "4. compensate: refund charge" {class: failure}
    order.cancel: Order cancelled {class: [note; compact]}
  }
}
```

### 10. A protocol that names its artifact: show where it is made, sent and checked

When the request names the thing the protocol is about (PKCE's `code_verifier` /
`code_challenge`, a signed webhook's signature), the focus is the messages that carry it:
`flow` on them (`focus: spa -> auth  # "including the code_verifier/code_challenge"`).
Add a compact note where it is created and one where it is checked:

```d2
# cwd: ../templates
...@neutral-theme
shape: sequence_diagram
classes: {box: {width: 136}}
spa: Browser SPA {class: [actor; box]}
auth: Auth server {class: [actor; box]}
spa.v: random code_verifier, kept in the SPA {class: [note; compact]}
spa -> auth: "1. GET /authorize (code_challenge)" {class: flow}
auth -> spa: "2. 302 code=AUTH_CODE" {class: secondary; style.stroke-dash: 3}
spa -> auth: "3. POST /token (code, code_verifier)" {class: flow}
auth.c: S256(code_verifier) = code_challenge? {class: [note; compact]}
auth -> spa: "4. 200 access_token" {class: secondary; style.stroke-dash: 3}
```
