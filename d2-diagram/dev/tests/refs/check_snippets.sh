#!/bin/sh
# check_snippets.sh - render every d2 code block in Markdown files.
#
# usage: sh check_snippets.sh [-v] [-j N] FILE.md ...
#
#   ```d2       must render: exit 0 from a real `d2` render (d2 validate only parses)
#   ```d2-bad   must FAIL to render: it shows a mistake
#
# Leading comment lines of a block are directives (d2 ignores them):
#   # fragment        partial code: skipped
#   # cwd: <dir>      render from <dir> (relative to the .md): imports and
#                     relative icon paths resolve there
#   # expect: <text>  d2-bad only: the d2 error output must contain <text>
#
# Blocks go to `d2 -` on stdin, run from the .md's directory (or cwd:), so
# nothing is written next to the docs. D2_LAYOUT, D2_THEME, D2_PAD, SCALE,
# D2_WATCH ... are unset: in the environment they override d2-config (or hang).
# -v prints every block, -j runs N renders at once (default: CPU count, max 8).
# A render past 120 s (env CHECK_SNIPPETS_TIMEOUT; needs `timeout`) is a FAIL.
# Exit: 0 all blocks pass | 1 a block failed | 2 usage error or d2 missing.

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

VERBOSE=
JOBS=
while [ $# -gt 0 ]; do
  case "$1" in
    -v) VERBOSE=1 ;;
    -j)
      [ $# -ge 2 ] || usage
      JOBS=$2
      shift
      ;;
    -h | --help) usage ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
  shift
done
[ $# -gt 0 ] || usage
command -v d2 > /dev/null 2>&1 || { echo "check_snippets: d2 not on PATH" >&2; exit 2; }
case "$JOBS" in
  '') JOBS=$(nproc 2> /dev/null || getconf _NPROCESSORS_ONLN 2> /dev/null || echo 2)
      [ "$JOBS" -gt 8 ] 2> /dev/null && JOBS=8 ;;
  *[!0-9]* | 0) usage ;;
esac

unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH \
  D2_ANIMATE_INTERVAL D2_BUNDLE D2_FORCE_APPENDIX SCALE
TO=
SECS=${CHECK_SNIPPETS_TIMEOUT:-120}
command -v timeout > /dev/null 2>&1 && TO="timeout $SECS"

T=$(mktemp -d "${TMPDIR:-/tmp}/check_snippets.XXXXXX") || exit 2
trap 'rm -rf "$T"' EXIT
trap 'exit 2' INT TERM

