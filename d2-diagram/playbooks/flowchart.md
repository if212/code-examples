# Playbook: flowcharts, CI/CD pipelines, step-by-step boards

Use for a process with decisions: request handling, approval flows, CI/CD
and release pipelines, runbooks. Not for data moving between systems
(`playbooks/pipeline.md`) or an object's lifecycle (`playbooks/state.md`).
Templates: `templates/flowchart.d2` (parallel checks, a decision, a failure
boundary, one failure lane) and `templates/steps.d2` (one board per step).

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
  (rule 8) or two diagrams.

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
no declaration order removes that.

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

### 8. Step-by-step boards: one layout for every step

d2 lays out every board on its own, so a board that adds edges moves the
nodes. Declare every node AND every edge in the base board with the edges
hidden, then reveal one edge per step:

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

The output is a FOLDER, not one file: d2check renders `flow.d2` to
`flow/index.svg` plus `flow/1.svg`, `flow/2.svg`, and lints every board.
`reference/export.md`: board files and single boards section 5, animation
section 6, names section 10.
