#!/bin/sh
# run_all_tests.sh - run every test suite of the d2-diagram skill, then print a summary table.
#
# usage: sh dev/run_all_tests.sh [--quick] [--network] [--llm] [--only LIST] [--skip LIST] [--list] [-j N]
#   --quick      the fast suites only: structure lint snippets templates
#   --network    also run icons (every icon name in the docs over HTTP)
#   --llm        also run routing (blind eval of workflows/route.md; needs the claude CLI)
#   --only LIST  comma-separated suites to run, e.g. --only recipes,structure
#   --skip LIST  comma-separated suites to leave out
#   --list       print the suites and what they need, then exit
#   -j N         parallel jobs inside the recipes and snippets suites (default 4)
#   -h, --help   this text
# Suites run one after another, in this order:
#   structure lint d2check doctor semantic style templates snippets export recipes icons routing
# Logs: ${TMPDIR:-/tmp}/d2-diagram-tests/<suite>.log (the tail of a failed suite is printed);
# the templates suite leaves each template's review PNGs in templates/work/ there.
# exit: 0 every suite that ran passed | 1 a suite failed | 2 usage error or d2/python3 missing
set -u
unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(dirname -- "$HERE")
T="$HERE/tests"
LOG=${TMPDIR:-/tmp}/d2-diagram-tests
ALL="structure lint d2check doctor semantic style templates snippets export recipes icons routing"
QUICK="structure lint snippets templates"
PYTHONDONTWRITEBYTECODE=1
export PYTHONDONTWRITEBYTECODE

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }
describe() {
  cat << 'EOF'
suite      needs                         checks
structure  python3 (d2 for fmt)          package structure: links, reachability, codes, ASCII, classes, ...
lint       d2, python3 (Chromium)        d2lint codes on their cases; rasterizer and pngstats checks
d2check    d2, python3, Chromium         d2check end to end: exit codes, summary, files, routes, boards
doctor     d2, python3, node, Chromium   doctor.sh on simulated machines, one dependency removed at a time; --help and usage exits
semantic   d2, python3                   semcheck: brief parsing, S- codes, hints, dump/compare
style      d2, python3, Chromium         theme contrast and fmt, class coverage, Snowflake rules
templates  d2, python3 (Chromium)        every template: d2check exit 0 against its brief at 800px
snippets   d2                            every d2 block in the docs renders (d2-bad blocks fail)
export     d2, python3, node, Chromium   the commands of reference/export.md on fixtures
recipes    d2, python3                   every Fix: in workflows/review-and-fix.md, by before/after pairs
icons      curl, network (--network)     every icon name in the docs answers HTTP 200
routing    claude CLI, network (--llm)   blind sessions route held-out requests with route.md (gate)
EOF
}

list_arg() {  # list_arg OPTION VALUE -> the suites, space-separated; an empty list is a usage error
  case $(printf '%s' "$2" | tr -d ', ') in
    '') echo "run_all_tests.sh: $1 needs a comma-separated list of suites: $ALL" >&2; exit 2 ;;
  esac
  printf '%s' "$2" | tr ',' ' '
}

only="" skip="" net=0 llm=0 jobs=4
while [ $# -gt 0 ]; do
  case $1 in
    --quick) only=$QUICK; shift ;;
    --network) net=1; shift ;;
    --llm) llm=1; shift ;;
    --only | --skip)
      [ $# -ge 2 ] || { echo "run_all_tests.sh: $1 needs a comma-separated list of suites: $ALL" >&2; exit 2; }
      v=$(list_arg "$1" "$2") || exit 2
      if [ "$1" = --only ]; then only=$v; else skip=$v; fi
      shift 2 ;;
    --only=*) only=$(list_arg --only "${1#*=}") || exit 2; shift ;;
    --skip=*) skip=$(list_arg --skip "${1#*=}") || exit 2; shift ;;
    --list) describe; exit 0 ;;
    -j) [ $# -ge 2 ] || { echo "run_all_tests.sh: -j needs a number" >&2; exit 2; }; jobs=$2; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) echo "run_all_tests.sh: unknown argument '$1' (see --help)" >&2; exit 2 ;;
  esac
done
case $jobs in '' | *[!0-9]*) echo "run_all_tests.sh: -j wants a number" >&2; exit 2 ;; esac
for s in $only $skip; do
  case " $ALL " in *" $s "*) ;; *) echo "run_all_tests.sh: unknown suite '$s' (suites: $ALL)" >&2; exit 2 ;; esac
done
if ! command -v d2 > /dev/null 2>&1 || ! command -v python3 > /dev/null 2>&1; then
  echo "run_all_tests.sh: d2 and python3 are required; run: sh $SKILL/scripts/doctor.sh" >&2
  exit 2
fi
rm -rf "$LOG" && mkdir -p "$LOG" || exit 2

