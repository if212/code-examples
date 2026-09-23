# Workflow: Export and Publish

Scope: this workflow runs ONLY for formats the user explicitly requested. The default deliverable is SVG; nothing here is produced speculatively. Regenerating or editing an existing diagram does not inherit its previous export list - formats are re-confirmed from the current request.

## Input

- source `.d2`
- destination medium (web, docs, slides, terminal)

## Actions

1. Select format per destination:
   - docs/web: SVG
   - slides: PPTX/GIF
   - static docs: PNG/PDF
   - terminal docs: ASCII - the ascii grid assumes single-width glyphs; the strict-ASCII label rule (SKILL.md validate step) is exactly what keeps this export aligned. `examples/exports/ascii-safe.d2` shows a minimal source.
2. Run validate/fmt before export.
3. Render requested outputs.
4. Confirm artifact paths and file existence.
5. Note interactivity caveats for embedding.

## Validation

- all requested formats are produced
- no unsupported-format claim without fallback suggestion

## Output

- follow `output-contract.md`
