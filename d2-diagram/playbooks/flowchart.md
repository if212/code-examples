# Playbook: flowcharts, CI/CD pipelines, swimlanes

A process with decisions: requests, approvals, CI/CD, runbooks. Not data moving between
systems (`playbooks/pipeline.md`) or one object's lifecycle (`playbooks/state.md`).
Templates: `templates/flowchart.d2` (parallel checks, a go/no-go decision, a failure
scope laid out as a row, both ends on the last rank), `templates/swimlane.d2` (rule 8).

## Skeleton

| Part | How |
|---|---|
| Direction | `direction: down`: the happy path is one straight spine |
| Steps | `[service; compact; step]`, verb first (`Deploy to staging`); one local `step: {width: 160}` on every step and end |
| Start and ends | pills: start `[compact; step; terminal]`, ends `[success; compact; step; terminal]` and `[danger; ...]` |
| Decisions | `decision` diamond, a short question, a fixed size (`width: 240; height: 64`); `focal` only when the request highlights it |
| Parallel steps | one `zone` holding them as a one-row grid (`grid-rows: 1`), no arrows between them |
| "Any failure in X..Y" | a `boundary` around X..Y, named in 1-3 words, one `failure` edge out (rule 4) |
| Edges | the happy path the request describes `flow`, the hop into success `ok`, failures `failure` |
| Key | `vars.d2-legend`, one line per edge class drawn (`reference/design-system.md` section 8) |

## Budget at 800px (measured on the template)

- A compact rank is 48px plus a 40px gap; a labelled edge adds a label layer (98px
  instead of 40). The template (5 ranks, a 3-step row in each container) is 723 x 735.
- A 3-wide parallel row over a 1-wide column leaves a void beside the column
  (`I-sparse`): lay 2-4 sequential steps under it as a row (rule 4). Past 7 ranks:
  fold (rule 7: 11 nodes and the key in 794 x 733); past about 15 steps: `steps` boards.

## Notation checklist

- [ ] One start; every step reachable (`S-unreachable`); every path ends in a terminal.
- [ ] Every decision has 2+ labelled exits (`S-decision`); in a failure scope its reject
      exit is the scope's one failure edge (rule 4), which S-decision counts.
- [ ] The success end and the failure end on the last rank; the story ends on success.
- [ ] Emphasis per the brief (`workflows/brief.md` section 3): `flow` only on the happy
      path the request describes, `focal` only on the node it asks to highlight.
- [ ] A key naming every edge class drawn (`S-key`).

## Rules

### 1. One straight spine: happy path first, a ghost across every fork

ELK ranks by the edges; declaration order breaks ties: which sibling goes left and which
branch becomes the spine (`reference/layout.md` section 3). ELK centres a node over its
branches, so the spine steps sideways at every node with a side exit: give it a `ghost`
on the far side, its edge labelled like the real one (`gate -> g1: all pass {class:
ghost}`, as in the template). The real branch is then the middle of three and drops
straight (`reference/design-system.md` section 7).

### 2. Labels: decision exits and scope exits, nothing else

A decision's exits carry their condition (`all pass` / `any check fails`, `yes` / `no`),
a failure scope's exits theirs (`all done` / `any step fails`); other hops stay bare. A
label takes a layer: label both exits of a node or neither, or the labelled one drops its
end a rank below the other. d2check moves a decision's label next to it.

### 3. Parallel steps: one zone, a one-row grid, one edge in and one out

A `zone` with `grid-rows: 1` holds them; its one exit is the join (`checks -> gate`, or a
labelled `all pass` edge when no decision follows). Not three edges in and three out: six
converging arrows read as three paths. An edge into a zone reaches every step in it.

### 4. A failure scope: one boundary, one failure edge, both ends on the last rank

