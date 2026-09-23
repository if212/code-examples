# Workflow: Watch Mode Loop

## Input

- active edit session for one `.d2` file

## Actions

1. Start:

```sh
d2 -w input.d2 out.svg
```

2. Iterate in short cycles:
   - edit a small block
   - observe browser refresh
   - fix parser warnings early
3. When stable:

```sh
d2 validate input.d2
d2 fmt input.d2
```

## Validation

- no validate error before final handoff

## Output

- follow `output-contract.md`
