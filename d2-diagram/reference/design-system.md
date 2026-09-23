# Design system: roles, color, type, strokes

Every diagram that is not Snowflake-branded (`reference/brand-snowflake.md`)
uses `${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2`: a slate ramp, one blue
for focus, four semantic hues, role classes and six geometry classes. Syntax:
`reference/syntax.md`.

## 1. Use it

`cp ${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2 <dir of the diagram>/`,
then make the import the first line of code:

```d2
# cwd: ../templates
...@neutral-theme
direction: down
web: Web app {class: actor}
api: API gateway {class: service}
db: "Orders DB\nPostgres" {class: [datastore; tech]}
web -> api: HTTPS {class: dep}
api -> db: writes {class: dep}
```

The import sets ELK, `pad: 24` and theme 0; never pass `-l`, `-t` or `--pad`.

## 2. Role classes

Tag by what a thing IS, never by the color you want. Every node, container
and edge gets a class: an un-classed one keeps d2's defaults (a 16px edge
label, a triangle head), and `W-unclassed` flags it once most peers carry one.

| Base role | Class | Look |
|---|---|---|
| Component, service, step (the default) | `service` | white box, 1px slate outline, radius 8 |
| User, client app, caller at the edge; sequence participant | `actor` | slate-200 box, slate-300 outline, bold: light chrome |
| Database, cache, bucket | `datastore` | cylinder, slate-50 |
| Queue, topic, stream | `queue` | queue shape, violet-100 fill, violet outline |
| Flowchart decision (short question) | `decision` | diamond |
| State in a state machine | `state` | white box, radius 8 |
| Start or end of a flow | `terminal` | pill, shape only (see section 3) |
| Initial pseudo-state, label `""` | `dot` | 20px dark dot |
| Annotation, one short sentence | `note` | amber-100 page, 14px regular |
| Lane, row, tick or time header in a grid; a dependency graph's key line (never a title) | `caption` | text only: 15px bold UPPERCASE slate-600 |

| Modifier | Class | Look | Rule |
|---|---|---|---|
| What the request asks the reader to look at | `focal` | blue-100 fill, 2px blue outline, bold | only on the brief's focus (section 4) |
| The same on a busy canvas | `focal-solid` | blue fill, white bold text | instead of `focal`, once |
| Legacy, deprecated, inferred, out of scope | `muted` | gray text, regular weight | never on an outcome the request names |
| Not ours: SaaS, partner API | `external` | dashed outline | never inside a `boundary` |
| Failure outcome | `danger` | red-100 fill, red outline | only for failure |
| Success outcome | `success` | green-100 fill, green outline | only for success |

| Container | Class | Look |
|---|---|---|
| Group, tier, VPC, cluster, namespace | `zone` | slate-100 panel, 15px bold UPPERCASE title top-left |
| Tinted group when a tint means something (section 4) | `zone-blue` `zone-green` `zone-amber` `zone-violet` | same, 50-tint panel |
| Trust or network boundary | `boundary` | no fill, 2px dashed outline |

| Edge | Class | Look |
|---|---|---|
| The one path the request describes | `flow` | blue, 2px |
| Ordinary call or dependency | `dep` | slate, 1px |
| Read, return, background, optional | `secondary` | light slate, 1px dotted |
| Event, pub/sub, callback | `async` | violet, 1px long dash |
| Error, retry, fallback path | `failure` | red, 1px short dash |
| Last hop into a success outcome | `ok` | green, 2px |

All edges: 14px upright labels, slim `arrow` heads that follow the operator
(`->` one, `<->` two, `--` none); an edge's own arrowheads (crow's feet) win.

`compact`, `chip`, `tech` and `ghost` set no color, so they combine with any
role; `title` and `key` stand alone. The Snowflake theme has the same six,
same sizes.

| Class | Sets | Write | For |
|---|---|---|---|
| `compact` | height 48 (default 66) | `[service; compact]`, `[note; compact]` | one-line boxes, pills and notes on a spine or in a tight rank; never a cylinder (section 7) |
| `chip` | 104 x 32, 14px | `[service; chip; success]` | a status in a `key` row, up to about 10 characters (section 8) |
| `tech` | nothing d2 sees: d2check draws label lines 2+ at 14px slate-600 | `"Orders\nJava" {class: [service; tech]}` | every "Name\nTechnology" node and C4 element; never a name wrapped over two lines |
| `ghost` | 12 x 48, invisible, 14px upright label | `{class: ghost}` on a node or an edge | balancing a fork (section 7) |
| `title` | text, 18px bold slate-900, centered above the diagram | `title: "Container diagram: Shop" {class: title}` | C4 only, at the root (section 5) |
| `key` | one-row frame: white, 1px slate-300, radius 8, no title | `key: {class: key; ...}` | a row of `chip`s (section 8) |

