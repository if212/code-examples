# FIXPLAN - d2-diagram round 6 (fix wave from the round-5 evidence)

Lead planner's plan. Binding: lead decisions D1-D8 (w4/FIXPLAN.md), D9-D19 below, CONVENTIONS.md.
`S` = `<scratch>/new/d2-diagram` (source of truth, stable: T16-T18 landed, `findings:` header).
`W8` = `<scratch>/w8` (round-5 evidence: results/all.txt, new/<id>/). `X` = `<scratch>/w9/exp`
(experiments run while writing this plan, frozen skill copy `W8/skill`). Every file stays printable
ASCII; English only.

## 0. Where we are and what must change

| | Round 5 (12 requests) | Target round 6 |
|---|---|---|
| Absolute mean | 6.35 (r3 6.28, original 5.26) | >= 7.3 on the benchmarks, >= 7.0 on the held-out set |
| layout / legibility / hierarchy / polish / accuracy / embeddability | 6.38 / 7.71 / **5.96** / 6.63 / 7.58 / 7.17 | every dimension >= 7.0 |
| Judge defects high / medium / low | 11 / 52 / 64 (k8s 2, rag 2; oauth, snowflake, ecommerce, cicd, erd, saga, c4 1 each) | 0 high |
| Pairwise vs original | 10/10 (the 10 with a baseline; mean 8.05 vs 5.98) | 10/10 benchmarks, >= 9/10 held-out |
| Run frictions rated high | 5 (semcheck end labels x2, W-fanout zone edge, code with no source x2) | 0 |

Diagnosis (lead's points checked against all.txt and the renders; refined where the evidence says so):
1. **Metric-driven rules cost meaning and looks (confirmed; the main cause of the plateau).** Hierarchy is
   the weakest dimension (5.96) and 7 of the 11 high defects trace to a rule that trades meaning for a lint
   number: steps and replies pruned for W-tall (saga creation step, high; oauth API reply and consent),
   stores lifted into the callers' row by `db <- api` / `pg <- api` (c4 high, k8s high: upward edge, DB reads
   as an entry tier), nodes stretched to span a row for straight edges or to fill an I-sparse void (k8s LB 376,
   Ingress 440, api Deployment 502 against 112 cards, high; c4 API 590; rag hub 580; ecommerce gateway 700),
   the Snowflake Consumers zone dropped "to keep the column in budget", Kafka and three cylinders stretched to
   136px so side-by-side zones end level (ecommerce). Refinement: the ghost technique itself works (order-state
   scored 7.5, the best run); only its invisible leftovers in the SVG are the defect (left margin 70 vs 24px,
   hidden duplicate labels).
2. **The skill measures embeddability differently from its readers.** d2check keeps a narrow SVG at its
   intrinsic size; the rubric scales every SVG to the 800px column ("effective px = authored x 800 / width"),
   so the saga's 677x952 is judged at 800x1125 and the c4's 753x927 at 985. A narrow portrait figure passes
   W-tall while the judge sees it over budget.
3. **Sequence height is a toolchain problem, not a content problem.** d2 0.7.1 spaces message rows about 88px
   apart for a 19px label (oauth: 9% of pixel rows carry ink). The skill answered by pruning. A post step that
   closes empty bands takes the oauth render from 899x1040 to 899x695 (-33%) with nothing removed (X/seq).
4. **Keys misfire in four ways (confirmed, extended):** they explain the obvious (state "main path / side
   exit", snowflake "dbt transform" already on both hops), draw a swatch unlike the thing (a circle for a
   double-bordered pill; line samples at half weight and half dash), sit where they leave a dead block (state
   272x338 under the key, snowflake 283x808), and are missing where colour is not notation (sequence blue,
   red, focal lifeline: design-system section 8 exempts all sequence diagrams). New: key text is not linted
   (d2lint skips `g.d2-key`), so the ERD key shipped at 10.6px with "min text 12px".
5. **Dashes mean six things** (5 runs): boundary, external node, async edge, reply, failure, compensation.
   k8s's key made the whole namespace "outside the cluster"; c4 marks "ours" and "not ours" with one cue; saga's
   compensating request reads as a reply; cicd's failure scope reads "optional".
6. **Benchmark contamination (confirmed, wider than listed).** Verbatim or near-verbatim: sequence.md rule 9
   (saga: the run shipped the example, 677x952 to the pixel), rule 10 (oauth skeleton and its note copied word
   for word), brief.md section 3 focus table (order-state, saga, oauth, ecommerce quoted), state.d2 = the order
   lifecycle, architecture.md section 4 "banking view". Domain-level: architecture.d2 (web + mobile clients,
   gateway, Kafka order events, Payments/Catalog/Orders/Notifications, Stripe, SendGrid = the ecommerce
   request), infrastructure.md k8s snippet (ingress, api Service, Deployment x3, HPA, ConfigMap, Secret,
   Postgres), pipeline.d2 (Snowflake zone RAW/STAGING/MARTS, Fivetran, dbt), erd.md rule 7 and syntax.md
   (users, tasks.assignee_id nullable, comments, memberships), code-walkthrough.d2 (verifyJwt, req.user),
   layout.md section 3 ghost example + section 9 + review-and-fix W-aspect (order lifecycle), flowchart.md
   rule 7 fold (the CI/CD request), flowchart.d2 and sequence.d2 (reserve stock, authorize/charge card: the
   saga), README table (OAuth PKCE; Fivetran/dbt/marts). The benchmark has 12 requests, not 10.
7. **Tool bugs (all confirmed, one refined):** semcheck reads arrowhead labels as mid labels when the SVG has
   no mid label anywhere (reproduced: X/semlab, a 2-node file fails S-edge-label, clean once any other edge has
   a mid label); semcheck drops code nodes from S-inferred (semcheck.py:2649); d2lint `spans()` rounds
   508/112 = 4.54 to 5 and rejects an exact 4 x 112 + 3 x 20 span; layout.md's "siblings of one source: the
   first-declared edge's target goes left whatever the node order" is false (X/order a.d2: declared embed,
   retriever, reranker -> drawn retriever, reranker, embed). Refined: W-long-edge on snowflake's SaaS -> RAW
   was a real accuracy defect (the judge: "contradicts sources flow into ingestion") with a wrong message
   ("hangs off this one edge"); the fix is the pipeline rule plus a message that names the skipped zone.
8. **Code templates (confirmed):** described-not-given code has no path (route.md ASKs; 2 high frictions);
   3x2 callout grid for 5 notes (orphan cell, zig-zag 1 2 / 3 4 / 5; the judge's one-column re-render was
   658x503 instead of 650x666); 264x48 callouts leave ~45 characters, so notes restate code; no failure-line
   marker (a 401 shown with the blue "look here" band); descriptive card titles in mono; one marker per line
   (jwt line 1 has two calls, one badge).
9. **Also found:** "slide/doc" gets the doc layout by an escape hatch (snowflake high: 0.81 portrait on a
   slide); RAG hub-and-spoke hides the query order the request spells out (rag high x2); the CI/CD fold's
   container-to-container stub (cicd high) - fixable node to node (X/fold); ERD parent-end markers stack at a
   shared port (erd high) - the one high defect without a verified fix (F34 starts with the experiment).

### 0.1 Verified while writing this plan

| Experiment (X = w9/exp) | Result | Consequence |
|---|---|---|
| `X/seq/seqcompact.py` on the round-5 oauth SVG (closes every empty vertical band to 20px, moves messages, notes, masks, lifeline ends, viewBox) | 899x1040 -> 899x695 (-33%), every label, note and arrowhead intact (`oauth-c20.png`) | F22: sequence compaction in post; the 9-message cap and "prune replies first" go |
| same on the saga SVG (operand frames treated as occupied) | 677x952 -> 677x804 (-16%); the empty rows INSIDE the operands stay: the production step must treat frame interiors as free | F22 spec: frames are free space except their title band and bottom edge |
| `X/k8s/k8s-v1.d2`: round-5 k8s with natural widths (no 376/440/502) and `api -> pg` below | 956x1386, display 800x1164 (scale 0.84), W-long-edge 512px (2 bends), I-sparse 402px; LB/Ingress/Deployment read at their natural size | D10/D11 cost ~190px on k8s: F25 needs the fit rules and an honest over-budget report, not a lift |
| `X/k8s/k8s-v2.d2`: HPAs written `hpa -> deploy` | HPAs land a rank ABOVE the Services, 764x1537: REJECTED | keep `deploy <- hpa` for attachments (F38) |
| `X/c4/c4-v1.d2`: round-5 c4 with the DB under the API, natural API, boxes 66 tall | 780x1011 (1% over W-tall), E-label-overlap of the two external labels, customer edge through the boundary title | F39: DB under the API is affordable; the external edges need label placement, the title a lane |
| `X/fold/f.d2`: an edge between nodes in two root grid cells | compiles; d2 draws it straight, 100% diagonal (W-diagonal-edge 472px) | F33: allowed as source syntax, rerouted in post |
| `X/fold/cicd2.d2` + 10-line reroute (`cicd2b.png`) | staging -> E2E runs right, up the 48px gutter, right into E2E: one continuous blue path; the failure end inside the right cell (no stretched pill, no hidden hole) | F33: the fold connector |
| `X/order/a.d2`, `b.d2` | ELK reorders siblings that have further edges (layout.md claim false); a `grid-rows: 1` keeps order but d2 draws edges into grid children as straight diagonals | F29/F37: order is carried by numbers, not position; the layout.md row is corrected |
| `X/semlab/endlab.d2` (+ a second edge with a mid label) | false S-edge-label (exit 2) -> clean (exit 0) | F37 reproduction case |
| every template at column 800 through S's d2check (`X/tpl`), fit view computed as h x 800 / w | over 1000 in the fit view: threat-model 1231, pipeline 1219, code-walkthrough 1242, c4 1075, steps 1025; sequence 907 and walkthrough 908 over the 900 target; the rest <= 875 | D14 costs five templates a re-layout or an approved `# expect:` (section 2) |
| n-gram and signature scan (`X/overlap.py`, `X/domain.py`) of the 12 benchmark requests and the 10 held-out requests against every shipped file | benchmark hits listed in diagnosis 6; held-out: 0 six-word overlaps, only generic words (library, copies, branches) | F28 check design: 8-word n-grams + curated signature terms |

## 0.2 Lead decisions D9-D19 (settle every conflict; D1-D8 stand)

