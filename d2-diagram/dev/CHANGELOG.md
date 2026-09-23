# Changelog

## 2.2.2 - 2026-09-23: verification of the code templates and the T1-T15 fixes

An adversarial pass (install from the zip under a path with a space, two new requests drawn
end to end, the trial's compare redrawn) found these; each fix has a test.

- Install: `unzip -d ~/.claude/skills/` makes only the last folder of its path, so on a machine
  without `~/.claude` the README's zip line failed. README.md and package.sh now run
  `mkdir -p ~/.claude/skills &&` first; structure check (q) holds every such line to it.
- Label widths: d2 fits EVERY line of a label at its size (16px), `tech` lines 2+ too, though
  svgpost draws them at 14px. The compare budget said 16 characters on `tech` lines at 120px:
  measured, 16-17 character lines need 115-133px. Now: about 13 characters on every line at
  120, 12 at 110 (change.md, compare.d2, design-system.md). E-label-overflow on a box that
  pushed its label out names the widest line and the width d2 needs for it (was: the drawn
  width + 40, often 40px too much), and its recipe keeps the width class of a one-width row
  (a compare panel, a tier): shorten the line, or widen the class (pair E-label-overflow.row).
- W-code-wide: the message kept the fix past d2check's 170-character cut ("br..."); it now
  names the case - a pair side by side stacks (`grid-columns: 1`, 36 a side at 800), a long
  line breaks, and code that fits while the canvas is wide for another reason ("its lines
  fit") sends the fix to the layout (lint cases, a length check in run_tests.py).
- S-code-marker: `<+>` in the block that reads first (left, or above) and `<->` in the other,
  or both kinds in one block, drew the diff backwards and passed. semcheck now flags both
  (semantic cases code_compare*, pair S-code-marker.sides). semcheck read no box for a bare
  code block (svgpost writes its body rect without x/y): a rect's x and y default to 0.
- code-annotated: two callouts under a short snippet (5 lines or fewer) side by side make a
  strip (W-aspect, 650x257); one column (`grid-rows: 2` alone) gives 362x317 (code.md
  section 3, the W-aspect recipe, pair W-aspect.callouts).

## 2.2.1 - 2026-09-23: friction from a real-use trial

A user trial drew two diagrams of one PR (a compare and a flowchart) and logged 15
friction items (T1-T15). Fixed here, each with a test where it is behaviour.

Workflow
- One home for splitting (route.md, "Assume, ask, split"): over budget means past about
  15 nodes once `out:` holds what the request does not need; every diagram of a split is
  drawn, the first first, each with its own brief and loop, one report. "Not split" needs
  one picture asked for in words ("a diagram" alone is not); over budget it groups parts
  and moves detail to `out:`. brief.md section 4, the E-small-text recipe and flowchart.md's
  budget point there.
- A document the user hands over as the request (a handoff, an issue, a goal doc) goes
  into the brief as `# source: <name> "<verbatim passage>"`: its words ground a focus and
  count as asked (semcheck).
- SKILL.md: what to read before the first render (route.md, the template and playbook
  its row names, brief.md sections 2, 3, 5, 7: about 540 lines, was about 1,600) and a
  "Read on demand" table; experiments spelled out (the theme copied into D2W, the same
  `--brief`, PNGs in the sibling `<name>-exp/`); the Re-render line carries `D2_WORK`, so
  a fresh shell finds the brief; a report block per diagram of a split.
- `semcheck.py --sync-labels BRIEF IN.d2` rewrites the brief's node and edge labels to
  the wording the .d2 draws (keys, attributes and comments stay); slips are kept and listed,
  never synced: a label the .d2 cuts (an unquoted `#` or `;`), a bare key (no label written),
  a label the brief wants empty, an edge drawn with none, a chain line.

Templates, playbooks and recipes
- compare: two panels in one grid row, the key `near: bottom-center` (a key cell
  stretched to its column, and three cells filled a 2 x 2 grid); the width budget up
  front (two 120px boxes a row per panel: about 13 characters a line, 16 on `tech` lines
  2+, 110px when a hidden rank edge shifts a row; 132px boxes shrink the canvas to scale
  0.96; stacked panels take boxes to 300).
  Green means added in a compare, so an outcome is never `success`; a failure the
  request names is `danger` with its label naming it.
- flowchart rule 4 and its template: declare the failure EDGE first (at the root ELK
  places a source's targets by edge order, whatever the node order; inside a container
  by node order).
- W-sibling-size: a source ELK drops a rank beside another chain is lifted into its
  peer's row by a hidden edge labelled like that node's edge in; it costs about 20px of
  width (layout.md section 3).
- I-sparse: a narrow spine over a wider row takes the notes the request gives beside
  the steps they explain, each held in its rank by a hidden edge labelled like the spine
  edge beside it (bare, a note lands a rank off).
- design-system.md: `tech` covers any "name\ndetail" second line; the chip key is a root
  `near: bottom-center` container (a rows-only grid may give it a row).

Tests
- structure (l): a template's root grid of R x C holds R x C cells (the old compare
  template fails it). recipes: I-sparse.spine, I-sparse.spine-label, W-sibling-size.rank.
  semantic: 2 codesets and 3 runs for `# source:`, 5 `--sync-labels` cases. d2check:
  the report's Re-render line finds the brief in a fresh shell (T14).

## 2.2.0 - 2026-09-23: code snippets

A short snippet in the picture, when the picture adds what a fenced code block cannot
(CODE-SPEC, the lead's decision after the prototype and two blind judges).

Templates and docs
- Four templates: code-annotated (numbered notes on the lines of one snippet), code-calls
  (what a function reaches, badge N = edge "N. verb"), code-compare (before/after with
  green and red line bands, one note on why; a pair past 36 characters a side stacks),
  code-walkthrough (the code at each step of one request, one card width on a straight
  spine). Briefs in dev/tests/templates; each renders clean at 800px.
- playbooks/code.md (snippet rules, markers, one section per template, Snowflake);
  route.md rows 1-4 and a first tie-breaker (code in the picture only when the request
  gives or points at a snippet and wants it shown), OUT for long listings and diffs, ASK
  for missing code; brief.md (`key: * {code}`); design-system.md, brand-snowflake.md,
  syntax.md section 18, layout.md section 9.
- Themes: `code`, `code-file`, `callouts`, `callout` in both (frames decorative); the
  var `code-keyword` (neutral) and `sf-code-add`/`-del`/`-hl` (Snowflake).

Toolchain
- svgpost.py step 0, code: tokens in four role colours from the theme's vars (text,
  keyword, literal, comment; numbers and constants are literals, a keyword beside a dot
  is text; never bold), a white body with the theme radius, the card body under a
  slate-50 title bar with the path 12px in, trailing markers `<N>` as badges in one
  column (the digit in the embedded mono face) and `<+>` `<->` `<!>` as line bands,
  `callout` "N. text" as badge plus text, the hidden dark copies dropped.
- d2lint.py reads code blocks (one text per line, measured in the mono face): the false
  I-sparse on every code diagram is gone. New E-code-overflow (a line past its card) and
  W-code-wide (code under 13px); a before/after pair at full scale is exempt from
  W-aspect (`aspect_exempt: code-pair`, which the templates gate honours).
- semcheck.py: the `code` attribute; S-code-marker (badges pair with callouts or edges
  1..N down the code, no marker left as text); a `<!>` band is emphasis (S-emphasis);
  --dump writes `key: * {code}`, --compare lists code lines that changed (markers
  ignored); request words found in the code count as covered; a `|` in the code gets a
  compile hint; code pasted into the brief, or `{code}` on the card instead of its block,
  is named with where it goes (agent run a wrote both before it read brief.md), and
  `edges: none` reads as an empty section.
- contrast.py --check audits the code palette too: lowest code text 5.80 (neutral),
  5.06 (Snowflake). d2check's tripwire says to expand tabs in code.
- Tests: 8 lint cases, 4 svgpost fixtures with code-step properties, 12 semantic codesets,
  6 runs (compare, dump, --lint, brief errors), a hint and 2 dump round trips, 4 recipe
  pairs; routing: 4 validation cases, 4 traps, 6 held-out cases written blind from the
  README catalog (gate 56/56 templates, 53/56 calls in both modes).

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
