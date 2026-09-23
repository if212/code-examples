# Design system: roles, color, type, strokes

Every diagram that is not Snowflake-branded (`reference/brand-snowflake.md`)
uses `${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2`: a slate ramp, one blue
for focus, four semantic hues and role classes. Syntax: `reference/syntax.md`.

## 1. Use it

`cp ${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2 <dir of the diagram>/`,
then make the import the first line:

```d2
# cwd: ../templates
...@neutral-theme
direction: down
web: Web app {class: actor}
api: API gateway {class: focal}
db: "Orders DB\nPostgres" {class: datastore}
web -> api: HTTPS {class: flow}
api -> db: write {class: dep}
```

The import sets ELK, `pad: 24` and theme 0; never pass `-l`, `-t` or `--pad`.

## 2. Role classes

Tag by what a thing IS, never by the color you want. Every node, container
and edge gets a class: an un-classed one keeps d2's defaults (a 16px edge
label, a triangle head), and `W-unclassed` flags it once most peers carry one.

| Base role | Class | Look |
|---|---|---|
| Component, service, step (the default) | `service` | white box, 1px slate outline, radius 8 |
| User, client app, caller at the edge; sequence participant | `actor` | slate-100 box, lighter outline |
| Database, cache, bucket | `datastore` | cylinder, slate-50 |
| Queue, topic, stream | `queue` | queue shape, violet tint and outline |
| Flowchart decision (short question) | `decision` | diamond |
| State in a state machine | `state` | white box, radius 8 |
| Start or end of a flow | `terminal` | pill, shape only (see section 3) |
| Initial pseudo-state, label `""` | `dot` | 20px dark dot |
| Annotation, one short sentence | `note` | amber page, 14px regular |
| Lane, row, tick or time header in a grid; a dependency graph's key line (never a title) | `caption` | text only: 15px bold UPPERCASE slate-600 |

| Modifier | Class | Look | Rule |
|---|---|---|---|
| The one thing to look at | `focal` | blue-50 fill, 2px blue outline, bold | one per diagram |
| Hero node on a busy canvas | `focal-solid` | blue fill, white bold text | instead of `focal`, once |
| Legacy, deprecated, inferred, out of scope | `muted` | gray text, regular weight | |
| Not ours: SaaS, partner API | `external` | dashed outline | never inside a `boundary` |
| Failure outcome | `danger` | red-50 fill, red outline | only for failure |
| Success outcome | `success` | green-50 fill, green outline | only for success |

| Container | Class | Look |
|---|---|---|
| Group, tier, VPC, cluster, namespace | `zone` | slate-100 panel, 15px bold UPPERCASE title top-left |
| Tinted group when groups need telling apart | `zone-blue` `zone-green` `zone-amber` `zone-violet` | same, tinted |
| Trust or network boundary | `boundary` | no fill, 2px dashed outline |

| Edge | Class | Look |
|---|---|---|
| The main path the reader follows | `flow` | blue, 2px |
| Ordinary call or dependency | `dep` | slate, 1px |
| Read, return, background, optional | `secondary` | light slate, 1px dotted |
| Event, pub/sub, callback | `async` | violet, 1px long dash |
| Error, retry, fallback path | `failure` | red, 1px short dash |
| Last hop into a success outcome | `ok` | green, 2px |

All edges: 14px upright labels, slim `arrow` heads that follow the operator
(`->` one, `<->` two, `--` none); an edge's own arrowheads (crow's feet) win.

## 3. Combining classes

`class: [a; b]` applies left to right; the LAST class wins each key. Base role
first, modifier last: `[datastore; focal]`, `[queue; danger]` (dead-letter
queue); a template's geometry class goes between: `[service; pkg; focal]`.
`[focal; service]` draws a plain service box; any class but `terminal` after
`focal` fails `S-emphasis`. A modifier alone is a radius-8 box.

`terminal` sets only the pill (radius 99, 1px outline) and takes its colors
from the theme defaults or from a modifier listed BEFORE it:
`{class: [success; terminal]}` is a green pill, `[danger; terminal]` a red
one. The other order `[terminal; success]` gives a green radius-8 box.
Final states: `{class: [success; terminal]; style.double-border: true}`.

## 4. Color rules

