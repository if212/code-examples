#!/bin/sh
# Design-system regression test (neutral-theme, snowflake-brand, style samples).
# usage: sh dev/tests/style/run.sh [OUTDIR]     (default ${TMPDIR:-/tmp}/d2-style-test)
#  1. contrast.py --check and d2 fmt --check pass on both theme files, and
#     contrast.py still fails the pre-rewrite theme in fixtures/
#  2. theme_rules.py: no node fill equals a panel tint, AA2 is slate, the six
#     geometry classes match across the themes, carry the interface values and
#     (the plain ones) set no color, and no modifier sets a size
#  3. d2check renders every dev/tests/style/*.d2 with 0 E-/S- findings
#  4. no sample SVG carries a prefers-color-scheme: dark block (light only)
#  5. style-guide.d2 uses every neutral-theme class and snowflake-guide.sf.d2
#     every snowflake-brand class; the Snowflake sample has a 3px #11567F
#     sf-flow, 16px Mid-Blue titles, white cylinders and (with fonts) Lato
#  6. OUTDIR/style-sheet.png: theme 0 plain (before/*.plain.d2) vs the theme,
#     column view, for arch, flow and state - look at it
# exit 0 = all pass, 1 = a check failed
set -u
unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
OUT=${1:-${TMPDIR:-/tmp}/d2-style-test}
mkdir -p "$OUT"
D2_WORK="$OUT/d2work"
export D2_WORK
fail=0
bad() { printf 'FAIL %s\n' "$*"; fail=1; }

for t in neutral-theme snowflake-brand; do
  f="$SKILL/templates/$t.d2"
  python3 "$SKILL/scripts/contrast.py" --check "$f" > "$OUT/contrast-$t.txt" 2>&1 ||
    bad "contrast $t (see $OUT/contrast-$t.txt)"
  d2 fmt --check "$f" > /dev/null 2>&1 || bad "d2 fmt --check $t"
  printf 'theme %-16s %s\n' "$t" "$(tail -1 "$OUT/contrast-$t.txt")"
done

python3 "$HERE/theme_rules.py" "$SKILL/templates/neutral-theme.d2" "$SKILL/templates/snowflake-brand.d2" \
  > "$OUT/theme-rules.txt" 2>&1 || bad "theme rules (see $OUT/theme-rules.txt)"
tail -1 "$OUT/theme-rules.txt"

# the audit itself must catch the two failures of the pre-rewrite Snowflake theme
fx="$HERE/fixtures/snowflake-brand.orig.d2"
if python3 "$SKILL/scripts/contrast.py" --check "$fx" > "$OUT/contrast-fixture.txt" 2>&1; then
  bad "contrast.py passed the failing fixture"
else
  for want in 'sf-flow .*2\.37 on canvas  FAIL' 'sf-accent-orange .*2\.05 on canvas  FAIL'; do
    grep -q "$want" "$OUT/contrast-fixture.txt" || bad "contrast.py missed: $want"
  done
fi

col_of() {  # the column PNG listed on d2check's READ: line (shell-quoted paths: spaces survive)
  python3 - "$1" << 'PY'
import shlex, sys
line = next((x for x in open(sys.argv[1], encoding='utf-8', errors='replace') if x.startswith('READ: ')), '')
print(next((p for p in shlex.split(line[6:]) if p.endswith('.col.png')), ''))
PY
}
for f in "$HERE"/*.d2 "$HERE"/before/*.d2; do
  n=$(basename "$f" .d2)
  sh "$SKILL/scripts/d2check.sh" --check-fmt "$f" "$OUT/$n.svg" > "$OUT/$n.log" 2>&1
  rc=$?
  errs=$(grep -cE '^[ES]-[a-z-]+ x[0-9]+' "$OUT/$n.log")
  warns=$(grep -E '^W-[a-z-]+ x[0-9]+' "$OUT/$n.log" | sed 's/ ->.*//' | tr '\n' ' ')
  printf 'sample %-14s exit %s  errors %s  %s\n' "$n" "$rc" "$errs" "$warns"
  case $f in
    */before/*) ;;
    *)
      [ "$rc" -eq 1 ] && bad "$n did not render (see $OUT/$n.log)"
      [ "$rc" -eq 3 ] && printf 'WARN %s: not faithfully rasterized (d2check exit 3) - look at it by hand\n' "$n"
      [ "$errs" -eq 0 ] || bad "$n has E-/S- findings (see $OUT/$n.log)"
      if grep -q 'prefers-color-scheme: *dark' "$OUT/$n.svg" 2>/dev/null; then
        bad "$n.svg has a dark-mode block"
      fi ;;
  esac
done

# each style guide shows every class of its theme
for pair in neutral-theme:style-guide.d2 snowflake-brand:snowflake-guide.sf.d2; do
  missing=$(python3 - "$SKILL/templates/${pair%%:*}.d2" "$HERE/${pair#*:}" <<'PY'
import re, sys
theme, guide = (open(p).read() for p in sys.argv[1:3])
defined = re.findall(r'^  ([a-z][a-z-]*): \{', theme.split('classes:', 1)[1], re.M)
used = set()
for v in re.findall(r'class: *(\[[^\]]*\]|[a-z-]+)', guide):
    used.update(x.strip() for x in v.strip('[]').split(';'))
print(' '.join(c for c in defined if c not in used) if defined else 'NO-CLASSES-PARSED')
PY
)
  [ -z "$missing" ] || bad "${pair#*:} lacks classes: $missing"
done

# Snowflake sample: Mid-Blue 3px sf-flow, 16px Mid-Blue container titles, Lato embedded
sf="$OUT/snowflake.sf.svg"
grep -q 'stroke="#11567F"[^>]*stroke-width:3;' "$sf" || bad "sf-flow is not #11567F at 3px"
grep -q 'fill="#11567F" class="text-bold" style="text-anchor:middle;font-size:16px"' "$sf" ||
  bad "no 16px Mid-Blue container title"
# sf-datastore: white cylinders on the #F4FAFD container tint (never a hollow outline)
grep -q '<path d="M [^"]*C[^"]*" stroke="#11567F" fill="#FFFFFF"' "$sf" ||
  bad "no white sf-datastore cylinder in the Snowflake sample"
if grep -q '^fonts: brand-snowflake' "$OUT/snowflake.sf.log"; then
  faces=$(python3 "$HERE/fontnames.py" "$sf" 2>&1)  # read it all: grep -q would close the pipe early
  case $faces in *' Lato '*) ;; *) bad "Snowflake sample does not embed Lato" ;; esac
else
  echo "SKIP Lato check: d2check did not apply the brand-snowflake fonts ($(grep '^fonts:' "$OUT/snowflake.sf.log"))"
fi

set --
for d in arch flow state; do
  b=$(col_of "$OUT/$d.plain.log") a=$(col_of "$OUT/$d.ds.log")
  if [ -n "$b" ] && [ -n "$a" ]; then
    set -- "$@" "$b:$d-theme-0-plain" "$a:$d-neutral-theme"
  else
    bad "no column PNG for $d (rasterizer unavailable?)"
  fi
done
[ $# -gt 0 ] && python3 "$HERE/sheet.py" "$OUT/style-sheet.png" 2 820 "$@"
[ $fail -eq 0 ] && echo "style: PASS" || echo "style: FAIL"
exit $fail
