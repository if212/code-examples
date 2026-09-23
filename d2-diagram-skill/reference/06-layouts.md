# Layouts

## Engines

- `dagre` (default): fast, layered, good default.
- `elk`: strong for dense graphs.
- `tala`: D2-specific engine.

## Choosing a Layout

- Start with `dagre`.
- Move to `elk` if edge routing gets messy.
- Use `tala` when you need TALA-specific behavior.

## Commands

```sh
d2 layout
d2 layout dagre
d2 --layout elk in.d2 out.svg
```

## Orthogonal edges (horizontal/vertical only)

Prefer edges that run strictly horizontal or vertical; diagonal edges read as
visual noise and tend to cut across labels. Two rules keep routing orthogonal:

- **One global direction.** `dagre` and `elk` honor a single board-level
  `direction` (`up`/`down`/`left`/`right`). A nested per-container `direction:`
  and a true boustrophedon serpentine (row 1 left-to-right, row 2 right-to-left)
  are **TALA-only** - on `dagre`/`elk` a nested `direction:` is silently ignored.
  Do not design a layout that depends on it unless TALA is available.
- **In `grid` layouts, connect containers, not cross-cell nodes.** A grid does
  not route edges through a layout engine: an edge between two nodes that live
  in different grid cells is drawn as a straight (usually diagonal) line across
  the grid. Connect the **containers** instead (`s1 -> s2`), which the grid
  renders as a clean, centered vertical (or horizontal) arrow between rows; keep
  node-to-node edges only **within** a single cell, where they stay horizontal.

## Wrapped "stage per row" layout (grid)

To fill a page column without one very long single-direction chain, wrap the
flow into rows with `grid` and stack the rows: an outer `grid-columns: 1` makes
each stage a full-width row, and each stage sets its own `grid-columns: N` to lay
its steps out horizontally. Connect stage to stage at the container level (see
above) so the between-row arrows stay orthogonal. This trades width for height
and reads well when embedded in a doc (see the aspect-ratio note in
`reference/12-exports.md`).

```d2
direction: down
flow: {
  grid-columns: 1
  s1: { grid-columns: 3; a; b; c; a -> b -> c }   # a row of steps
  s2: { grid-columns: 2; d; e; d -> e }
}
flow.s1 -> flow.s2   # container-to-container: clean vertical arrow
```
