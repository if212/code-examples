# Snowflake brand theme

Scope: the brand layer for Snowflake diagram deliverables (docs, decks,
READMEs). Product-UI token systems are a different layer and out of scope.
Every other diagram uses `reference/design-system.md`; its rules on emphasis
(section 4), sizes, keys, special shapes and dark mode apply here too.

## 1. Use it

```sh
cp ${CLAUDE_SKILL_DIR}/templates/snowflake-brand.d2 <dir of the diagram>/
```

```d2
# cwd: ../templates
...@snowflake-brand
direction: down

api: DataFrame API {class: sf-node}
engine: Snowflake execution engine {class: sf-primary}
api -> engine: generates SQL {class: sf-flow}
```

The import sets ELK, `pad: 24` and theme 0. d2check sees the import and
embeds the bundled Lato (`assets/fonts/README.md`; its Regular face also
serves as italic, so labels stay upright): never pass `--font-*`, `-l`, `-t`
or `--pad` by hand.

## 2. Palette

| Role | Name | Hex | Used for | On white |
|---|---|---|---|---|
| Signature | Snowflake Blue | `#29B5E8` | `sf-primary` fill only | 2.37 |
| Structure | Mid-Blue | `#11567F` | outlines, edges, `sf-flow`, titles, icons | 7.89 |
| Structure | Midnight | `#000000` | label text | 21.0 |
| Structure | Medium Gray | `#5B5B5B` | `sf-muted`, edge labels | 6.79 |
| Tint | (theme) | `#F4FAFD` / `#BCE3F7` | container fill / outline, key frame | - |
| Secondary | Star Blue | `#71D3DC` | `sf-accent-star` | 1.74 |
| Secondary | Valencia Orange | `#FF9F36` | `sf-accent-orange` | 2.05 |
| Secondary | Purple Moon | `#7D44CF` | `sf-accent-purple` (white text) | 5.83 |
| Secondary | First Light | `#D45B90` | `sf-accent-pink` | 3.69 |

## 3. Classes

| Class | Use | Look |
|---|---|---|
| `sf-node` | any component (the default) | white, 1px Mid-Blue outline, radius 6 |
| `sf-primary` | the focus: one node (section 4) | Snowflake Blue fill, black bold text |
| `sf-datastore` | database, stage, table, layer | white cylinder, Mid-Blue outline |
| `sf-external` | not ours: SaaS, partner tools | dashed Mid-Blue outline |
| `sf-muted` | legacy, deprecated, inferred | gray outline and text, regular |
| `sf-accent-orange` `-star` `-pink` `-purple` | the ONE element the eye must find besides the focus | secondary fill, Mid-Blue outline (pink, purple: own) |
| `sf-container` | the account, a stage, a product boundary | `#F4FAFD` tint, 16px bold Mid-Blue title top-left |
| `sf-edge` | ordinary connection | Mid-Blue 1px, gray 14px upright label |
| `sf-flow` | the one path the request describes | Mid-Blue 3px, Mid-Blue label |
| `sf-failure` | error, retry, alert path | Mid-Blue 2px dashed |
| `compact` `chip` `tech` `ghost` `title` `key` | geometry, as in the neutral theme (design-system.md section 2) | same sizes; `title` black, `key` frame `#BCE3F7` radius 6 |

Combine a shape role with an accent the same way as the neutral theme (last
class wins): `{class: [sf-datastore; sf-primary]}` is a blue cylinder, and a
geometry class goes after the `sf-*` role: `[sf-node; compact]`. Only `sf-*`
classes and the six geometry classes exist here: a neutral one (`focal`,
`flow`) is silently ignored, and semcheck names its twin (`S-src-class`).

| Neutral class | Here | Note |
|---|---|---|
| `service` `actor` `state` | `sf-node` | |
| `focal` `focal-solid` | `sf-primary` | one node, section 4 |
| `datastore` | `sf-datastore` | |
| `external` / `muted` | `sf-external` / `sf-muted` | |
| `zone` `zone-*` `boundary` | `sf-container` | |
| `flow` `ok` | `sf-flow` | only on a path the request describes |
| `dep` | `sf-edge` | |
| `async` `secondary` | `sf-edge` plus `style.stroke-dash: 5` | one key line says what the dash means |
| `failure` | `sf-failure` | |
| `danger` `success` | none | name the outcome in the label (full weight, never `sf-muted`); the path into a failed end is `sf-failure` |
| `decision` `terminal` `dot` `queue` `note` `caption` | an `sf-*` class plus the shape on the object | below |