## 3. Combining classes

`class: [a; b]` applies left to right; the LAST class wins each key. Base role
first, geometry next, modifier last: `[datastore; focal]`, `[queue; danger]`
(dead-letter queue), `[service; compact; focal]`. A geometry class may also
follow the modifier, since it sets no color, but `chip` and `ghost` set 14px,
so they always follow the base role. `[focal; service]` draws a plain service
box; a color class after `focal` fails `S-emphasis`. A modifier alone is a
radius-8 box.

`terminal` sets only the pill (radius 99, 1px outline) and takes its colors
from the theme defaults or from a modifier listed BEFORE it:
`{class: [success; terminal]}` is a green pill, `[danger; terminal]` a red
one. The other order `[terminal; success]` gives a green radius-8 box.
Final states add `style.double-border: true`: `[success; terminal]` for a good
end, `[danger; terminal]` for a bad one, plain `terminal` for a neutral one
(bold, full weight); `muted` only for an inferred or out-of-scope state.

## 4. Emphasis and color

Emphasis is earned: blue says "the request asked you to look here" and
nothing else. What may carry it is decided in the brief: `focus: none` by
default, and any other focus quotes the request words that ask for it
(`workflows/brief.md` section 3, with the table of what counts). semcheck
fails a `focal` node or `flow` edge the focus does not name (`S-emphasis`).

- Color comes from the role, never from taste: no raw hex outside the theme.
- Blue: the focus (`focal`, `focal-solid`) and the one path the request
  describes (`flow`). Red only for failure (`danger`, `failure`); violet only
  for async (`queue`, `async`, `zone-violet`); green only for success
  (`success`, `ok`); amber only for notes and `zone-amber`.
- Peers look alike: nodes with one parent and one base role that the request
  lists together ("web and mobile clients") share one node class and one edge
  class. Never one blue peer.
- Meaning never rides on hue alone: `async`, `failure` and `secondary` also
  differ by dash, `external` is dashed, datastores and queues differ by shape.
- A color, dash, weight or marker that means something gets a key (section 8).
- No role fill equals the panel it sits on: node tints are the 100 step,
  panels the 50 step and slate-100, `actor` is slate-200. Never set a node's
  fill to match its panel; a node that looks hollow reads as missing.
- Zones are plain `zone` unless a tint means something: `zone-blue` a group the
  request focuses (never a focal node inside it), `zone-violet` event
  infrastructure, `zone-amber` a manual or caution area or a failure branch,
  `zone-green` a success branch. Nest `zone` > `zone-blue`, `boundary` > `zone`.

## 5. Type scale

By role; the family is the bundled font (`assets/fonts/README.md`, applied by d2check):

| Role | Size | Weight | Color |
|---|---|---|---|
| Diagram title (`title`, C4 only) | 18 | bold | slate-900 `#1E293B` |
| Node label | 16 | bold | slate-900 (tint-800 on colored roles) |
| Lines 2+ of a `tech` label | 14 (d2check) | as line 1 | slate-600 `#475569` |
| Container title | 15 | bold, UPPERCASE | slate-600 or the tint's 700/800 |
| Edge label, chip | 14 | edge regular upright; chip as its role | slate-600, or the hue's dark shade |
| Note, muted label | 14 / 16 | regular | amber-800 / slate-600 |
| Key title (d2check) | 15 | bold, "KEY" | slate-600 |

- Never below 14px (a 1000px SVG in an 800px column shows 14px as 11px): fix
  width with layout (direction, wrapping, splitting), not font size.
- `tech` is the hierarchy inside a node: name first, technology smaller and
  lighter. d2 embeds one face per label, so line 2 keeps the weight of line 1;
  d2check changes only size and color.
- No title inside the diagram: the page caption carries it. C4 is the one
  exception, its notation names the view: one `title` node, "Container
  diagram: <system>" or "System context: <system>", centered above (a
  `top-left` title sits beside the diagram and widens the canvas by its own
  width; markdown labels clip).

## 6. Strokes, radii, spacing

