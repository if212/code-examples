# Quality Gate Checklist

- `d2 validate` passes.
- `d2 fmt` applied.
- Keys are stable and readable.
- Labels are concise and unambiguous.
- Connections represent intent (direction, labels, endpoints).
- Layout is legible and does not collapse critical edges.
- Styles/themes are consistent and intentional.
- Icons are valid URLs or existing local paths, verified per `reference/15-icon-library.md` (never invented).
- Rendered PNG was opened with the Read tool and visually inspected: no edge crossings through boxes, no truncated/overlapping labels, no empty icon boxes.
- Monotone icons share one accent color; brand logos keep original colors.
- If Snowflake-branded: theme imported (`...@snowflake-brand`); signature blue present (`sf-primary` and/or `sf-flow`); at most one secondary accent; no Snowflake Blue label text; no blue logomark on dark fills.
- No emoji glyphs anywhere in the diagram, its legend, or companion text; every visual marker went through the icon pipeline.
- Every `icon:` reference came from the decision table, the bundled pack, or a live search + `200` verification - none from memory.
- Only requested output formats were produced (default SVG); no speculative exports.
- All labels are English and ASCII; the ASCII tripwire ran clean.
- If visual inspection could not run (degraded mode), the report states this explicitly and makes no quality claims.