`sf-datastore` is the brand's one shape role. Any other shape goes on the
object next to an `sf-*` class: a decision `shape: diamond`, a start or end
pill `style.border-radius: 99`, an initial state `shape: circle; width: 20;
height: 20`, a queue `shape: queue`, a note `shape: page`, a grid header
`shape: text`. `compact` fits one-line boxes and pills, never a cylinder (its
rim leaves the label no room).

```d2
# cwd: ../templates
...@snowflake-brand
direction: down
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: order path {class: sf-flow}
    a -> b: payment failed {class: sf-failure}
  }
}
placed: Order placed {class: [sf-node; compact]; style.border-radius: 99}
paid: Payment taken? {class: sf-node; shape: diamond}
g: "" {class: ghost}
shipped: Shipped {class: [sf-primary; compact]; style.border-radius: 99}
cancelled: Cancelled {class: [sf-node; compact]; style.border-radius: 99}
placed -> paid: {class: sf-flow}
paid -> g: no {class: ghost}
paid -> shipped: yes {class: sf-flow}
paid -> cancelled: no {class: sf-failure}
```

## 4. Brand rules in diagrams

- Signature presence ("about 80% of materials carry the signature blue"):
  every Snowflake diagram has ONE `sf-primary`. It is the node the request
  asks to highlight; when it asks for none, the served result (MARTS, the
  app), grounded in the brief by `# brand` (`focus: sf.marts  # brand`,
  `workflows/brief.md` section 3). More only when the request names more,
  never over 3, and never every stage.
- `sf-flow` marks one path the request describes, as `flow` does
  (design-system.md section 4). Co-equal sources merging into a hub: it
  starts at the hub. A bolder feed nobody described invents a main source.
- "Snowflake Blue is not a text color below 28pt": it is never label text,
  and never a line color either (2.37:1 fails the 3:1 rule for graphics).
  The main path is `sf-flow`, Mid-Blue at 3px.
- Secondary colors are garnish: at most ONE `sf-accent-*` element per
  diagram, and most diagrams need none. A failure path uses `sf-failure`,
  which spends no accent; red is not a brand color.
- Structure carries hierarchy: Mid-Blue for outlines, edges and titles,
  Medium Gray for de-emphasis. Color encodes meaning, not decoration.
- A line style or outline that means something gets a key (design-system.md
  section 8): d2check draws the legend in brand colors (white frame,
  `#BCE3F7` outline, radius 6, Mid-Blue "KEY", gray entries).
- Contrast is pre-computed: black on `#29B5E8` (8.87) passes and white fails
  (2.37), so `sf-primary` keeps black text; purple takes white (5.83). Do not
  override font colors. Audit edits with
  `python3 ${CLAUDE_SKILL_DIR}/scripts/contrast.py --check snowflake-brand.d2`.
- Light backgrounds only; "no blue logo on black".

## 5. Containers and tints

`sf-container` is the only grouping class: one light tint, one hue family,
title 16px bold (never the 28px d2 default, which outshouts the nodes).
Containers are the stages the request names (`playbooks/pipeline.md`): the
Snowflake account is ONE `sf-container` holding its layers (RAW, STAGING,
MARTS), never layers split across source or consumer rows, and the word
"Snowflake" goes on that container, not on every layer. Cylinders stay white
on the tint, so a datastore never reads as a hollow outline. A
light-to-deeper tint progression is on-brand but needs its own theme classes:
do not hand-code tints in the diagram (no raw colors outside the theme). A
rainbow of container colors is off-brand.

## 6. Icons and logos

- One icon family per diagram (`workflows/icons.md`). Lucide concept icons
  in Mid-Blue: `sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh tint 11567F icons`
  copies the bundled pack into `icons/`, recolored; `get --color 11567F` for
  new ones.
- Icons on `sf-primary` fills: Mid-Blue reads muddy there (3.33:1) and
  white fails (2.37:1); use a black copy (`--color 000000`, 8.87:1) or none.
- Logo clear space: never put the logomark next to a typed "Snowflake"
  (that improvises a lockup), and never as a container icon (it sits a few px
  from the border and pushes the first row down). If the logo must
  appear, give it its own node with clear space of at least half its height.

## 7. Not encoded, on purpose

- Product-UI design tokens (the application-code layer).
- Tertiary palette names exist in brand materials, but their hex values are
  not encoded: add them only from a verified brand source, never guessed.
