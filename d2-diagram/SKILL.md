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

Setup: `d2` missing, or d2check exit 3: run `sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh`.
It prints the install commands (`--install` needs no sudo: ask the user first).

## 1. Route and brief

`<target>` is the deliverable path without extension, named after the subject
in kebab-case; no location given: `docs/<name>` if docs/ exists, else
`./<name>` (say which under Assumed). `<name>` is its last part.

1. Match the request to a row of `workflows/route.md`: it names the template
   and the playbook, and when to ask or split. Read that playbook.
2. Make the work dir and note the path it prints (D2W below):
   `mkdir -p "${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>" && ls -d "${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>"`
3. Write `D2W/<name>.brief` as `workflows/brief.md` shows: the request
   verbatim, type, reader, width (800 docs, 1600 slides), direction, focus,
   what is left out. Focus is `none` unless the request singles something
   out; then it quotes those words (brief.md section 3). Infer the rest; ask
   or split only as route.md says, else record the assumption.

## 2. Inventory

In the same brief, list every node (the dotted key is its group) and every
edge (direction, label), taken from the request, not from D2. Anything the
user did not state gets `{inferred}`. semcheck diffs the drawing against it.

## 3. Draft

```sh
cp ${CLAUDE_SKILL_DIR}/templates/neutral-theme.d2 <dir of target>/
cp ${CLAUDE_SKILL_DIR}/templates/<template>.d2 <target>.d2
```

Snowflake brand: copy `snowflake-brand.d2` instead of the theme, replace the
`...@neutral-theme` line of `<target>.d2` with `...@snowflake-brand`, use
`sf-*` classes (`reference/brand-snowflake.md`). Then edit `<target>.d2`:
- Line 1 says in English what it shows. Inventory keys verbatim. Nodes
  first, in their groups; edges last, main path first.
- Every node, container and edge gets a role class, base first, modifier
  last: `[service; focal]` (`reference/design-system.md`). Tables and UML
  classes take none: the template's globs style them.
- A colour, dash or line weight that means something gets a key
  (design-system.md section 8), as the templates show.
- `direction` only at the root (a container's is ignored, a grid cell's
  works). Render settings only in `vars.d2-config`.
- Icons only through `workflows/icons.md`. Syntax: `reference/syntax.md`.

## 4. Render and inspect

```sh
sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh --brief D2W/<name>.brief <target>.d2
```

It formats, runs the ASCII tripwire, renders `<target>.svg` (layers/steps:
the folder `<target>/`), post-processes it (svgpost.py moves labels off
bends, restyles keys and tables), lints, checks it against the brief and
rasterizes that same SVG. Read the PNGs on its `READ:` line, in order:
`col.png` (the reader's view at the brief's width), `ann.png` (a numbered box
per finding `[n]`), `2x.png` (detail). After `fmt: reformatted`, Read the .d2
again.
Experiments: `D2W/<name>-exp.d2` beside a copy of the theme (own PNGs).

| Exit | Meaning | Next |
|---|---|---|
| 0 | clean or warnings | the warnings, then the rubric on col.png |
| 1 | fmt or compile failed | d2's error and a `hint:` line; else `workflows/review-and-fix.md#compile-and-command-errors` |
| 2 | E-/S- errors or tripwire hits | step 5 |
| 3 | no faithful rasterizer | doctor.sh; report what `reviewed:` says |

## 5. Fix

- Every listed code names its recipe, `workflows/review-and-fix.md#<code>`:
  Grep that file for `^### <CODE>` with `-A 28`. Walk its rubric on col.png.
- Budget: 6 render cycles. First compile errors and every E-/S- error
  (independent ones together; one layout change per cycle). Once those are
  clean, fix W- and I-sparse findings in rubric order, in any cycle.
- Stop when d2check exits 0 and no W- or I-sparse is left, except one whose
  recipe you tried in a render cycle and that failed: Open names the code,
  the recipe and why it failed. A finding the 2x crop proves false: report
  it with that proof, never loop on it.