Wrap the steps that fail the same way in a `boundary` named in 1-3 words (`Release`),
the rule on its failure edge (`any failure`); a decision inside gets no reject edge of its
own (`any failure or rejected`). The success end leaves the scope too: both ends sit on
the last rank, and the story ends on success, where the happy path ends:
- 2-4 steps: a one-row grid inside the boundary (`grid-rows: 1; horizontal-gap: 24`),
  arrows between the steps. The row ends at the right, so the success end goes right and
  the failure end left: declare the failure end first (the template).
- More steps than a row holds: a column (`grid-columns: 1`) on the spine, as wide as its
  two ends (`width: 320` for two 160px pills), the success end declared first (left):
  both exits drop straight. Past 7 ranks, fold (rule 7).
Enter and leave by container edges (an edge to the first step inside crosses the title).

### 5. Terminals are pills colored by outcome

The modifier goes before `terminal` (`[success; ...; terminal]` is a green pill, `[terminal;
success]` a green box). `ok` is the hop into success only; one failure end takes every failure.

### 6. CI/CD specifics

Stages are named by what they do (`Deploy to staging`), a tool only on a `tech` second line
the request names (`"Build image\nDocker"`); a manual approval is a `decision`.

### 7. Past 7 ranks: fold into two columns

A root grid, 2 x 2: the first stages, the scope, a hidden hole, the failure end under the
scope, `vertical-gap: 80` so its edge shows past the label (edges between cells are
straight); the success end is the scope's last step.

```d2
# cwd: ../templates
...@neutral-theme
grid-rows: 2
grid-columns: 2
horizontal-gap: 32
vertical-gap: 80
classes: {step: {width: 176}; check: {width: 96}}
build: Build {
  class: zone
  direction: down
  pr: Pull request opened {class: [compact; step; terminal]}
  checks: In parallel {class: zone; grid-rows: 1; horizontal-gap: 12; vertical-gap: 12}
  checks.lint: Lint {class: [service; compact; check]}
  checks.unit: Unit tests {class: [service; compact; check]}
  checks.image: Build image {class: [service; compact; check]}
  scan: Security scan {class: [service; compact; step]}
  staging: Deploy to staging {class: [service; compact; step]}
  pr -> checks: {class: flow}
  checks -> scan: all pass {class: flow}
  scan -> staging: {class: flow}
}
release: Release {
  class: boundary
  direction: down
  e2e: Run e2e tests {class: [service; compact; step]}
  approval: Approve? {class: decision}
  canary: Canary 10% {class: [service; compact; step]}
  rollout: Full rollout {class: [success; compact; step; terminal]}
  e2e -> approval: {class: flow}
  approval -> canary: approved {class: flow}
  canary -> rollout: {class: ok}
}
empty: {label: ""; width: 10; height: 10; style.opacity: 0}
rollback: Roll back {class: [danger; compact; step; terminal]}
build -> release: {class: flow}
release -> rollback: any failure or rejected {class: failure}
vars: {d2-legend: {a: {style.opacity: 0}; b: {style.opacity: 0}
  a -> b: happy path {class: flow}; a -> b: success {class: ok}; a -> b: failure {class: failure}
}}
```

### 8. Swimlanes: who does each step, and where work changes hands

`type: swimlane`: 2+ named people, roles or teams hand work over; services: a flowchart.
- One grid row per lane (`[zone; lane]`), the same `grid-columns` and cell size in every
  lane: steps line up, time runs right. The lane name is a `caption` in a hidden slot
  (brief: `cust.h.t: Customer {note}`). A decision cell holds two 9-character lines.
- Staircase: a lane's next step takes the next column; a handoff goes straight up or down;
  empty cells stay hidden. Never skip a lane (`W-edge-through-container`); rework is a
  later step, never an edge back.
- Pre-check: list each lane's handoff partners. A lane trading work with 3+ lanes
  (support in a triage) cannot keep every handoff adjacent: keep the lanes asked for, run
  the spine down one column and send the return handoff straight up another through
  empty hidden cells; the finding it leaves goes under `Open:` with the recipe tried. A
  flowchart with the role first in each label only when the request names no lanes.
- 3 lanes x 4 columns of 128px: 794 x 494, key under the lanes; more: lanes as columns.
