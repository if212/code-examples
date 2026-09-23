# Playbook: flowcharts, CI/CD pipelines, swimlanes

Use for a process with decisions: request handling, approval flows, CI/CD
and release pipelines, runbooks. Not for data moving between systems
(`playbooks/pipeline.md`) or an object's lifecycle (`playbooks/state.md`).
Templates: `templates/flowchart.d2` (parallel checks, a decision, a failure
boundary, one failure lane) and `templates/swimlane.d2` (who does each step,
rule 8). Step-by-step boards: `playbooks/change.md` section 3.

## Skeleton

| Part | How |
|---|---|
| Direction | `direction: down` for docs; the happy path is the spine |
| Start and ends | `terminal` pills: start `terminal`, outcomes `[success; terminal]` / `[danger; terminal]` |
| Steps | `service` boxes, verb first: `Deploy to staging` |
| Decisions | `decision` diamond, a short question: `All checks pass?`; the gate that matters `[decision; focal]` |
| Parallel steps | one `zone` holding them; one edge in, one edge out |
| "Any failure in X..Y" | a `boundary` around X..Y with ONE `failure` edge out |
| Edges | happy path `flow`, last hop into success `ok`, failures `failure` |

## Budget at 800px (measured on the template)

- A layer gap is 40px; a labelled edge adds a label layer (98px). The
  template (7 steps, 2 containers, one decision) is 639x997px.
- Past about 15 steps, or three nested decisions, split into boards
  (`playbooks/change.md` section 3) or two diagrams.

## Notation checklist

- [ ] Exactly one start; every step reachable from it (`S-unreachable`).
- [ ] Every decision has 2+ exits, each labelled (`S-decision`).
- [ ] Every path ends in a terminal; nothing leaves an end (`S-dead-end`).
- [ ] One focus (`focal`), and the happy path is `flow` from start to success.
- [ ] Failures leave through one side lane, never across the happy path.

## Rules

### 1. Declare the happy path first and make it the spine

ELK ranks nodes in declaration order. Write the nodes top to bottom, then the
happy-path edges (`flow`), then the failure edges: the failure lane then runs
on the right (declared first, it runs on the left). ELK centres a decision
over the two things below it (the next step and the lane), so the spine
below a decision sits off the spine above it (about 100px in the template);
no declaration order removes that. The hidden third target of W-label-on-bend
does (`gate -> ghost` declared before the main edge), at a cost: an empty
column on the left (I-sparse), 81px more height and a bend in the failure lane.

### 2. Label decision branches, and only them

Every edge out of a decision carries its condition (`all pass` / `any fails`,
or `yes` / `no`); other hops stay unlabelled. A labelled edge takes a label
layer (a 98px gap instead of 40px), so labels on some plain hops but not
others make the rhythm uneven. Label every hop of a kind or none of them.

### 3. Parallel steps: one zone, one edge in, one edge out

```d2
# cwd: ../templates
...@neutral-theme
direction: down
push: Commit pushed {class: terminal}
checks: Checks run in parallel {
  class: zone
  lint: Lint {class: service}
  unit: Unit tests {class: service}
  build: Build image {class: service}
}
gate: All green? {class: [decision; focal]}
push -> checks: {class: flow}
checks -> gate: {class: flow}
```

Not three edges in and three out: six converging arrows read as three
separate paths. semcheck treats an edge into a zone as reaching every step in it.

### 4. "Any failure in these steps": a boundary with one failure edge

Wrap the steps in `boundary`, name the rule in its title (`"Release: any
failure rolls back"`), and draw one `failure` edge from the boundary itself.
Enter and leave it with container edges (`gate -> release`, `release ->
done`): they come out straight, while an edge to the first step inside runs
through the title (`E-edge-through-label`). Never draw one failure edge per step.

### 5. Failures share one side lane

Send every failure to the same outcome on one side: a single `[danger;
terminal]` collecting them keeps the happy path clear. The first edge of the
lane runs the length of the diagram by design; one failure end per step would
put a red pill in every row instead.

### 6. Terminals are pills coloured by outcome

`terminal` alone is a white pill for the start. For the ends, the modifier
goes FIRST: `[success; terminal]` is a green pill, `[terminal; success]` a
green box. The last hop into success is `ok` (green); nothing else is green.

### 7. CI/CD specifics

- Stages are steps named by what they do (`Deploy to staging`), not by tool.
- A manual approval is a `[decision; focal]` gate with `approved` / `rejected`.
- Put tools in the label's second line only when the request names them:
  `"Build image\nDocker"`.

### 8. Swimlanes: who does each step, and where work changes hands

`templates/swimlane.d2`, `type: swimlane`: a process where 2+ named people, roles or
teams hand work over (approvals, escalations, refunds). Agents or services as the
actors: a plain flowchart. Rules 2 and 6 hold; the layout is a grid:
- One grid row per lane (`[zone; lane]`). Every lane has the same `grid-columns` and
  cell size, so steps line up across lanes; time runs right.
- The lane name is a `caption` in a hidden fixed-width slot (a bare caption sticks to
  the top of its cell); the brief lists it as `cust.h.t: Customer {note}`.
- Staircase: inside a lane the next step takes the next column; a handoff goes straight
  up or down in the same column. Empty cells stay, hidden with `style.opacity: 0`.
- Never skip a lane: that edge cuts through the lane between
  (`W-edge-through-container`). Route the handoff through a real step there, reorder
  the lanes, or end in the lane that produces the outcome (`Claim paid` in Finance).
- Rework is a later step in time, never an edge back across lanes. Label decision
  exits only: the 24px gaps hold nothing more.
- 3 lanes x 4 step columns of 128px: 794x434 at 14px. A 5th column needs 112px cells
  (12.9px text), too narrow for a 2-line decision. More steps: lanes as grid columns,
  time running down (`grid-columns: N` at the root, `grid-rows: K` in every lane).
- A decision cell holds two lines of about 9 characters (`Within\n30 days?`):
  `On sanctions\nlist?` needed 189px (E-label-overflow).
- A grid edge is a straight line between cell centres: a step hands work only to the
  lane above or below it. A process that needs more (a step handing work to two lanes
  on one side; requester, procurement, legal and finance all trading work: 4 E-, 10 W-)
  is a flowchart, the role first in each label (`"Legal review:\nclear the vendor?"`);
  say so under `Assumed:`.
