# Round 5: paused (plan only, not implemented)

The skill in this folder is the version evaluated in round 5, plus the backlog fixes T16-T18
(height-aware E-label-overflow hint, `semcheck --dump` keeps the brief, `semcheck --compare`
lists class and size changes, d2check's `findings:` header). Round 5's fix wave was started
and then stopped at the user's request; none of its edits are in this tree.

Files here (dev only; dev/ is not packaged):
- eval-round5.md: scores of the round-5 evaluation (12 requests; absolute and blind pairwise
  against the original skill). Benchmarks: mean 6.35/10 absolute (original 5.26), 10/10
  pairwise wins.
- FIXPLAN.md: the plan for the next wave, from the judges' root causes: lead decisions D9-D19
  (accuracy before height budgets, width follows content, stores below callers, key policy,
  no worked example may restate an eval request, fit-to-column budgets, one meaning per dash),
  fixes F21-F42, five work packages with frozen interfaces. Paths like $S/w8/... refer to a
  scratch area that no longer exists; the evidence is summarised in the plan itself.
- heldout.js: 10 fresh held-out requests for the next evaluation (share no domain with any
  worked example once the F28 replacements land).

Also open, from real use after round 5 (not yet in FIXPLAN):
- No idiom for proportional bars (work or size bars); route.md sends "numbers" to a chart.
- Two opposite labelled arrows between one pair of boxes: an ELK row gets very wide and grid
  back-edges overprint; the workaround (a box built from two empty halves) needs a recipe, and
  it trips W-title-size and S-missing-node on its hidden ports.
- A deliberate `label.near: outside-*` on a narrow box is reported as E-label-overflow.
- No plain body-text role (caption is bold uppercase).
- The S-duplicate-label compare exemption covers flat before.x / after.x keys only.
- Whether S- warnings block delivery, and whether experiment renders count toward the 6-cycle
  budget, is unclear in SKILL.md (raised by several runs).