- Color comes from the role, never from taste: no raw hex outside the theme.
- One focus: a single `focal` (or `focal-solid`) node, plus `flow` on the
  main path. Blue means focus or main path and nothing else.
- Red only for failure (`danger`, `failure`); violet only for async (`queue`,
  `async`, `zone-violet`); green only for success (`success`, `ok`); amber
  only for notes and `zone-amber`.
- Meaning never rides on hue alone: `async`, `failure` and `secondary` also
  differ by dash, `external` is dashed, datastores and queues differ by shape.
- Zones are plain `zone` unless a tint means something: `zone-blue` holds the
  focus, `zone-violet` event infrastructure, `zone-amber` a manual or caution
  area, `zone-green` success outcomes. Nest `zone` > `zone-blue`, `boundary` > `zone`.

## 5. Type scale

By role; the family is the bundled font (`assets/fonts/README.md`, applied by d2check):

| Role | Size | Weight | Color |
|---|---|---|---|
| Node label | 16 | bold | slate-900 `#1E293B` (tint-800 on colored roles) |
| Container title | 15 | bold, UPPERCASE | slate-600 `#475569` or the tint's 700/800 |
| Edge label | 14 | regular, upright | slate-600, or the edge hue's dark shade |
| Note, muted label | 14 / 16 | regular | amber-800 / slate-600 |

- Never below 14px (a 1000px SVG in an 800px column shows 14px as 11px): fix
  width with layout (direction, wrapping, splitting), not font size.
- No title inside the diagram: the page caption carries it (`shape: text`
  titles add height and markdown labels clip).

## 6. Strokes, radii, spacing

- Strokes: nodes 1px slate-500 (`focal` 2px blue), radius 8; `terminal` a
  1px pill (radius 99); zones 1px slate-300 (decorative) and `boundary` 2px
  dashed, both radius 12; edges 1px, `flow` and `ok` 2px.
- Spacing: `pad: 24` from the theme plus d2check's ELK flags; add neither.
- No `shadow` (a hard offset block), `3d`, gradients or fill patterns.
  `style.multiple: true` only for real replicas (`web x3`), never for looks.

## 7. Sizes: the theme fixes none

- A theme class cannot know its label, so none sets `width` or `height`
  (except `dot`). d2 never grows a fixed box: a label too big for it is drawn
  outside it, or under a cylinder's top rim or a queue's end cap; both are
  `E-label-overflow` (the rim case names the height that clears it).
- To line up a tier, `W-sibling-size` prints the heights (`66/82`): give
  every sibling the larger one, `height: 82` (boxes and cylinders, one- and
  two-line labels). Equal widths: the widest sibling's `width`.
- With an icon, d2 adds the label height on top of a fixed height
  (`height: 98` renders 124 / 140 for one / two lines): give icon siblings
  the same number of label lines instead.
- `icon-card` (icon `center-left`) is NOT viable: one- and two-line labels
  always differ by 16px (`W-sibling-size`), and at width 160 a two-line label
  can touch the icon (`E-icon-collision`). Icons: `workflows/icons.md`.

## 8. Special shapes

- `sql_table` and `class`: `style.stroke` paints the BODY and `style.fill`
  the header (`syntax.md` section 12), so a role class alone breaks a table
  (`E-contrast`). Style them with the globs at the end of `templates/erd.d2`
  (16px rows, 1px rules, slate headers; relationships `dep` at 2px, so crow's
  feet stay legible); the one focus table: `{class: focal-solid; style.stroke:
  ${paper}}`. `playbooks/erd.md`.
- Sequence: participants `actor`; the one the diagram is about `[actor;
  focal]`, plus `flow` on its key messages if a path matters too. Groups
  (`alt`, `loop`) are `zone`. Lifelines are always 2px dashed in the
  participant's outline color (blue for the focal one). `playbooks/sequence.md`.
- Legend: native `vars.d2-legend` (mechanics: `syntax.md` section 11). Add
  one only when color or dash carries meaning the labels do not state; reuse
  the real classes so swatches match, and hide edge endpoints:

```d2
# cwd: ../templates
...@neutral-theme
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: main path {class: flow}
    a -> b: event {class: async}
  }
}
api: API {class: focal}
orders: Orders {class: service}
bus: order-events {class: queue}
api -> orders: POST /orders {class: flow}
orders -> bus: OrderPlaced {class: async}
```

## 9. Dark mode