- Strokes: nodes 1px slate-500 (`focal` 2px blue, `actor` 1px slate-300),
  radius 8; `terminal` a 1px pill (radius 99); zones 1px in their 200 tint
  (slate-300 for `zone`; decorative) and `boundary` 2px dashed, both radius
  12; the `key` frame 1px slate-300, radius 8; edges 1px, `flow` and `ok` 2px.
- Spacing: `pad: 24` from the theme plus d2check's ELK flags; add neither.
- No `shadow` (a hard offset block), `3d`, gradients or fill patterns.
  `style.multiple: true` only for real replicas (`web x3`), never for looks.

## 7. Sizes

The theme fixes four sizes: `compact` (height 48), `chip` (104 x 32), `ghost`
(12 x 48) and `dot` (20). Everything else takes its size from its label.

- d2 never grows a fixed box: a label too big for it is drawn outside it, or
  under a cylinder's top rim or a queue's end cap; both are
  `E-label-overflow` (the rim case names the height that clears it).
- Default heights with the bundled font: boxes and queues 66 for one label
  line, 82 for two, 98 for three; cylinders 118 and 134 (the rims).
  `compact` is for one-line labels: a two-line label fills a 48px box edge to
  edge, and on a cylinder the rim lands on the label.
- One height per rank: `W-sibling-size` prints the heights (`66/82`); give
  every sibling the larger one: `height: 82` for boxes and queues with one-
  and two-line labels, or `compact` on all of them when every label is one
  line. A cylinder clears its rim at 90 (one line) or 106 (two lines): a rank
  with one takes that height on every sibling,
  `classes: {tier: {height: 90}}`. Equal widths: one local class with the
  widest sibling's width, `step: {width: 184}`, on every box of the spine.
- A ghost is as tall as its rank-mates: 48 beside `compact` boxes (the
  class), `height: 66` beside default ones. Label each ghost edge like its
  visible sibling, so both columns keep one rank pitch:

```d2
# cwd: ../templates
...@neutral-theme
direction: down
classes: {s: {width: 120}}
pending: Pending {class: [state; compact; s]}
paid: Paid {class: [state; compact; s]}
g1: "" {class: ghost}
cancelled: Cancelled {class: [terminal; compact; s]; style.double-border: true}
pending -> g1: cancel {class: ghost}
pending -> paid: pay {class: flow}
pending -> cancelled: cancel {class: dep}
```

- With an icon, d2 adds the label height on top of a fixed height
  (`height: 98` renders 124 / 140 for one / two lines): give icon siblings
  the same number of label lines instead.
- `icon-card` (icon `center-left`) is NOT viable: one- and two-line labels
  always differ by 16px (`W-sibling-size`), and at width 160 a two-line label
  can touch the icon (`E-icon-collision`). Icons: `workflows/icons.md`.

## 8. Keys

A color, dash, weight or marker that carries meaning no label states gets a
key. semcheck (`S-key`) fails a missing key, or one that leaves an encoding
out, for edge classes, `external` and `muted` nodes and tinted panels; a
marker's key line is yours to add. Pick the key by the encoding:

| Encoding | Key | Model |
|---|---|---|
| Two or more edge classes (`flow` `dep` `secondary` `async` `failure` `ok`); an `external` or `muted` node; a `zone-green`, `zone-amber` or `zone-violet` panel; a marker (start `dot`, double-border final) | `vars.d2-legend`, one entry per encoding used, in the real classes | below |
| Statuses told only by fill and text style (added / removed / changed, done / planned) | a `key` container of `chip`s in the status classes | below; `templates/roadmap.d2` |
| C4 container or context view | a `title` node plus a legend: container, external system, database, relationship | `templates/c4.d2` |
| ERD crow's feet | the four-line crow's-foot legend, or a `caption` naming the notation ("crow's-foot notation") | `templates/erd.d2` |
| Dependency graph | its `caption` line, with "=" ("arrow = imports, red = cycle") | `templates/depgraph.d2` |

Sequence, class, gitflow, timeline, tree, stack and steps diagrams are exempt:
their notation or their labels carry the meaning.

- One entry per encoding the diagram uses, named by its meaning in the
  request's words ("event", "third party", "main path"), never by the class.
- Line entries: two endpoints hidden with `style.opacity: 0` and one edge per
  class. Node entries: one node in the class, labelled with what it means; a
  tinted panel the same way, `ev: event infrastructure {class: zone-violet}`.
