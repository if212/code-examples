# Pipeline playbook: data pipelines and stage flows

Use for data that moves through stages: sources, ingestion, warehouse layers,
consumers (ETL/ELT, CDC, streaming). Control flow with decisions is a
flowchart (`${CLAUDE_SKILL_DIR}/playbooks/flowchart.md`). Start from
`${CLAUDE_SKILL_DIR}/templates/pipeline.d2`. Grid mechanics:
`${CLAUDE_SKILL_DIR}/reference/layout.md` section 7.

## 1. Pick the layout by where it is read

Measured on the template's 10 nodes with d2check defaults:

| Layout | 800px column | 1600px slide |
|---|---|---|
| Serpentine: each stage row is a grid cell with its own `direction` | 680x904, text 15px: use | fine |
| One ELK row: `direction: right`, stages as zones | 1395px, text 8px (E-small-text) | 1395x488, clean: use |
| ELK `direction: down`, two stage zones | 640x1130, clean; a label on each hop: 1307px (W-tall) | too tall |
| Grid of stage columns, `grid-rows: 1` | 1230px, text 9.8px, 5 diagonal edges | never |

`direction: down` suits a short chain with unlabelled hops (6 ranks at most):
it reads one way and ELK centres every merge and fan-out, whatever their size.
Past two rows of three stages, add rows (right, left, right) or split the
story into `steps` boards (`${CLAUDE_SKILL_DIR}/templates/steps.d2`).

## 2. Notation checklist

- [ ] Stages are `zone`s titled by what happens there: "Extract and load",
      "Transform (dbt) and serve".
- [ ] Tables, buckets and databases are `datastore`, topics and streams
      `queue`, sources you do not own `[service; external]`.
- [ ] Arrows point where the data goes. The path from a source to the focus
      is `flow`, other hops `dep`, fire-and-forget hops `async`.
- [ ] Technology in the label: `"RAW\nSnowflake"`, `"Connectors\nFivetran"`.
- [ ] The transformer (dbt, a Spark job) is named in a stage title or an edge
      label, never drawn as its own node or lane (rule 5).
- [ ] One focus, usually the table the document is about: `[datastore; focal]`.

## 3. Rules

**1. Serpentine for doc columns.** Root `grid-columns: 1`; every stage row is a
`zone` with its own `direction`, alternating `right` and `left`. A grid cell
honours its `direction`; a plain container ignores it.

```d2
# cwd: ../templates
...@neutral-theme
grid-columns: 1
vertical-gap: 60
load: Load {
  class: zone
  direction: right
  pg: "App DB\nPostgres" {class: datastore; width: 150}
  raw: "RAW\nSnowflake" {class: datastore; width: 150}
  pg -> raw: {class: flow}
}
serve: Serve {
  class: zone
  direction: left
  marts: "MARTS\nSnowflake" {class: [datastore; focal]; width: 150}
  bi: "Dashboards\nLooker" {class: service; width: 150}
  marts -> bi: {class: flow}
}
load.raw -> serve.marts: {class: flow}
```

**2. Merges and fan-outs stay inside one row,** where ELK routes them at right
angles. Between grid cells d2 draws a straight line from center to center: in
a grid of stage columns every merge and fan-out came out diagonal, and even a
1:1 box-to-cylinder hop slants because the two centers differ.

**3. One edge between rows, node to node:** the last node of a row to the first
node of the next. A row-to-row edge (`load -> serve`) ends at the rows'
middles and loses the real endpoint: semcheck fails it (S-misrouted-edge).

**4. Keep the turn vertical.** Row contents sit left-aligned in their cells, so
a turn at the left end is always vertical, and a turn at the right end only
while both rows are equally wide: one `width` on every node, the same number
of stages per row, merges and fan-outs of at most 3 with the main node in the
middle, no labels on horizontal hops. Measured tilts: a `loads` label 52px, a
4th source 37px (a second routing track, +50px), rows of 3 and 2 stages 133px.
d2lint flags only the last (W-diagonal-edge starts at 12 degrees): look at the
turn in the col.png after every edit.

**5. Name the transformer in the title or on the turn edge,** not in a node: a
`dbt` node adds a stage to its row (870px wide) and pushed the turn 135px off
vertical.

**6. Hubs grow in rows.** With `direction: right|left`, a node with N incoming
or outgoing edges grows to N x 40px tall. Put the main-path source in the
middle of a merge: its lane runs straight into the hub, and no box of the same
shape shares the hub's centre line (W-sibling-size otherwise).

**7. Leave room for labels between cells.** A labelled edge across
`vertical-gap: 40` touches the row border; 60 clears it. Across
`horizontal-gap: 40` the label straddles both borders (2 x
W-edge-label-on-border); use the longest label plus 60.

**8. Slides: one ELK row.** Drop `grid-columns`, `vertical-gap` and the per-row
`direction`s, set `direction: right`, group the stages in zones and label hops
freely. 1395x488 for the template's content, clean at `--column 1600`.

```d2
# cwd: ../templates
...@neutral-theme
direction: right
src: Sources {
  class: zone
  pg: "App DB\nPostgres" {class: datastore}
  events: "Clickstream\nSegment" {class: [service; external]}
}
fivetran: "Connectors\nFivetran" {class: service}
wh: Snowflake {
  class: zone
  raw: RAW {class: datastore}
  marts: MARTS {class: [datastore; focal]}
}
src.pg -> fivetran: {class: flow}
src.events -> fivetran: {class: dep}
fivetran -> wh.raw: {class: flow}
wh.raw -> wh.marts: dbt {class: flow}
```

## 4. The template

`${CLAUDE_SKILL_DIR}/templates/pipeline.d2`: two rows, "Extract and load"
(right) and "Transform (dbt) and serve" (left); three sources merge into
Fivetran, RAW turns down into STAGING, MARTS fans out to three consumers:
680x904 at 800px, no errors or warnings. A third row runs `direction: right`
and starts under row 2's last node: that turn is at the left end, so it stays
vertical (rule 4).
