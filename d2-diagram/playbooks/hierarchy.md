# Hierarchy playbook: dependency graphs, trees, layer stacks

What depends on what (several parents, cycles), how a whole breaks down (one
parent each) and what sits on top of what. Roles:
`${CLAUDE_SKILL_DIR}/reference/design-system.md`; grids:
`${CLAUDE_SKILL_DIR}/reference/layout.md` section 7.

## 1. Pick the view

| The reader asks | Start from | Holds at 800px |
|---|---|---|
| What depends on what; any cycles? | `${CLAUDE_SKILL_DIR}/templates/depgraph.d2` | 10 nodes, 14 edges |
| How does the whole break down; who reports to whom? | `${CLAUDE_SKILL_DIR}/templates/tree.d2` | 4 groups x 4, 3 levels |
| What sits on top of what? | `${CLAUDE_SKILL_DIR}/templates/stack.d2` | 5 bands x 4 parts, 2 bars |

A "dependency tree" is a depgraph, a "class hierarchy" a class diagram
(`${CLAUDE_SKILL_DIR}/playbooks/erd.md`); layers whose calls matter are an
architecture diagram.

## 2. Dependency graph

| Part | How |
|---|---|
| Direction | `direction: down`, declared tier by tier |
| Nodes | one per package, module, model or role; one size: class `pkg: {width: 120; height: 48}` |
| Caption | `{class: caption}` saying what an arrow (and red) means |
| Classes | edges `dep`; the one finding (the cycle, a layer break) `failure`; the subject `focal` |

The arrow means different things per graph: the caption says which.

| Graph | Arrow | On top | Focus |
|---|---|---|---|
| imports, Terraform modules | importer -> imported | apps, the root module | the package asked about |
| dbt or table lineage | source -> model ("feeds") | sources, upstream only | the model or dashboard asked about |
| task DAG (Airflow, CI `needs:`) | runs before | the first task | the failing or slow task |
| role grants | grantee -> granted role | the top role | the role asked about |

**1. Pin the caption on top**: hidden `pin` edges (`style.opacity: 0`) from
it to every top node. Without them it sat beside the apps (744px wide).

**2. No tier zones.** Tiers come from the declaration order; zones around the
same graph made it 550x622 instead of 450x422.

**3. Two nodes that both import the same two packages always cross once**
(23 node orders, 1 crossing each): node order cannot fix it. Merge the pair,
drop an edge the reader does not need, or keep the one crossing.

**4. The cycle is a pair of `failure` edges, unlabelled;** the caption says
"red = cycle". A `cycle` edge label added a label row (510 vs 422px tall).

**5. Past the budget, aggregate.** 10 packages with 19 imports crossed 8
times; 16 with 30 crossed 13 times at 1116px (11.4px text). Draw one node per
folder or team, or one graph per app, and list the rest in a table.

```d2
# cwd: ../templates
...@neutral-theme
direction: down
classes: {
  m: {width: 150; height: 48}
  pin: {style.opacity: 0}
}
caption: "Revenue lineage: arrow = feeds" {class: caption}
charges: "stripe.charges" {class: [service; m; external]}
orders: "app.orders" {class: [service; m; external]}
stg_charges: stg_charges {class: [service; m]}
stg_orders: stg_orders {class: [service; m]}
revenue: fct_revenue {class: [service; m]}
dash: "Revenue\nLooker" {class: [service; m; focal]}
caption -> charges: {class: pin}
caption -> orders: {class: pin}
charges -> stg_charges: {class: dep}
orders -> stg_orders: {class: dep}
stg_charges -> revenue: {class: dep}
stg_orders -> revenue: {class: dep}
revenue -> dash: {class: flow}
```

## 3. Tree

Org chart (the template): the root, then one `zone` per group holding a
one-column grid: the lead first (`service`), members `muted` (regular weight,
so each group reads lead first), one `--` line per group into its zone
(reporting lines carry no arrowheads). Members use role classes, never local
font styles.

**1. Width grows with groups, not leaves.** 4 groups of 4 = 846px (14.1px
text); every team as its own tree node, 8 teams under 3 leads = 1150px (11px).

**2. `horizontal-gap` is also a grid's side padding:** 12 in the group class;
the default left 60px margins and a 1230px canvas. `grid-rows` = the lead plus
the members: a bigger group sets its own (`grid-rows: 5`); under the shared 4,
its 5 cards folded into 2 columns (11.7px text).

**3. The root is a little wider than the two inner groups together**
(`width: 440` beside 388px; 420-520 all work): their lines drop straight, the
outer two turn once at one height and all four land on their group's centre;
at 200 the four lines left four ports and turned at two heights.

**4. Module trees and containment** (folders; account > database > schema >
table) grow `direction: right`: leaves stack vertically, so they add height.
One size per level (7 leaves: 536x450px).

```d2
# cwd: ../templates
...@neutral-theme
direction: right
classes: {
  dir: {width: 128; height: 48}
  leaf: {width: 150; height: 40}
}
root: "shop-api/" {class: [service; dir; focal-solid]}
cmd: "cmd/" {class: [service; dir]}
internal: "internal/" {class: [service; dir]}
server: "server/" {class: [muted; leaf]}
orders: "orders/" {class: [muted; leaf]}
billing: "billing/" {class: [muted; leaf]}
root -- cmd: {class: dep}
root -- internal: {class: dep}
cmd -- server: {class: dep}
internal -- orders: {class: dep}
internal -- billing: {class: dep}
```

**5. Mind maps: `direction: right`, root in the middle.** Right branches are
`root -- topic`; left ones `topic -- root`, since the key written first goes
left. Keep 2 sides x 3 topics x 3 ideas: the result is wide and short
(W-aspect is expected). A radial mind map is impossible with ELK.

## 4. Layer stack

- Root `grid-rows: 1`: an untitled `zone` holding the bands (`grid-rows: N`,
  N = the band count: 5 bands under 4 wrapped into 2 columns, 8.4px text),
  then one `[zone; bar]` per cross-cutting concern (`label.near:
  center-center`). Cells of a row share its height, so each bar spans the stack.
- A band is `[zone; layer]`, class `layer: {grid-rows: 1; horizontal-gap: 12;
  vertical-gap: 12}`: a grid's gaps are also its padding (the default 60
  made each band 180px tall).
- One inner band width: part width = (516 - (n-1)*12)/n, so 4 parts: 120,
  3: 164, 2: 252; the band edges then line up exactly.
- Top = closest to the user. No edges: position is the relation; calls
  between layers are an architecture diagram.
- One `focal` part; its band `zone-blue`, every other band and bar `zone`.
- Bar titles of about 10 characters: MONITORING took 98 of 112px, SECURITY AND
  IAM overflowed a 104px bar (E-label-overflow).
- The bands sit in one untitled `zone`: it groups them as one stack.
