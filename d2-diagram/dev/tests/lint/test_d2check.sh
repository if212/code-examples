#!/bin/sh
# shellcheck disable=SC2015,SC2016  # 'check && ok || bad' is intended; single-quoted $ is literal
# test_d2check.sh - end-to-end checks of scripts/d2check.sh (exit codes, summary lines, files).
# usage: sh dev/tests/lint/test_d2check.sh        needs d2, python3; Chromium for the faithful cases
# exit: 0 all passed, 1 a check failed
set -u
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

# 3. compile error: exit 1, d2's error, then a hint; OUT untouched ------------------------------------
printf 'left -> right\n' > "$T/kw.d2"
cp "$T/out/ok.svg" "$T/kw.svg"
before=$(cksum < "$T/kw.svg")
o=$(sh "$CHECK" "$T/kw.d2" "$T/kw.svg" 2>&1); rc=$?
e=$(printf '%s\n' "$o" | grep -n 'reserved keywords' | head -1 | cut -d: -f1)
h=$(printf '%s\n' "$o" | grep -n '^hint: ' | head -1 | cut -d: -f1)
[ "$rc" = 1 ] && [ -n "$e" ] && [ -n "$h" ] && [ "$e" -lt "$h" ] && ok "left -> right: exit 1, d2 error then hint:" || bad "compile error (exit $rc)" "$o"
has "$o" ': kw.d2:1:1: reserved keywords are prohibited' && ! has "$o" "$T/kw.d2:1" && ok "d2 errors shown without the input's absolute folder" || bad "d2 error path" "$o"
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
[ "$rc" = 2 ] && has "$o" '^tripwire: 1 line' && ok "tripwire: non-ASCII label -> exit 2" || bad "tripwire (exit $rc)" "$o"
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
[ "$rc" = 3 ] && [ "$rc2" = 2 ] && has "$o" 'W-short-label x1 -> workflows/review-and-fix.md#w-short-label' && ok "warnings: exit 3 with --no-raster, 2 with --strict; code line + anchor" || bad "strict ($rc/$rc2)" "$o"

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
# exit 2 names its real cause: the tripwire, or an unformatted file under --check-fmt (no E-/S- findings)
printf 'a: Caf\303\251\n' > "$T/trip.d2"
o=$(sh "$CHECK" --no-raster "$T/trip.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^result: exit 2 - replace the non-ASCII' && ! has "$o" '^result: .*E-/S-' &&
  ok "exit 2 from the tripwire says so" || bad "tripwire result line (exit $rc)" "$o"
printf 'a->b\n' > "$T/unf.d2"
o=$(sh "$CHECK" --no-raster --check-fmt "$T/unf.d2" 2>&1); rc=$?
[ "$rc" = 2 ] && has "$o" '^result: exit 2 - format the source' && [ "$(cat "$T/unf.d2")" = 'a->b' ] &&
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
