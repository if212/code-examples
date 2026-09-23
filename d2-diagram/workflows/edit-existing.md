# Workflow: Edit Existing Diagram

## Input

- existing `.d2` file
- requested changes

## Actions

1. Read current `.d2` and identify change scope.
2. Preserve stable keys whenever possible.
3. Apply minimal delta and avoid unrelated rewrites.
4. Run:
   - `d2 validate <file.d2>`
   - `d2 fmt <file.d2>`
5. Render and compare readability impact.

## Validation

- no regressions in existing paths/connections
- changed area matches user request

## Output

- follow `output-contract.md`
