# Snowflake brand theme

Scope: the brand layer for Snowflake diagram deliverables (docs, decks,
READMEs). Product-UI token systems are a different layer and out of scope.
Every other diagram uses `reference/design-system.md`; its rules on sizes,
special shapes, legends and dark mode apply here too.

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
| Tint | (theme) | `#F4FAFD` / `#BCE3F7` | container fill / outline, datastore fill | - |
| Secondary | Star Blue | `#71D3DC` | `sf-accent-star` | 1.74 |
| Secondary | Valencia Orange | `#FF9F36` | `sf-accent-orange` | 2.05 |
| Secondary | Purple Moon | `#7D44CF` | `sf-accent-purple` (white text) | 5.83 |
| Secondary | First Light | `#D45B90` | `sf-accent-pink` | 3.69 |

## 3. Classes

| Class | Use | Look |
|---|---|---|
| `sf-node` | any component (the default) | white, 1px Mid-Blue outline, radius 6 |
| `sf-primary` | the focus: 1 node, never more than 3 | Snowflake Blue fill, black bold text |
| `sf-datastore` | database, stage, table | cylinder, tint fill |
| `sf-external` | not ours: SaaS, partner tools | dashed Mid-Blue outline |
| `sf-muted` | legacy, deprecated, inferred | gray outline and text, regular |
| `sf-accent-orange` `-star` `-pink` `-purple` | the ONE element the eye must find besides the focus | secondary fill, Mid-Blue outline (pink, purple: own) |
| `sf-container` | stage, account, product boundary | `#F4FAFD` tint, 16px bold Mid-Blue title top-left |
| `sf-edge` | ordinary connection | Mid-Blue 1px, gray 14px upright label |
| `sf-flow` | the main data path | Mid-Blue 3px, Mid-Blue label |
| `sf-failure` | error, retry, alert path | Mid-Blue 2px dashed |

Combine a shape role with an accent the same way as the neutral theme (last
class wins): `{class: [sf-datastore; sf-primary]}` is a blue cylinder.

## 4. Brand rules in diagrams

- Signature presence ("about 80% of materials carry the signature blue"):
  every Snowflake diagram has at least one `sf-primary`. Cap: 3; one is best.
  Emphasize the served result (MARTS, the app) rather than every stage.
- "Snowflake Blue is not a text color below 28pt": it is never label text,
  and never a line color either (2.37:1 fails the 3:1 rule for graphics).
  The main path is `sf-flow`, Mid-Blue at 3px.
- Secondary colors are garnish: at most ONE `sf-accent-*` element per
  diagram, and most diagrams need none. A failure path uses `sf-failure`,
  which spends no accent; red is not a brand color.
- Structure carries hierarchy: Mid-Blue for outlines, edges and titles,
  Medium Gray for de-emphasis. Color encodes meaning, not decoration.
- Contrast is pre-computed: black on `#29B5E8` (8.87) passes and white fails
  (2.37), so `sf-primary` keeps black text; purple takes white (5.83). Do not
  override font colors. Audit edits with
  `python3 ${CLAUDE_SKILL_DIR}/scripts/contrast.py --check snowflake-brand.d2`.
- Light backgrounds only; "no blue logo on black".

## 5. Containers and tints

`sf-container` is the only grouping class: one light tint, one hue family,
title 16px bold (never the 28px d2 default, which outshouts the nodes). A
light-to-deeper tint progression is on-brand but needs its own theme
classes: do not hand-code tints in the diagram (no raw colors outside the
theme). A rainbow of container colors is off-brand.

## 6. Icons and logos

- One icon family per diagram (`workflows/icons.md`). Lucide concept icons
  in Mid-Blue: `sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh tint 11567F icons`
  recolors the bundled pack; `get --color 11567F` for new ones.
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
