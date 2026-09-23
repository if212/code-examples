# Workflow: From Requirements

## Input

- natural-language requirement
- optional constraints: layout/theme/format

## Actions

1. Parse requirements into nodes, relationships, boundaries, and outputs.
2. Draft minimal `.d2` that compiles.
3. Add containers, labels, and only necessary style.
4. Select layout (`dagre` default; `elk` if dense).
5. Run:
   - `d2 validate <file.d2>`
   - `d2 fmt <file.d2>`
6. Render only the explicitly requested formats (default: SVG). Extra formats go through `workflows/export-publish.md`.

## Validation

- no parse errors
- output files exist
- key relationships are visible and directional intent is clear

## Output

- follow `output-contract.md`
