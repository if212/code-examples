# Workflow: Refactor Large Diagram

## Input

- large or hard-to-read `.d2` file

## Actions

1. Identify pain points: clutter, overlong labels, unclear groups.
2. Split by containers or composition boards where appropriate.
3. Normalize style via globs and classes.
4. Move repeated literals into `vars`.
5. Run:
   - `d2 validate <file.d2>`
   - `d2 fmt <file.d2>`
6. Re-render and confirm readability gains.

## Validation

- file is still semantically equivalent to original intent
- visual complexity reduced without information loss

## Output

- follow `output-contract.md`
