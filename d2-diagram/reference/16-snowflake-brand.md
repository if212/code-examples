# Snowflake Brand Theme (16)

Scope: the **brand layer**, for diagram deliverables (docs, decks, READMEs). Product-UI token systems are a different layer for application code and are deliberately out of scope here.

## Import

```sh
cp <skill-dir>/templates/snowflake-brand.d2 .   # beside your working .d2
```

```d2
...@snowflake-brand
direction: right

engine: Snowflake execution engine { class: sf-primary }
api: DataFrame API { class: sf-node }
api -> engine: generates SQL { class: sf-flow }
```

## Palette

| Role | Name | Hex | Diagram usage |
|---|---|---|---|
| Primary (signature) | Snowflake Blue | `#29B5E8` | `sf-primary` fills, `sf-flow` edges. Never label text. |
| Structure | Mid-Blue | `#11567F` | default strokes, container titles, monotone icon accent |
| Structure | Midnight | `#000000` | label text on light backgrounds |
| Structure | Medium Gray | `#5B5B5B` | `sf-muted`, annotations, legends |
| Secondary | Star Blue | `#71D3DC` | `sf-accent-star` - at most ONE accent class per diagram |
| Secondary | Valencia Orange | `#FF9F36` | `sf-accent-orange` |
| Secondary | Purple Moon | `#7D44CF` | `sf-accent-purple` (white text - the one dark secondary) |
| Secondary | First Light | `#D45B90` | `sf-accent-pink` |

## Brand rules -> diagram translation

- **Signature presence** ("~80% of materials carry the signature blue; when unsure, use it"): every Snowflake diagram should carry Snowflake Blue - the focal node (`sf-primary`) and/or the main data path (`sf-flow`). When unsure which color a thing should be, the answer is Snowflake Blue fill or default structure colors, not a secondary.
- **Secondary colors are garnish**: at most ONE `sf-accent-*` class per diagram, reserved for the single element the eye must find (hot path, warning, the new component). Most diagrams need zero.
- **"Snowflake Blue is not a text color below 28pt"**: diagram labels are always below 28pt, so Snowflake Blue is **never** used as label/font color in diagrams. Fills and strokes only. Text is Midnight on light backgrounds.
- **"No blue logo on black"**: default branded diagrams to light backgrounds. In dark-theme renders, do not place the blue logomark (e.g. `logos:snowflake-icon`) on dark fills; use a white logo variant or keep the logo on a light surface.
- **Structure carries hierarchy**: Mid-Blue for strokes and container titles; Medium Gray for de-emphasis. Color encodes meaning, not decoration.
- **Contrast decisions are pre-computed in the theme**: black text on `#29B5E8` passes, white fails - hence `sf-primary` uses Midnight text; `#7D44CF` is the inverse - hence white text. Do not override font colors casually.

## Section background tints (distinguishing groups)

To visually separate sections or stages (lanes, phases, grid rows), a **subtle
single-hue background tint** per container is allowed and is **not** counted as
the diagram's one secondary accent - it is structure, not garnish. Keep the
single `sf-accent-*` element for the one thing the eye must find; the tints sit
behind everything and must not compete with it.

- Stay in **one hue family** (the brand blues). A light-to-slightly-deeper
  progression can encode "moving toward done"; a **saturated multi-color
  (rainbow) scheme is off-brand** and fights the accent - do not use it.
- Keep tints **light** so Midnight label text and Mid-Blue container titles stay
  readable and white / `sf-primary` nodes still stand out on top.
- Apply with `style.fill` on the container - a blue progression plus a neutral
  gray for an auxiliary/independent section:

  ```d2
  s1: Validation    { class: sf-container; style.fill: "#ECF7FD" }
  s2: Ready         { class: sf-container; style.fill: "#DDF1FC" }
  s3: Released      { class: sf-container; style.fill: "#CDEAFA" }
  s4: All channels  { class: sf-container; style.fill: "#BCE3F7" }
  s5: Wrap-up (aux) { class: sf-container; style.fill: "#F2F3F5" }
  ```

## Icons under this theme

- Monotone concept icons (Lucide): accent color is **Mid-Blue `#11567F`**, not Snowflake Blue - thin strokes in `#29B5E8` on white fail contrast for the same reason the brand bans it for small text. Iconify URL: `?color=%2311567F`. The bundled `assets/icons/` pack is pre-colored accordingly.
- Brand/tech logos keep their original colors.
- Icons ON `sf-primary` fills: Mid-Blue reads muddy there (3.33:1, vs 7.89:1 on white nodes) and white fails outright (2.37:1). Use a Midnight `#000000` copy (8.87:1) - offline: `sed 's/#11567F/#000000/g' icons/x.svg > icons/x-dark.svg` - or omit the icon on primary nodes. Same accessibility math as the midnight text there.

## Typography note

D2 renders with Source Sans Pro by default - an acceptable humanist-sans stand-in for the brand body font. For strict brand output, pass Lato TTFs via `d2 --font-regular <path> --font-bold <path>`.

## Not encoded, on purpose

- Product-UI design tokens (application-code layer, not diagram deliverables).
- Tertiary palette names exist in brand materials, but hex values are not encoded here; add them only from a verified brand source - never guess hex values.
