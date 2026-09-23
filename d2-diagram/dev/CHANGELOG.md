# Changelog

## 2.1.0 - 2026-09-23: round 4 fix wave

From the round-3 evidence (10 benchmark requests judged, 5 review lenses): emphasis
is earned, every encoding has a key, the checker no longer calls an unfinished
picture clean, and the size budget fits a doc column.

Workflow
- Focus is `none` unless the request asks for emphasis; any other focus quotes the
  request words (`focus: api  # "Focus on the API"`, Snowflake `# brand`). `flow`
  marks one described path; peers share one class (workflows/brief.md section 3).
- A colour, dash or weight that means something gets a key: `vars.d2-legend` for
  lines, a `key` row of `chip`s for statuses, a `title` plus key for C4.
- Stop rule: no W- or I-sparse ships unless its recipe was tried in a render cycle
  and failed; `Open:` names the code, the recipe and why. The "honest shape" escape
  hatches are gone; the structure check bans them.
- English only: requests and labels are English; the whole .d2, comments
  included, is plain ASCII.
- Report: `Reviewed:` without the doubled prefix, `Checks:` from d2check's
  `checks:` line, a `Left out:` line; default location `docs/<name>` when docs/
  exists; experiments as `D2W/<name>-exp.d2`; the brand swap replaces the import line.
- route.md: one-picture exception to the offline/online split, named notations
  without a row (use case, fishbone, activity, component), "topology" by what it
  shows, DFD without trust zones, keyword traps, notation-clash defaults, one
  ASK/SPLIT policy for all docs.

Recipes (workflows/review-and-fix.md, every one proven by a before/after pair)
- New codes: W-dogleg, W-label-on-lifeline, S-key, S-src-direction.
- Rewritten around measured levers: W-tall (2x2 flowchart fold: a 10-rank CI/CD
  550x1263 -> 794x733 with its key; `db <- api` lift 610x1034 -> 680x834; sequence and state
  budgets), W-aspect (compact spine, ghosts, side column: 356x779 -> 395x599),
  W-long-edge (`sink <- caller`: 647x941 -> 557x721), W-fanout (a source as wide
  as the row it feeds: a straight fan), I-sparse (container fill),
  W-sibling-size (widths), W-seq-group-ragged (operands end alike), S-emphasis
  (invented, ungrounded, focal in zone-blue), S-src-icon-family (k8s + lucide at
  326CE5 when icons are asked), S-src-class (two themes; a list over a single
  class).
- dev/tests/recipes: 133 pairs. The after file of each new or rewritten W- recipe
  renders clean, or its comment gives the reason for the code its `# allow:` line
  keeps; no note over an activation bar, no focal colour without a request.
- Rubric rows for invented emphasis, missing keys, doglegs and labels far from
  their decision.

Toolchain
- `scripts/svgpost.py` (new): d2check's post step moves labels off bends, borders
  and foreign lifelines, restyles and places the native legend, draws table rules
  and headers in the design system, sets tech lines at 14px slate.
- d2lint: the doc budget (target 1.125x, W-tall past 1.25x, aspect 0.6-2.5 with
  size guards; slides 0.55x, 1.2-3.2), W-dogleg, W-label-on-lifeline, I-sparse
  for half-empty containers, W-sibling-size widths, per-operand
  W-seq-group-ragged; fewer false alarms (W-long-edge needs 2+ bends, W-fanout
  a bent comb, E-label-overflow on the front card of `style.multiple`).
- semcheck: S-emphasis errors for invented or ungrounded emphasis, S-key,
  S-src-direction, two themes, list over a single class, request terms split on
  `/`.

Design
- Theme classes `ghost compact tech title chip key` in both themes; lighter
  sequence chrome (`actor`), constraint tags and class types in slate (AA2).

Templates and playbooks
- All 23 templates pass the templates gate at an 800px column: displayed height
  at most 900 (the tallest was 1226), content aspect 0.6-2.5, and no finding
  beyond the `# expect:` line of their test brief (gitflow: its diagonal cut and
  merge lines); a key wherever S-key asks for one, emphasis only where the test
  request asks. Playbooks carry the per-type levers: the flowchart fold, the
  sequence row budget and saga variant, the state spine with ghosts, C4 with
  `db <- api`, pipeline stages as containers, Kubernetes attachments.

Docs and tests
- reference/layout.md section 9: the budget table and a compaction lever per
  type; `sink <- caller` and ghost sizing in section 3; approximate figures marked.
- reference/syntax.md, export.md, icons.md: fact-check corrections (class-set
  shapes in filters, container sizes are minimums, list-over-list, `data` key,
  keyword messages, the full env list, the watch pid in D2W, the D6 icon pair).
- dev/tests/routing: 50 held-out English cases, share-based gate, an EDIT or OUT
  call scores right whatever template it names.
- dev/tests/structure: (m) svgpost is shipped, named, called and pre-approved;
  (n) no escape-hatch wording; (o) the recipe lookup (`-A 28`) reads the longest
  recipe whole.
- dev/tests/refs/check_export.sh fills the doc commands with quoted paths, so it
  passes with a TMPDIR that has spaces.

Integration (after the five packages landed)
- Snowflake `sf-actor` (white, `#BCE3F7` outline, bold): people, clients and every
  sequence participant, so lifelines stay light in brand colours; `actor` <-> `sf-actor`
  in the brand mapping table and in semcheck's twin hints; a Snowflake sequence sample.