Light only by default (no `dark-theme-id`): the SVG keeps its white canvas and
reads as a light card on dark pages; hex styles never follow a dark theme
(`E-contrast-dark`). Adaptive output only on request: no theme import and no
role colors (only theme codes flip), colors in the two override maps:

```d2
vars: {
  d2-config: {
    layout-engine: elk; pad: 24; theme-id: 0; dark-theme-id: 200
    theme-overrides: {N1: "#1E293B"; N2: "#475569"; B1: "#64748B"; AA4: "#F8FAFC"}
    theme-overrides: {B4: "#F1F5F9"; B5: "#FFFFFF"; B6: "#FFFFFF"}
    dark-theme-overrides: {N1: "#E2E8F0"; N2: "#94A3B8"; N7: "#0F172A"; B1: "#94A3B8"}
    dark-theme-overrides: {AA4: "#273449"; B4: "#1E293B"; B5: "#273449"; B6: "#1E293B"}
  }
}
classes: {
  node: {style: {border-radius: 8; stroke-width: 1}}
  store: {shape: cylinder; style.stroke-width: 1}
  call: {target-arrowhead.shape: arrow; style: {stroke-width: 1; italic: false; font-size: 14}}
}
api: API {class: node}
db: Postgres {class: store}
api -> db: write {class: call}
```

## 10. Built-in themes: not the route to polish

Same graph, ELK, `pad: 24`; contrast of edge labels (N2) on the level-1
container fill (B4), where AA needs 4.5:

| Theme | Look | Edge label on container | Verdict |
|---|---|---|---|
| 0 Neutral default | blue-gray, navy strokes | 4.31 | best built-in, still fails AA |
| 1 Neutral gray | gray fills | 3.46 | flat, fails AA |
| 3-8 | saturated blue and violet containers | 2.06-2.97 | fails; 8 "Colorblind clear" is worst |
| 100, 102, 103 | tan / pink containers | 3.65-4.10 | fails, dated |
| 101, 104, 105 | orange / teal / yellow containers | 4.67-5.88 | loud fills compete with nodes |
| 300, 301 terminal | monospace UPPERCASE, double borders | 10.22-16.87 | 10-20% wider; novelty only |
| 302 Origami | paper-texture fills, double borders | 9.71 | novelty; fill patterns |
| 303 C4 | blue fills, every edge dashed | white on `#438dd5` 3.49 | person and text labels white on white; use `neutral-theme` with `c4-person` |
| 200, 201 | dark only | - | not for docs |

All built-ins: 28px container titles over 16px nodes, italic edge labels, no roles.

## 11. Theme codes (for theme-overrides)

What each code paints (probed in the SVG CSS). Accepted: N1-N7, B1-B6, AA2,
AA4, AA5, AB4, AB5; anything else fails the render. Codes are not valid style
values (`style.fill: N7` fails).

| Code | Paints | Code | Paints |
|---|---|---|---|
| N1 | all default text; table and class header fill, outline, row lines | B1 | every default stroke: nodes, containers, edges |
| N2 | edge labels; table column types | B2 | table and class column names |
| N4 | diamond fill | B3 | person fill |
| N5 | queue, hexagon, parallelogram fill | B4 | level-1 container fill |
| N7 | canvas; cloud and callout fill; table body and header text | B5 | nodes inside a container, level-2 containers |
| AA2 | table constraint tags (PK, FK, UNQ) | B6 | top-level nodes, level-3 nodes |
| AA4 / AA5 | cylinder, stored_data, package fill (top level / nested) | AB4 / AB5 | page, document, step fill (top level / nested) |

## 12. Editing a theme

- Palette names (`ink-900` ... `ink-50`, `paper`, `primary-*`, `success-*`,
  `danger-*`, `warn-*`, `async-*`) are an interface (`${paper}` above): change
  values, never names. Theme globs do not reach the diagram and a glob beats
  every class: style through classes. No class named `link` (syntax.md section 7).
- Informative strokes (edges, node outlines, `boundary`) need 3:1 on the
  canvas and every zone tint, text 4.5:1. Zone outlines are decorative (tint
  and title mark the region); mark any other with `# decorative`. Then:

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/contrast.py --check neutral-theme.d2
```

Lowest today: text 5.17 (`focal-solid`), strokes 3.28 (`ink-400` on `zone-violet`).
