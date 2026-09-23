#!/bin/sh
# run.sh - prove the fix recipes of workflows/review-and-fix.md with before/after render pairs.
#
# usage: sh dev/tests/recipes/run.sh [-j N] [-v] [NAME ...]
#   NAME   a pair name or a code (W-long-edge runs W-long-edge and W-long-edge.*); default: all
#   -j N   pairs checked at once (default 4)
#   -v     print d2check's output of every file that failed its check
#
# A pair is NAME.before.d2 + NAME.after.d2, with NAME = CODE or CODE.variant, plus an optional
# brief (a `# brief: FILE` line, else NAME.before.brief / NAME.after.brief, else NAME.brief,
# else CODE.brief). Each file goes through the real loop in a scratch copy of this folder:
#   sh scripts/d2check.sh --no-raster [--brief B] FILE OUT.svg
#   CODE pairs     before must list CODE and every code on its `# expect:` line; after must
#                  not list CODE, must not fail (d2check exit 1 or 2), and may list only the
#                  codes on its `# allow:` line
#   compile.SLUG   before must fail to compile (exit 1) and print its `# expect-error:` text;
#                  after must render clean; that text must appear in review-and-fix.md
# Leading comment directives in a file: `# column: N` (d2check --column), `# d2check: OPTS`
# (more d2check options), `# d2: FLAGS` (extra d2 flags, after --), `# unescape` (turn
# \uXXXX escapes into characters in the scratch copy, so the repo stays ASCII).
# A passing pair proves its CODE and the codes on its before file's `# expect:` line.
# Cross-checks: every pair's CODE has a `### CODE` section in review-and-fix.md, and (full runs)
# every section with a `Fix:` line is proven by a passing pair.
# exit: 0 every recipe proven | 1 a pair or a cross-check failed | 2 usage or setup problem
set -u
unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE

HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
CHECK="$SKILL/scripts/d2check.sh"
RF="$SKILL/workflows/review-and-fix.md"

directive() {  # directive FILE KEY -> the value of a leading `# KEY: value` line
  sed -n "s/^# $2: *//p" "$1" | head -1
}

codes_of() {  # the finding codes d2check listed (lint and semantic, every board)
  sed -n 's/^ *\([EWIS]-[a-z0-9-]*\) x[0-9][0-9]* -> .*/\1/p' "$1" | sort -u | tr '\n' ' ' | sed 's/ $//'
}

check_file() {  # check_file NAME WHICH -> writes $T/res/NAME.WHICH.d2.{out,rc}
  cname=$1 which=$2
  f="$T/r/$cname.$which.d2"
  if grep -q '^# unescape' "$f"; then
    python3 -c 'import sys
p = sys.argv[1]
s = open(p, encoding="ascii").read()
open(p, "w", encoding="utf-8").write(s.encode("ascii").decode("unicode_escape"))' "$f" || return 1
  fi
  ccode=${cname%%.*}
  brief=$(directive "$f" brief)
  [ -z "$brief" ] || brief="$T/r/$brief"
  for b in "$T/r/$cname.$which.brief" "$T/r/$cname.brief" "$T/r/$ccode.brief"; do
    if [ -z "$brief" ] && [ -f "$b" ]; then brief=$b; fi
  done
  col=$(directive "$f" column)
  opts=$(directive "$f" d2check)
  flags=$(directive "$f" d2)
  set -- --no-raster
  [ -z "$brief" ] || set -- "$@" --brief "$brief"
  [ -z "$col" ] || set -- "$@" --column "$col"
  # the source goes in by its bare name from inside $T/r: d2 then prints short paths, so a deep
  # TMPDIR never pushes its message past d2check's line limit
  # shellcheck disable=SC2086  # directive values are whitespace-separated option lists
  set -- "$@" $opts "$cname.$which.d2" "$T/out/$cname.$which.svg"
  # shellcheck disable=SC2086
  [ -z "$flags" ] || set -- "$@" -- $flags
  (cd "$T/r" && sh "$CHECK" "$@") > "$T/res/${f##*/}.out" 2>&1
  echo $? > "$T/res/${f##*/}.rc"
}

