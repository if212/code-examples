#!/bin/sh
# shellcheck disable=SC2015,SC2016  # 'check && ok || bad' is intended; single-quoted $ is literal
# test_d2check.sh - end-to-end checks of scripts/d2check.sh (exit codes, summary lines, files).
# usage: sh dev/tests/lint/test_d2check.sh        needs d2, python3; Chromium for the faithful cases
# exit: 0 all passed, 1 a check failed
set -u
PYTHONDONTWRITEBYTECODE=1  # no __pycache__ in the skill's scripts/ (B57)
export PYTHONDONTWRITEBYTECODE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
CHECK="$SKILL/scripts/d2check.sh"
T=${TMPDIR:-/tmp}/d2check-tests
rm -rf "$T" && mkdir -p "$T"
export D2_WORK="$T/work"
pass=0 fail=0
ok() { pass=$((pass + 1)); printf 'ok    %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL  %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | head -12 | sed 's/^/      /'; }
has() { printf '%s\n' "$1" | grep -q -- "$2"; }

cp "$HERE/cases/ok_flowchart.d2" "$T/ok_flowchart.d2"

# 1. clean case: exit 0, contract lines, deliverable attributes, nothing written next to it -------------
o=$(sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/ok.svg" 2>&1); rc=$?
if [ "$rc" = 0 ] && has "$o" '^reviewed: faithful' && has "$o" '^display: ' && has "$o" '^READ: ' && has "$o" '^re-render: d2 ' && has "$o" '^fonts: '; then
  ok "clean case: exit 0 + reviewed/display/READ/re-render/fonts lines"
else bad "clean case (exit $rc)" "$o"; fi
# FIXPLAN I6: post: and checks: lines; the re-render line ends with the svgpost step; a clean result says so
if has "$o" '^post: ' && has "$o" '^checks: lint 0 error(s) 0 warning(s); semantic 0 error(s) 0 warning(s)$' &&
  has "$o" '^re-render: d2 .* && python3 [^ ]*/scripts/svgpost.py [^ ]*ok.svg$' && has "$o" '^result: exit 0 - clean'; then
  ok "I6: post:, checks: and the svgpost step on the re-render line"
else bad "I6 summary lines" "$o"; fi
m=$(stat -c %a "$T/out/ok.svg" 2>/dev/null || stat -f %Lp "$T/out/ok.svg")
if [ "$m" = 644 ] && grep -q 'geometricPrecision' "$T/out/ok.svg" && head -c 400 "$T/out/ok.svg" | grep -q ' width="[0-9.]*" height="[0-9.]*"'; then
  ok "deliverable: mode 644, width/height, geometricPrecision"
else bad "deliverable attributes ($m)"; fi
if [ "$(ls "$T/out")" = "ok.svg" ]; then ok "no working files next to the deliverable"; else bad "stray files next to OUT" "$(ls "$T/out")"; fi
for p in $(printf '%s\n' "$o" | sed -n 's/^READ: //p'); do
  [ -f "$p" ] || bad "READ path missing: $p"
done
has "$o" 'col.png' && ok "READ lists the column view first" || bad "READ has no col.png" "$o"
if has "$o" '^fonts: default ('; then  # bundled fonts: one readable $(sh font-flags.sh) word, not 8 paths
  has "$o" '^re-render: d2 \$(sh [^ ]*/scripts/font-flags.sh default) --scale 1 ' && ok "re-render: fonts as \$(sh font-flags.sh default)" \
    || bad "re-render with fonts" "$(printf '%s\n' "$o" | grep '^re-render')"
fi
sh "$CHECK" --no-raster --column 0 "$T/ok_flowchart.d2" "$T/out/ok.svg" > /dev/null 2>&1; rc=$?
[ "$rc" = 64 ] && ok "--column 0 refused (exit 64)" || bad "--column 0 accepted (exit $rc)"

# 2. rasterizer routes ----------------------------------------------------------------------------------
o=$(D2CHECK_ROUTE=rsvg sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/ok.svg" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^reviewed: approximate' && has "$o" "report 'Reviewed: approximate" && ok "D2CHECK_ROUTE=rsvg: exit 3, approximate" || bad "rsvg route (exit $rc)" "$o"
o=$(D2CHECK_ROUTE=cairosvg sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/ok.svg" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'rejected' && has "$o" '^reviewed: NOT visually reviewed' && ok "D2CHECK_ROUTE=cairosvg: output rejected, exit 3" || bad "cairosvg route (exit $rc)" "$o"
# a PATH with the basics but no node, chrome or rsvg-convert, and no browser cache
bin="$T/bin"; mkdir -p "$bin"
for t in sh dash d2 python3 sed awk grep cksum basename dirname mkdir mv cp rm find sort wc tr head tail cut cat chmod ls env uname; do
  p=$(command -v "$t" 2>/dev/null) && ln -sf "$p" "$bin/$t"
done
o=$(PATH="$bin" PLAYWRIGHT_BROWSERS_PATH="$T/none" HOME="$T/none" sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/ok.svg" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^reviewed: NOT visually reviewed' && ok "no node/chrome/rsvg: NOT visually reviewed, exit 3" || bad "stripped PATH (exit $rc)" "$o"

# B55: 19 S- errors box every participant and both operands; the tinted ann.png is an aid and never turns
# a faithful review into "NOT visually reviewed" (only the column and detail views decide it)
mkdir -p "$T/b55" && cp "$SKILL/templates/neutral-theme.d2" "$T/b55/"
cat > "$T/b55/saga.d2" << 'EOF'
...@neutral-theme
shape: sequence_diagram
classes: {p: {width: 170}}
order: Order service {class: [actor; p]}
payment: Payment service {class: [actor; p]}
inventory: Inventory service {class: [actor; p]}
order -> payment: "1. Charge card (order PENDING)" {class: dep}
order -> inventory: "2. Reserve stock" {class: dep}
alt: "alt" {
  class: zone
  ok: "[stock reserved]" {
    class: zone-green
    inventory -> order: "3. stock reserved" {class: secondary}
    order.confirm: Confirms order {class: [note; compact]}
  }
  failed: "[reservation fails]" {
    class: zone-amber
    inventory -> order: "3. reservation failed" {class: failure}
    order -> payment: "4. compensate: refund charge" {class: failure}
    order.cancel: Cancels order {class: [note; compact]}
  }
}
EOF
o=$(sh "$CHECK" --brief "$SKILL/dev/tests/recipes/seq.brief" "$T/b55/saga.d2" "$T/b55/saga.svg" 2>&1); rc=$?
if [ "$rc" = 2 ] && has "$o" '^reviewed: faithful' && has "$o" '^READ: .*saga\.ann\.png'; then
  ok "B55: a finding-heavy ann.png never downgrades a faithful review"
elif ! has "$o" '^reviewed: faithful' && ! has "$o" 'output rejected'; then
  ok "B55: skipped (no faithful rasterizer here)"
else bad "B55: annotated view downgraded the review (exit $rc)" "$o"; fi

# 3. compile error: exit 1, d2's error, then a hint; OUT untouched ------------------------------------
printf 'left -> right\n' > "$T/kw.d2"
cp "$T/out/ok.svg" "$T/kw.svg"
before=$(cksum < "$T/kw.svg")
o=$(sh "$CHECK" "$T/kw.d2" "$T/kw.svg" 2>&1); rc=$?
e=$(printf '%s\n' "$o" | grep -n 'reserved keywords' | head -1 | cut -d: -f1)
h=$(printf '%s\n' "$o" | grep -n '^hint: ' | head -1 | cut -d: -f1)
[ "$rc" = 1 ] && [ -n "$e" ] && [ -n "$h" ] && [ "$e" -lt "$h" ] && ok "left -> right: exit 1, d2 error then hint:" || bad "compile error (exit $rc)" "$o"
has "$o" ': kw.d2:1:1: reserved keywords are prohibited' && ! has "$o" "$T/kw.d2:1" && ok "d2 errors shown without the input's absolute folder" || bad "d2 error path" "$o"
o=$(cd /dev && sh "$CHECK" "$T/kw.d2" "$T/kw.svg" 2>&1)
! has "$o" '\.\.kw\.d2' && has "$o" ': kw.d2:1:1: reserved keywords are prohibited' && ok "d2 errors: the ../../ spelling of the folder is dropped too" || bad "d2 error path from another cwd" "$o"
# a deep folder: paths are shortened BEFORE the line is cut, so d2's own advice survives (B37)
deep="$T/a-very-long-folder-name-that-pushes-the-error-line-past-its-cut-aaaaaaaaaaaaaaaaaaaa/and-one-more-level-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
mkdir -p "$deep" && cp "$SKILL/templates/neutral-theme.d2" "$deep/"
printf '...@neutral-theme\napi: Orders API {class: [service, focal]}\n' > "$deep/cc.d2"
o=$(sh "$CHECK" --no-raster "$deep/cc.d2" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'Did you mean to use ";" to separate array items' && ok "deep folder: d2's advice is not cut off (B37)" || bad "deep folder error line (exit $rc)" "$o"
[ "$before" = "$(cksum < "$T/kw.svg")" ] && ok "failed render leaves the existing OUT untouched" || bad "failed render changed OUT"
printf 'a -> b: "unterminated\n' > "$T/syn.d2"
o=$(sh "$CHECK" "$T/syn.d2" "$T/syn.svg" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" '^fmt: FAILED' && has "$o" '^hint: ' && ok "syntax error: exit 1 at fmt, with hint" || bad "syntax error (exit $rc)" "$o"

# 4. multi-board source: every board rendered and linted --------------------------------------------
cp "$HERE/d2check/multi_board.d2" "$T/multi_board.d2"
o=$(sh "$CHECK" "$T/multi_board.d2" "$T/mb.svg" 2>&1); rc=$?
nb=$(printf '%s\n' "$o" | grep -c '^board ')
if [ "$nb" = 5 ] && [ -f "$T/mb/index.svg" ] && [ -f "$T/mb/steps/2.svg" ] && [ "$(printf '%s\n' "$o" | sed -n 's/^READ: //p' | wc -w)" -ge 5 ]; then
  ok "multi-board: 5 boards linted and rasterized (exit $rc)"
else bad "multi-board ($nb boards, exit $rc)" "$o"; fi
{ printf 'vars: {d2-config: {layout-engine: elk; pad: 24}}\nbase: Base\nsteps: {\n'
  i=1; while [ "$i" -le 11 ]; do printf '  "%d": {\n    s%d: Step %d\n  }\n' "$i" "$i" "$i"; i=$((i + 1)); done
  printf '}\n'; } > "$T/eleven.d2"
o=$(sh "$CHECK" --no-raster "$T/eleven.d2" "$T/el/eleven.svg" 2>&1)
order=$(printf '%s\n' "$o" | sed -n 's/^board \([^:]*\):.*/\1/p' | tr '\n' ' ')
[ "$order" = "index.svg 1.svg 2.svg 3.svg 4.svg 5.svg 6.svg 7.svg 8.svg 9.svg 10.svg 11.svg " ] && ok "boards: root first, then natural step order" || bad "board order" "$order"
# the same source rendered into a new folder: the earlier OUT folder is someone's deliverable, never touched
sh "$CHECK" --no-raster "$T/multi_board.d2" "$T/v2/mb.svg" > /dev/null 2>&1
[ -f "$T/mb/index.svg" ] && [ -f "$T/mb/steps/2.svg" ] && [ -f "$T/v2/mb/steps/2.svg" ] && ok "new OUT folder: the earlier one is left alone" || bad "earlier OUT folder touched" "$(find "$T/mb" "$T/v2" -name '*.svg' | sort)"
echo keep > "$T/v2/mb/NOTES.txt"
sed '/"2": {/,/^  }/d' "$T/multi_board.d2" > "$T/mb.tmp" && mv "$T/mb.tmp" "$T/multi_board.d2"
sh "$CHECK" --no-raster "$T/multi_board.d2" "$T/v2/mb.svg" > /dev/null 2>&1
[ ! -f "$T/v2/mb/steps/2.svg" ] && [ -f "$T/v2/mb/steps/1.svg" ] && [ -f "$T/v2/mb/NOTES.txt" ] && [ -f "$T/mb/steps/2.svg" ] && ok "dropped board removed from its own folder only; other files kept" || bad "stale board cleanup" "$(find "$T/mb" "$T/v2" | sort)"

# 5. tripwire, formatting, strict -----------------------------------------------------------------------
printf 'a: "Caf\303\251"\na -> b\n' > "$T/nonascii.d2"
o=$(sh "$CHECK" --no-raster "$T/nonascii.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^tripwire: 1 line' && has "$o" '(the whole .d2, comments included, must be plain ASCII; in code: expand tabs to 4 spaces)' &&
  ok "tripwire: non-ASCII label -> exit 2, names the plain-ASCII rule" || bad "tripwire (exit $rc)" "$o"
# a Go snippet pasted with its tabs: the tripwire names the line and says to expand the tabs
printf 'vars: {d2-config: {layout-engine: elk}}\nf: |`go\n  func f() error {\n  \treturn nil\n  }\n`|\n' > "$T/tabs.d2"
o=$(sh "$CHECK" --no-raster "$T/tabs.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^tripwire: 1 line' && has "$o" 'in code: expand tabs to 4 spaces' && has "$o" '<TAB>return nil' &&
  ok "tripwire: a tab in a code block -> exit 2, says to expand tabs" || bad "tripwire on a code tab (exit $rc)" "$o"
printf 'vars: {d2-config: {layout-engine: elk}}\na->b\n' > "$T/fmt.d2"
o=$(sh "$CHECK" --no-raster --check-fmt "$T/fmt.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^fmt: NOT formatted' && grep -q 'a->b' "$T/fmt.d2" && ok "--check-fmt: reports, leaves the file, exit 2" || bad "--check-fmt (exit $rc)" "$o"
o=$(sh "$CHECK" --no-raster "$T/fmt.d2" 2>&1); rc=$?
has "$o" '^fmt: reformatted' && grep -q 'a -> b' "$T/fmt.d2" && ok "fmt applied in place, with a re-Read note" || bad "fmt apply (exit $rc)" "$o"
o=$(sh "$CHECK" --no-raster "$T/fmt.d2" 2>&1)
has "$o" '^fmt:' && bad "fmt note on an already formatted file" "$o" || ok "no fmt noise when already formatted"
cp "$HERE/cases/bad_short_label.d2" "$T/short.d2"
o=$(sh "$CHECK" --no-raster "$T/short.d2" 2>&1); rc=$?
sh "$CHECK" --no-raster --strict "$T/short.d2" > /dev/null 2>&1; rc2=$?
[ "$rc" = 3 ] && [ "$rc2" = 2 ] && has "$o" '^W-short-label x1 -> workflows/review-and-fix.md#w-short-label (warning)$' &&
  has "$o" '^result: exit 3 - .*; 1 warning(s) still to fix$' &&
  ok "warnings: exit 3 with --no-raster, 2 with --strict; code line + anchor + severity" || bad "strict ($rc/$rc2)" "$o"

# 6. -l/-t warn, --watch refused ------------------------------------------------------------------------
o=$(sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/out/ok.svg" -- -l dagre 2>&1); rc=$?
has "$o" "^warning: '-l' overrides" && has "$o" 'W-curved-edge' && ok "-l dagre: warning + W-curved-edge in the listing" || bad "-l warning (exit $rc)" "$o"
o=$(sh "$CHECK" "$T/ok_flowchart.d2" -- -w 2>&1); rc=$?
[ "$rc" = 64 ] && ok "--watch refused" || bad "--watch not refused (exit $rc)" "$o"

# 7. brief: semantic findings merged into the listing -----------------------------------------------
if [ -f "$SKILL/scripts/semcheck.py" ]; then
  cp "$HERE/d2check/brief_case.d2" "$HERE/d2check/brief_case.brief" "$T/"
  o=$(sh "$CHECK" --no-raster --brief "$T/brief_case.brief" "$T/brief_case.d2" 2>&1); rc=$?
  [ "$rc" = 2 ] && has "$o" '^S-missing-edge x1 -> workflows/review-and-fix.md#s-missing-edge' && ok "brief: S- errors listed, exit 2" || bad "brief (exit $rc)" "$o"
  mkdir -p "$D2_WORK/brief_case" && cp "$HERE/d2check/brief_case.brief" "$D2_WORK/brief_case/brief_case.brief"
  o=$(sh "$CHECK" --no-raster "$T/brief_case.d2" 2>&1)
  has "$o" 'S-missing-edge' && ok "brief found in D2W/<name>.brief without --brief" || bad "D2W brief lookup" "$o"
  # T14: the report's Re-render line (SKILL.md step 6) carries D2_WORK, so a fresh shell finds the brief;
  # without it d2check falls back to the source checks
  rl=$(sed -n 's/^Re-render: //p' "$SKILL/SKILL.md")
  case $rl in
    "D2_WORK=<D2W's parent> sh \${CLAUDE_SKILL_DIR}/scripts/d2check.sh "*"<target>.d2")
      o=$(env -u D2_WORK TMPDIR="$T/fresh" D2_WORK="$D2_WORK" sh "$CHECK" --no-raster "$T/brief_case.d2" 2>&1)
      o2=$(env -u D2_WORK TMPDIR="$T/fresh" sh "$CHECK" --no-raster "$T/brief_case.d2" 2>&1)
      has "$o" 'S-missing-edge' && has "$o2" '^semantic: .* - source checks only' &&
        ok "T14: the Re-render line's D2_WORK prefix finds the brief in a fresh shell" ||
        bad "T14 re-render with D2_WORK" "$o
--- without D2_WORK:
$o2" ;;
    *) bad "T14: SKILL.md's Re-render line does not start with D2_WORK=<D2W's parent>" "$rl" ;;
  esac
  # without a brief the source checks still run: a class nothing defines is not "clean" (B36)
  cp "$SKILL/templates/neutral-theme.d2" "$T/"
  printf '...@neutral-theme\napi: API {class: service}\ndb: DB {class: datastor}\napi -> db: {class: dep}\n' > "$T/nobrief.d2"
  o=$(sh "$CHECK" --no-raster "$T/nobrief.d2" 2>&1); rc=$?
  [ "$rc" = 2 ] && has "$o" '^semantic: 1 error(s), 0 warning(s) - source checks only - no brief' &&
    has "$o" '^S-src-class x1 -> workflows/review-and-fix.md#s-src-class (error)' &&
    ok "no brief: semcheck --lint runs, a class typo exits 2 (B36)" || bad "no-brief source checks (exit $rc)" "$o"
  printf 'a -> b\n' > "$T/unpinned.d2"
  o=$(sh "$CHECK" --no-raster "$T/unpinned.d2" 2>&1); rc=$?
  [ "$rc" = 2 ] && has "$o" '^S-src-cli-engine x1 -> ' && ok "no brief: an unpinned engine is S-src-cli-engine, as with a brief" ||
    bad "no-brief S-src-cli-engine (exit $rc)" "$o"
else
  printf 'skip  brief checks (scripts/semcheck.py missing)\n'
fi

# 8. fonts: a fake font-flags.sh in a copy of the scripts (paths with spaces, both flag spellings) ----
fake="$T/skill copy/scripts"; mkdir -p "$fake" "$T/skill copy/assets/fonts/default" "$T/skill copy/assets/fonts/lato"
cp "$SKILL/scripts/"*.py "$SKILL/scripts/"*.cjs "$SKILL/scripts/d2check.sh" "$fake/"
src=$(ls /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf 2>/dev/null || true)
if [ -n "$src" ]; then
  for n in Regular Bold Italic; do cp "$src" "$T/skill copy/assets/fonts/default/$n.ttf"; cp "$src" "$T/skill copy/assets/fonts/lato/$n.ttf"; done
  cat > "$fake/font-flags.sh" <<'EOF'
#!/bin/sh
d=$(CDPATH='' cd -- "$(dirname -- "$0")/../assets/fonts" && pwd)
case ${1:-default} in brand-snowflake) f=lato ;; *) f=default ;; esac
printf -- '--font-regular=%s/%s/Regular.ttf --font-bold "%s/%s/Bold.ttf"\n--font-italic %s/%s/Italic.ttf\n' "$d" "$f" "$d" "$f" "$d" "$f"
EOF
  o=$(sh "$fake/d2check.sh" --no-raster "$T/ok_flowchart.d2" "$T/out/f.svg" 2>&1); rc=$?
  has "$o" '^fonts: default (assets/fonts/default)' && has "$o" "'--font-italic=/" && grep -q 'd2-[0-9]*-font-italic' "$T/out/f.svg" && ok "font-flags.sh: default family applied (spaces in paths)" || bad "font flags (exit $rc)" "$o"
  # the re-render line runs as printed (quoted font paths, no $(...) under a path with spaces) and
  # gives the shipped SVG byte for byte, svgpost step included (B38, FIXPLAN I6)
  cp "$T/out/f.svg" "$T/out/f.shipped.svg"
  rr=$(printf '%s\n' "$o" | sed -n 's/^re-render: //p')
  if sh -c "$rr" > /dev/null 2>&1 && [ "$(cksum < "$T/out/f.shipped.svg")" = "$(cksum < "$T/out/f.svg")" ]; then
    ok "re-render: runs as printed from a path with spaces, same SVG byte for byte (B38)"
  else bad "re-render line under a path with spaces" "$rr"; fi
  printf '...@snowflake-brand\na -> b\n' > "$T/sf.d2"
  printf 'vars: {d2-config: {layout-engine: elk}}\n' > "$T/snowflake-brand.d2"
  o=$(sh "$fake/d2check.sh" --no-raster "$T/sf.d2" 2>&1)
  has "$o" '^fonts: brand-snowflake (assets/fonts/lato)' && ok "font-flags.sh: brand-snowflake when the file imports snowflake-brand" || bad "brand fonts" "$o"
  rm -f "$fake/font-flags.sh"
  o=$(sh "$fake/d2check.sh" --no-raster "$T/ok_flowchart.d2" "$T/out/f.svg" 2>&1)
  has "$o" '^fonts: d2 default (font-flags.sh unavailable)' && ok "font-flags.sh missing: one fonts line, render goes on" || bad "missing font-flags.sh" "$o"
else
  printf 'skip  font checks (no DejaVu font to fake with)\n'
fi
if [ -f "$SKILL/scripts/font-flags.sh" ]; then
  o=$(D2_FONT_FAMILY=d2-default sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/out/f2.svg" 2>&1)
  has "$o" '^fonts: d2 built-in (d2-default)' && ! has "$o" '^re-render: .*font' && ok "D2_FONT_FAMILY=d2-default: d2's built-in fonts" || bad "d2-default family" "$o"
fi

# 10. toolchain usability (WP8a) -------------------------------------------------------------------------
# d2's environment variables are ignored (D2_WATCH used to hang the render); the SVG is the clean one
sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/out/clean.svg" > /dev/null 2>&1
o=$(D2_WATCH=true D2_LAYOUT=dagre D2_PAD=100 SCALE=2 timeout 60 sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/out/env.svg" 2>&1); rc=$?
vb() { grep -o 'viewBox="[^"]*"' "$1" | head -1; }
[ "$rc" = 3 ] && has "$o" '^warning: ignored d2 settings from the environment: D2_LAYOUT=dagre D2_PAD=100 D2_WATCH=true SCALE=2' &&
  [ -n "$(vb "$T/out/env.svg")" ] && [ "$(vb "$T/out/env.svg")" = "$(vb "$T/out/clean.svg")" ] && ok "D2_WATCH/D2_LAYOUT/D2_PAD/SCALE ignored with a warning, no hang (B3)" ||
  bad "hostile environment (exit $rc)" "$o"
# a TMPDIR that no longer exists (a deleted temp folder) must not cost the faithful review
r1=$(sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/tmpdir.svg" 2>&1 | grep '^reviewed:')
r2=$(TMPDIR="$T/no-such-tmp" sh "$CHECK" "$T/ok_flowchart.d2" "$T/out/tmpdir.svg" 2>&1 | grep '^reviewed:')
[ -n "$r1" ] && [ "$r1" = "$r2" ] && ok "TMPDIR that does not exist: the same review ($r2)" || bad "missing TMPDIR" "$r1 / $r2"
# an explicit D2_FONT_FAMILY beats the snowflake-brand detection
if [ -f "$SKILL/scripts/font-flags.sh" ]; then
  mkdir -p "$T/sfd" && printf '...@snowflake-brand\na -> b\n' > "$T/sfd/sf.d2" && cp "$SKILL/templates/snowflake-brand.d2" "$T/sfd/"
  o=$(D2_FONT_FAMILY=default sh "$CHECK" --no-raster "$T/sfd/sf.d2" 2>&1)
  has "$o" '^fonts: default (' && ok "D2_FONT_FAMILY overrides the brand detection" || bad "D2_FONT_FAMILY precedence" "$o"
fi
# a theme imported by absolute path still selects ELK and its spacing flags
mkdir -p "$T/abs/theme" "$T/abs/doc" && cp "$SKILL/templates/neutral-theme.d2" "$T/abs/theme/"
printf '...@%s/abs/theme/neutral-theme\na: A\nb: B\na -> b\n' "$T" > "$T/abs/doc/abs.d2"
o=$(sh "$CHECK" --no-raster "$T/abs/doc/abs.d2" 2>&1)
has "$o" '^render: ok .*(elk)' && has "$o" "^re-render: .*--elk-padding '\[top=50,left=50,bottom=30,right=50\]'" &&
  ok "absolute theme import: ELK detected, ELK flags + padding on the re-render line" || bad "absolute import" "$o"
# multi-board + brief: S- findings and the display line belong to the root board (B8)
if [ -f "$SKILL/scripts/semcheck.py" ]; then
  mkdir -p "$T/b8" && cp "$HERE/d2check/multi_board.d2" "$T/b8/mb.d2"
  { printf '# request: "a multi-board test"\ntype: steps\nreader: test\nwidth: 800\ndirection: down\nout: none\nnodes:\n'
    sed -n 's/^\([a-z][a-z0-9_]*\): \(.*\)$/  \1: \2/p' "$T/b8/mb.d2" | grep -v 'vars\|steps\|layers\|scenarios' | head -3
    printf '  ghost: Ghost node\nedges:\n'; } > "$T/b8/mb.brief"
  o=$(sh "$CHECK" --no-raster --brief "$T/b8/mb.brief" "$T/b8/mb.d2" 2>&1)
  first=$(printf '%s\n' "$o" | grep -n '^board index.svg' | cut -d: -f1)
  sline=$(printf '%s\n' "$o" | grep -n '^  S-' | head -1 | cut -d: -f1)
  next=$(printf '%s\n' "$o" | grep -n '^board ' | sed -n 2p | cut -d: -f1)
  [ -n "$first" ] && [ -n "$sline" ] && [ -n "$next" ] && [ "$sline" -gt "$first" ] && [ "$sline" -lt "$next" ] &&
    has "$o" '^display: ' && ok "multi-board: S- findings listed under board index.svg (B8)" || bad "B8 multi-board semantics" "$o"
fi
# --quiet: codes without the numbered detail lines; --json: one parseable object; --out; --help
cp "$HERE/cases/bad_short_label.d2" "$T/q.d2"
o=$(sh "$CHECK" --no-raster --quiet "$T/q.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^W-short-label x1 -> ' && ! has "$o" '^  \[' && ! has "$o" '^fonts: default' && has "$o" '^result: ' &&
  ok "--quiet: code lines only, no finding details or fonts line" || bad "--quiet (exit $rc)" "$o"
o=$(sh "$CHECK" --no-raster --json "$T/q.d2" 2>&1); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["exit"], d["codes"].get("W-short-label"), d["warnings"] >= 1, d["errors"], "display" in d)' 2>&1)
[ "$rc" = 3 ] && [ "$j" = "3 1 True 0 True" ] && ok "--json: one object, exit/codes/warnings/display" || bad "--json (exit $rc: $j)" "$o"
o=$(sh "$CHECK" --no-raster --out "$T/out/viaout.svg" "$T/ok_flowchart.d2" 2>&1); rc=$?
[ -f "$T/out/viaout.svg" ] && ok "--out writes the deliverable" || bad "--out (exit $rc)" "$o"
sh "$CHECK" --no-raster --out "$T/a.svg" "$T/ok_flowchart.d2" "$T/b.svg" > /dev/null 2>&1; rc=$?
[ "$rc" = 64 ] && ok "--out and a second OUT disagree: exit 64" || bad "conflicting outputs exit $rc"
o=$(sh "$CHECK" --help 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" '^exit codes' && has "$o" '^examples:' && has "$o" '--json' && ok "--help: options, exit codes, examples" || bad "--help (exit $rc)" "$o"
# an animated SVG (every board in one file): only its first frame is linted, the brief is not applied
cp "$HERE/d2check/multi_board.d2" "$T/anim.d2"
o=$(sh "$CHECK" --no-raster "$T/anim.d2" "$T/out/anim-animated.svg" -- --animate-interval 1000 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^lint: 0 error(s)' && has "$o" 'only the first (the base board) is linted' && grep -q '@keyframes' "$T/out/anim-animated.svg" &&
  ok "animated SVG through d2check: first frame linted, no cross-frame phantoms" || bad "animated SVG (exit $rc)" "$o"
# the ERD sample whose crow's-foot markers used to read as cropped content (B23): faithful, exit 0
if [ -f "$SKILL/dev/tests/style/erd.ds.d2" ]; then
  o=$(sh "$CHECK" --check-fmt "$SKILL/dev/tests/style/erd.ds.d2" "$T/out/erd.svg" 2>&1); rc=$?
  [ "$rc" = 0 ] && has "$o" '^reviewed: faithful' && ok "ERD with crow's feet: faithful, exit 0 (B23)" || bad "ERD sample (exit $rc)" "$o"
fi

# paths with spaces: the READ: line is shell-quoted, and --json gives each PNG as one existing path
mkdir -p "$T/sp ace/d2 work" && cp "$HERE/cases/ok_flowchart.d2" "$T/sp ace/my flow.d2"
o=$(D2_WORK="$T/sp ace/d2 work" sh "$CHECK" --json "$T/sp ace/my flow.d2" 2>&1); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,os,sys; d=json.load(sys.stdin); r=d["read"]; print(len(r) >= 1 and all(os.path.isfile(p) for p in r), d["output"].endswith("my flow.svg"))' 2>&1)
[ "$rc" = 0 ] && [ "$j" = "True True" ] && ok "--json read: whole paths when they contain spaces" || bad "--json with spaces (exit $rc: $j)" "$o"
# --json on a compile error carries d2's error and the hint: line, not only the log path
printf 'left -> right\n' > "$T/kwj.d2"
o=$(sh "$CHECK" --no-raster --json "$T/kwj.d2" 2>&1); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); t="\n".join(d["text"]); print(d["exit"], "reserved keywords" in t, "hint:" in t)' 2>&1)
[ "$rc" = 1 ] && [ "$j" = "1 True True" ] && ok "--json on exit 1: text holds d2's error and the hint" || bad "--json compile error (exit $rc: $j)" "$o"
# exit 2 names its real cause: the tripwire, or an unformatted file under --check-fmt (no E-/S- findings:
# the engine is pinned, else S-src-cli-engine would be one)
printf 'vars: {d2-config: {layout-engine: elk}}\na: Caf\303\251\n' > "$T/trip.d2"
o=$(sh "$CHECK" --no-raster "$T/trip.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^result: exit 2 - replace the non-ASCII' && ! has "$o" '^result: .*E-/S-' &&
  ok "exit 2 from the tripwire says so" || bad "tripwire result line (exit $rc)" "$o"
printf 'vars: {d2-config: {layout-engine: elk}}\na->b\n' > "$T/unf.d2"
o=$(sh "$CHECK" --no-raster --check-fmt "$T/unf.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^result: exit 2 - format the source' && [ "$(sed -n 2p "$T/unf.d2")" = 'a->b' ] &&
  ok "--check-fmt: exit 2 names the formatting, file untouched" || bad "--check-fmt result line (exit $rc)" "$o"
# a theme file draws nothing: d2 writes no SVG; d2check says why and ends with a result: line
cp "$SKILL/templates/neutral-theme.d2" "$T/theme-only.d2"
o=$(sh "$CHECK" --no-raster "$T/theme-only.d2" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'the file draws nothing' && has "$o" '^hint: a theme is imported' && has "$o" '^result: exit 1' &&
  ok "a theme file as input: exit 1, why, hint and result lines" || bad "theme file as input (exit $rc)" "$o"
# a python older than 3.8 counts as none: rendered, not reviewed (exit 3), and --json stays valid
mkdir -p "$T/oldpy" && printf '#!/bin/sh\ncase "$*" in *version_info*) exit 1 ;; esac\nexec %s "$@"\n' "$(command -v python3)" > "$T/oldpy/python3"
chmod +x "$T/oldpy/python3"
o=$(PATH="$T/oldpy:$PATH" sh "$CHECK" --json "$T/ok_flowchart.d2" "$T/out/oldpy.svg" 2>&1); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["exit"], "older than python 3.8" in d["error"])' 2>&1)
[ "$rc" = 3 ] && [ "$j" = "3 True" ] && ok "python older than 3.8: exit 3, named in --json" || bad "old python (exit $rc: $j)" "$o"
# a missing brief is a missing file (1, like a missing IN); an SVG as input points at d2lint.py (64)
sh "$CHECK" --no-raster --brief "$T/nope.brief" "$T/ok_flowchart.d2" > /dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "missing --brief file: exit 1" || bad "missing brief exit $rc"
o=$(sh "$CHECK" "$T/out/ok.svg" 2>&1); rc=$?
[ "$rc" = 64 ] && has "$o" 'd2lint.py' && ok "an SVG as input: exit 64, points at d2lint.py" || bad "SVG input (exit $rc)" "$o"

# 11. round 4 (FIXPLAN F6, F19, I6, I8) ------------------------------------------------------------------
cp "$SKILL/templates/neutral-theme.d2" "$T/"
# a warning with a faithful raster: exit 0, but the result line says it is still to fix (F6)
o=$(sh "$CHECK" "$T/short.d2" "$T/out/short.svg" 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" '^result: exit 0 - 1 warning(s) to fix before delivering (workflows/review-and-fix.md)' &&
  ok "warnings only: exit 0, result names them as still to fix (F6)" || bad "warnings result line (exit $rc)" "$o"
# the re-render line rebuilds the finished SVG byte for byte: labels moved, key restyled (I6)
cat > "$T/rr.d2" << 'EOF'
...@neutral-theme
direction: down
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: request {class: dep}
    a -> b: event {class: async}
  }
}
pending: Pending {class: state}
paid: Paid {class: state}
cancelled: Cancelled {class: terminal}
refunded: Refunded {class: terminal}
pending -> paid: pay {class: dep}
pending -> cancelled: cancel {class: async}
paid -> refunded: refund {class: dep}
EOF
o=$(sh "$CHECK" --no-raster "$T/rr.d2" "$T/out/rr.svg" 2>&1)
cp "$T/out/rr.svg" "$T/out/rr.shipped.svg"
rr=$(printf '%s\n' "$o" | sed -n 's/^re-render: //p')
if has "$o" '^post: .*restyled key' && grep -q 'class="d2-key"' "$T/out/rr.svg" && (cd "$T" && sh -c "$rr" > /dev/null 2>&1) &&
  [ "$(cksum < "$T/out/rr.shipped.svg")" = "$(cksum < "$T/out/rr.svg")" ]; then
  ok "re-render: d2 + svgpost rebuild the deliverable byte for byte (key restyled)"
else bad "re-render with svgpost" "$o"; fi
# multi-board: the re-render line finishes every board
mkdir -p "$T/rrmb" && cp "$HERE/d2check/multi_board.d2" "$T/rrmb/mb.d2"
sh "$CHECK" --no-raster "$T/rrmb/mb.d2" "$T/rrmb/mb.svg" > "$T/rrmb.txt" 2>&1
rr=$(sed -n 's/^re-render: //p' "$T/rrmb.txt")
(cd "$T/rrmb" && find mb -name '*.svg' | sort | while IFS= read -r f; do cksum < "$f"; done) > "$T/rrmb.before"
if [ -s "$T/rrmb.before" ] && (cd "$T/rrmb" && sh -c "$rr" > /dev/null 2>&1) && has "$rr" "&& find .* -exec python3 .*svgpost.py.* {} +$"; then
  (cd "$T/rrmb" && find mb -name '*.svg' | sort | while IFS= read -r f; do cksum < "$f"; done) > "$T/rrmb.after"
  cmp -s "$T/rrmb.before" "$T/rrmb.after" && ok "multi-board re-render: every board byte for byte" ||
    bad "multi-board re-render differs" "$(diff "$T/rrmb.before" "$T/rrmb.after")"
else bad "multi-board re-render line" "$rr"; fi
# D2W ownership (I8): another file with the same name gets a warning and no automatic brief
mkdir -p "$T/own/a" "$T/own/b"
cp "$HERE/d2check/brief_case.d2" "$T/own/a/same.d2" && cp "$HERE/d2check/brief_case.d2" "$T/own/b/same.d2"
sh "$CHECK" --no-raster "$T/own/a/same.d2" > /dev/null 2>&1
cp "$HERE/d2check/brief_case.brief" "$D2_WORK/same/same.brief"
[ "$(cat "$D2_WORK/same/.source")" = "$T/own/a/same.d2" ] && ok "D2W/.source names the .d2 that owns D2W" || bad "D2W/.source" "$(cat "$D2_WORK/same/.source")"
o=$(sh "$CHECK" --no-raster "$T/own/b/same.d2" 2>&1); rc=$?
has "$o" "^warning: D2W/same belongs to $T/own/a/same.d2: its brief is not applied - pass --brief or set D2_WORK" &&
  has "$o" '^semantic: .* - source checks only' && ! has "$o" 'S-missing-edge' && [ "$(cat "$D2_WORK/same/.source")" = "$T/own/a/same.d2" ] &&
  ok "same name, other folder: warning, owner's brief not applied, ownership kept (I8)" || bad "D2W ownership (exit $rc)" "$o"
o=$(sh "$CHECK" --no-raster --brief "$D2_WORK/same/same.brief" "$T/own/b/same.d2" 2>&1)
! has "$o" '^warning: D2W/same belongs' && has "$o" 'S-missing-edge' && ok "same name with --brief: no warning, that brief applies" ||
  bad "D2W ownership with --brief" "$o"
o=$(sh "$CHECK" --no-raster "$T/own/a/same.d2" 2>&1)
has "$o" 'S-missing-edge' && ! has "$o" '^warning: D2W' && ok "the owner still gets its brief" || bad "owner's brief" "$o"
rm -f "$T/own/a/same.d2"
o=$(sh "$CHECK" --no-raster "$T/own/b/same.d2" 2>&1)
! has "$o" '^warning: D2W' && [ "$(cat "$D2_WORK/same/.source")" = "$T/own/b/same.d2" ] &&
  ok "the owner's .d2 is gone: the next file takes D2W over" || bad "D2W takeover" "$o"
# D2W/.lock: a live run holds D2W (exit 1); a lock left by a dead run is taken over, and removed at exit
sh -c 'sleep 30; :' d2check.sh &   # stands in for a running d2check: its command line names d2check
spid=$!
printf '%s\n' "$spid" > "$D2_WORK/same/.lock"
o=$(sh "$CHECK" --no-raster "$T/own/b/same.d2" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" "another d2check (pid $spid) is using" && ok "D2W/.lock of a live run: exit 1, names the pid" ||
  bad "live lock (exit $rc)" "$o"
kill "$spid" 2> /dev/null; wait "$spid" 2> /dev/null
# after a container restart the dead run's pid can belong to another program: that lock is stale too
if [ -r "/proc/$$/cmdline" ] || ps -p $$ -o args= > /dev/null 2>&1; then
  sleep 30 &
  spid=$!
  printf '%s\n' "$spid" > "$D2_WORK/same/.lock"
  o=$(sh "$CHECK" --no-raster "$T/own/b/same.d2" 2>&1); rc=$?
  [ "$rc" != 1 ] && has "$o" '^result: ' && [ ! -f "$D2_WORK/same/.lock" ] &&
    ok "D2W/.lock naming a live non-d2check pid (reused after a restart): taken over" || bad "reused-pid lock (exit $rc)" "$o"
  kill "$spid" 2> /dev/null; wait "$spid" 2> /dev/null
fi
o=$(sh "$CHECK" --no-raster "$T/own/b/same.d2" 2>&1); rc=$?
[ "$rc" != 1 ] && has "$o" '^result: ' && [ ! -f "$D2_WORK/same/.lock" ] && ok "stale D2W/.lock taken over, removed at exit" ||
  bad "stale lock (exit $rc)" "$o"
# CRLF: converted with a message (F19 F4); --check-fmt reports it instead
printf 'vars: {d2-config: {layout-engine: elk}}\r\na -> b: calls\r\n' > "$T/crlf.d2"
o=$(sh "$CHECK" --no-raster --check-fmt "$T/crlf.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" 'has CRLF (Windows) line endings' && has "$o" '^result: exit 2 - .*convert the CRLF line endings to LF' &&
  LC_ALL=C grep -q "$(printf '\r')" "$T/crlf.d2" && ok "--check-fmt on CRLF: reported, file untouched, exit 2" || bad "CRLF --check-fmt (exit $rc)" "$o"
o=$(sh "$CHECK" --no-raster "$T/crlf.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^fmt: converted CRLF line endings to LF in ' && ! has "$o" 'tripwire' &&
  ! LC_ALL=C grep -q "$(printf '\r')" "$T/crlf.d2" && ok "CRLF: converted to LF with a message, no tripwire (F19)" || bad "CRLF (exit $rc)" "$o"
# a read-only IN (F19 F3; as root -w always passes, so a d2 whose fmt cannot write stands in for a read-only
# file system): checked, not reformatted, and the check says whether d2 fmt would change it
mkdir -p "$T/rofs/bin"
real_d2=$(command -v d2)
printf '#!/bin/sh\nif [ "$1" = fmt ] && [ "$2" != --check ]; then\n  echo "err: failed to fmt: open $2: read-only file system" >&2\n  exit 1\nfi\nexec %s "$@"\n' "$real_d2" > "$T/rofs/bin/d2"
chmod +x "$T/rofs/bin/d2"
printf 'vars: {d2-config: {layout-engine: elk}}\na ->    b: calls\n' > "$T/rofs/ro.d2"
o=$(PATH="$T/rofs/bin:$PATH" sh "$CHECK" --no-raster "$T/rofs/ro.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^fmt: .*ro.d2 is read-only - checked, not reformatted (d2 fmt would change it)' && has "$o" '^render: ok' &&
  ok "read-only IN: checked, not failed, says d2 fmt would change it (F19)" || bad "read-only IN (exit $rc)" "$o"
d2 fmt "$T/rofs/ro.d2" > /dev/null 2>&1
o=$(PATH="$T/rofs/bin:$PATH" sh "$CHECK" --no-raster "$T/rofs/ro.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^fmt: .*ro.d2 is read-only - checked, not reformatted$' &&
  ok "read-only IN already formatted: no 'would change it'" || bad "read-only IN formatted (exit $rc)" "$o"
# an extra flag d2 does not know is a usage error (64), not a compile error
o=$(sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/out/bogus.svg" -- --bogus 2>&1); rc=$?
[ "$rc" = 64 ] && has "$o" 'd2 rejected an extra flag after --' && ok "-- --bogus: exit 64, names the flag (F19)" || bad "-- --bogus (exit $rc)" "$o"
# a compile error in a file whose name has spaces keeps the source excerpt
mkdir -p "$T/sp2" && printf 'vars: {d2-config: {layout-engine: elk}}\nleft -> right\n' > "$T/sp2/my kw.d2"
o=$(sh "$CHECK" --no-raster "$T/sp2/my kw.d2" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" '^  my kw.d2:2: left -> right' && ok "spaces in the name: the source line is still quoted (F19)" ||
  bad "source excerpt with spaces (exit $rc)" "$o"
# brand detection reads imports, not comments; an import path with spaces is followed
printf '# not a snowflake-brand diagram\n...@neutral-theme\na: A {class: service}\n' > "$T/brandc.d2"
o=$(sh "$CHECK" --no-raster "$T/brandc.d2" 2>&1)
has "$o" '^fonts: default (' && ! has "$o" 'snowflake' && ok "a comment naming snowflake-brand is not the brand (F19)" || bad "brand in a comment" "$o"
mkdir -p "$T/sp2/my themes" && cp "$SKILL/templates/neutral-theme.d2" "$T/sp2/my themes/"
printf '...@"my themes/neutral-theme"\na: A {class: service}\nb: B {class: service}\na -> b: {class: dep}\n' > "$T/sp2/imp.d2"
o=$(sh "$CHECK" --no-raster "$T/sp2/imp.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^render: ok .*(elk)' && ! has "$o" 'S-src-cli-engine' && ok "import path with spaces: theme found, ELK (F19)" ||
  bad "import with spaces (exit $rc)" "$o"
# --json: early errors are one JSON object too (F19 F7)
o=$(sh "$CHECK" --json "$T/no-such.d2" 2> /dev/null); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["exit"], "no such file" in d["error"])' 2>&1)
[ "$rc" = 1 ] && [ "$j" = "1 True" ] && ok "--json, missing IN: one JSON object, exit 1" || bad "--json early error (exit $rc: $j)" "$o"
o=$(sh "$CHECK" --json --column 5 "$T/ok_flowchart.d2" 2> /dev/null); rc=$?
j=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["exit"])' 2>&1)
[ "$rc" = 64 ] && [ "$j" = 64 ] && ok "--json, usage error: one JSON object, exit 64" || bad "--json usage error (exit $rc: $j)" "$o"
# D2CHECK_TIMEOUT: validated; a render that runs over is stopped with exit 1 (F19 F17)
o=$(D2CHECK_TIMEOUT=soon sh "$CHECK" --no-raster "$T/ok_flowchart.d2" 2>&1); rc=$?
[ "$rc" = 64 ] && has "$o" 'D2CHECK_TIMEOUT wants whole seconds' && ok "D2CHECK_TIMEOUT=soon: exit 64" || bad "D2CHECK_TIMEOUT validation (exit $rc)" "$o"
if command -v timeout > /dev/null 2>&1; then
  { printf 'vars: {d2-config: {layout-engine: elk}}\n'; i=0
    while [ "$i" -lt 120 ]; do printf 'n%d -> n%d\nn%d -> n%d\n' "$i" $((i + 1)) "$i" $(((i * 7 + 3) % 120)); i=$((i + 1)); done; } > "$T/slow.d2"
  s=$(date +%s)
  o=$(D2CHECK_TIMEOUT=2 sh "$CHECK" --no-raster "$T/slow.d2" "$T/out/slow.svg" 2>&1); rc=$?
  el=$(($(date +%s) - s))
  [ "$rc" = 1 ] && has "$o" 'd2 ran over 2s and was stopped' && [ ! -f "$T/out/slow.svg" ] && [ "$el" -lt 15 ] &&
    ok "D2CHECK_TIMEOUT=2: a slow render stops, exit 1, no OUT (${el}s)" || bad "render timeout (exit $rc, ${el}s)" "$o"
fi
# a timeout without -k (busybox) or one that wants -t (old busybox): the render still runs
mkdir -p "$T/bbt/bin"
printf '#!/bin/sh\ncase $1 in -k) echo "timeout: unrecognized option: k" >&2; exit 1 ;; esac\nshift; exec "$@"\n' > "$T/bbt/bin/timeout"
chmod +x "$T/bbt/bin/timeout"
o=$(PATH="$T/bbt/bin:$PATH" sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/bbt/a.svg" 2>&1); rc=$?
printf '#!/bin/sh\ncase $1 in -t) shift 2; exec "$@" ;; esac\necho "timeout: unrecognized option" >&2; exit 1\n' > "$T/bbt/bin/timeout"
o2=$(PATH="$T/bbt/bin:$PATH" sh "$CHECK" --no-raster "$T/ok_flowchart.d2" "$T/bbt/b.svg" 2>&1); rc2=$?
[ "$rc" = 3 ] && [ "$rc2" = 3 ] && [ -f "$T/bbt/a.svg" ] && [ -f "$T/bbt/b.svg" ] &&
  ok "a busybox timeout (no -k, or -t only): the render runs" || bad "busybox timeout (exit $rc/$rc2)" "$o
$o2"
# ELK spacing from the source: 72px layers with a sql_table (crow's feet), 50px under bottom titles
printf 'vars: {d2-config: {layout-engine: elk}}\nt: {shape: sql_table; id: int}\nu: {shape: sql_table; id: int}\nt.id -> u.id\n' > "$T/tbl.d2"
o=$(sh "$CHECK" --no-raster "$T/tbl.d2" 2>&1)
has "$o" '^re-render: .*--elk-nodeNodeBetweenLayers 72 ' && has "$o" '^post: .*table rules' && ok "sql_table: layers 72px apart, table rules restyled (F11)" ||
  bad "sql_table spacing" "$o"
printf 'vars: {d2-config: {layout-engine: elk}}\nsys: System {\n  label.near: bottom-left\n  api: API\n}\n' > "$T/bt.d2"
o=$(sh "$CHECK" --no-raster "$T/bt.d2" 2>&1)
has "$o" "^re-render: .*--elk-padding '\[top=50,left=50,bottom=50,right=50\]'" && ok "a bottom-left container title: 50px bottom padding (F10)" ||
  bad "bottom title padding" "$o"
# the S-inferred list is the report's Assumed: line: printed in full, never cut
{ printf '# request: "a long list of assumed parts"\ntype: architecture\nreader: test\nwidth: 800\ndirection: down\nfocus: none\nout: none\nnodes:\n'
  for k in alpha bravo charlie delta echo foxtrot golf; do printf '  %s_component_service: %s {inferred}\n' "$k" "$k"; done
  printf 'edges:\n'; } > "$T/inf.brief"
{ printf '...@neutral-theme\ngrid-columns: 3\n'
  for k in alpha bravo charlie delta echo foxtrot golf; do printf '%s_component_service: %s {class: service}\n' "$k" "$k"; done; } > "$T/inf.d2"
o=$(sh "$CHECK" --no-raster --brief "$T/inf.brief" "$T/inf.d2" 2>&1)
l=$(printf '%s\n' "$o" | grep -A1 '^S-inferred x' | tail -1)
[ "${#l}" -gt 170 ] && has "$l" 'golf' && ok "S-inferred: the whole list, ${#l} chars (F19)" || bad "S-inferred cut" "$o"

# 9. speed: the acceptance sample -----------------------------------------------------------------------
if [ -f "$HERE/d2check/arch.ds.d2" ]; then
  cp "$HERE/d2check/arch.ds.d2" "$HERE/d2check/neutral-theme.d2" "$T/"
  s=$(date +%s)
  sh "$CHECK" "$T/arch.ds.d2" "$T/arch.svg" > "$T/arch.log" 2>&1
  el=$(($(date +%s) - s))
  [ "$el" -lt 15 ] && ok "arch.ds.d2 end to end in ${el}s (< 15s)" || bad "arch.ds.d2 took ${el}s" "$(tail -3 "$T/arch.log")"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" = 0 ]
