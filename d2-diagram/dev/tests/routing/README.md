# Routing eval: is workflows/route.md read the way we mean it?

`workflows/route.md` maps a request to a template, a playbook and a call (GO, ASK,
SPLIT, OUT, EDIT). It is read by an agent, not matched by keywords: a keyword router
tuned to 99/99 on the dev set scored 16/30 on the held-out set. So the only valid test
is blind: a fresh model session that sees nothing but route.md and the requests.

## Data (not packaged)

| File | Cases | Use |
|---|---|---|
| `heldout.json` | 56 | release gate; never tune route.md on it. H01-H30 (the first gate), E01-E20 (written by the round-3 routing review) and C01-C06 (the code templates: written by a fresh session that saw only README.md's template catalog, never route.md; expect/alt fixed before the first run). The skill is English only: the round-4 Chinese requests (Z01-Z20) and vocabulary probes (P01-P16) were dropped |
| `dev.json` | 99 | tuning: the jobs-lens phrasings (R01-R99) |
| `validation.json` | 28 | tuning: fresh phrasings, one per template |
| `validation2.json` | 24 | tuning: traps ("flowchart" of services, "tree" of dependencies, code named but not wanted in the picture) |

A case: `{"id", "request", "expect", "alt": [...], "call", "altcall": [...], "why"}`.
`expect` is a template name (or `OUT` / `EDIT`), `alt` lists answers accepted as right,
`call` is the expected call. Alternates are fixed BEFORE a run, never after a miss.
The E cases were written blind, but the round-4 route.md answers the misses the review found on
them (routing F3-F10): they are held out from now on, and the next miss spends them.

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
python3 blind_eval.py heldout.json ../../../workflows/route.md --per-request --gate 90%,83%
```

- Release gate: at least 90% of the templates and 83% of the calls (51 and 47 of 56), in both
  modes (one session for all requests, and one session per request).
- An EDIT or OUT call scores its template as right whatever template it names: the edited
  file stands in for the template (SKILL.md, editing).
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

Trial friction (route.md sha1 341da493: one home for splitting, every diagram of a split drawn,
"a diagram" alone is not a one-picture request), two gate runs and one run of the tuning sets:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 56/56, 56/56 | 52/56, 54/56 | run 1: H16 (ASK), H30, E05 (SPLIT), E20 (ASK); run 2: H30, E20 - the default drawn |
| heldout | per request | 56/56, 56/56 | 53/56, 53/56 | H14, E20 both runs (the default drawn); H30 ASK where SPLIT was expected (run 1), E01 ASK where GO was (run 2) |
| dev | one session | 99/99 | 99/99 | - |
| validation | one session | 28/28 | 28/28 | - |
| validation2 | one session | 24/24 | 24/24 | - |

Code snippets (the 56-case gate with C01-C06, route.md sha1 2d856428: code rows 1-4 and the
code tie-breaker), one gate run and two dev runs:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 56/56 | 53/56 | H30, E05, E20: the default drawn where SPLIT or ASK was expected |
| heldout | per request | 56/56 | 53/56 | H14, H30, E20 |
| dev | one session | 98/99, 99/99 | 94/99, 91/99 | R44 flowchart in run 1 (sequence expected; compare, an alternate, in run 2); calls: the defaults drawn (R02, R06, R09, R17, R44, R52, R71) and R58 an ASK for code (run 2) |
| validation | one session | 28/28 | 28/28 | - |
| validation2 | one session | 24/24 | 24/24 | - |

Round 4 verification (the 50-case English gate, route.md sha1 e382d7de, after the Chinese genre
tie-breaker was dropped), one run:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 50/50 | 47/50 | H14, H30, E20: the default drawn where ASK or SPLIT was expected |
| heldout | per request | 50/50 | 48/50 | H14, E20 |

Round 4 (the 86-case gate of the time, before the English-only scope dropped Z and P), five runs:
run 1 on an earlier wording of the one-picture exception (sha1 08c0de9a), runs 2 and 3 on sha1
9c6bfe31, runs 4 and 5 (the verification) on the shipped route.md (sha1 609a4790: a one-picture RAG
request goes to llm-app, as playbooks/pipeline.md rule 9 measures). Runs 1, 2 and 4 cover every set;
runs 3 and 5 the gate only:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 86/86, 86/86, 86/86, 86/86, 86/86 | 83/86, 81/86, 82/86, 84/86, 85/86 | E20 drew the notation-clash default (ASK) in runs 1-4; H30 in every run; E18 (run 1), E05, H14, Z18 (run 2), H14, Z18 (run 3): the default drawn where ASK or SPLIT was expected |
| heldout | per request | 86/86, 86/86, 86/86, 86/86, 86/86 | 83/86, 83/86, 84/86, 83/86, 84/86 | E20 and H14 every run; H30 (runs 1, 2, 4) |
| dev | one session | 99/99, 98/99, -, 98/99 | 97/99, 94/99, -, 92/99 | R45 walkthrough (runs 2, 4; sequence expected: parallel calls); calls: the defaults drawn (R02, R06, R09, R17, R44, R52, R71) |
| validation | one session | 24/24, 24/24, -, 24/24 | 24/24, 24/24, -, 24/24 | - |
| validation2 | one session | 20/20, 20/20, -, 20/20 | 20/20, 20/20, -, 20/20 | - |

Round 2 (route.md sha1 4d255dab, the 30-case gate), two independent runs:

| Set | Mode | Templates | Calls | Call misses (template right) |
|---|---|---|---|---|
| heldout | one session | 30/30, 30/30 | 29/30, 30/30 | run 1: H14 bare "password reset" drew sequence, ASK expected |
| heldout | per request | 30/30, 30/30 | 29/30, 29/30 | H14, both runs |
| dev | one session | 99/99, 99/99 | 96/99, 98/99 | run 1: R09, R52, R71 drew the default (ASK); run 2: R44 drew one (SPLIT) |
| validation | one session | 24/24, 24/24 | 24/24, 24/24 | - |
| validation2 | one session | 20/20, 20/20 | 20/20, 20/20 | - |