- A node swatch is a small fixed square: it keeps outline, dash, fill and
  shape, but a pill draws as a circle, and text style and a double border are
  lost. Name what it cannot show: `legacy (gray label)` for `muted`,
  `final state (double border)`.
- d2check restyles and places the legend: the "KEY" title, the frame, 1px
  swatch outlines; right of the diagram, top-aligned, when that fits the
  column and the key is no taller than the diagram, else in rows under it.
  Never style it or position it by hand (d2 ignores `near` and `position` in
  `d2-legend`).

```d2
# cwd: ../templates
...@neutral-theme
direction: right
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: call {class: dep}
    a -> b: event {class: async}
    ext: third party {class: [service; external]}
  }
}
orders: Orders {class: service}
bus: order-events {class: queue}
stripe: Stripe {class: [service; external]}
orders -> bus: publishes {class: async}
orders -> stripe: charges {class: dep}
```

- A status told only by fill and text style needs its real look, which a
  swatch cannot show (a `muted` swatch is a white square), so statuses use
  chips: a `key` container whose `chip`s take the same classes as the
  diagram's nodes, each chip naming its status. It is part of the layout: a
  grid cell in a grid template, else a root container with `near:
  bottom-center`, which sits under the diagram without widening it
  (`bottom-left` puts it beside the diagram and shrinks the scale). A chip
  holds about 10 characters of bold 14px; longer statuses get one wider
  class on every chip, `chipw: {width: 136}`.

```d2
# cwd: ../templates
...@neutral-theme
direction: right
api: Shop API {class: [service; focal]}
idp: Auth0 {class: [service; success]}
sessions: Sessions {class: [datastore; muted]}
api -> idp: verifies tokens {class: dep}
key: {
  class: key
  near: bottom-center
  added: Added {class: [service; chip; success]}
  removed: Removed {class: [service; chip; muted]}
  changed: Changed {class: [service; chip; focal]}
}
```

- C4: the legend entries are the element kinds, then the relationship line:

```d2
# fragment
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    c: container {class: service}
    x: external system {class: [service; external]}
    d: database {class: datastore}
    a -> b: relationship {class: dep}
  }
}
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
| AA2 | table constraint tags (PK, FK, UNQ) and class member types: slate-500, never blue | B6 | top-level nodes, level-3 nodes |
| AA4 / AA5 | cylinder, stored_data, package fill (top level / nested) | AB4 / AB5 | page, document, step fill (top level / nested) |

## 12. Editing a theme

- Palette names (`ink-900` ... `ink-50`, `paper`, `primary-*`, `success-*`,
  `danger-*`, `warn-*`, `async-*`) and class names are an interface
  (`${paper}` above; d2check reads `paper`, `ink-200` to `ink-900`): change
  values, never names. Theme globs do not reach the diagram and a glob beats
  every class: style through classes. No class named `link` (syntax.md
  section 7).
- Informative strokes (edges, node outlines, `boundary`) need 3:1 on the
  canvas and every zone tint, text 4.5:1. Zone outlines are decorative (tint
  and title mark the region); mark any other with `# decorative`. Then:

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/contrast.py --check neutral-theme.d2
```

Lowest today: text 4.76 (`AA2` tags, slate-500 on white), then 5.17
(`focal-solid`); strokes 3.28 (slate-400 on `zone-violet`).

## 13. Special shapes

- `sql_table` and `class`: `style.stroke` paints the BODY and `style.fill`
  the header (`syntax.md` section 12), so a role class alone breaks a table
  (`E-contrast`). Style them with the globs at the end of `templates/erd.d2`
  (16px rows, slate headers; relationships `dep` at 2px, so crow's feet stay
  legible); the one focus table: `{class: focal-solid; style.stroke:
  ${paper}}`. d2check thins the row rules to 1px and sets the header bold.
  `playbooks/erd.md`.
- Sequence: participants `actor`; `[actor; focal]` only for the participant
  the brief's focus names, plus `flow` on the messages it names. d2 draws
  each lifeline 2px dashed in its participant's outline color: slate-300 for
  `actor`, so the messages stay the heaviest ink, and blue for
  `[actor; focal]`. Groups (`alt`, `loop`) are `zone`; the two operands of an
  `alt` that ends in success or in failure are `zone-green` and `zone-amber`.
  d2check thins activation bars to 1px. `playbooks/sequence.md`.
