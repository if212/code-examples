#!/bin/sh
# run.sh - blind routing eval of workflows/route.md (dev only; needs the claude CLI).
# usage: sh run.sh [gate|tuning|all] [OUT_DIR]
#   gate    (default) release gate on heldout.json: one session for all requests AND one
#           session per request; each must get >= 90% of the templates and >= 83% of the calls
#   tuning  dev.json, validation.json, validation2.json, one session each: re-run after any
#           route.md change (never tune on heldout.json)
#   all     both
# Results go to OUT_DIR (default: a new temp dir); nothing is written next to this file.
# exit: 0 the gate passed (or only tuning ran), 1 the gate failed, 2 setup error
set -u
PYTHONDONTWRITEBYTECODE=1  # no __pycache__ in the skill's scripts/ (B57)
export PYTHONDONTWRITEBYTECODE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROUTE=$HERE/../../../workflows/route.md
what=${1:-gate}
OUT=${2:-$(mktemp -d "${TMPDIR:-/tmp}/route-eval.XXXXXX")}
case $what in gate | tuning | all) ;; *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2 ;; esac
[ -f "$ROUTE" ] || { echo "run.sh: no route.md at $ROUTE" >&2; exit 2; }
command -v claude > /dev/null 2>&1 || { echo "run.sh: no claude CLI: see README.md, 'Without the CLI'" >&2; exit 2; }
mkdir -p "$OUT" || exit 2
rc=0
if [ "$what" != gate ]; then
  for s in dev validation validation2; do
    python3 "$HERE/blind_eval.py" "$HERE/$s.json" "$ROUTE" --out "$OUT/$s" > "$OUT/$s.log" 2>&1 &
  done
fi
if [ "$what" != tuning ]; then
  python3 "$HERE/blind_eval.py" "$HERE/heldout.json" "$ROUTE" --gate 90%,83% --out "$OUT/one" > "$OUT/gate-one.log" 2>&1 &
  python3 "$HERE/blind_eval.py" "$HERE/heldout.json" "$ROUTE" --gate 90%,83% --per-request --out "$OUT/per" > "$OUT/gate-per.log" 2>&1 &
fi
wait
for f in "$OUT"/*.log; do
  echo "== $(basename "$f" .log)"
  grep -E '^(MISS|ok   c!)' "$f"
  grep -E '^(template |gate )' "$f"
  case $f in *gate-*) grep -q ': PASS$' "$f" || rc=1 ;; esac
done
echo "results: $OUT"
exit $rc
