---
name: d2-diagram
description: Generate, validate, format, and render D2 diagrams from requirements, including themes, styles, classes, composition, imports, icons, and exports. Use whenever the user asks for an architecture diagram, flowchart, sequence/ER diagram, or any technical diagram deliverable, not only when D2 is named explicitly.
license: MIT
argument-hint: [requirement text, file path, or refactor goal]
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash(d2 *), Bash(ls *), Bash(pwd *)
---

# D2 Diagram Skill

Use this skill whenever the user asks to create, edit, review, or export D2 diagrams.

You are not just explaining D2. You are teaching-by-doing: produce runnable `.d2`, execute the correct CLI flow, and return reproducible outputs.

## Inputs

- Natural-language diagram requirements.
- Existing `.d2` file path.
- Export targets: `svg`, `png`, `pdf`, `pptx`, `gif`, `txt`.
- Optional constraints: layout engine, theme IDs, dark theme, style rules.

## Mandatory Execution Flow

1. Clarify intent from `$ARGUMENTS` and identify output targets.
2. Choose workflow:
   - new diagram -> `workflows/from-requirements.md`
   - edit existing -> `workflows/edit-existing.md`
   - refactor large -> `workflows/refactor-large.md`
   - export/publish -> `workflows/export-publish.md`
   - live iteration -> `workflows/watch-mode-loop.md`
   - repeated errors -> `workflows/diagnose-and-recover.md`
3. Generate a minimal valid `.d2` first, then enrich incrementally.
4. Before writing any `icon:` line, resolve icons via `workflows/icon-resolution.md` (decision table -> offline pack -> search -> verify - never from memory).
5. Validate:
   - `d2 validate <input.d2>`
   - ASCII tripwire (en scope): labels are English and ASCII-safe. Run the Grep tool with pattern `[^\x00-\x7F]` on the `.d2`, or in any shell: `LC_ALL=C grep -n '[^ -~]' <file>` (works in every grep, GNU or BSD; `d2 fmt` never introduces tabs, so zero hits is the clean state). Emoji hits are hard-rule violations - route them through the icon pipeline. Typographic strays (smart quotes, em dashes) get replaced with ASCII equivalents. This one check also keeps every export format safe, including ascii txt.
6. Format:
   - `d2 fmt <input.d2>`
7. Render:
   - Default deliverable: `d2 <input.d2> <output.svg>` (the Visual Verification Loop adds its own PNG inspection copy).
   - Additional formats - `png`, `pdf`, `pptx`, `gif`, ascii `txt` - are produced ONLY when the user explicitly asked for them; follow `workflows/export-publish.md`. Never emit artifacts beyond what was requested.
8. Run the Visual Verification Loop (section below) on the rendered output.
9. If watch mode is requested:
   - `d2 -w <input.d2> <output.svg>`
10. Return results using `output-contract.md`.

## Visual Verification Loop (mandatory before claiming completion)

`d2 validate` passing does NOT mean the diagram is good. It proves the source compiles, not that the picture communicates. After every render:

1. Produce an inspection copy, by either route:
   - Chromium route: `d2 -l elk --scale 2 <name>.d2 <name>.png` (first run downloads a headless Chromium, ~140 MB; field note: this download has been observed to 404 on linux-arm64 devboxes)
   - Chromium-free route: `d2 -l elk <name>.d2 <name>.svg`, then rasterize externally: `rsvg-convert -z 2 <name>.svg -o <name>.png` (apt: `librsvg2-bin`) or `python3 -c "import cairosvg; cairosvg.svg2png(url='<name>.svg', write_to='<name>.png', scale=2)"` (pip: `cairosvg`). Prefer this route on ARM machines.
   If neither route works, use Degraded mode below - and say so.
2. Open `<name>.png` with the Read tool and actually look at the image.
3. Check, in order:
   - edges crossing each other or passing through node boxes
   - diagonal edges where a horizontal/vertical route would read cleaner (in a `grid`, connect containers, not nodes across cells)
   - labels truncated, overlapping, or colliding with edges; a leaf-node icon overlapping its own multi-line label (reserve `height` - see `reference/15-icon-library.md`)
   - inconsistent flow direction; containers grouping the wrong things
   - icons rendered as intended: no empty boxes, consistent style, monotone icons share one accent color
   - emoji glyphs anywhere (labels, legends, annotations) - replace via the icon pipeline, never ship them
   - dense clusters that would read better with a different engine (`-l dagre` vs `-l elk`) or a different `direction:`
   - diagram rendered but unstyled (default colors)? D2 silently ignores unknown classes - almost always a missing theme import (`...@snowflake-brand`)
4. Inspection copies are working files - never present them as deliverables unless PNG was explicitly requested.
5. If any check fails: edit the `.d2`, re-render, re-inspect. Iterate up to 3 times, then report remaining issues honestly.
6. Only after a pass may completion be reported, per `checklists/quality-gate.md`.

