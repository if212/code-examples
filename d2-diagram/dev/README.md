# d2-diagram: maintainer guide

Everything under `dev/` is for maintaining the skill and is left out of the
packaged zip. User-facing docs: [../README.md](../README.md). The agent's entry
point: [../SKILL.md](../SKILL.md).

## Layout

| Path | Role | Loaded by the agent |
|---|---|---|
| `SKILL.md` | entry point: the flow, the report block, hard rules, where things live (<= 170 lines, 9 KB) | always |
| `README.md` | humans: install, prerequisites, quick start, troubleshooting | on setup problems |
| `workflows/route.md` | request signals -> template + playbook | step 1 |
| `workflows/brief.md` | brief + inventory format (semcheck reads it) | step 1 |
| `workflows/review-and-fix.md` | rubric, one `### CODE` recipe per finding code, compile-error table | step 5 |
| `workflows/icons.md` | icon ladder | when icons are used |
| `playbooks/*.md` | per-type rules, <= 150 lines each | the routed type |
| `reference/*.md` | design system (<= 420 lines: emphasis, keys, type, special shapes), Snowflake brand, syntax, layout, icons, export; every file has a line budget in `dev/tests/structure/check.py` (`BUDGETS`) | on demand |
| `templates/*.d2` | starting diagrams (<= 80 lines, clean in d2check) and the two theme files | copied |
| `scripts/` | `d2check.sh` (the loop) calls `font-flags.sh`, `svgpost.py` (the post step: labels off bends, keys, tables, tech lines), `d2lint.py`, `semcheck.py`, `d2raster.py` (+ `raster.cjs`, `pngstats.py`); `doctor.sh` (setup), `icon.sh`, `contrast.py` | run |
| `assets/icons/`, `assets/fonts/` | offline Lucide pack (ISC), bundled fonts (OFL) | embedded |
| `dev/run_all_tests.sh` | every suite, one summary table | - |
| `dev/package.sh` | builds `dev/dist/d2-diagram.zip` | - |
| `dev/tests/` | `lint/` (d2lint, rasterizers, d2check end to end, doctor), `semantic/`, `style/`, `templates/` (briefs), `refs/` (doc snippets, export, icon names), `recipes/` (before/after proofs), `structure/`, `routing/` (blind eval of route.md) | - |
| `dev/CHANGELOG.md` | release notes | - |