one_pair() {  # one_pair NAME -> prints one result line
  name=$1
  code=${name%%.*}
  if [ ! -f "$T/r/$name.after.d2" ]; then
    printf 'FAIL  %-34s no %s.after.d2\n' "$name" "$name"
    return
  fi
  check_file "$name" before
  check_file "$name" after
  bo="$T/res/$name.before.d2.out" ao="$T/res/$name.after.d2.out"
  brc=$(cat "$T/res/$name.before.d2.rc") arc=$(cat "$T/res/$name.after.d2.rc")
  bc=$(codes_of "$bo") ac=$(codes_of "$ao")
  why=""
  if [ "$code" = compile ]; then
    want=$(directive "$T/r/$name.before.d2" expect-error)
    [ "$brc" = 1 ] || why="before should fail to compile (d2check exit 1), got exit $brc"
    [ -z "$why" ] && [ -n "$want" ] && ! grep -qF -- "$want" "$bo" && why="before: d2 did not print '$want'"
    [ -z "$why" ] && [ -z "$want" ] && why="before has no '# expect-error:' line"
    [ -z "$why" ] && [ "$arc" != 3 ] && why="after should render clean (exit 3 with --no-raster), got exit $arc [$ac]"
    [ -z "$why" ] && [ -n "$ac" ] && why="after lists $ac"
    detail="exit $brc -> $arc"
  else
    for c in $code $(directive "$T/r/$name.before.d2" expect); do
      case " $bc " in *" $c "*) ;; *) why="${why:+$why; }before does not list $c" ;; esac
    done
    [ "$brc" = 1 ] && why="${why:+$why; }before does not compile"
    case " $ac " in *" $code "*) why="${why:+$why; }after still lists $code" ;; esac
    [ "$arc" = 3 ] || why="${why:+$why; }after fails (exit $arc)"
    allow=" $(directive "$T/r/$name.after.d2" allow) "
    for c in $ac; do
      [ "$c" = "$code" ] && continue  # reported above
      case $allow in *" $c "*) ;; *) why="${why:+$why; }after lists $c" ;; esac
    done
    detail="[${bc:-none}] -> [${ac:-clean}]"
  fi
  if [ -z "$why" ]; then
    printf 'ok    %-34s %s\n' "$name" "$detail"
  else
    printf 'FAIL  %-34s %s\n' "$name" "$why"
    if [ "$VERBOSE" = 1 ]; then
      for w in before after; do
        printf '      --- %s.%s.d2 (exit %s)\n' "$name" "$w" "$(cat "$T/res/$name.$w.d2.rc")"
        grep -v '^re-render: ' "$T/res/$name.$w.d2.out" | sed 's/^/      /'
      done
    fi
  fi
}

# --- worker mode (one pair per process, driven by xargs -P) ------------------------------------
if [ "${1:-}" = --pair ]; then
  T=$2 VERBOSE=$3
  one_pair "$4" > "$T/res/$4.result"
  exit 0
fi

jobs=4 VERBOSE=0
while [ $# -gt 0 ]; do
  case $1 in
    -j) [ $# -ge 2 ] || { echo "run.sh: -j needs a number" >&2; exit 2; }; jobs=$2; shift 2 ;;
    -v) VERBOSE=1; shift ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    -*) echo "run.sh: unknown option $1 (see -h)" >&2; exit 2 ;;
    *) break ;;
  esac
done
case $jobs in '' | *[!0-9]*) echo "run.sh: -j wants a number" >&2; exit 2 ;; esac
command -v d2 > /dev/null 2>&1 || { echo "run.sh: d2 is not on PATH (sh scripts/doctor.sh)" >&2; exit 2; }
command -v python3 > /dev/null 2>&1 || { echo "run.sh: python3 is not on PATH" >&2; exit 2; }
[ -f "$CHECK" ] || { echo "run.sh: missing $CHECK" >&2; exit 2; }

