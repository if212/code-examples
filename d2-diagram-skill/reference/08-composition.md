# Composition

Board types:

- `layers`: isolated boards
- `scenarios`: inherit from base
- `steps`: inherit from previous step

Also includes linking and composition export/animation workflows.

## Example

```d2
x -> y
scenarios: {
  hotfix: {
    x -> z
  }
}
```

Animated export:

```sh
d2 --animate-interval 1200 in.d2 out.svg
```
