# Routing eval: is workflows/route.md read the way we mean it?

`workflows/route.md` maps a request to a template, a playbook and a call (GO, ASK,
SPLIT, OUT, EDIT). It is read by an agent, not matched by keywords: a keyword router
tuned to 99/99 on the dev set scored 16/30 on the held-out set. So the only valid test
is blind: a fresh model session that sees nothing but route.md and the requests.

## Data (not packaged)

| File | Cases | Use |
|---|---|---|
| `heldout.json` | 30 | release gate; never tune route.md on it |
| `dev.json` | 99 | tuning: the jobs-lens phrasings (R01-R99) |
| `validation.json` | 24 | tuning: fresh phrasings, one per template |
| `validation2.json` | 20 | tuning: traps ("flowchart" of services, "tree" of dependencies) |

A case: `{"id", "request", "expect", "alt": [...], "call", "altcall": [...], "why"}`.
`expect` is a template name (or `OUT` / `EDIT`), `alt` lists answers accepted as right,
`call` is the expected call. Alternates are fixed BEFORE a run, never after a miss.

## Protocol

`blind_eval.py` sends ONE prompt per session to `claude -p` with no tools
(`--tools ""`), no skills, no CLAUDE.md (`--safe-mode --disable-slash-commands` when the
CLI has them) and an empty working dir: route.md, then the numbered requests, asking
for a JSON list of `{id, template, call}`. It scores template (expect or alt) and call
(call or altcall; OUT/EDIT count as one), prints one line per case (`MISS` = wrong
template, `c!` = wrong call) and writes `prompt.txt`, `raw/` and the scores to a temp
dir (or `--out DIR`); nothing is written next to this file.

```sh
sh run.sh                  # release gate: heldout.json, one session AND one per request
sh run.sh tuning           # dev, validation, validation2 (after any route.md change)
python3 blind_eval.py heldout.json ../../../workflows/route.md --per-request --gate 27,25
```

- Release gate: at least 27/30 templates and 25/30 calls, in both modes (one session
  for all 30 requests, and one session per request).
- The call is the noisy part: the model sometimes draws the default where route.md
  says ASK. Count ASK vs the default drawn as a soft error.
- Without the CLI: give `prompt.txt` (written first, even on failure) to a fresh
  subagent with no other context, save its reply, and score it with `--answers FILE`.

## After a miss

1. Fix route.md from the miss (a signal, a tie-breaker or an ASK rule), never by
   copying the held-out wording into it.
2. Re-run `sh run.sh tuning`: dev, validation and validation2 must not regress.
3. The held-out set is now spent: move its cases into `dev.json` and write a NEW
   `heldout.json` (30 cases, every template at least once, some traps and ASK/SPLIT
   calls), then run the gate once.

## Results

route.md sha1 4d255dab (the frozen version, CATALOG-SPEC section 2.2), 2026-09-23, two
independent runs (build, then verification), scores given as run 1, run 2:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 30/30, 30/30 | 29/30, 30/30 | run 1: H14 bare "password reset" drew sequence, ASK expected |
| heldout | per request | 30/30, 30/30 | 29/30, 29/30 | H14, both runs |
| dev | one session | 99/99, 99/99 | 96/99, 98/99 | run 1: R09, R52, R71 drew the default (ASK); run 2: R44 drew one (SPLIT) |
| validation | one session | 24/24, 24/24 | 24/24, 24/24 | - |
| validation2 | one session | 20/20, 20/20 | 20/20, 20/20 | - |