T=$(mktemp -d "${TMPDIR:-/tmp}/d2-recipes.XXXXXX") || exit 2
trap 'rm -rf "$T"' EXIT
trap 'exit 130' INT TERM
mkdir -p "$T/r" "$T/res" "$T/out"
cp -RL "$HERE/." "$T/r/" || exit 2
D2_WORK="$T/work"
export D2_WORK

all=$(cd "$T/r" && for f in *.before.d2; do [ -f "$f" ] && printf '%s\n' "${f%.before.d2}"; done | LC_ALL=C sort)
[ -n "$all" ] || { echo "run.sh: no *.before.d2 pairs in $HERE" >&2; exit 2; }
if [ $# -gt 0 ]; then
  sel=""
  for want in "$@"; do
    hit=$(printf '%s\n' "$all" | awk -v w="$want" '$0 == w || index($0, w ".") == 1')
    [ -n "$hit" ] || { echo "run.sh: no pair named $want" >&2; exit 2; }
    sel="$sel$hit
"
  done
  names=$(printf '%s' "$sel" | LC_ALL=C sort -u)
  full=0
else
  names=$all
  full=1
fi

start=$(date +%s)
printf '%s\n' "$names" | xargs -n 1 -P "$jobs" sh "$0" --pair "$T" "$VERBOSE"
fail=0 n=0 proven=""
for name in $names; do
  n=$((n + 1))
  if grep -q '^ok ' "$T/res/$name.result" 2> /dev/null; then
    cat "$T/res/$name.result"
    # a passing pair proves its CODE and every code on its before file's `# expect:` line
    proven="$proven ${name%%.*} $(directive "$T/r/$name.before.d2" expect)"
  elif [ -s "$T/res/$name.result" ]; then
    cat "$T/res/$name.result"
    fail=$((fail + 1))
  else
    printf 'FAIL  %-34s the worker died\n' "$name"
    fail=$((fail + 1))
  fi
done

# --- cross-check the pairs against the recipe catalog -------------------------------------------
xfail=0
if [ ! -f "$RF" ]; then
  echo "FAIL  catalog: $RF is missing"
  xfail=1
else
  heads=$(sed -n 's/^### \([EWIS]-[a-z0-9-]*\)[[:space:]]*$/\1/p' "$RF" | LC_ALL=C sort -u)
  for name in $names; do
    code=${name%%.*}
    if [ "$code" = compile ]; then
      want=$(directive "$T/r/$name.before.d2" expect-error)
      if [ -n "$want" ] && ! grep -qF -- "$want" "$RF"; then
        echo "FAIL  catalog: '$want' ($name) is not in review-and-fix.md"
        xfail=1
      fi
    elif ! printf '%s\n' "$heads" | grep -qx -- "$code"; then
      echo "FAIL  catalog: pair $name has no '### $code' section"
      xfail=1
    fi
  done
  if [ "$full" = 1 ]; then
    # every section that states a Fix: must be proven by at least one pair
    fixed=$(awk '/^### [EWIS]-/ { c = $2; next } /^#/ { c = "" } c != "" && /^Fix:/ { print c; c = "" }' "$RF" | LC_ALL=C sort -u)
    for code in $fixed; do
      case " $proven " in
        *" $code "*) ;;
        *) echo "FAIL  catalog: '### $code' states a Fix: but no passing pair proves it"; xfail=1 ;;
      esac
    done
    nofix=$(printf '%s\n' "$heads" | grep -vxF -e "$(printf '%s\n' "$fixed")" | tr '\n' ' ')
    [ -z "${nofix% }" ] || echo "note  sections without a Fix: line: $nofix"
  fi
fi
secs=$(($(date +%s) - start))
echo "recipes: $n pair(s), $((n - fail)) proven, $fail failed; catalog cross-check $([ "$xfail" = 0 ] && echo ok || echo FAILED) (${secs}s)"
[ "$fail" = 0 ] && [ "$xfail" = 0 ]