# ---- extract: $T/b<i>.d2 (block body) + $T/b<i>.meta (key=value lines)
n=0
bad_files=0
for md in "$@"; do
  if [ ! -f "$md" ]; then
    echo "FAIL $md: no such file"
    bad_files=$((bad_files + 1))
    continue
  fi
  n=$(awk -v start="$n" -v T="$T" -v md="$md" '
    function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
    BEGIN { n = start; open = 0 }
    {
      line = $0
      if (!open) {
        if (match(line, /^ *(```+|~~~+)/)) {
          lead = line; sub(/[^ ].*$/, "", lead); ind = length(lead)
          f = substr(line, ind + 1, RLENGTH - ind); fch = substr(f, 1, 1); flen = length(f)
          info = trim(substr(line, RLENGTH + 1)); sub(/[ \t{].*$/, "", info); info = tolower(info)
          if (fch == "`" && index(substr(line, RLENGTH + 1), "`")) next  # inline code, not a fence
          open = 1; at = NR; cur = 0
          if (info == "d2" || info == "d2-bad") {
            n++; cur = n; hdr = 1
            body = T "/b" n ".d2"; meta = T "/b" n ".meta"
            printf "" > body
            printf "kind=%s\nmd=%s\nline=%d\n", info, md, NR > meta
          }
          next
        }
        next
      }
      s = trim(line)
      if (substr(s, 1, 1) == fch && length(s) >= flen && s ~ ("^[" fch "]+$")) {
        open = 0
        if (cur) { close(body); close(meta) }
        next
      }
      if (!cur) next
      for (k = 0; k < ind && substr(line, 1, 1) == " "; k++) line = substr(line, 2)
      print line > body
      if (hdr) {
        if (s == "") next
        if (s ~ /^#[ ]*fragment/) { print "fragment=1" > meta; next }
        if (s ~ /^#[ ]*cwd:/) { v = s; sub(/^#[ ]*cwd:[ ]*/, "", v); print "cwd=" v > meta; next }
        if (s ~ /^#[ ]*expect:/) { v = s; sub(/^#[ ]*expect:[ ]*/, "", v); print "expect=" v > meta; next }
        hdr = 0
      }
    }
    END {
      if (open) printf "FAIL %s:%d code fence never closed\n", md, at >> (T "/unclosed")
      print n
    }' "$md") || exit 2
done
if [ -s "$T/unclosed" ]; then
  cat "$T/unclosed"
  bad_files=$((bad_files + $(wc -l < "$T/unclosed")))
fi

get() { sed -n "s/^$1=//p" "$T/b$2.meta" | head -n 1; }

# ---- render one block; writes one result line to $T/r<i>
run_block() {
  i=$1
  kind=$(get kind "$i")
  md=$(get md "$i")
  at=$(get line "$i")
  where="$md:$at [$kind]"
  if [ -n "$(get fragment "$i")" ]; then
    echo "skip $where fragment" > "$T/r$i"
    return
  fi
  dir=$(cd "$(dirname "$md")" && pwd)
  rel=$(get cwd "$i")
  if [ -n "$rel" ]; then
    case "$rel" in /*) dir=$rel ;; *) dir=$dir/$rel ;; esac
    if ! dir=$(cd "$dir" 2> /dev/null && pwd); then
      echo "FAIL $where cwd: $rel does not exist" > "$T/r$i"
      return
    fi
  fi
  # shellcheck disable=SC2086 # $TO is "timeout N" or empty
  (cd "$dir" && $TO d2 - "$T/o$i.svg" < "$T/b$i.d2") > "$T/e$i.log" 2>&1
  rc=$?
  if [ -n "$TO" ] && [ "$rc" = 124 ]; then
    echo "FAIL $where render timed out after $SECS s" > "$T/r$i"
    return
  fi
  # d2 reports stdin positions as -:LINE:COL: -> map them to .md lines
  err=$(grep 'err:' "$T/e$i.log" | sed 's/^err: //; s/failed to compile -: //' |
    awk -v at="$at" '{
      out = ""
      while (match($0, /-:[0-9]+:[0-9]+:/)) {
        p = substr($0, RSTART + 2, RLENGTH - 3); sub(/:.*/, "", p)
        out = out substr($0, 1, RSTART - 1) "md line " (at + p) ":"
        $0 = substr($0, RSTART + RLENGTH)
      }
      print out $0
    }' | head -n 2 | tr '\n' '|' | sed 's/|$//; s/|/ | /g')
  [ -n "$err" ] || err=$(tail -n 1 "$T/e$i.log")
  expect=$(get expect "$i")
  if [ "$kind" = d2 ]; then
    if [ "$rc" = 0 ]; then
      echo "ok   $where" > "$T/r$i"
    else
      echo "FAIL $where does not render: $err" > "$T/r$i"
    fi
  elif [ "$rc" = 0 ]; then
    echo "FAIL $where renders, but a d2-bad block must fail" > "$T/r$i"
  elif [ -n "$expect" ] && ! grep -F -q -- "$expect" "$T/e$i.log"; then
    echo "FAIL $where fails without \"$expect\": $err" > "$T/r$i"
  else
    echo "ok   $where fails as expected: $err" > "$T/r$i"
  fi
}

i=1
batch=0
while [ "$i" -le "$n" ]; do
  run_block "$i" &
  batch=$((batch + 1))
  if [ "$batch" -ge "$JOBS" ]; then
    wait
    batch=0
  fi
  i=$((i + 1))
done
wait

ok=0 bad=0 skip=0 fail=$bad_files
i=1
while [ "$i" -le "$n" ]; do
  r=$(cat "$T/r$i" 2> /dev/null || echo "FAIL block $i: no result")
  case "$r" in
    FAIL*) fail=$((fail + 1)); echo "$r" ;;
    skip*) skip=$((skip + 1)); [ -z "$VERBOSE" ] || echo "$r" ;;
    *'fails as expected'*) bad=$((bad + 1)); [ -z "$VERBOSE" ] || echo "$r" ;;
    *) ok=$((ok + 1)); [ -z "$VERBOSE" ] || echo "$r" ;;
  esac
  i=$((i + 1))
done
echo "snippets: $ok render, $bad fail as expected, $skip skipped, $fail FAILED (files: $#)"
[ "$fail" = 0 ]
