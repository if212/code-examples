# Workflow: Diagnose and Recover

## Trigger

- `d2 validate`, `d2 fmt`, or render command fails

## Actions

1. Capture failing command and exact error text.
2. If validate fails:
   - quote labels/keys with special characters
   - replace Unicode punctuation with ASCII (`:`, `;`, `.`)
   - reduce to minimal failing block and re-test
3. If fmt fails:
   - fix map/block/string structure
   - run validate first, then fmt
4. If render fails:
   - confirm input file exists
   - confirm validate passes
   - render SVG first, then target format
5. Re-run full chain: validate -> fmt -> render.

## Output

- follow `output-contract.md`
- include root cause and concrete next fix if still failing