**D9 Accuracy first; budgets never delete content.** Order of concerns: (1) every element, step, zone and
relationship the request names, every reply that gates the next step or ends the story, correct direction
and grouping; (2) legible at the target width (text >= 12px); (3) honest geometry: size, position and tier
say what the thing is; (4) height, aspect and whitespace budgets. A budget is met by levers that keep content
(post compaction, `compact`, one-line labels, a fold, landscape, a key moved into a void), else by a split the
route.md split rules allow, else the diagram ships over budget and `Open:` says
`W-tall - kept <what> (the request names it) - <N>% over`. Never drop to meet a budget: a requested node,
step, reply that gates the next step (charge succeeded -> reserve; the API call's response), a requested zone
or group, an edge label the request states. Pruning is allowed only for `{inferred}` content that gates
nothing. The inventory lists gating replies (`{inferred}` when unstated), so semcheck catches their loss
(S-missing-edge).

**D10 Width follows content and role.** A node is as wide as its label needs or as its tier's shared width
class (one class per rank or spine is fine). It is never widened to straighten edges, to span the row it
feeds, or to fill a void. Straight edges come from order and one width class; 2-3 edges fanning from a
natural-width node are drawn as ELK's comb and are fine; 4+ edges into one zone become ONE edge to a zone
that holds exactly those targets (a sub-zone named in the request's words when the zone holds others), else
the comb stays. Heights are never raised to make zones end level. New lint `W-stretched-node` (F25) enforces
it. I-sparse stays a finding, but its levers are content-preserving (the key into the void, order, a note
the request gives); stretching is never one.

**D11 Stores and sinks sit below (or after) their caller.** `db <- api` and `pg <- api` lifts are removed from
every doc and template. A store sits under its caller, inside the caller's boundary when it belongs to the
system; an external sink sits in the next rank below the caller's container. Upward edges are only true
back-edges (a consumer fed by a broker, a loop, an attachment pointing at its owner: `deploy <- hpa`).
W-long-edge does not fire on a downward edge from inside a container to an external node in the rank below
it with at most 2 bends; it names a skipped zone ("skips zone 'Ingestion'") when a straight path would cross
one.

**D12 Key policy.** A key entry exists for each encoding a first-time reader cannot decode from labels or
from the type's standard notation, and for nothing else:
- Required (S-key): `async`, `failure`, `secondary` (outside sequences), `external`, `muted`, `zone-green`,
  `zone-amber`, `zone-violet`; in a sequence also `flow` messages, a `focal` participant and `failure`
  messages (colour is not sequence notation; dashed returns are).
- Not required, and left out unless the diagram needs them to be read: `dep`, `ok` (the green end says it),
  `flow` outside sequences when it is the only blue and marks the path the request writes, an edge class
  whose every edge carries a label naming it (all `dbt` hops), the state dot and double border unless the
  request asks to mark them (then two entries, drawn as the real shapes).
- A swatch looks like the thing: svgpost draws node swatches in the entry's shape (a pill for `terminal`, a
  double outline for `style.double-border`, a cylinder for `datastore`) and line samples at the class's full
  stroke width and dash (no half scale). Key text is at least the diagram's edge-label size and is linted.
- Placement leaves no dead block: svgpost puts the key into the largest empty region of the drawing that
  holds it with 16px margins; else right of the drawing aligned to the emptier end (top or bottom) when that
  fits the column; else one centred strip under the drawing, aligned with any `near: bottom-center` note.

**D13 No worked example restates an eval request.** Templates, fenced ```d2 / ```brief blocks, example rows
and measured-example captions in shipped files use the domains of the F28 allocation table. A dev-only file
`dev/tests/eval/requests.json` lists every benchmark and held-out request with curated signature terms;
structure check (r) fails any shipped file sharing an 8-word run with a request, and any template or fenced
example holding 3+ signature terms of one request. Every replaced example is itself reviewed against the
eval rubric (section 3, "rubric gate"), not only linted.

**D14 Embeddability is measured as readers see it: fit to the column.** The column view scales the SVG to
the column width, up or down (the rubric's formula). Height and aspect budgets apply to that view: target
<= 1.125 x column, `W-tall` past 1.25 x column, `W-aspect` below 0.6 or above 2.5 (slides: 0.55 x column,
1.2-3.2, unchanged). Guard: a drawing whose intrinsic height is under 0.6 x column (480 at 800) never gets
W-tall. The text floor keeps using the intrinsic scale when the SVG is narrower (text only grows). `col.png`
is the fit view.

**D15 Two media named ("for a slide/doc") means both are checked.** The brief takes `width: 800, 1600`;
d2check lints both widths and prints two `display:` lines. First try one landscape layout (content aspect
1.3-2.0) that passes both; if none does, deliver two diagrams from one inventory, `<target>.svg` (doc) and
`<target>-slide.svg` (landscape, `direction: right`), one report block each (`Diagram N of 2`). The escape
hatch "a graph that cannot go landscape gets the doc layout" is deleted.

**D16 Sequences earn blue like everything else.** "A story told from one participant" no longer grounds a
focal participant: column order (leftmost) carries it; `focal` on a participant needs "highlight X" words.
Lifelines are always light (`ink-300`, 1px dashed) whatever the header's class. Compensating requests are
requests (solid), failed replies are replies (dashed).

**D17 Described code is drawn as a sketch.** When the request describes the code line by line but gives no
source (and none is in the repo), draw a minimal, idiomatic, correct sketch in the request's names: at most
12 lines, error paths as described, no invented library, product or config value in node labels ("Token
verifier" not "jose"), card title "<what it is> (sketch)" in the sans title style. The brief marks the code
node `{inferred}` (semcheck lists it), `Assumed:` says "code sketched from the description". ASK only when the
request neither gives nor describes the code ("explain our retry helper").

**D18 One title position per diagram; identifiers keep their case.** Container titles are all top-left, or
(when an edge would strike a top title) all bottom-left for every sibling zone of that row; never mixed. A
title that is an identifier (a namespace, a CIDR, a path, a bucket) sets `style.text-transform: none`.

**D19 One meaning per visual channel.** Dash on a container outline = a boundary the request names (trust,
system, namespace, failure scope); its title names it, so it never takes a key entry. Dash on an edge =
async (architecture, pipeline) or a reply (sequence). Nodes are never dashed: "not ours" (`external`) is a
grey fill (`ink-200`) with a solid `ink-400` outline and `ink-700` text - the C4 convention for external
systems. The round-5 dashes already differed (c4: boundary 10/10, externals 4/4) and the judge still read
them as one cue, so a longer dash is not enough. `actor` loses its grey fill (paper fill, `ink-400`
outline) so a grey node always means external and the User stops being the only filled node (rag).
`failure` edges become solid red at 2px (a failed REPLY adds `style.stroke-dash: 3` like every reply);
compensations are `failure`.

## 1. Fixes F21-F42 (ranked by expected score impact inside each block)

Owners: P1 checks, P2 render/post, P3 structure types + look, P4 behaviour + code types, P5 core docs + eval
hygiene (section 3). Lift = rubric points on the named runs.

### F21. Budgets never delete content (D9) - policy, docs, semantics
- Evidence: saga high (creation step pruned; agent's own experiment with it was 1070px), saga low (charge
  reply pruned), oauth medium (API reply pruned for 1003px), oauth brief "the API response (pruned for
  height)", snowflake medium (Consumers zone removed: +90px would cross 1000), k8s frictions (traffic labels
  dropped "each added a label layer").
- Root cause: playbooks/sequence.md rule 8 and Budget ("at most 9 messages and one note"); rule 9 text ("a
  creation note on top makes it 1070 (W-tall)"); review-and-fix.md W-tall sequence bullet ("Prune inferred
  replies first"); reference/layout.md section 9 sequence row; brief.md section 2 ("d2check holds the render
  to this width ... height at most 1.25x") and layout.md section 9 ("<= 6 ranks") beat pipeline.md's
  checklist ("Zones are the stages the request names (..., Consumers)"): the agent's own source comment reads
  "no zone of their own ... keeps the column in budget".
- Change: SKILL.md step 5 adds one sentence: "Never delete requested content to meet a budget: its levers,
  a split, else Open." (paid by cuts, F40). brief.md section 5 item 1 gains "a reply that gates the next step
  or ends the story is an edge (`{inferred}` when unstated)"; section 2 last paragraph states D9's order.
  sequence.md: rule 8 rewritten to "Keep every requested step and every gating reply; prune only inferred
  rows that gate nothing"; the Budget section re-measured after F22. review-and-fix W-tall: the sequence
  bullet becomes "d2check compacts rows; still over: split by phase (route.md), else Open"; a new first line
  "never delete a requested element, step, reply or zone (D9)". pipeline.md: Consumers is a zone when the
  request lists consumers as a stage.
- Acceptance: `grep -rn "Prune replies\|prune inferred replies\|keeps the column in budget" S` empty (P5
  check (n) extended); semantic case `seq_gating_reply` (P1): brief lists `api -> spa: 200 data {inferred}`,
  the .d2 omits it -> S-missing-edge; saga and oauth re-run (section 4) show the creation step and the API
  reply.
- Risk: taller sequences before F22 lands - F22 must land first (interface I10).
- Lift: saga accuracy +2, oauth accuracy +1, snowflake hierarchy +0.5.

### F22. Sequence compaction in post (enables D9 for sequences)
- Evidence: oauth high (messages 88px apart for 19px labels; 9% ink rows; 925px displayed); saga low (952px
  for 5 messages and 2 notes, 82px dead between reply and note); X/seq prototype -33% / -16%.
- Root cause: d2 0.7.1's fixed row pitch; layout.md section 9 and sequence.md Budget declare it untouchable
  ("nothing in the source changes it: compact by rows").
- Change (P2, NEW `scripts/svgseq.py`, called by svgpost for `shape: sequence_diagram` boards): compute the
  occupied vertical bands (header boxes; each message line +-9px; each label box +-8px; each note +-10px;
  a frame's title band (top 34px) and bottom edge +-8px; span tops and bottoms +-6px; everything else inside
  frames is free), shrink every free band longer than G = 20px to G, and map every y (paths incl. H/V/C
  commands, rects, texts, mask rects, lifeline ends, span rects, frame rects, viewBox and svg height) through
  the monotone piecewise map. Lifelines end 24px below the last element. Idempotent. `post:` reports
  `compacted sequence -<N>px`.
- Acceptance: P2 fixtures `post_seq_oauth.d2` (round-5 oauth source) and `post_seq_saga.d2`: height -30% or
  more on oauth and -25% or more on saga, every text node still inside its frame, no label within 4px of
  another element, arrowheads intact (compare element counts before/after), a second run changes nothing;
  P1 recalibrates W-tall on sequences (lint runs after post). Visual: contact sheet of both, message spacing
  even, notes not touching messages.
- Risk: d2 SVG variants (self-messages, nested groups, spans across groups): fixture coverage for each; on
  any unmapped element type the step aborts and leaves the SVG as d2 wrote it (`post: sequence compaction
  skipped (<why>)`).
- Lift: oauth embeddability +2, layout +1; saga embeddability +1; enables F21 (accuracy).

### F23. Sequence look and rules: full-width frames, true tints, light lifelines, keys, compensations
- Evidence: saga medium x6 (compensation dashed like a reply; focal lifeline 2px blue is the heaviest ink;
  tints washed by multiply 0.5 to grey-beige; both outcome notes identical amber; frame titles float 130px in;
  lopsided header gaps 113/40); oauth medium x4 (no key for blue; lopsided gaps 62/185/58; label masks 1.5px;
  no phase structure), oauth low (generic look).
- Root cause: design-system.md section 8 exempts sequences from keys; neutral-theme `failure` has
  `stroke-dash: 3`; sequence.md rule 9 prescribes `[note; compact]` for both endings and `[actor; focal]`
  for the teller (brief.md s3 table row); svgpost step_sequence slides titles right of the lifeline and keeps
  d2's `.blend` group rects and label masks.
- Change: (P2 svgseq) every top-level frame spans the full lifeline range (first lifeline - 40px to last +
  40px; nested frames inset 12px per level), titles stay in the frame's top-left corner on a paper chip;
  group rects lose the `blend` class and take their class tint at full opacity; lifelines restyled `ink-300`
  1px dash 6 4 whatever the participant class; edge-label mask rects padded to 4px each side. (P4) sequence.md:
  rule 5 allows phase frames (`zone`, "Front channel") now that frames align; rule 9 rewritten on the F28
  travel-booking domain with the creation step, the gating reply, compensation `failure` (solid) and outcome
  notes `[note; compact; success]` / `[note; compact; danger]`; rule 1 participant width = longest one-line
  name x 8.3 + 32, min 120 (no two-line names: "Auth server"), rule 2 caps a label at the gap it spans
  (parameters beyond ~30 characters go into a note); sequence.d2 re-domained (F28) with a key. (P1) S-key per
  D12 for sequences; S-emphasis rejects a participant focus whose quote lacks highlight words (D16).
  (P3) theme: `failure` solid 2px; design-system.md section 8 drops the blanket sequence exemption.
- Acceptance: test_svgpost `seq_frames` (all top-level frame rects share x and width; no `blend` class on a
  group rect; lifeline stroke #CBD5E1 width 1 with a focal participant), `seq_masks` (every mask rect >= label
  width + 8); semantic `seq_key_flow` (flow messages, no key -> S-key), `seq_focal_story` (focus quote "the
  Order service creates" -> S-emphasis); P4 template gate + rubric gate on sequence.d2 and the rule 9/10
  snippets.
- Risk: multiply blend was hiding overlaps of nested operands - check nested fixture; frame titles over the
  first lifeline need their chip.
- Lift: saga hierarchy +1.5, polish +1; oauth hierarchy +1.

### F24. Stores and sinks below their callers (D11)
- Evidence: c4 high (DB in the apps' row, only upward arrow, "reads as a peer tier"), c4 medium (dead
  370x250 quadrant built into the lift), c4 low (boxes 96 tall to match the lifted cylinder); k8s high
  (Postgres beside the LB, 439px upward edge through two borders), k8s low (arrowhead 8px off centre on a
  502px source).
- Root cause: architecture.md section 4 ("The hub's store joins its callers' row, `db <- api`"; banking view
  760x865); templates/c4.d2 (`shop.worker <- shop.api`, `stripe <- shop.worker`); infrastructure.md section 2
  bullet 3 ("A sink fed from deep inside is lifted: `pg <- api`"); layout.md section 3 lever rows `sink <-
  caller`; review-and-fix W-tall store bullet, W-long-edge "Hanging node" fix, I-sparse "a sink: pg <- api".
- Change: delete every lift lever (P5 layout.md s3 + review-and-fix; P3 architecture.md s4,
  infrastructure.md s2, c4.d2, deployment.d2). New wording: "A store sits under its caller, inside the
  boundary when the system owns it; an external sink sits in the next rank under the container its caller
  lives in, its edge labelled at the tail with the port (`:5432`)". W-long-edge (P1) per D11 (exempt the
  down-and-out edge; name a skipped zone). c4 layout per F39.
- Acceptance: `grep -rn "db <- api\|pg <- \|sink <- caller" S/{playbooks,reference,workflows,templates}`
  empty; lint cases `ok_sink_below_container` (external sink one rank under a cluster, 2 bends: no
  W-long-edge) and `bad_skip_stage` (message contains "skips zone"). The round-5 lifts draw straight
  edges, so no lint catches them after the fact: placement is accepted by the P3 fixtures (k8s, c4: the
  store's centre y is below its caller's) and by the rubric gate.
- Risk: +100-190px on c4/k8s (X/c4 780x1011, X/k8s 800x1164 display): D9 accepts it; F25/F38 levers claw
  some back.
- Lift: c4 layout +1, hierarchy +1; k8s layout +1, accuracy +0.5.

### F25. Width follows content: W-stretched-node, rewritten fan-out and I-sparse levers (D10)
- Evidence: k8s high (LB 376, Ingress 440, api Deployment 502 vs 112 cards: "the biggest blocks of ink carry
  the least information"; api reads 4.5x as important as web), k8s medium (asymmetric fork, dead zone), c4
  medium (API 590x96 slab 3.4x the area; externals 285 vs 175 containers), rag medium (580px hub, 560px
  cylinder the emptiest shapes), ecommerce medium x2 (700px gateway misses its row by 50px; Kafka 122x136 and
  cylinders stretched to 136 to end zones level); friction c4 ("I-sparse recipe: draw the entry point as
  wide as the tier it feeds" vs the playbook).
- Root cause: review-and-fix I-sparse ("draw the entry point as wide as the tier it feeds (`width: 620`)"),
  W-fanout ("draw the source as wide as the row it feeds"), W-sibling-size ("side-by-side containers end at
  different heights" -> equal node heights), W-dogleg ("a caller with two partners as wide as both");
  architecture.md rules 5-6 and section 4 ("A hub called by 2+ containers spans them (the API: 420px)");
  infrastructure.md ("the workload spans its row", snippet width 430; network rules 3 and 5, gateways `width: 520`); llm-app.d2 (hub 480/580, floor 680);
  context.d2 (system box 700); code-calls "the card spans the row" (kept: a code card is content).
- Change: P1 d2lint NEW `W-stretched-node` (warning): a leaf node (not a container, grid child, code card or
  key) whose width is >= 2 x the diagram's median leaf width AND >= 2 x its own label need (widest line x the
  font's advance + 32) AND no other node in its rank shares that width (+-4px). Message: "'<key>' is 590px
  wide for a 140px label (median 175): width signals importance - natural width, or one edge to a zone".
  W-sibling-size drops the side-by-side-container-bottoms variant; W-fanout fires only when the fan band is
  >= 60px (3+ distinct bend heights); I-sparse unchanged in detection. P5 recipes: I-sparse levers = key into
  the void (automatic, F26), declaration order, a note the request gives, else Open; W-fanout = zone edge
  when the zone holds exactly the targets (a sub-zone in the request's words), else the comb; W-dogleg tiers
  keep "one width class for both tiers" but drop "as wide as both partners"; W-sibling-size "never raise a
  height to end zones level". P3/P4 templates and playbooks remove every span width (list in section 2).
- Acceptance: lint cases `bad_stretched_node` (k8s round-5 source: 3 hits), `ok_width_class_spine` (a spine
  of five 176px steps with "Lint"-length labels: none), `ok_code_card_row` (none); calibration on W8/new:
  W-stretched-node on k8s (lb, ingress, api), c4 (api), rag (app, vectors), ecommerce (gateway), nowhere else;
  templates gate: 0 W-stretched-node in all 27 templates; grep `S/templates` for `width: [4-9][0-9][0-9]` on a
  leaf lists only code cards and the key.
- Risk: more ELK combs; W-fanout must not re-fire on 3-edge combs (fixture `ok_comb3`).
- Lift: hierarchy +1 on k8s, c4, rag; layout +0.5 on ecommerce.

### F26. Keys that earn their space (D12)
- Evidence: order-state medium x2 (circle swatch for a pill; 272x338 dead block under a top-right key), low
  (key 237x235 spends rows on obvious classes, green success unkeyed); snowflake medium x2 (redundant key;
  283x808 void), low (half-weight line samples); c4 low (key 16px under externals, "database" kind vs
  "[Container]"), k8s medium (key contradicts: blue stops at the fork), erd medium (key text 10.6px, lint
  printed 12px), erd low (dashed + cf-many sample, half dash), oauth/saga medium (no key for colour).
- Root cause: design-system.md section 8 (sequence exemption; swatch "a pill draws as a circle ... name what
  it cannot show"); review-and-fix S-key ("2+ edge classes among flow dep ..."); svgpost step_key (d2's 0.5
  sample scale, top-right placement, 14px items); d2lint skips `g.d2-key` text (d2lint.py:1288);
  state.md rule 8; brief.md s3 ("flow ... stops at the fork" makes the k8s blue end at the Ingress).
- Change: P1 semcheck S-key required set per D12 (+ sequence set); d2lint lints key text size (not
  collisions). P2 svgpost step_key: swatches drawn from the entry's classes (pill, double outline, cylinder)
  and line samples at full width and dash (`vector-effect: non-scaling-stroke`, dash array doubled to undo
  the 0.5 scale); item text 14px min and never below the diagram's edge-label size; placement per D12 (void
  -> right, emptier end -> centred strip under, aligned with a bottom-center note); `post:` says `key
  <void|right-top|right-bottom|below>`. P3 design-system.md section 8 rewritten to D12 (the exempt list, the
  required list, examples in F28 domains). P4 state.d2/state.md: key only for the markers when asked, drawn
  as real shapes; erd.md: optional-FK key line is a head-less dashed sample "optional (nullable FK)". P5
  brief.md s3: "a written chain that forks into peers the request lists: flow continues into every peer
  branch alike".
- Acceptance: test_svgpost `key_void` (state fixture: key inside the drawing's empty region, canvas not
  wider than without key), `key_swatch_pill` (the swatch path for a `terminal` entry has rx = h/2 and two
  outlines with double-border), `key_line_weight` (a `flow` sample renders 2px, dash of `async` 5 5 at
  scale), `key_strip_center` (ERD fixture: key strip centre = note centre +-2px); lint `bad_key_small_text`
  (ERD 1060px: W-small-text names a key label); semantic `key_flow_only` (flow + dep: no S-key),
  `key_dbt_labelled` (all sf-flow edges labelled dbt: no S-key), `key_async_missing` (still S-key).
- Risk: a key in a void may crowd a label: void search excludes label boxes + 16px.
- Lift: order-state polish +0.5, layout +0.5; snowflake layout +1; erd legibility +0.5; sequence hierarchy.

### F27. One meaning per channel (D19)
- Evidence: k8s medium (namespace boundary and managed Postgres both dashed; key made the namespace "outside
  the cluster"), c4 medium (boundary and externals both dashed: "inside" and "not ours" share one cue), rag
  low (dashed LLM reads optional; dashed async edges), cicd low (dashed failure-scope boundary reads optional;
  1px dashed rollback edge ~0.93px), saga medium (compensating request drawn like a reply).
- Root cause: neutral-theme.d2 `boundary` (stroke-dash 5), `external` (stroke-dash 4), `failure`
  (stroke-dash 3); design-system.md sections 2, 4, 6 ("roles differ by dash").
- Change (P3, I3): `failure` solid, stroke-width 2; `external` fill `ink-200`, stroke `ink-400`, no dash,
  font-color `ink-700`; `actor` fill `paper`, stroke `ink-400`; `boundary` unchanged (dashed, 2px). The
  Snowflake twins follow the brand (`sf-external`: the brand gray fill, solid; `sf-failure` solid). Update
  design-system sections 2/4/6/8 (the swatch for "external system" is now a grey box) and brand-snowflake.
  A contact sheet of the c4, k8s, rag, ecommerce fixtures before/after is read by one fresh reviewer with
  the eval rubric ("can you tell ours / not ours / boundary apart?") before P3 hands off. P4: sequence.d2
  and snippets add `style.stroke-dash: 3` to failed replies; flowchart failure edges stay `failure` (now
  solid).
- Acceptance: style test (P3) "no node class has a dashed outline; container dash only on `boundary`; edge
  dash only on `async`/`secondary`; `failure` solid; `external` fill differs from every panel fill it can
  sit on (`zone` ink-100, `boundary` transparent on paper)"; contrast.py --check both themes PASS;
  S-seq-return still passes every sequence template and snippet.
- Risk: every template using `failure`, `external` or `actor` re-renders (most of them): the template gate
  and the P3/P4 rubric gates catch drift; a grey external inside a grey `zone` (ecommerce's "External" zone)
  is two greys (#E2E8F0 on #F1F5F9) - the reviewer checks it reads.
- Lift: hierarchy/polish +0.5 on c4, k8s, cicd, saga.

### F28. Remove benchmark contamination; add the check (D13)
- Evidence: saga medium ("The benchmark is contaminated ... near-verbatim copy of rule 9 ... even 677x952"),
  oauth medium (rule 10 note copied word for word), order-state friction ("templates/state.d2 is almost this
  exact request"), cicd friction (rule 7 example followed "almost verbatim"), snowflake low ("App DB\nPostgres"
  copied), diagnosis 6 list.
- Root cause: examples written from the benchmark prompts in rounds 3-4 (w4 FIXPLAN F8, F14, F7, F10 asked
  for it).
- Change: replace every contaminated example with the allocated domain below, keeping the technique; re-measure
  every quoted size on the new example; update test briefs. P5 adds `dev/tests/eval/requests.json`
  (`{"<id>": {"set": "benchmark"|"heldout", "request": "...", "signature": ["..."]}}`, 22 entries: eval2.js REQ
  + w9/heldout.js) and structure check (r): (1) no shipped file (all but dev/, assets/) shares an 8-token run
  (lowercase `[a-z0-9_]+` tokens) with any request; (2) no template and no fenced ```d2/```brief block holds 3+
  signature terms of one request; failures print file:line and the request id. Warn-only until P3/P4 land,
  strict at integration.

  | Replaced example (owner) | Was (benchmark) | New domain (technique kept) |
  |---|---|---|
  | architecture.d2, architecture.md rules 1-3 snippets (P3) | ecommerce: web+mobile, gateway, Kafka order events, Stripe, SendGrid | fitness app backend: web and watch apps, API gateway, Workouts / Profiles / Leaderboards services, "workout events" topic, Achievements worker, Postgres, Redis, push via Firebase Cloud Messaging (external), Strava import (external) |
  | c4.d2, context.d2, architecture.md s4 (P3) | internet banking (and "online shop") | university course registration: students and advisors, registration SPA, admin app, Registrar API, worker, Postgres; externals: student information system, payment provider, email service |
  | deployment.d2, infrastructure.md s2 snippet (P3) | k8s: ingress, api Service, Deployment x3, HPA, ConfigMap, Secret, Postgres | chat backend on AKS: ingress, ns chat: websocket gateway Deployment (3 replicas) + HPA, presence Deployment, ConfigMap, Secret; Azure Cache for Redis and Cosmos DB outside |
  | pipeline.d2, pipeline.md checklist/rules (P3) | Snowflake ELT: Fivetran, RAW/STAGING/MARTS, dbt | product analytics lakehouse: mobile event export, CRM via Airbyte, billing DB; Databricks bronze / silver / gold built by Spark jobs; Power BI and a feature store |
  | llm-app.d2 RAG notes, pipeline.md rule 9 wording (P3) | RAG chatbot: Confluence/Drive, pgvector, rerank | keep the support-agent template (Zendesk, Claude API); rule 9 examples: a legal-contracts search assistant over SharePoint |
  | walkthrough.d2 (P3) | ecommerce: CloudFront, Kong, Orders/Catalog/Cart APIs | photo sharing: GET /photos/42 through a CDN, gateway, Photos API, Postgres |
  | sequence.d2 (P4) | checkout: Orders API, Stripe charge alt | ride request: Rider app, Dispatch API, Pricing, Driver app; alt driver accepts / no driver in 60 s |
  | sequence.md rule 9 (P4) | checkout saga | travel booking saga: Trip service books a flight, then a hotel; hotel fails -> cancel flight (compensate), trip cancelled |
  | sequence.md rule 10, brief.md s3 row (P4, P5) | OAuth PKCE code_verifier | signed webhook: sender computes an HMAC signature header, receiver recomputes and compares, rejects on mismatch |
  | state.d2, state.md rules 3-8, layout.md s3 ghost example + s9 row, review-and-fix W-aspect (P4, P5) | order lifecycle | subscription: trialing -> active -> past due -> canceled; trial expires; past due -> active on payment (loop) |
  | flowchart.d2 (P4) | order fulfilment with "reserve stock / authorize card" (saga terms) | content moderation: post submitted -> spam, toxicity and image checks in parallel -> publish; flagged -> human review decision |
  | flowchart.md rule 7 fold, review-and-fix W-tall fold bullet (P4, P5) | the CI/CD request | employee onboarding: offer signed -> laptop, accounts, badge in parallel -> orientation -> team intro -> 30-day check-in decision; any failure in the first month -> HR escalation |
  | erd.md rule 7, syntax.md sql_table example (P4, P5) | users / tasks.assignee_id / comments / memberships | blog: authors, posts (reviewer_id nullable), comments by readers; enrollments for the join example |
  | code-walkthrough.d2 (P4) | verifyJwt, req.user | invoice PDF download: Django middleware loads the tenant, the view queries invoices, SQL |
  | code-calls.d2 (P4) | checkout: pricing, reserve stock, Stripe charge | signup handler: validate, hash password, insert user, enqueue welcome email, track event |
  | brief.md s3 focus table + peers bullet (P5) | order-state, saga, oauth, ecommerce quoted | subscription chain; "the Trip service books a flight, then asks Hotels ..."; "including the HMAC signature"; "Architecture of a fitness app: web and watch apps ..." |
  | README.md template table (P5) | "OAuth login with PKCE", "Fivetran into raw, dbt staging and marts" | "a signed webhook delivery", "Airbyte into bronze, Spark silver and gold" |

  No replacement may use a held-out domain (video streaming, GKE inference, TOTP login, insurance claims,
  library lending, expense reimbursement, smart-meter IoT, clinic booking, token-bucket rate limiter, React
  fetch/abort).
- Acceptance: `sh dev/tests/structure/check.sh` (r) strict PASS; P5 runs it once against the pre-fix tree and
  records the hits (the table above must be the list it prints, nothing missed); every replaced example
  passes the rubric gate (section 3).
- Risk: replacements that are merely renamed copies teach the same answer to a structurally identical
  held-out request: the rubric gate reviewer also checks "is this a relabelled benchmark answer?".
- Lift: honest measurement (the saga's 6.0 was measuring the example); no direct score gain expected.

### F29. RAG and LLM apps: the query order is visible
- Evidence: rag high (six unnumbered `<->` spokes; "the core of a RAG diagram cannot be read"), rag high
  (callee row Embedding, Reranker, Retriever after two declaration orders; shipped with "declared in request
  order"), rag medium x4 (three Z-doglegs; paths not grouped; flat weight with 580px hub; label band), low
  (LLM invented external; feedback not from the User; hooked heads), friction (template has no
  embedding-model node).
- Root cause: architecture.md s5 ("Every online call is ONE <-> edge, request / answer ... all in one class";
  "the model is external unless self-hosted"; "The indexing source and job sit at the root, never in a
  zone: ... 303px hole"); llm-app.d2 (no shared embedding model, hub 480); layout.md s3 order claim;
  pipeline.md rule 9 ("Both paths as stage zones ... 1331px tower: for one picture draw the app view").
- Change (P3): architecture.md s5 + llm-app.d2: when the request orders the online steps, each call edge is
  numbered in request order (`"1. embed question"`, one-way `->` for a call whose answer the next step
  carries, `<->` only when the answer comes back to the caller and is used there); the embedding model is
  ONE node in the template, used by both paths; the request's paths are zones when it names them ("At query
  time", "offline evaluation") - D9 beats the I-sparse argument; the model is `external` only when the
  request says hosted/third party; feedback starts at the User. (P5) layout.md s3 row corrected: "ELK keeps
  declaration order only between siblings with no other edges; otherwise crossing minimisation decides:
  carry reading order in numbered labels" (X/order evidence).
- Acceptance: llm-app template gate + rubric gate; a P3 fixture from the round-5 rag inventory rendered with
  the new rules: numbers 1..n visible in order, 0 W-stretched-node, <= 1 W-dogleg.
- Risk: zones + numbers on a 12-node RAG may exceed 900 fit-to-width: D9 (report) or the split by path that
  route.md already allows.
- Lift: rag hierarchy +2, accuracy +1 (5.5 -> ~7).

### F30. Two media named: both are checked (D15)
- Evidence: snowflake high (portrait 796x981, aspect 0.81 on a 16:9 slide; slide W-tall/W-aspect never
  checked), friction ("the skill offers no fallback for the slide half").
- Root cause: brief.md s2 row "Both ... a graph that cannot go landscape gets the doc layout".
- Change: P1 semcheck brief parser accepts `width: 800, 1600`; P2 d2check lints each width (two `display:`
  lines, the lint JSON per width, col.png per width named `<name>.col-<w>.png`), exit status the worse of
  the two; P5 brief.md s2 row per D15, SKILL.md step 1.3 "(800 docs, 1600 slides; both: `800, 1600`)";
  P3 pipeline.md rule 8 gives the landscape recipe as the slide half.
- Acceptance: test_d2check `two_widths` (a 1384x468 pipeline: 800 -> E-small-text, 1600 -> clean: exit 2 and
  both display lines), semantic `width_list`.
- Risk: double raster time (about +2 s a cycle): only when two widths are listed.
- Lift: snowflake embeddability +2.

### F31. Pipelines: stages are what the request says they are
- Evidence: snowflake medium x5 (SaaS -> RAW skips Ingestion; Fivetran not a node though the request's
  ingestion stage is made of tools; consumers without a zone; Snowpark outside Snowflake; zones zig-zag with
  no shared axis), low x3 ("App DB" invented role; cylinder labels hug the rim; off-centre exits from mixed
  widths); frictions (tool-hop vs stage rule conflict; role labels).
- Root cause: pipeline.md checklist ("Tools that move data (Fivetran, dbt, a Spark job) label the hops ...
  never a node"; "Labels are `<role>\n<tool>` ... role first everywhere" with "App DB\nPostgres"), rule 1
  ("Stage rows of different widths are fine: ELK centres"), rule 4 (90/106px cylinders as targets);
  brand-snowflake.md s5 (nothing about native services).
- Change (P3): pipeline.md: "A tool the request lists as a member of a stage is a node of that stage; a
  tool the request puts on a hop ('built by Spark jobs', 'synced by Airbyte') labels that hop" (examples in
  the F28 lakehouse domain, never the benchmark's tools); "Label = the request's words; a role line only when the request gives one, a
  tool line only when named"; consumers get a zone when the request lists them as a stage; stage zones share
  one width class for their nodes and are centred on one axis (declare the widest stage first); cylinder
  heights 102 / 118 (label centred in the body by svgpost, F42). brand-snowflake.md s5: Snowflake-native
  services (Snowpark, Streamlit in Snowflake, Cortex, Tasks) sit inside the Snowflake container.
- Acceptance: pipeline template gate + rubric gate; a P3 fixture from the round-5 snowflake inventory:
  0 W-long-edge, every source edge enters Ingestion, Consumers zone present, zones' centres within 8px.
- Lift: snowflake accuracy +1, layout +1.

### F32. Architecture tiers without distortion
- Evidence: ecommerce high (Data nodes ~60px left of callers, 4 of 5 doglegs), medium x5 (28px S-jog near a
  head passes W-edge-jog; zones ragged, gateway 50px off its row; gateway edge into a zone that holds the
  worker it does not route to; shapes stretched; titles top and bottom mixed), low x4 (External zone
  diagonal via a hidden rank edge; 6 services at width 100; label band; "consumes" reads backwards); friction
  high (zone edge vs a zone with a non-target).
- Root cause: architecture.md rules 1-7 (one lower zone assumption, rule 3 zone edge, rule 5 widen, rule 6
  heights, rule 7 bottom-left titles, rule 2 `consumes` label), architecture.d2 (lower zone `bottom-left`,
  `width: 720`), review-and-fix W-fanout ("semcheck accepts a container edge that covers every child"),
  d2lint W-edge-jog (16px).
- Change (P3): architecture.md: rule 3 per D10 (zone edge only to a zone holding exactly its targets; the
  others (the worker) in their own named place); rule 6 per D10 (no height matching); rule 7 per D18;
  rule 2 label reads source -> target ("delivers" on broker -> consumer, or the arrow reversed with
  "consumes"); new rule: two lower zones the request names sit side by side, each under its callers,
  third parties in one column only when their callers are adjacent. (P1) W-edge-jog: also fires on any
  kink whose last run into the arrowhead is < 24px after a bend (hooked head, also rag), threshold for the
  middle segment 16 -> 32px. (P5) review-and-fix W-fanout per F25.
- Acceptance: lint `bad_edge_jog_28` (the ecommerce 28px S-jog fires), `bad_hooked_head` (rag's 8px final
  run fires), semantic `zone_edge_extra_child` (P1 adds it if the suite lacks it); architecture template
  gate + rubric gate.
- Lift: ecommerce layout +1, hierarchy +0.5.

### F33. Flowchart fold with a real handoff
- Evidence: cicd high (26px container-to-container stub at mid-height, "Z-shaped jump"), medium x4 (Roll back
  stretched to 340px by the grid cell; decision with one exit; redundant green `ok`; failure scope dashed),
  low x4 (dead 436x144 hole cell; two-line label in a 48px compact box; nested zone same fill; uneven rank
  rhythm; 858px canvas), pairwise closest margin (7.8 vs 7.0).
- Root cause: flowchart.md rule 7 (2x2 root grid, `build -> release` container edge, hidden hole, failure
  end in a root cell), skeleton ("the hop into success ok"), `compact` on two-line steps, nested `zone` in
  `zone`.
- Change: (P2) svgpost `fold`: in a root grid of 1 row x 2 columns, an edge between two nodes in different
  cells is rerouted: from the source's right side at its centre y, right to the gutter centre, vertical to
  the target's centre y, right into the target's left side; 10px corner arcs; its label (if any) on the
  vertical run; mask rect moved; `post: rerouted N fold edge(s)`. (P4) flowchart.md rule 7 + template: root
  `grid-columns: 2` (one row); each cell is a `frame` (I3: transparent, no stroke, no title), so no group
  is invented for the layout (the round-5 "CI and staging" zone was, and it nested a zone in a zone); the
  left frame holds the first steps and the parallel `zone`, the right frame holds the failure-scope
  `boundary` and the failure end under it; the handoff is written node to node,
  `left.last -> right.scope.first`; step width 176; `ok` dropped (the success end is green); `compact`
  only on one-line labels. The decision's reject exit is tried as its own edge to the failure end, kept if
  the spine drifts <= 8px, else the B58 form ("any failure or rejected" on the scope's one failure edge).
  F28 domain for the example.
- Acceptance: test_svgpost `fold_connector` (cicd-shaped fixture: the edge path has exactly 4 points (3
  segments), axis-aligned, starts at source right edge, ends at target left edge, no W-diagonal-edge after
  post); P4 template gate: flowchart.d2 0 W-, no node wider than its class; rubric gate. X/fold/cicd2b.png is
  the target look.
- Risk: `frame` must be exempt from W-unclassed/S-key and count as structure, not content (P1); a frame
  cell still stretches to its row height, so its content is top-aligned (X/fold/cicd2b.png shows the
  left panel's empty lower part only because that experiment kept a filled zone there).
- Lift: cicd layout +1, hierarchy +0.5 (7.0 -> ~7.8).

### F34. ERD: readable ports, reproducible width, honest notes
- Evidence: erd high (three heads stacked at users.id: "an 8px blob"), medium x4 (forks inside the markers
  with edgeNodeBetweenLayers 20; key 10.6px unlinted; note and key misaligned; loud amber note of invented
  values), low x4 (dash + cf-many key sample; centred enum lines; collinear verticals 31px apart; width at the
  floor only via a CLI flag); frictions (budget table unreachable: 1364 -> 1096 vs "1025"; two enums, one
  `near`; note 14px the smallest text; no way to mark inferred columns).
- Root cause: erd.md rules 6-7 and budget table; d2check (`--elk-edgeNodeBetweenLayers 20` for all ELK,
  layer gap fixed 72 for sql_table); neutral-theme `note` (amber, 14px); svgpost key placement.
- Change: (P2) d2check: sql_table files get `--elk-edgeNodeBetweenLayers 32` (a bend clears a 12px marker);
  a first-lines pragma `# d2check: layer-gap <48..72>` for sql_table files (echoed in `re-render:`);
  svgpost `ports`: 2-3 relationship ends meeting one row side are spread over the row height (pitch 8px) with
  a 16px straight stub before any bend; 4+ -> lint. Experiment first (P2, day 1): the saas-erd round-5 source
  with the spread; accept if no two parent-end markers overlap by more than 2px at 2x, else fall back to
  rule text "a PK referenced 3+ times: order the child FK rows so ELK uses both sides" and record it. (P1)
  d2lint NEW-lite: W-edge-overlap also reports parallel segments of different edges closer than 12px for
  more than 80px. (P4) erd.md: budget table re-measured on the F28 blog schema with the new gaps; enum values
  only when the request gives them (else the type name in the column is enough); enum lines and remarks use
  the new quiet theme class `aside` (I3), never the amber `note`; two enums -> one `aside`, one
  left-aligned line per type; the optional-FK key line is a head-less dashed sample. Brief `cols:` gains `?`
  for an inferred column (`cols: id name? slug?`) - P1 parser, listed in S-inferred.
- Acceptance: test_svgpost `erd_ports` (fixture from W8/new/saas-erd: parent-end marker boxes overlap <= 2px),
  test_d2check `layer_gap_pragma`; semantic `erd_inferred_cols`; erd template gate + rubric gate.
- Risk: the spread may push a marker off a short row: clamp to the row box.
- Lift: saas-erd legibility +1, hierarchy +0.5.

### F35. Code templates: sketches, one-column notes, failure marker
- Evidence: jwt medium x3 (401 only as a blue band; badges ~500px from their edges; line 1 calls the library
  too, one badge per line), low x4 (invented "jose"; reconstructed code unsafe; 99px rails; mono descriptive
  title); retry medium x2 (orphan cell / zig-zag; notes restate code), low x5 (badge column inside the code;
  indented notes and a dead band; flat callout type; invented defaults; uneven rhythm); frictions high x2 (no
  path for described code), low (odd counts, request order vs top-down numbering, rubric location).
- Root cause: route.md row 1 and code.md s1 (ASK / never invent); code.md s2 (one marker; badge column after
  the longest MARKED line), s3 (grid-rows ceil(n/2) then grid-columns 2; 264x48 callouts), s4 (card spans the
  row, badge only in the code); svgpost `code_title` (always mono), CODE_MARK (one marker); semcheck
  S-inferred skips code nodes.
- Change: (P2, hour 0) move `step_code` and its helpers from svgpost.py into NEW `scripts/svgcode.py`
  unchanged; svgpost imports it. (P4, owns svgcode.py after that) markers per interface I4: `<x>` = failure
  band (danger-100 row, danger-600 3px left bar), up to two markers per line (`// <1> <2>`, `// <2> <x>`);
  badge column after the longest line of the whole block + 16px; a light ink-50 band on each numbered line
  (under the `<!>`/`<x>` bands); card title in sans 14px bold ink-700 unless it looks like a path (has `/` or
  ends in `.<1-5 letters>`); in code-calls, an edge label "N. verb" is drawn with the same badge glyph as the
  code. code.md + code-annotated.d2: callouts in ONE column (`grid-rows: N` only), each as wide as the card,
  one or two lines of about 60 characters ("what it does, and why / what happens when"), 26px (one line) or
  44px (two) tall, gap 4; a callout's lead-in ends with a colon ("The backoff: ...") and svgcode sets the
  words before the first colon in bold. D17 sketch path in code.md s1 (P4) and route.md row 1 (P5);
  "one external call per numbered line; two calls on one line take two numbers". (P1) semcheck: code nodes
  enter S-inferred; S-code-marker accepts I4 syntax.
- Acceptance: P4 NEW dev/tests/code/test_svgcode.sh: `<x>` band colours, two badges on one line (distinct x,
  same y), badge column x > end of the longest line, sans title for "Session loader (sketch)", mono for
  "src/auth.ts", badge glyph on code-calls edge labels; the round-5 retry source re-laid as one column renders
  <= 660x510 at 800 (judge measured 658x503); semantic `code_inferred`, `marker_x`, `marker_two`; routing
  case: "show how our X middleware works: <line-by-line description>" routes GO (not ASK); rubric gate on the
  four code templates.
- Risk: svgcode split breaks test_svgpost's code fixtures: P2 runs them after the move before handing over.
- Lift: retry hierarchy +1, polish +0.5; jwt accuracy +1, hierarchy +0.5.

### F36. State machines: no scaffolding in the output, true markers
- Evidence: order-state medium (left margin 70 vs 24: ghosts and their labels set the viewBox), low (hidden
  duplicate labels "pay/ship/deliver"; start edge leans 0.9px; exits leave from the bottom face; paid ->
  refunded 400px edge 20px under Cancelled), medium x2 (key, F26).
- Root cause: state.md rule 3 / layout.md s3 (ghost edges carry the sibling's label); svgpost keeps opacity-0
  groups (`aria-hidden` only); d2lint TILT_PX 8.
- Change: (P2) svgpost `strip`: delete every opacity-0 node, edge and edge label outside the key after layout
  and trim the viewBox to the visible ink + pad; `snap`: a segment leaning < 2px off its axis is made exact.
  (P4) state.md rule 4: two exits into one final (round 5: a 400px paid -> refunded edge 20px under
  Cancelled): P4 tries a ghost in the empty slot beside the later source so the shared final rises one rank;
  the lever goes into the rule only if the long edge drops under 250px and clears other nodes by 16px, else
  the rule says the gap is the cost of one shared final. Template on the F28 subscription with a loop
  (`active <- past_due: payment succeeds`).
- Acceptance: test_svgpost `strip_ghosts` (state fixture: no element with opacity 0 outside `d2-key`, left
  margin = pad +-2), `snap_axis`; state template gate + rubric gate.
- Lift: order-state layout +0.5, polish +0.5.

### F37. Tool bugs and small toolchain fixes
- semcheck (P1): end labels classified by position, not by mask existence (a text within 40px of a path end
  and outside every mid-label mask is an end label, whatever the mask count); code nodes in S-inferred;
  `width:` list (F30); `cols:` `?` (F34); S-key set (D12); S-emphasis participant rule (D16); S-code-marker
  syntax (I4). Cases: `end_labels_only` (X/semlab file: clean), `end_labels_mixed`.
- d2lint (P1): `spans()` tries every n in 2..floor(x/unit) and accepts one gap in 0..40 (508 = 4 x 112 + 3 x
  20 passes); key text linted for size; W-long-edge per D11; W-edge-jog per F32; W-stretched-node (F25);
  W-tall/W-aspect fit view (D14) with the JSON fields `display_fit: [w, h]` next to `display`. Cases:
  `ok_spans_508`, `bad_tall_fit` (677x952 -> W-tall), `ok_small_narrow` (300x400: no W-tall).
- d2check (P2): `re-render:` prints the SKILL.md form (`D2_WORK=... sh .../d2check.sh [--column W]
  <target>.d2`), never a raw d2 line (friction rag); a render of a file inside D2W copies the target's
  `icons/` and theme next to it when missing (friction k8s experiments); col.png = fit view (D14);
  two widths (F30); ERD flags (F34). Cases in test_d2check.
- layout.md (P5): the section 3 order row (X/order), the lift rows deleted (F24), section 9 rows re-measured.
- Lift: removes 2 high frictions and ~1 wasted cycle a run.

### F38. Kubernetes and deployment specifics
- Evidence: k8s medium ("Deployment x3" on a stacked card reads as three Deployments; key contradicts blue
  stopping at the fork; a fifth of the canvas empty), low ("Cloud LB / load balancer" filler lines; "NS: APP"
  uppercased; mixed icon styles; unlabelled hop leaving the cluster; 112px cramped cards).
- Root cause: infrastructure.md s2 ("the count in the label", `"api\nDeployment x3"`, "share one label line
  count", "a hop crossing two borders ... leave it bare", "the workload spans its row"), icons.md s2
  (colour alone unifies lucide with k8s), neutral-theme `text-transform: uppercase` on titles.
- Change (P3): label `"api\nDeployment, 3 replicas"`; one label line count per diagram only when every card
  has a real second line - else one line (no glosses); the hop leaving the cluster labelled at its tail
  (`source-arrowhead.label: ":5432"`, the port class); icon cards without a fixed width (icons.md s5 rule);
  the lucide icons of non-k8s parts (internet, load balancer, database) stay `--color 326CE5`; a badge
  treatment is tried on the contact sheet and adopted only if the reviewer reads the set as one family;
  ns titles per D18. Flow along every peer branch (F26).
- Acceptance: deployment template gate + rubric gate; P3 fixture from the round-5 k8s inventory under the new
  rules: 0 W-stretched-node, no upward edge to Postgres, over-budget reported per D9 if it is.
- Lift: k8s hierarchy +1, accuracy +0.5.

### F39. C4 container views
- Evidence: c4 high (lifted DB), medium x4 (void; API slab; same dash for boundary and externals; wireframe
  look), low x7 (off-centre ports; person label under edge fork; boundary title in the corner radius; labels
  resting on the boundary line; bold type tags; key rhythm and "database" kind; 96px boxes); frictions
  (template box 150 too narrow; boundary title width vs store column; I-sparse vs person rule; "[Container]"
  without protocol).
- Root cause: architecture.md s4 (lift, spans, `top-left over the lifted store`), c4.d2, svgpost tech step
  (keeps bold on lines 2+), design-system s8 C4 key list.
- Change (P3): c4.d2 on the F28 domain: DB under the API inside the boundary, externals under the boundary
  in the API's edge order, boxes 176 x 66, API natural width, boundary title top-left over the leftmost
  column with a declared first child whose column is at least the title's width (or `bottom-left` when an
  edge leaves the bottom there, D18), key = container, external system, relationship (a database is a
  container; its cylinder needs no line); the person's label must not sit where its edges leave (round 5:
  the stubs touched "[Person]"): P3 measures a `c4-person` size that holds the label inside, else writes the
  person's edges to leave from its sides; either is proven on the fixture before it goes into the template. (P2)
  svgpost tech step: lines 2+ `font-weight: 400` (applies everywhere). A C4 tint for the system's own
  containers is NOT added (D1: emphasis earned); polish comes from F27's distinct external look.
- Acceptance: c4 template gate + rubric gate; P3 fixture from the round-5 c4 inventory: DB below the API, 0
  W-stretched-node, 0 E-, over-budget reported per D9 if > 1000 fit view (X/c4: 780x1011).
- Lift: c4 hierarchy +1, layout +1.

### F40. SKILL.md clarity (paid by cuts: 9209 of 9216 bytes)
- Evidence: frictions in 5 runs: the rubric's location (order-state, retry, jwt, ecommerce, saas-erd);
  ann.png only exists with findings (cicd, order-state, jwt); whether experiments count toward the 6 cycles
  (ecommerce, saas-erd, c4).
- Change (P5): step 4 "`ann.png` (when there are findings)"; the exit-0 row "the warnings, then the rubric
  (`workflows/review-and-fix.md`, top)"; step 5 "Experiments do not count; at most 3." and the D9 sentence
  (F21). Cuts of at least the added bytes: the "Editing an existing .d2" section tightened (it restates
  semcheck flags listed in the Read-on-demand table) and the "Where things live" rows merged; never the
  frontmatter description (it drives triggering). The structure limit stays 9216 bytes (no raise).
- Acceptance: structure check (f) PASS; `wc -c SKILL.md` <= 9216; the three phrases present.
- Lift: fewer wasted cycles; no direct score.

### F41. Held-out evaluation set
- `w9/heldout.js` (this plan): 10 requests - architecture (video-on-demand), deployment (GKE inference),
  sequence (TOTP two-factor login, success + lockout), state (insurance claim, a loop and 4 terminals),
  ERD (library lending, nullable returned_at, book-level reservations), flowchart (expense reimbursement,
  parallel checks, loop back, conditional second approval), pipeline (smart-meter IoT on AWS), C4 (clinic
  booking, three front ends, queue + worker, two externals), code-annotated (Go token bucket, verbatim, tabs),
  code-compare (React fetch with AbortController, verbatim, template literals). P5 copies it into
  `dev/tests/eval/requests.json` (set "heldout") with signatures; routing cases for all 10 in
  dev/tests/routing/heldout.json (expected template, GO).

### F42. Post polish that costs nothing in the source
- Evidence: snowflake low (cylinder labels hug the rim, lower 40% empty), c4 low (bold type tags), state low
  (0.9px lean), rag low (hooked heads), oauth low (masks 1.5px).
- Change (P2): cylinder labels centred in the body (between the front cap's lowest point and the bottom);
  tech lines weight 400 (F39); snap (F36); label masks padded (F23); hooked heads: when the last run into an
  arrowhead is < 16px after a corner and the previous run is collinear within 3px, merge them (else leave
  for W-edge-jog).
- Acceptance: test_svgpost `cyl_label_center` (label centre within 3px of the body centre), `tech_weight`,
  `hook_merge`.
- Lift: polish +0.25 across 5 runs.

## 2. Per-template verdicts (every template touched; column 800, fit view per D14)

Gate for every template: exit 0, 0 E-/S-, no W-stretched-node, no lifted store, fit-view height <= 900 or an
`# expect: W-tall - <reason>` line approved by the lead, content aspect 0.6-2.5, key per D12, emphasis
grounded by its brief, no W-/I- outside its `# expect:` line, AND the rubric gate (run by the owning package): a fresh reviewer
scores the col.png >= 7.5 overall with no high defect against the eval RUBRIC and the brief's `# request:`.

Measured on S today (d2check at column 800; "fit" = the D14 view, W-tall past 1000):

| Template | Owner | Now: display / fit | Verdict | Changes |
|---|---|---|---|---|
| architecture | P3 | 770x843 / 875; ecommerce domain | RE-DOMAIN + FIX | F28 fitness domain; no span widths (F25); a zone edge only to an exact-target zone; one title position (D18); "delivers" label; external look (F27); key: async + external only |
| c4 | P3 | 640x860 / **1075**; online shop; `<-` lifts | RE-LAYOUT | F28 course registration; F24/F39 layout (DB under the API: X/c4 780x1011, fit 1037); if still over after `compact` rows and the key in a void, an approved `# expect: W-tall - store under its caller (D11)` |
| context | P3 | 764x549 / 575; system box 700 | FIX | F28 domain; in-scope box natural width (>= 240); externals row by D10 |
| llm-app | P3 | 776x818 / 843; hub 480, floor 680 | RE-LAYOUT | F29: shared embedding-model node, numbered online steps, hub and index at natural width, model external only when stated |
| deployment | P3 | 792x846 / 854; shop on EKS | RE-DOMAIN + FIX | F28 AKS chat; no spans; sinks per D11; "Deployment, 3 replicas"; ns title case (D18) |
| pipeline | P3 | 580x884 / **1219**; Snowflake ELT | RE-DOMAIN + RE-LAYOUT | F28 lakehouse; F31 stage/tool rule, consumers zone, one stage width class, cylinders 102/118; fit <= 1000: wider stage rows (sources side by side) or the landscape layout of rule 8 when 5+ ranks |
| walkthrough | P3 | 785x891 / 908 | RE-DOMAIN | F28 photo sharing; trim 8px+ (one `compact` row) to meet 900 |
| threat-model | P3 | 530x816 / **1231** | RE-LAYOUT | the D14 view: widen to two lanes side by side (aspect >= 0.8); F27 look |
| network | P3 | 794x834 / 840 | FIX | infrastructure.md network rules 3 and 5 ("a gateway is as wide as the columns it serves (`width: 520`)") break D10: natural-width gateway with its comb, W-stretched-node clean; re-render after F27 |
| stack, tree, depgraph | P3 | 800x495, 798x384, 450x422 / 495, 384, 750 | CHECK | re-render after F27 |
| sequence | P4 | 774x878 / 907; checkout | RE-DOMAIN + FIX | F28 ride request; failed replies dashed (F27); compaction and frames by post (F22/F23, expect ~620 fit); a key for its non-notation colours |
| state | P4 | 642x598 / 745; order lifecycle | RE-DOMAIN + FIX | F28 subscription with a loop; markers keyed only when asked, real swatches (F26); ghosts stripped (F36) |
| flowchart | P4 | 723x735 / 813; order fulfilment | RE-DOMAIN + FIX | F28 content moderation; no `ok`; `compact` on one-line steps only; the fold lives in the playbook (F33) |
| steps | P4 | 422x541 / **1025** | RE-LAYOUT | the failover boards laid out wider (the pooler beside the app, `direction: right` per board), or an approved `# expect: W-tall` |
| swimlane | P4 | 794x494 / 497 | CHECK | failure solid (F27); key per D12 (no `ok`) |
| erd | P4 | 669x478 / 571; tickets | FIX | F34 `aside` note, key strip, edge-node gap 32; the tickets domain stays (no eval domain) |
| class, compare, roadmap, timeline, gitflow | P4 | 770x681, 786x540, 782x534, 551x510, 726x334 / all <= 740 | CHECK | re-render after the theme; keys per D12 |
| code-annotated | P4 | 650x444 / 546; 2x2 callouts | FIX | F35 one column, wide callouts, bold lead-ins; domain kept |
| code-calls | P4 | 710x473 / 533; checkout calls | RE-DOMAIN + FIX | F28 signup handler; badge glyphs on edge labels; an `<x>` line on the error return |
| code-compare | P4 | 666x287 / 344 | CHECK | the title rule (sans for non-paths) |
| code-walkthrough | P4 | 554x860 / **1242**; verifyJwt | RE-DOMAIN + RE-LAYOUT | F28 invoice download; at most 2 cards stacked with the caller and store beside them, or an approved `# expect: W-tall - three code cards` |
| neutral-theme, snowflake-brand | P3 | 157/160 lines | FIX | I3 deltas; line budget 175 each (new `frame`, `aside`), approved here |

## 3. Work packages (disjoint file ownership)

### 3.0 Frozen interfaces (landed in hour 0 by their provider; changes only through the lead)

| # | Interface | Provider -> consumers | Content |
|---|---|---|---|
| I1 | Finding codes | P1 -> P5 (recipes, pairs), P3/P4 | NEW `W-stretched-node` (warning). CHANGED: W-tall, W-aspect (fit view), W-long-edge (D11 exemption, "skips zone" message), W-edge-jog (32px middle; hooked head < 24px final run), W-fanout (band >= 60px), W-sibling-size (no container-bottoms variant; spans fix), W-small-text (key text counted), W-edge-overlap (parallel near-miss < 12px over > 80px), S-key (D12 sets), S-emphasis (D16), S-inferred (code nodes, `?` columns), S-edge-label (end labels by position), S-code-marker (I4). None removed or renamed. First words of every new message fixed in P1's first commit |
| I2 | Constants | P1 -> P2, P5 | fit view: `display_fit = (column, h x column / w)`; W-tall > 1.25 x column on the fit view, guard intrinsic h >= 0.6 x column; target 1.125; W-stretched-node: width >= 2.0 x the median leaf width AND >= 2.0 x its label need (widest line x 8.3 at 16px bold (BACKLOG V3), x the 14px advance P1 measures, + 32) AND no other node in its rank within 4px of that width; sequence compaction G = 20px |
| I3 | Theme deltas (both themes, same geometry) | P3 -> P2, P4 | `failure` (and `sf-failure`): no dash, stroke-width 2; `external`: fill ink-200, stroke ink-400, no dash, font-color ink-700 (`sf-external`: the brand gray fill, solid); `actor`: fill paper, stroke ink-400; `boundary` unchanged; NEW `frame` `{label: ""; style: {fill: transparent; stroke-width: 0}}` (a transparent grid-cell wrapper: W-unclassed/S-key exempt); NEW `aside` (shape page, fill ink-50, stroke ink-200, 14px ink-700, left-aligned: ERD enum lines and remarks); `callout` `{width: 560; height: 26}` and `callouts` gaps 4/0 (a two-line callout sets `height: 44`); other class names and geometry unchanged; theme line budget 175 |
| I4 | Code marker syntax | P4 (svgcode) <-> P1 (semcheck) | a trailing comment holding only markers: `<1>`..`<9>`, `<+>`, `<->`, `<!>`, NEW `<x>` (failure band); up to two markers separated by one space: two numbers, or one number and one band; numbers 1..N top-down, once each |
| I5 | Post steps and summary | P2 (+ P4 for code) -> P1 (lint reads post output), P5 docs | order: precision, strip, snap, seq (compact, frames, tints, lifelines, masks), relabel, fold, ports, tables, cylinder labels, code (svgcode), tech, key; `post:` words: `stripped N ghost(s)`, `compacted sequence -Npx`, `framed N group(s)`, `rerouted N fold edge(s)`, `spread N port(s)`, `key void|right-top|right-bottom|below`, plus the existing ones |
| I6 | Brief and source syntax | P1 (parser), P2 (d2check) -> P5 (brief.md), P3/P4 briefs | `width: 800, 1600`; `cols: a b? c` (`?` = inferred column); `{inferred}` on a `{code}` node is listed; `.d2` pragma `# d2check: layer-gap N` (sql_table files, 48-72) within the first 5 lines |
| I7 | Key authoring | P3 (design-system s8) -> P2, P4, P5 | `vars.d2-legend` unchanged; entries use the real classes; svgpost draws shape-faithful swatches from them; required/exempt sets per D12 |
| I8 | Eval file | P5 -> structure check (r) | `dev/tests/eval/requests.json`: `{id: {set, request, signature[]}}`, 22 entries |
| I9 | Fold contract | P2 -> P4 | root `grid-columns: 2` (1 row); an edge between nodes in the two cells is rerouted through the gutter; `horizontal-gap` >= 40 |
| I10 | Sequence post contract | P2 -> P4, P1, P5 | compaction G = 20; frames span first lifeline - 40 to last + 40, nested inset 12; group tints opaque; lifelines ink-300 1px dash 6 4; label masks +4px; runs only on `shape: sequence_diagram` boards |
| I11 | svgcode split | P2 hour 0 -> P4 | `scripts/svgcode.py` exports `step_code(raw, brand) -> raw` (today's signature); svgpost imports it; after the move P4 owns it |
| I12 | Fit view | P1 -> P2 (col.png), P5 (layout.md s9, brief.md s2) | per D14 |

Order: hour 0: P2 moves svgcode (I11) and lands the no-op `svgseq.py` hook; P3 lands I3 (all values above,
no option switch); P1 lands I1/I2/I6 skeletons (codes, constants, parser) with tests; P5
lands I8 and check (r) warn-only. Then all packages in parallel against the frozen interfaces. Integration:
all suites green, check (r) strict, rubric gate on every template listed in section 2, calibration section
3 P1 holds.

Contract changes (everything else stays as it is):
| Contract | Change | Why |
|---|---|---|
| File tree | + `scripts/svgseq.py`, `scripts/svgcode.py`, `dev/tests/eval/requests.json`, `dev/tests/code/**`, `dev/tests/lint/calibrate_round5.sh` | F22/F23, F35, F28, F41 |
| d2check CLI | options and exit codes unchanged; `width` list via the brief; `re-render:` line form; col.png is the fit view (plus `col-<w>.png` for two widths) | D14, D15, F37 |
| Finding codes | + `W-stretched-node` | D10 |
| Brief format | `width:` list, `cols:` `?` | D15, F34 |
| Theme | `failure` solid, `external` grey fill and solid, `actor` paper, + `frame`, `aside`, callout geometry | D19, F33, F34, F35 |
| Budgets | theme files 175 lines; SKILL.md stays 9216 bytes; playbooks stay 150 lines (replacements must not grow them) | the lead's rule for SKILL.md |

### P1 - Checks (lint, semantics, test runner)
Owned paths: `scripts/d2lint.py scripts/semcheck.py scripts/contrast.py dev/run_all_tests.sh
dev/tests/lint/run_tests.py dev/tests/lint/calibrate_round3.sh dev/tests/lint/calibrate_round5.sh (NEW)
dev/tests/lint/cases/bad_* dev/tests/lint/cases/ok_* dev/tests/lint/cases/*.svg dev/tests/semantic/**`.
Changes: F25 (W-stretched-node, W-sibling-size, W-fanout), F24/D11 (W-long-edge), F32 (W-edge-jog), F26 (key
text; S-key sets), F34 (W-edge-overlap near-miss, `cols` `?`), F37 (semcheck end labels, code inferred, spans,
fit view), F30 (width list), F23/D16 (S-emphasis), F35 (S-code-marker I4), F21 (gating-reply case); the
templates gate in run_all_tests.sh uses the fit view and fails any W-stretched-node; the I3 classes `frame` and
`aside` known to W-unclassed, S-key and S-src-class (shape-only / structure lists); new rows `code` (runs
dev/tests/code/test_svgcode.sh) and `eval-hygiene` (structure check (r) alone, for quick runs).
Tests to add: lint cases `bad_stretched_node`, `ok_width_class_spine`, `ok_code_card_row`, `ok_comb3`,
`ok_sink_below_container`, `bad_skip_stage`, `bad_edge_jog_28`, `bad_hooked_head`, `bad_key_small_text`,
`ok_spans_508`, `bad_tall_fit`, `ok_small_narrow`, `bad_edge_near_miss`; semantic cases `end_labels_only`,
`end_labels_mixed`, `code_inferred`, `erd_inferred_cols`, `width_list`, `key_flow_only`, `key_dbt_labelled`,
`key_async_missing`, `seq_key_flow`, `seq_focal_story`, `seq_gating_reply`, `marker_x`, `marker_two`,
`zone_edge_extra_child` (if the suite lacks it).
Calibration `calibrate_round5.sh W8/new` must hold:
| Deliverable | Must report | Must not report |
|---|---|---|
| k8s-topology | W-stretched-node x3 (lb, cluster.ingress, cluster.ns.api) | E- |
| c4-container | W-stretched-node (ibs.api) | - |
| rag-pipeline | W-stretched-node (app, vectors), W-edge-jog (hooked head) | - |
| ecommerce-arch | W-stretched-node (edge.gateway), W-edge-jog (28px S-jog) | - |
| saga-sequence | W-tall (fit view 800x1125) | - |
| saas-erd | W-small-text (key label) | - |
| order-state, snowflake, oauth, cicd, retry, jwt | nothing new beyond round 5 except W-tall where the fit view exceeds 1000 | W-stretched-node |
Acceptance:
```sh
cd $S && sh dev/run_all_tests.sh --only lint,semantic,templates   # PASS (templates after P3/P4 land)
sh dev/tests/lint/calibrate_round5.sh <scratch>/w8/new             # every row holds
python3 scripts/semcheck.py <scratch>/w9/exp/semlab/endlab.brief <scratch>/w9/exp/semlab/endlab.d2   # exit 0 (was 1)
```

### P2 - Render and post
Owned paths: `scripts/d2check.sh scripts/svgpost.py scripts/svgseq.py (NEW) scripts/d2raster.py
scripts/raster.cjs scripts/pngstats.py scripts/doctor.sh scripts/font-flags.sh scripts/icon.sh
dev/tests/lint/test_svgpost.sh dev/tests/lint/test_d2check.sh dev/tests/lint/test_doctor.sh
dev/tests/lint/d2check/** dev/tests/lint/cases/post_*`; `scripts/svgcode.py` for hour 0 only (I11).
Changes: I11 split; F22/F23 svgseq (compaction, frames, tints, lifelines, masks); F26 key (swatches,
placement, text size); F33 fold connector; F34 ports spread (experiment first), sql_table edge-node gap 32,
layer-gap pragma; F36 strip + snap; F42 cylinder labels, tech weight, hooked heads; F30 two widths; F37
re-render line, D2W asset copy, col.png fit view (d2raster/raster.cjs).
Tests to add (test_svgpost unless noted): `seq_compact_oauth`, `seq_compact_saga`, `seq_frames`,
`seq_masks`, `seq_idempotent`, `key_void`, `key_swatch_pill`, `key_line_weight`, `key_strip_center`,
`fold_connector`, `erd_ports`, `strip_ghosts`, `snap_axis`, `cyl_label_center`, `tech_weight`, `hook_merge`;
test_d2check `two_widths`, `layer_gap_pragma`, `rerender_form`, `exp_assets`, `col_fit_view`.
Acceptance:
```sh
cd $S && sh dev/tests/lint/test_svgpost.sh && sh dev/tests/lint/test_d2check.sh   # PASS
sh dev/run_all_tests.sh --only lint,d2check,doctor                                 # PASS
python3 scripts/svgpost.py --help; echo $?                                         # 0
```
Visual: a contact sheet of oauth, saga, cicd-fold, state, erd fixtures before/after post, reviewed against
X/seq/oauth-c20.png and X/fold/cicd2b.png.

### P3 - Structure types and the look
Owned paths: `templates/{neutral-theme,snowflake-brand,architecture,c4,context,llm-app,deployment,network,
threat-model,pipeline,walkthrough,stack,tree,depgraph}.d2 playbooks/{architecture,infrastructure,pipeline,
hierarchy}.md reference/{design-system,brand-snowflake,icons}.md workflows/icons.md assets/icons/**
dev/tests/templates/{architecture,c4,context,llm-app,deployment,network,threat-model,pipeline,walkthrough,
stack,tree,depgraph}.brief dev/tests/templates/fixtures/** (NEW) dev/tests/style/**`.
Changes: I3 (hour 0) then the F27 contact-sheet review; F24, F25, F29, F31, F32, F38, F39 in the playbooks and templates; F26 and
D12 in design-system s8; D18/D19 in design-system s2/4/5/6; F28 rows owned (architecture, c4, context,
deployment, pipeline, llm-app notes, walkthrough, infrastructure snippet); brand-snowflake native services.
Tests to add: style checks (dash channel per D19, `frame`/`aside` exist in both themes with equal geometry,
no panel-fill clash for the grey external); template briefs re-written to the new domains with
`# request:` lines that ground each emphasis; fixtures under `dev/tests/templates/fixtures/` (NEW, P3-owned
subfolder): the round-5 k8s, c4, rag, ecommerce, snowflake inventories redrawn under the new rules (each
must render with 0 E-, 0 W-stretched-node, D11 placement), plus their col.png in the contact sheet.
Acceptance:
```sh
python3 scripts/contrast.py --check templates/neutral-theme.d2 && python3 scripts/contrast.py --check templates/snowflake-brand.d2
sh dev/run_all_tests.sh --only style,templates,snippets,structure   # PASS for P3 templates
```
Rubric gate: the 12 P3 templates + 5 fixtures, one fresh reviewer each (eval2.js RUBRIC + the brief's request),
>= 7.5 overall, 0 high; findings fixed before hand-off.

### P4 - Behaviour and code types
Owned paths: `templates/{sequence,state,flowchart,swimlane,erd,class,compare,roadmap,timeline,gitflow,steps,
code-annotated,code-calls,code-compare,code-walkthrough}.d2 playbooks/{sequence,state,flowchart,erd,code,
change}.md scripts/svgcode.py (from hour 0 + I11) dev/tests/code/** (NEW)
dev/tests/templates/{sequence,state,flowchart,swimlane,erd,class,compare,roadmap,timeline,gitflow,steps,
code-annotated,code-calls,code-compare,code-walkthrough}.brief`.
Changes: F21 (sequence rules), F23 (sequence rules and template), F27 (failed replies dashed), F28 rows owned
(sequence, rules 9/10, state, flowchart + fold example, erd rule 7, code-walkthrough, code-calls), F33
(flowchart rule 7 + template), F34 (erd.md), F35 (svgcode markers/badges/titles, code.md, code templates),
F36 (state rules and template).
Tests to add: dev/tests/code/test_svgcode.sh (+ fixtures) per F35; template briefs re-written; the retry
one-column re-layout measurement; sequence snippets compile and pass S-seq-return with failed replies
dashed.
Acceptance:
```sh
sh dev/tests/code/test_svgcode.sh                                      # PASS
sh dev/run_all_tests.sh --only templates,snippets,structure,code      # PASS for P4 templates
```
Rubric gate: the 15 P4 templates + the sequence rule 9/10 snippets + the flowchart fold snippet, same protocol.

### P5 - Core docs, eval hygiene, packaging
Owned paths: `SKILL.md README.md workflows/{brief,route,review-and-fix}.md reference/{layout,syntax,export}.md
dev/README.md dev/CHANGELOG.md dev/package.sh dev/dist/** dev/tests/structure/** dev/tests/recipes/**
dev/tests/refs/** dev/tests/routing/** dev/tests/eval/** (NEW)`.
Changes: F40 SKILL.md; brief.md s2 (D9 order, D14, D15), s3 (focus table re-domained, flow along every peer
branch, D16), s5 (gating replies, `cols` `?`); route.md (D17 sketch path in row 1; RAG rows per F29; "for a
slide/doc" per D15); review-and-fix.md (W-stretched-node recipe; W-tall, W-long-edge, W-fanout, I-sparse,
W-sibling-size, W-dogleg, W-aspect, S-key recipes per D9-D12; the lift and widen levers deleted; rubric row 6
"a key entry for the obvious, or a swatch unlike its thing"); layout.md (s3 order row and lift rows, s9
compaction table re-measured with F22 and the fit view, ghost example re-domained); syntax.md (sql_table
example re-domained; cross-cell edges in a grid fold); I8 + check (r); recipe pairs; routing cases;
CHANGELOG round-6 entry; package rebuilt last.
Tests to add: structure check (r) (+ a self-test on a planted 8-word overlap and a planted 3-term template);
check (n) extended (no "prune replies", no `db <- api`/`pg <-`, no "as wide as the tier it feeds"); recipe
pairs `W-stretched-node.natural`, `W-tall.sequence-compact` (before: 9 messages over budget; after: same
messages, compacted), `W-long-edge.sink-below`, `I-sparse.key-void`, `S-key.flow-exempt`,
`W-fanout.zone-exact`, `W-edge-jog.hooked`; routing: 10 held-out requests + 2 sketch cases (GO) + 1 bare
"explain our helper" (ASK).
Acceptance:
```sh
sh dev/run_all_tests.sh --only structure,recipes,snippets,export,refs   # PASS
wc -c SKILL.md                                                         # <= 9216
sh dev/run_all_tests.sh --only routing --llm                           # gate PASS
sh dev/package.sh                                                      # zip built
```

### Wave acceptance
```sh
cd $S && sh dev/run_all_tests.sh              # every suite PASS, check (r) strict
sh dev/tests/lint/calibrate_round5.sh <scratch>/w8/new
```
Every template: section 2 gate including the rubric gate. No shipped file shares an 8-word run with any of
the 22 eval requests.

## 4. Re-evaluation

Phase 0 (no judging): wave acceptance; install the zip under a path with a space; the 27-template contact
sheet reviewed by one design critic (target >= 8.0).
Phase 1: the 12 benchmark requests, eval2.js protocol, fresh sessions: absolute judge; blind pairwise vs the
original skill AND vs the round-5 output of the same request. Pass: mean >= 7.3, every dimension >= 7.0, 0
high defects, 10/10 vs original (the 10 with a baseline), >= 9/12 vs round 5 and no loss on saga, c4, k8s,
rag, oauth (the requests
the decisions target).
Phase 2: the 10 held-out requests (w9/heldout.js), same protocol, pairwise vs the original skill (its outputs
generated in the same phase). Pass: mean >= 7.0, >= 9/10 pairwise, 0 high defects. A held-out miss becomes a
fix item only when its root cause is general (named by at least two requests or a rule, not the example).
Phase 3 (lenses): friction review of the run logs (no high friction), and a contamination re-scan of the
final package against all 22 requests.