Conventions: every file is printable ASCII (no tabs, no emoji). Docs call
scripts as `sh ${CLAUDE_SKILL_DIR}/scripts/x.sh` or `python3 .../x.py`, so the
exec bit never matters. Python is standard library only (3.8+) and never
writes `__pycache__` (`sys.dont_write_bytecode = True` before any import of a
skill script; shell runners export `PYTHONDONTWRITEBYTECODE=1`; structure check
(p) and the runner's closing bytecode check enforce it). Shell is POSIX `sh`,
shellcheck-clean in `sh` and `dash` modes. Every code block tagged `d2` in the
docs must render (first line `# fragment` to skip, `# cwd: <dir>` for imports),
and every block tagged `d2-bad` must fail.

## Run the tests

```sh
sh dev/run_all_tests.sh              # every offline suite, then a summary table
sh dev/run_all_tests.sh --network    # also check every icon name over HTTP
sh dev/run_all_tests.sh --llm        # also the routing gate (claude CLI sessions)
sh dev/run_all_tests.sh --quick      # the fast ones: structure, lint, snippets, templates
sh dev/run_all_tests.sh --only recipes,structure
sh dev/run_all_tests.sh --list       # the suites and what they need
```

Logs go to `${TMPDIR:-/tmp}/d2-diagram-tests/<suite>.log` (each run clears
that folder: run one at a time). For a failed suite, its FAIL lines with their
details and the end of its log are printed. Exit 0 means every suite that ran
passed (skipped suites are listed as SKIP with the reason) and no suite left
`__pycache__` or `.pyc` anywhere in the skill (the `bytecode` row); the full run takes
about 10 minutes, `--quick` about 2. The suites need d2 and python3;
the faithful-render cases need Chromium (Node Playwright or a Chrome binary);
`check_export.sh --native` (not run by default) downloads d2's own driver.

| Suite | Command | Proves |
|---|---|---|
| structure | `sh dev/tests/structure/check.sh` | the checks (a)-(p): frontmatter, paths, anchors and `section N` / `rule N` references (and no link from a shipped file into `dev/`), reachability, a heading per code, ASCII, size budgets (SKILL.md 170 lines / 9 KB, playbooks 150, templates 80, each workflow and reference file its own), deleted paths, junk, class lists, script syntax, allowed-tools, templates fmt + routed, the svgpost wiring, no escape-hatch wording ("the honest shape") in the recipes, a recipe grep context (`-A N`) that covers the longest recipe, no way to write bytecode into the skill |
| lint | `python3 dev/tests/lint/run_tests.py` | every d2lint code fires on its case, ok cases stay clean, rasterizer checks |
| d2check | `sh dev/tests/lint/test_d2check.sh` | exit codes, summary lines, file modes, routes, multi-board |
| doctor | `sh dev/tests/lint/test_doctor.sh` | doctor.sh on simulated machines (one dependency taken away at a time) prints the right verdict and fix; every script's `--help` and usage exit |
| semantic | `python3 dev/tests/semantic/run_tests.py` | semcheck codes, brief parsing, `--hint` on real d2 errors, dump/compare |
| style | `sh dev/tests/style/run.sh` | theme contrast, fmt, class coverage, brand rules, a before/after sheet |
| templates | `sh dev/run_all_tests.sh --only templates` | every template: d2check exit 0 against its brief at 800px |
| snippets | `sh dev/tests/refs/check_snippets.sh <md files>` + `selftest.sh` | every doc snippet renders (and every d2-bad fails) |
| export | `sh dev/tests/refs/check_export.sh` | the commands of reference/export.md, run on fixtures |
| recipes | `sh dev/tests/recipes/run.sh` | every `Fix:` in review-and-fix.md (see below) |
| icons | `sh dev/tests/refs/verify_icons.sh` | every icon name in the docs answers HTTP 200 (network) |
| routing | `sh dev/tests/routing/run.sh gate` | blind `claude -p` sessions, given only workflows/route.md, pick the right template for 50 held-out English requests: 90% templates and 83% calls in both modes (needs the claude CLI; `--llm`) |

## Build the zip

```sh
sh dev/package.sh                                            # structure check, then dev/dist/d2-diagram.zip
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) sh dev/package.sh   # reproducible: dated from the last commit
sh dev/package.sh --list                                     # also list entries with their modes
sh dev/package.sh --out /tmp/d2-diagram.zip                  # somewhere else
```

The zip's only root entry is `d2-diagram/`; it holds no `dev/`, `__MACOSX`,
`__pycache__`, `*.zip` or editor leftovers, and `scripts/*.sh` / `*.py` carry
`-rwxr-xr-x`. package.sh reads the zip back and fails if any of that is off,
then unpacks it and runs the structure check on the copy, which catches a doc
that points into `dev/`. With the same `SOURCE_DATE_EPOCH` and the same files,
two builds are byte-identical. `--no-verify` skips both structure checks (for
a draft build only). To check an unpacked zip by hand:
`python3 dev/tests/structure/check.py --skill <dir>/d2-diagram`.

## Add a template

1. `templates/<name>.d2`: line 1 is the pointer comment
   (`# <Type> template. Write D2W/<name>.brief first (workflows/brief.md); reuse its keys.`),
   line 2 `...@neutral-theme`; role classes only (reference/design-system.md
   section 2), fmt-clean, ASCII, at most 80 lines.
2. `dev/tests/templates/<name>.brief` in the format of workflows/brief.md.
3. Gate: `sh scripts/d2check.sh --check-fmt --brief dev/tests/templates/<name>.brief --column 800 templates/<name>.d2 /tmp/t/<name>.svg`
   exits 0 with 0 E- and 0 S- findings; min text >= 12px, displayed height
   <= 900px, content aspect 0.6-2.5; a key wherever S-key asks for one; any
   focus quotes the brief's `# request:`; no W- or I- finding except those on
   an `# expect: W-code xN - <reason>` line of the brief (the templates suite
   enforces all of it). Read the col.png against the rubric in
   workflows/review-and-fix.md. (`--check-fmt`: report formatting, never
   rewrite the shipped template.)
4. Route it: a row in `workflows/route.md` (and the playbook section it
   points to). The structure check fails for a template the router does not name.
   Add it to the catalog table in `README.md` and to the type list in the
   SKILL.md `description:`, then re-run the routing gate (`--llm`).
5. `sh dev/run_all_tests.sh --only structure,templates,snippets`.

## Add a finding code

1. Emit it: d2lint (`Finding("warn", "W-new-code", ...)`, plus `CODE_ORDER`) or
   semcheck (`rep.add('error', 'S-new-code', ...)`). Codes are frozen
   contracts: agree the name first. d2lint's list is also asserted in
   `dev/tests/lint/run_tests.py` (`FROZEN`).
2. Test it: a `bad_*.d2` case with `# expect: W-new-code` in
   `dev/tests/lint/cases/`, or a case in `dev/tests/semantic/run_tests.py`.
3. Document it: a `### W-new-code` section in workflows/review-and-fix.md
   with a `Seen:` line and, once proven, a `Fix:` line.
4. Prove the fix with a recipe pair (next section). Structure check (d) fails
   while a code the scripts emit has no heading.

## Add or change a recipe

A recipe ships only when a before/after pair proves it (the code fires on the
before file and is gone after the fix). Pairs live in `dev/tests/recipes/`:

- `<CODE>.before.d2` / `<CODE>.after.d2`, or `<CODE>.<variant>.*` for a second
  fix of the same code; `compile.<slug>.*` for a row of the compile-error table.
- Brief (for S- codes): `# brief: FILE` in the file, else `<name>.before.brief` /
  `<name>.after.brief`, `<name>.brief` or `<CODE>.brief`.
- Directives on the first lines: `# expect: CODES` (more codes the before must
  show, all proven by the pair), `# allow: CODES (reason)` (codes the after may
  keep; the after of a W- recipe should render clean, so say why one stays),
  `# column: N`, `# d2check: OPTS`, `# d2: FLAGS` (after `--`),
  `# expect-error: TEXT` (compile pairs), `# unescape` (write non-ASCII as
  `\uXXXX`; the repo stays ASCII).
- `neutral-theme.d2`, `snowflake-brand.d2` and `icons/` are symlinks into the
  skill, so pairs always test the shipped theme.

`sh dev/tests/recipes/run.sh` renders every file through the real d2check in a
scratch copy and fails when a pair does not prove its code, when a pair has
no `### CODE` section, or when a section's `Fix:` has no passing pair.
`sh dev/tests/recipes/run.sh W-fanout -v` runs one pair and prints d2check's
output. Toolchain changes (d2check flags, lint thresholds, theme) can move
layouts: rerun the recipes after any of them.

## Release checklist

1. `sh dev/run_all_tests.sh --network --llm`: every suite PASS (routing
   after any change to workflows/route.md or the template set).
2. Look at the pictures: the col.png of every template (the templates suite
   leaves them in its log folder) and `dev/tests/style/run.sh`'s sheet.
3. `sh scripts/doctor.sh` on a machine without Chromium says DEGRADED with a
   working fix; with it, READY (the doctor suite simulates the missing parts).
4. Update `dev/CHANGELOG.md` (version, date, what changed for users).
5. Commit, then `SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) sh dev/package.sh`;
   record the sha256 it prints.
6. Smoke-test the zip: `unzip dev/dist/d2-diagram.zip -d "$(mktemp -d)"`, run
   its `scripts/doctor.sh` and `scripts/d2check.sh` on a copied template.

## Known d2 0.7.1 quirks (and where the skill handles them)

| Quirk | Where |
|---|---|
| `d2 validate` only parses; unknown shapes, bad colours, keywords as edge ends, missing imports and icons pass it and fail the render | reference/syntax.md section 17; d2check gates on the render |
| dagre draws every edge as a spline; `-l`, `-t`, `--pad` and `D2_*` variables override d2-config | reference/layout.md section 1; the theme pins ELK; d2check ignores `D2_*` |
| ELK spacing flags are CLI-only (d2-config rejects them) | reference/layout.md section 8; d2check passes them |
| d2's PNG/PDF export needs a Playwright driver whose download 404s everywhere | reference/export.md section 7; the skill rasterizes with raster.cjs / Chrome |
| rsvg-convert ignores embedded fonts and drops remote icons; cairosvg paints d2 SVGs blank | d2raster.py (rsvg = approximate, cairosvg rejected by pngstats.py) |
| `d2 x.d2 /dev/null` replaces /dev/null (write by rename); board renders delete `X/` first | reference/export.md header and section 5 |
| `d2 fmt` rewrites `C# SDK` to `C # SDK` and splits `a; b`, so S-src-hash and S-src-semicolon only fire on unformatted text; in the loop the brief check reports the result | workflows/review-and-fix.md#s-src-hash |
| crow's feet at the source end render only on `<->`; `style.stroke` paints a sql_table's body | playbooks/erd.md rules 1 and 4 |
| an edge label is measured with the italic face even when `italic: false` | assets/fonts/README.md (Regular passed as italic) |
| nested `direction` is ignored except in grid cells; `grid-columns` alone fills column-major | reference/layout.md section 7; semcheck S-src-direction |
| a later class wins; a class list assigned over a single class is ignored (list over list applies) | workflows/review-and-fix.md#last-class-wins; reference/syntax.md section 7; semcheck S-src-class |
| the native legend (`vars.d2-legend`) is always drawn right of the diagram, shadowed, off-palette, with black text | svgpost.py restyles it and moves it under the diagram when the column is too narrow |
| edge labels sit at the midpoint, often on a bend or a foreign sequence lifeline | svgpost.py slides them to a straight run or a free lifeline gap; d2lint reports what is left |
| keywords are case-sensitive; `Shape: x` at the root silently draws nothing | reference/syntax.md section 16 |
| markdown labels clip in Chromium; theme 303 draws white text on white | reference/syntax.md; reference/design-system.md section 10 |
