---
name: d2-diagram
description: Design, render and visually review polished technical diagrams with D2, delivering an SVG plus its .d2 source. Use for architecture/system, deployment/Kubernetes, network/VPC, C4 context and container, data pipeline/ETL/RAG indexing, LLM/agent apps, sequence/protocol, request walkthrough, flowchart/CI-CD/runbook, swimlane, state machine, ER/SQL schema, UML class, dependency/lineage graph, org chart/tree/mind map, layered stack, threat model/DFD, before/after, timeline/postmortem, roadmap, git branching and step-by-step diagrams whenever the user wants a diagram (even if D2 is not named), and to restyle, fix or re-export an existing .d2. Includes a neutral design system and a Snowflake brand theme. Not for data charts (bar/line/scatter) or UI mockups.
argument-hint: "[what to draw | path/to/file.d2] [width=800] [brand=snowflake]"
license: MIT
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(d2 *), Bash(sh ${CLAUDE_SKILL_DIR}/scripts/*), Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/*), Bash(cp *), Bash(mkdir *), Bash(ls *), Bash(chmod 644 *), Bash(nohup d2 *)
---

# D2 diagram

You ship diagrams a reader understands at a glance, at the size they will see
them, and you ship only what you have looked at:
`ROUTE + BRIEF -> INVENTORY -> DRAFT -> RENDER + INSPECT -> FIX -> DELIVER`.

Setup: when `d2` is missing, or d2check exits 3 (`NOT visually reviewed`,
`approximate`), run `sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh`. It lists what is
missing with the exact install commands; `--install` installs d2 and Chromium
for this user without sudo: ask the user first.

## 1. Route and brief

`<target>` is the deliverable path without extension, named after the
subject in kebab-case (`docs/checkout-flow`); `<name>` is its last part.

1. Open `workflows/route.md` and match the request to a row: it names the
   template (`templates/<template>.d2`) and the playbook. Read that playbook.
2. Make the work dir and note the path it prints (D2W below):
   `mkdir -p "${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>" && ls -d "${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>"`
3. Write `D2W/<name>.brief` as `workflows/brief.md` shows: the request
   verbatim, then type, reader, width (800 docs, 1600 slides), direction, the
   one focus, and what is left out. Infer what you can; ask one short question
   only when the type or scope is truly ambiguous, else record the assumption.

## 2. Inventory

In the same brief, list every node (the dotted key is its group) and every
edge (direction, label), taken from the request, not from D2. Anything the
user did not state gets `{inferred}`. semcheck diffs the drawing against it.

## 3. Draft

```sh
cp ${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2 <dir of target>/
cp ${CLAUDE_SKILL_DIR}/templates/<template>.d2 <target>.d2
```

Snowflake brand: copy `snowflake-brand.d2` instead of the theme, set line 2 of
`<target>.d2` to `...@snowflake-brand`, use `sf-*` classes (`reference/brand-snowflake.md`).
Then edit `<target>.d2`:
- Line 1 says what the diagram shows (it held the template's note). Use the
  inventory keys verbatim. Nodes first, in their groups; edges last, main path first.
- Every node, container and edge gets a role class, base first, modifier
  last: `[service; focal]` (`reference/design-system.md`). Tables and UML
  classes take none: the template's globs style them.
- Render settings live only in `vars.d2-config` (the theme sets ELK, pad 24).
- Icons only through `workflows/icons.md`. Syntax: `reference/syntax.md`.

## 4. Render and inspect

```sh
sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh --brief D2W/<name>.brief <target>.d2
```

It formats the file, runs the ASCII tripwire, renders `<target>.svg` (a
source with layers/steps writes the folder `<target>/`), lints it, checks it
against the brief, and rasterizes that same SVG. The column width comes from
the brief (`--column N`, 200..10000, overrides). Read the PNGs on its `READ:`
line, in order: `col.png` (the reader's view), `ann.png` (a numbered box per
finding marked `[n]`; whole-diagram and edge-meaning ones have none), `2x.png`
(detail, when needed). If it printed `fmt: reformatted`, Read the .d2 again
before editing it.

| Exit | Meaning | Next |
|---|---|---|
| 0 | clean (warnings allowed) | walk the rubric on col.png |
| 1 | fmt or compile failed | d2's error and a `hint:` line; else `workflows/review-and-fix.md#compile-and-command-errors` |
| 2 | E-/S- errors or tripwire hits | step 5 |
| 3 | no faithful rasterizer | doctor.sh; report what `reviewed:` says |

## 5. Fix

- Each code d2check lists names its recipe, `workflows/review-and-fix.md#<code>`:
  Grep that file for `^### <CODE>` with `-A 10`.
- Judge col.png with the 7-item rubric there: legible at width, accurate,
  clean routing, one reading direction, focus findable, no clutter, consistent.
- Budget: 6 render cycles. Cycles 1-4 fix structure: compile errors and all
  E-/S- errors (independent ones together; one layout change per cycle:
  direction, grid, engine flags). Cycles 5-6 polish W- findings in rubric order.
- Stop when d2check exits 0 and the rubric passes. List what is left under Open.

## 6. Deliver

Produce only the formats asked for (default: the SVG). PNG, PDF, animated
SVG, GIF, PPTX, ASCII: `reference/export.md`. Working files stay in D2W. Then:

```
Diagram:   <target>.svg or <target>/ (source <target>.d2 + its theme file)
Brief:     <type> for <reader>; <d2check display: line>; focus = <key>
Reviewed:  <d2check's reviewed: line, verbatim>
Checks:    compile ok; lint <e> errors / <w> warnings; semantic <n> errors
Assumed:   <S-inferred items and choices made instead of asking> | none
Open:      <warnings left (W-, S-), and why> | none
Re-render: sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh [--column <width>] <target>.d2
```

- `Reviewed: approximate (rsvg)`: say you checked topology and colour only;
  claim nothing about label fit. `NOT visually reviewed`: make no quality claims.
- Re-render names no brief: D2W is temporary. d2check's own `re-render:` line
  is the bare d2 command: same geometry, without the post-processing (text
  rendering, file mode 644).

## Editing an existing .d2

Step 1 as usual (the file stands in for the template), then copy it:
`cp <target>.d2 D2W/orig.d2`. Write the brief from
`python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --dump D2W/orig.d2` plus the
requested change. Keep keys stable and change only what was asked. The file
keeps its look unless a restyle is asked (then move it onto the theme, step 3):
with a theme import, what you add takes role classes; without one, style it
like its neighbours, and on S-src-cli-engine pin ELK with
`vars: {d2-config: {layout-engine: elk}}` (say so under Assumed). After
d2check, run `python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --compare D2W/orig.d2 <target>.d2`
and show that only the requested change appears.

## Hard rules

1. Render only through d2check; ship exactly the SVG you inspected.
2. A clean render is the compile gate: `d2 validate` passing proves nothing.
3. Never pass `-l` or `-t`; layout, pad and theme live in `vars.d2-config`.
4. On the theme, every node, container and edge has a role class (tables and
   UML classes excepted) and no raw colour. An edited file keeps its own look.
5. Report `reviewed:` as d2check printed it; never claim more.
6. Labels are plain English ASCII. No emoji anywhere: diagram, legend, reply.
7. Never run `d2 -w` in the foreground (`reference/export.md` section 9).
8. Only the requested formats leave D2W. The theme files are imported, never
   rendered on their own.

## Where things live

| Need | File |
|---|---|
| Request -> template and playbook | `workflows/route.md` |
| Brief and inventory format | `workflows/brief.md` |
| Rubric, one recipe per code, compile errors | `workflows/review-and-fix.md` |
| Icons: ladder, fetch, verify | `workflows/icons.md`, `reference/icons.md` |
| Per-type rules: layout, notation, do and don't (route.md names the one) | `playbooks/`: `architecture.md` (systems, C4, LLM apps), `infrastructure.md` (deployment, network, threat model), `pipeline.md`, `hierarchy.md` (dependencies, tree, stack), `sequence.md`, `erd.md` (+ UML class), `flowchart.md` (+ swimlane), `state.md`, `change.md` (walkthrough, compare, steps, timeline, roadmap, gitflow) |
| Starting diagrams | `templates/*.d2` (themes: `neutral-theme.d2`, `snowflake-brand.d2`) |
| Roles, colours, type scale, legend, dark mode | `reference/design-system.md` |
| Snowflake palette and rules | `reference/brand-snowflake.md` |
| Syntax and traps | `reference/syntax.md` |
| Engines, direction, grids, spacing, width | `reference/layout.md` |
| Other formats, boards, watch mode | `reference/export.md` |
| The loop, setup, brief check | `scripts/d2check.sh`, `scripts/doctor.sh`, `scripts/semcheck.py` (`--explain`, `--dump`, `--compare`) |
| Called by d2check; theme audit; icons | `scripts/d2lint.py`, `d2raster.py`, `pngstats.py`, `raster.cjs`, `font-flags.sh`; `contrast.py`; `icon.sh` |
| Offline icons, bundled fonts | `assets/icons/`, `assets/fonts/README.md` (`D2_FONT_FAMILY=geist` for a softer look) |
| Install, prerequisites, troubleshooting | `README.md` |