- S-decision counts the one failure edge of a failure scope as the reject exit of a
  decision inside it (no more "list it without {decision}"); pair S-decision.scope.
- The review verdict rests on the column and detail views only: finding boxes that tint
  ann.png no longer turn a faithful review into "NOT visually reviewed".
- A key kept at the right keeps d2's pad to the canvas edge (was half of it).
- No bytecode in the skill: every python entry point turns it off before importing a
  skill script, every shell runner exports PYTHONDONTWRITEBYTECODE; structure check (p)
  and run_all_tests.sh's closing bytecode row enforce it. Structure check (f) gives every
  doc and template a line budget (design-system.md 420).
- Consistency: one legend-endpoint idiom (`style.opacity: 0`), success and failure
  operands of an `alt` tinted in the sequence template, the ERD enum note centred under
  the tables, the fold recipe and layout.md quote the playbook's file (794x733 with its
  key), a C4 context view is titled "System context", README's sample d2check output
  re-run.

Verification of the integration (two new requests drawn end to end from the zip)
- English only: the Chinese routing cases (50 held-out English cases remain), the
  non-Latin request note, the multilingual icon-request words and the reply-language,
  glossary and translation lines are gone; labels stay plain English ASCII.
- A consumer the gateway also calls: the top-row broker crossed the gateway's edge;
  architecture.md rule 2 and W-edge-crossing now put it in the lower zone between producer
  and consumer, each service spanning its store and half the broker (pair
  W-edge-crossing.broker).
- Sequence budget: lifelines stand 150px apart or more, so five participants fit 800px
  and a sixth shrinks the text to 12px (sequence.md, E-small-text; pair
  W-small-text.sequence: a state change becomes a note).
- semcheck's Snowflake twin for `secondary` and `async` names the dash
  (`sf-edge plus style.stroke-dash: 5`), as the brand mapping table does.

## 2.0.0 - 2026-09-23: rewrite

The skill was rebuilt around one idea: ship only what was looked at, at the
size the reader will see it.

Workflow
- New flow: route to a template, write a brief with the node and edge
  inventory, draft from the template, render and inspect with d2check, fix by
  recipe within a 6-cycle budget, deliver with an honest report block
  (`Reviewed: faithful | approximate (rsvg) | NOT visually reviewed`).
- `workflows/route.md` (request -> template + playbook, read for the reader's
  question, gated by a blind routing eval), `workflows/brief.md`,
  `workflows/review-and-fix.md` (rubric, one proven recipe per finding code,
  compile-error table), `workflows/icons.md`; nine playbooks (architecture,
  infrastructure, pipeline, hierarchy, sequence, erd, flowchart, state, change).

Toolchain
- `scripts/d2check.sh`: fmt, ASCII tripwire, render (the render exit code is
  the compile gate), lint, semantic check, faithful Chromium PNGs of the exact
  SVG that ships; one summary with exit codes 0/1/2/3 and a `re-render:` line.
- `scripts/d2lint.py`: 33 geometry and legibility codes measured at the
  displayed size (column width, 10/12px text floors, 1.6x height budget).
- `scripts/semcheck.py`: compares the drawing with the brief (35 S- codes),
  explains, dumps and compares diagrams, and hints d2 compile errors. Without
  a brief, d2check still runs its source checks (unknown classes, `#` and `;`
  slips, mixed icon families, an unpinned engine).
- `scripts/doctor.sh`: prerequisite check with install commands and a no-sudo
  `--install`. `scripts/d2raster.py`, `raster.cjs`, `pngstats.py`: faithful
  rasterizing with blank/cropped-output rejection; PDF through Chromium.
- `scripts/icon.sh`: multi-word search, verify, get (offline fallbacks).

Design
- Neutral design system (`templates/neutral-theme.d2`): role classes, one blue
  focus, semantic hues, 15px uppercase zone titles, upright 14px edge labels,
  ELK and pad 24 pinned in the theme, light-only. Snowflake theme patched
  (Mid-Blue flow edges at 3:1+, new datastore/external/failure classes).
- Bundled fonts: IBM Plex Sans + Geist Mono (default), Lato (Snowflake), Geist
  (opt-in), chosen by a blind bake-off; 40 Lucide icons offline.
- 23 templates, one per question a reader asks: architecture, context, c4,
  llm-app, deployment, network, threat-model, pipeline, depgraph, tree, stack,
  sequence, walkthrough, erd, class, flowchart, swimlane, state, compare,
  steps, timeline, roadmap, gitflow. Every one renders clean in d2check at
  800px against its brief.

Removed
- REVIEW.md, output-contract.md, checklists/, examples/ (3 of 10 were broken),
  the numbered reference stubs (00-16), the old workflows
  (from-requirements, edit-existing, refactor-large, diagnose-and-recover,
  watch-mode-loop, export-publish, icon-resolution) and the old templates
  (sql-erd, class-uml, layers-scenarios-steps, imported-template). Their
  content lives in the new files; wrong claims (validate proves compile,
  cairosvg as a rasterizer, "start with dagre") are gone.

Maintenance
- `dev/`: test suites for lint, d2check, doctor, semantic, style, templates,
  doc snippets, export, icons, recipe proofs, package structure and routing (a
  blind eval of route.md);
  `dev/run_all_tests.sh`; `dev/package.sh` builds a reproducible zip and
  verifies it: layout, exec bits, and the structure check on the unpacked copy.