# --- the templates suite: every template through d2check against its brief, on a copy ---------
suite_templates() {
  out="$LOG/templates"
  mkdir -p "$out/work" || return 1
  bad=0 n=0
  for t in "$SKILL"/templates/*.d2; do
    name=$(basename -- "$t" .d2)
    case $name in neutral-theme | snowflake-brand) cp "$t" "$out/"; continue ;; esac
  done
  for t in "$SKILL"/templates/*.d2; do
    name=$(basename -- "$t" .d2)
    case $name in neutral-theme | snowflake-brand) continue ;; esac
    n=$((n + 1))
    cp "$t" "$out/$name.d2"   # d2check formats in place: never touch the shipped template
    set -- --column 800
    b="$T/templates/$name.brief"
    if [ -f "$b" ]; then set -- "$@" --brief "$b"; else echo "note: $name has no brief in dev/tests/templates/"; fi
    D2_WORK="$out/work" sh "$SKILL/scripts/d2check.sh" "$@" "$out/$name.d2" "$out/$name.svg" > "$out/$name.txt" 2>&1
    rc=$?
    codes=$(sed -n 's/^ *\([EWIS]-[a-z0-9-]*\) x\([0-9]*\) -> .*/\1 x\2/p' "$out/$name.txt" | tr '\n' ' ')
    disp=$(sed -n 's/^display: \([0-9]*x[0-9]*\).*min text \([0-9.]*px\).*/\1, min text \2/p' "$out/$name.txt" | head -1)
    case $rc in
      0) printf 'ok    %-16s %s %s\n' "$name" "$disp" "$codes" ;;
      3) printf 'ok    %-16s %s %s(not faithfully rasterized: see doctor.sh)\n' "$name" "$disp" "$codes" ;;
      *) printf 'FAIL  %-16s d2check exit %s %s\n' "$name" "$rc" "$codes"
         sed 's/^/      /' "$out/$name.txt" | grep -v '^      re-render:' | head -20
         bad=$((bad + 1)) ;;
    esac
  done
  echo "templates: $n checked, $bad failed"
  [ "$n" -gt 0 ] && [ "$bad" = 0 ]
}

suite_snippets() {
  set -- "$SKILL/SKILL.md" "$SKILL/README.md"
  for f in "$SKILL"/workflows/*.md "$SKILL"/playbooks/*.md "$SKILL"/reference/*.md; do
    [ -f "$f" ] && set -- "$@" "$f"
  done
  sh "$T/refs/check_snippets.sh" -j "$jobs" "$@" && sh "$T/refs/selftest.sh"
}

run_suite() {  # run_suite NAME -> 0 pass | 1 fail | 3 skipped (the log says why)
  case $1 in
    structure) sh "$T/structure/check.sh" ;;
    lint) python3 "$T/lint/run_tests.py" ;;
    d2check) sh "$T/lint/test_d2check.sh" ;;
    doctor) sh "$T/lint/test_doctor.sh" ;;
    semantic) python3 "$T/semantic/run_tests.py" ;;
    style) sh "$T/style/run.sh" "$LOG/style" ;;
    templates) suite_templates ;;
    snippets) suite_snippets ;;
    export) sh "$T/refs/check_export.sh" ;;
    recipes) sh "$T/recipes/run.sh" -j "$jobs" ;;
    icons)
      sh "$T/refs/verify_icons.sh"
      rc=$?
      [ "$rc" = 3 ] && { echo "icons: network or rate limit - names unverified"; return 3; }
      return "$rc" ;;
    routing)
      [ -f "$T/routing/run.sh" ] || { echo "routing: no dev/tests/routing/run.sh"; return 3; }
      command -v claude > /dev/null 2>&1 || { echo "routing: no claude CLI on PATH"; return 3; }
      sh "$T/routing/run.sh" gate "$LOG/routing" ;;
  esac
}

pass=0 fail=0 skipped=0 failed=""
t0=$(date +%s)
printf '%-10s %-6s %6s  %s\n' suite result time log > "$LOG/summary.txt"
for s in $ALL; do
  why=""
  if [ -n "$only" ]; then case " $only " in *" $s "*) ;; *) continue ;; esac; fi
  case " $skip " in *" $s "*) why="--skip" ;; esac
  [ "$s" = icons ] && [ "$net" = 0 ] && [ -z "$why" ] && why="needs --network"
  [ "$s" = routing ] && [ "$llm" = 0 ] && [ -z "$why" ] && why="needs --llm"
  if [ -n "$why" ]; then
    printf '%-10s %-6s %6s  %s\n' "$s" SKIP - "$why" >> "$LOG/summary.txt"
    skipped=$((skipped + 1))
    continue
  fi
  printf '== %s ... ' "$s"
  start=$(date +%s)
  run_suite "$s" > "$LOG/$s.log" 2>&1
  rc=$?
  secs=$(($(date +%s) - start))
  case $rc in
    0) res=PASS; pass=$((pass + 1)) ;;
    3) res=SKIP; skipped=$((skipped + 1)) ;;
    *) res=FAIL; fail=$((fail + 1)); failed="$failed $s" ;;
  esac
  if [ "$res" = SKIP ]; then  # the suite said why on its last line
    why=$(tail -n 1 "$LOG/$s.log")
    echo "SKIP (${secs}s): $why"
    printf '%-10s %-6s %5ss  %s\n' "$s" SKIP "$secs" "$why" >> "$LOG/summary.txt"
    continue
  fi
  echo "$res (${secs}s)"
  if [ "$res" = FAIL ]; then  # each failing line with its indented details, then how the log ends
    awk '/^(FAIL|not ok)|[[:space:]]FAIL[[:space:]:]|Traceback/ { if (++n > 12) exit; print; keep = 1; d = 0; next }
         keep && /^[[:space:]]/ && d < 8 { print; d++; next }
         { keep = 0 }' "$LOG/$s.log" | sed 's/^/   | /'
    echo "   | ... (last lines of the log:)"
    tail -n 4 "$LOG/$s.log" | sed 's/^/   | /'
  fi
  printf '%-10s %-6s %5ss  %s\n' "$s" "$res" "$secs" "$LOG/$s.log" >> "$LOG/summary.txt"
done
total=$(($(date +%s) - t0))
echo
cat "$LOG/summary.txt"
echo "all: $pass passed, $fail failed, $skipped skipped in $((total / 60))m$((total % 60))s${failed:+ - failed:$failed}"
[ "$pass" -gt 0 ] || [ "$fail" -gt 0 ] || echo "nothing ran: every selected suite was skipped (exit 1)"
[ "$fail" = 0 ] && [ "$pass" -gt 0 ]