## 6. Deliver

Produce only the formats asked for (default: the SVG). PNG, PDF, animated
SVG, GIF, PPTX, ASCII: `reference/export.md`. Working files stay in D2W.
Report with this block; codes and d2check's quoted lines stay as printed:

```
Diagram:   <target>.svg or <target>/ (source <target>.d2 + its theme file)
Brief:     <type> for <reader>; <d2check display: line>; focus = <key | none>
Reviewed:  <the text after d2check's `reviewed:`, e.g. faithful (playwright)>
Checks:    compile ok; <d2check's checks: line>
Assumed:   <S-inferred items and choices made instead of asking> | none
Left out:  <the brief's out: items> | none
Open:      <CODE - recipe tried - why it failed> | none
Re-render: sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh [--column <width>] <target>.d2
```

- `approximate (rsvg)`: you checked topology and colour, not label fit.
  `NOT visually reviewed`: make no quality claims.

## Editing an existing .d2

Step 1 as usual (the file stands in for the template);
`cp <target>.d2 D2W/orig.d2`. Write the brief from
`python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --dump D2W/orig.d2` plus the
requested change. Keep keys stable and change only what was asked. The file
keeps its look unless a restyle is asked (then move it onto the theme, step 3):
with a theme import, what you add takes role classes; without one, style it
like its neighbours, and on S-src-cli-engine pin ELK with
`vars: {d2-config: {layout-engine: elk}}` (say so under Assumed). After
d2check, run `python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --compare D2W/orig.d2 <target>.d2`
(exit 1: it listed changes) and show that only the requested change appears.

## Hard rules

1. Render only through d2check; ship exactly the SVG you inspected.
2. A clean render is the compile gate: `d2 validate` passing proves nothing.
3. Never pass `-l` or `-t`; layout, pad and theme live in `vars.d2-config`.
4. On the theme, every node, container and edge has a role class (tables and
   UML classes excepted) and no raw colour. An edited file keeps its own look.
5. Report `reviewed:` as d2check printed it; never claim more.
6. Labels are plain English ASCII; product and tech names stay as written.
   The whole .d2, comments included, is ASCII. No emoji.
7. Never run `d2 -w` in the foreground (`reference/export.md` section 9).
8. Only the requested formats leave D2W. The theme files are imported, never
   rendered on their own.

## Where things live

| Need | File |
|---|---|
| Request -> template, playbook; ask or split | `workflows/route.md` |
| Brief, inventory, focus | `workflows/brief.md` |
| Rubric, one recipe per code, compile errors | `workflows/review-and-fix.md` |
| Icons | `workflows/icons.md`, `reference/icons.md` |
| Per-type rules (route.md names the one) | `playbooks/`: `architecture.md`, `infrastructure.md`, `pipeline.md`, `hierarchy.md`, `sequence.md`, `erd.md`, `flowchart.md`, `state.md`, `change.md` |
| Starting diagrams, themes | `templates/*.d2` (`neutral-theme.d2`, `snowflake-brand.d2`) |
| Roles, colours, type, keys | `reference/design-system.md`; Snowflake: `reference/brand-snowflake.md` |
| Syntax and traps; layout, size budget | `reference/syntax.md`; `reference/layout.md` |
| Other formats, boards, watch mode | `reference/export.md` |
| The loop, setup, brief check | `scripts/d2check.sh`, `doctor.sh`, `semcheck.py` (`--explain`, `--dump`, `--compare`) |
| Called by d2check; audits; icons | `scripts/svgpost.py`, `d2lint.py`, `d2raster.py`, `pngstats.py`, `raster.cjs`, `font-flags.sh`; `contrast.py`; `icon.sh` |
| Offline icons, fonts; install | `assets/icons/`, `assets/fonts/README.md`; `README.md` |