Degraded mode - when PNG is impossible (no Chromium, no rasterizer such as `rsvg-convert` or `cairosvg`): run mechanical SVG checks instead - expected theme hex values present, `<image` tag count matches the number of icons, all key labels present, tripwire clean on the SVG text. One overlap you CAN check geometrically (no pixels): for each `<image>` icon read its `y`/`height`, and for its node label read the last line's baseline (`<text y>` plus the sum of that text's `<tspan dy>` offsets); if the icon top is not below the label's last line by a clear gap they overlap - this reliably catches the leaf-node icon/label collision. The completion report MUST then state "mechanically verified only; visual inspection was not performed" and make no quality claims - mechanical checks cannot see contrast, crossings, or truncation. Do render an ascii copy to a working path (`d2 --ascii-mode standard <name>.d2 /tmp/<name>-check.txt`) and Read it: under the strict-ASCII label rule this reliably verifies topology - what connects to what, and containment - even without pixels. It is an internal check file, not a deliverable; the export gating rule still applies. Offer the environment fix (`pip install cairosvg`, `apt install librsvg2-bin`, or warming up Chromium) so the loop can close next time.

## Decision Rules

- Layout:
  - start with `dagre`
  - switch to `elk` for dense graphs or crossing-heavy edges
  - use `tala` only when TALA-specific behavior is required
  - to fill a doc column without one long chain, wrap the flow into a `grid` "stage per row" and connect stage containers for orthogonal arrows (`reference/06-layouts.md`)
- Composition:
  - use `layers` for isolated alternatives
  - use `scenarios` for variants from common base
  - use `steps` for progressive narratives/animations
- Export:
  - docs/web -> SVG
  - slides -> PPTX or GIF
  - static docs -> PNG/PDF
  - terminal-first -> ASCII

## Hard Rules

- Prefer correctness over visual complexity on first pass.
- Edges are orthogonal: prefer horizontal/vertical routing, avoid diagonals. In a `grid` layout a diagonal edge means you connected nodes across different cells - connect at the container level for clean centered-vertical routing (keep node-to-node edges within one cell). `dagre`/`elk` honor only ONE global `direction`; a serpentine or per-container direction needs TALA. See `reference/06-layouts.md`.
- Keep syntax characters ASCII (`:`, `;`, `.`, `{`, `}`) to avoid Unicode lookalikes.
- Quote labels/keys if reserved symbols conflict with parser.
- Use keys for references, not labels.
- For imports, prefer `@file` style without `.d2` suffix.
- Use `d2 validate` and `d2 fmt` before final render.
- Icons: resolution order lives in `workflows/icon-resolution.md`; knowledge (sources, verified names, color rules, legends) lives in `reference/15-icon-library.md`; the tool of choice is `scripts/icon.sh` (`search` / `verify` / `get`). Never invent icon names or URLs - table and pack names are pre-verified, anything else must return `200` before it ships. A bundled offline pack of 16 pre-colored Lucide icons lives at `${CLAUDE_SKILL_DIR}/assets/icons/`.
- No emoji as visual elements anywhere in the deliverable - not in node/edge labels, not in legends, not in companion text explaining the diagram. Any concept needing a visual marker goes through the icon pipeline (`icon:` + `reference/15-icon-library.md`) or a styled class. Emoji glyphs are also font-dependent across SVG viewers and PNG export, so this is a portability rule as much as a style rule. Build legends inside the diagram as nodes reusing the real classes and icons (see the Legends section of `reference/15-icon-library.md`).
- Labels are English and ASCII-safe (en scope). Non-ASCII content is outside this skill's guarantees; the ASCII tripwire in the validate step enforces this and keeps every export format portable, including ascii txt.
- Snowflake-branded deliverables: copy `${CLAUDE_SKILL_DIR}/templates/snowflake-brand.d2` beside the working `.d2`, spread-import with `...@snowflake-brand`, and follow `reference/16-snowflake-brand.md`. At most ONE secondary accent per diagram; Snowflake Blue is never used as label text. Subtle single-hue background tints to distinguish sections are allowed and do not count as that accent (see `reference/16-snowflake-brand.md`); a saturated multi-color scheme is not.
- Never claim render success without command confirmation.
- Do not skip failure recovery; use `workflows/diagnose-and-recover.md` when commands fail.
- Do not output only theory when the request is execution-oriented.

## Failure Recovery Protocol

1. `d2 validate` failed:
   - quote suspicious labels/keys
   - replace Unicode lookalike punctuation with ASCII
   - isolate to minimal failing block and re-run validate
2. `d2 fmt` failed:
   - fix structural syntax first (maps, blocks, strings)
   - re-run validate then fmt
3. render failed:
   - confirm input exists and validate passes
   - retry with svg first, then target format
   - for png/pdf issues, check browser/runtime dependency assumptions

## Deliverables

- Generated/updated `.d2` file path.
- Executed commands.
- Output artifact paths.
- Validation/formatting status.
- If failed: root cause + next fix steps.
