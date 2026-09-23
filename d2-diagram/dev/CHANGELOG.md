# Changelog

## 2.0.0 - 2026-09-23: rewrite

The skill was rebuilt around one idea: ship only what was looked at, at the
size the reader will see it.

Workflow
- New flow: route to a template, write a brief with the node and edge
  inventory, draft from the template, render and inspect with d2check, fix by
  recipe within a 6-cycle budget, deliver with an honest report block
  (`Reviewed: faithful | approximate (rsvg) | NOT visually reviewed`).
- `workflows/route.md` (request -> template + playbook), `workflows/brief.md`,
  `workflows/review-and-fix.md` (rubric, one proven recipe per finding code,
  compile-error table), `workflows/icons.md`; six playbooks.

Toolchain
- `scripts/d2check.sh`: fmt, ASCII tripwire, render (the render exit code is
  the compile gate), lint, semantic check, faithful Chromium PNGs of the exact
  SVG that ships; one summary with exit codes 0/1/2/3 and a `re-render:` line.
- `scripts/d2lint.py`: 33 geometry and legibility codes measured at the
  displayed size (column width, 10/12px text floors, 1.6x height budget).
- `scripts/semcheck.py`: compares the drawing with the brief (35 S- codes),
  explains, dumps and compares diagrams, and hints d2 compile errors.
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
- Templates rebuilt or added: architecture, deployment, c4, pipeline,
  sequence, erd, class, flowchart, state, steps (plus the catalog in
  route.md); every one renders clean in d2check at 800px.

Removed
- REVIEW.md, output-contract.md, checklists/, examples/ (3 of 10 were broken),
  the numbered reference stubs (00-16), the old workflows
  (from-requirements, edit-existing, refactor-large, diagnose-and-recover,
  watch-mode-loop, export-publish, icon-resolution) and the old templates
  (sql-erd, class-uml, layers-scenarios-steps, imported-template). Their
  content lives in the new files; wrong claims (validate proves compile,
  cairosvg as a rasterizer, "start with dagre") are gone.

Maintenance
- `dev/`: test suites for lint, d2check, semantic, style, templates, doc
  snippets, export, icons, recipe proofs and package structure;
  `dev/run_all_tests.sh`; `dev/package.sh` builds a reproducible zip and
  verifies it: layout, exec bits, and the structure check on the unpacked copy.
