#!/bin/sh
# d2check.sh - the d2-diagram skill's one review command: format, render, lint, check against the
# brief, and rasterize the exact SVG that ships, then print a short actionable summary.
#
# usage: sh d2check.sh [--column N] [--brief F] [--check-fmt] [--strict] [--dark] [--no-raster]
#                      IN.d2 [OUT.svg] [-- extra d2 flags]
#   --column N   doc column width in px, 200..10000 (default: the brief's width, else 800)
#   --brief F    brief for the semantic check (default: D2W/<name>.brief when it exists)
#   --check-fmt  only report formatting; do not rewrite IN.d2
#   --strict     warnings fail too (exit 2)
#   --dark       also render the dark-mode view
#   --no-raster  lint only; the review is then NOT visual
# Steps: d2 fmt -> ASCII tripwire -> render OUT.svg (--scale 1, bundled fonts, ELK spacing defaults)
#   -> post-process (text-rendering:geometricPrecision, chmod 644) -> d2lint -> semcheck -> Chromium PNGs
# Working files go to D2W = ${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>/, never next to OUT.
# Layout, theme and pad belong in vars.d2-config; -l/-t among the extra flags only draw a warning.
# exit: 0 clean (warnings allowed) | 1 fmt/compile/render failed | 2 E-/S- errors or tripwire hits
#       | 3 otherwise clean but no faithful rasterizer (report what the reviewed: line says)
# env: D2CHECK_ROUTE=auto|playwright|chrome|rsvg forces a rasterizer; D2_WORK moves D2W;
#      D2_FONT_FAMILY=default|geist|d2-default (see font-flags.sh; snowflake-brand files use Lato).
set -u

HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(dirname -- "$HERE")
PY=$(command -v python3 || command -v python || true)
ESC=$(printf '\033')
ANCHORS="workflows/review-and-fix.md"

say() { printf '%s\n' "$*"; }
die() { printf 'd2check: %s\n' "$1" >&2; exit "${2:-64}"; }
usage() { sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; }
quote() {  # print one shell word, quoted when needed
  case $1 in
    '' | *[!A-Za-z0-9_./=:,+@%-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}

column="" brief="" checkfmt=0 strict=0 dark=0 raster=1 in="" out=""
while [ $# -gt 0 ]; do
  case $1 in
    --column) [ $# -ge 2 ] || die "--column needs a value"; column=$2; shift 2 ;;
    --column=*) column=${1#*=}; shift ;;
    --brief) [ $# -ge 2 ] || die "--brief needs a file"; brief=$2; shift 2 ;;
    --brief=*) brief=${1#*=}; shift ;;
    --check-fmt) checkfmt=1; shift ;;
    --strict) strict=1; shift ;;
    --dark) dark=1; shift ;;
    --no-raster) raster=0; shift ;;
    -h | --help) usage; exit 0 ;;
    --) shift; break ;;
    -*) die "unknown option '$1' (d2 flags go after --)" ;;
    *)
      if [ -z "$in" ]; then in=$1
      elif [ -z "$out" ]; then out=$1
      else die "unexpected argument '$1' (d2 flags go after --)"; fi
      shift ;;
  esac
done
[ -n "$in" ] || { usage; exit 64; }
[ -f "$in" ] || die "no such file: $in" 1
case $in in *.d2) ;; *) die "input must be a .d2 file: $in" ;; esac
out=${out:-${in%.d2}.svg}
case $out in *.svg) ;; *) die "output must end in .svg (other formats: reference/export.md): $out" ;; esac
command -v d2 >/dev/null 2>&1 || die "d2 is not on PATH (https://d2lang.com/tour/install)" 1
[ -z "$brief" ] || [ -f "$brief" ] || die "no such brief: $brief"
in_range() { case $1 in '' | *[!0-9]* | ??????*) return 1 ;; esac; [ "$1" -ge 200 ] && [ "$1" -le 10000 ]; }
if [ -n "$column" ] && ! in_range "$column"; then
  die "--column wants whole px in 200..10000 (800 = doc column, 1600 = slides): $column"
fi

name=$(basename -- "$in" .d2)
D2W=${D2_WORK:-${TMPDIR:-/tmp}/d2work}/$name
mkdir -p "$D2W" || die "cannot create work dir $D2W" 1
rm -f "$D2W/$name".*.png "$D2W/$name"-*.png "$D2W/$name".*.svg "$D2W/$name"-*.svg "$D2W/$name".*.json "$D2W"/.boards
if [ -z "$brief" ]; then
  for b in "$D2W/$name.brief" "$D2W/$name.inv"; do [ -f "$b" ] && { brief=$b; break; }; done
fi
if [ -z "$column" ] && [ -n "$brief" ] && [ -n "$PY" ] && [ -f "$HERE/semcheck.py" ]; then
  column=$("$PY" "$HERE/semcheck.py" --field width "$brief" 2>/dev/null | tr -dc '0-9')
  if [ -n "$column" ] && ! in_range "$column"; then
    say "warning: the brief's width: $column is outside 200..10000 px; linting at 800"
    column=""
  fi
fi
column=${column:-800}
issues=0 warned=0

# --- extra d2 flags: warn about overrides of the file's d2-config ---------------------------------
engine="" prev=""
for a in "$@"; do
  case $prev in -l | --layout) engine=$a ;; esac
  case $a in
    -w | --watch | --watch=*) die "never run d2 --watch through d2check (it blocks); see reference/export.md" ;;
    --layout=*) engine=${a#*=} ;;
    -l?*) engine=${a#-l} ;;
  esac
  case $a in
    -l | -l?* | --layout | --layout=* | -t | -t?* | --theme | --theme=*)
      say "warning: '$a' overrides the file's vars.d2-config; put layout-engine/theme-id there instead" ;;
  esac
  prev=$a
done
for v in D2_LAYOUT D2_THEME D2_PAD; do
  eval "val=\${$v:-}"
  # shellcheck disable=SC2154
  [ -z "$val" ] || say "warning: environment $v=$val overrides the file's vars.d2-config"
done
[ -n "$engine" ] || engine=${D2_LAYOUT:-}

# --- the file plus the local .d2 files it imports (two levels): engine and brand detection -------
imports_of() {
  d=$(dirname -- "$1")
  grep -o '@[A-Za-z0-9_./-]*' "$1" 2>/dev/null | sed 's/^@//' | while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    for f in "$d/$ref" "$d/$ref.d2"; do
      if [ -f "$f" ]; then printf '%s\n' "$f"; break; fi
    done
  done
}
{ printf '%s\n' "$in"; imports_of "$in" | while IFS= read -r f; do printf '%s\n' "$f"; imports_of "$f"; done; } \
  | awk '!seen[$0]++' > "$D2W/.srcfiles"
if [ -z "$engine" ]; then
  engine=$(while IFS= read -r f; do
    sed -n -E -e '/^[[:space:]]*#/d' -e 's/.*layout-engine["[:space:]:]*(dagre|elk|tala).*/\1/p' "$f"
  done < "$D2W/.srcfiles" | head -1)
fi
engine=${engine:-dagre}
fontfam=${D2_FONT_FAMILY:-default}
while IFS= read -r f; do
  if grep -q 'snowflake-brand' "$f" 2>/dev/null; then fontfam=brand-snowflake; break; fi
done < "$D2W/.srcfiles"

# --- fonts (scripts/font-flags.sh prints the --font-* flags of a bundled family) -----------------
fonts_line="fonts: d2 default (font-flags.sh unavailable)"
: > "$D2W/.fontflags"
ff=""
if [ -f "$HERE/font-flags.sh" ]; then
  if ff=$(sh "$HERE/font-flags.sh" "$fontfam" 2> "$D2W/.fonterr"); then
    [ -n "$ff" ] || fonts_line="fonts: d2 built-in ($fontfam)"
  else
    ff=""
    fonts_line="fonts: d2 default (font-flags.sh $fontfam failed: $(head -1 "$D2W/.fonterr" | cut -c1-120))"
  fi
fi
if [ -n "$ff" ]; then
  printf '%s\n' "$ff" | awk '{
      gsub(/[ \t]+--/, "\n--"); n = split($0, parts, "\n")
      for (i = 1; i <= n; i++) {
        p = parts[i]; sub(/^[ \t]+/, "", p); sub(/[ \t]+$/, "", p)
        if (p !~ /^--font-[a-z-]+/) continue
        k = p; v = p
        if (p ~ /^--font-[a-z-]+=/) { sub(/=.*/, "", k); sub(/^[^=]*=/, "", v) }
        else { sub(/[ \t].*/, "", k); sub(/^[^ \t]*[ \t]+/, "", v) }
        gsub(/^["\047]|["\047]$/, "", v)
        if (v != "" && v != p) print k "=" v
      } }' > "$D2W/.fontflags"
  fmiss=""
  while IFS= read -r l; do [ -f "${l#*=}" ] || fmiss=${l#*=}; done < "$D2W/.fontflags"
  if [ -z "$fmiss" ] && [ -s "$D2W/.fontflags" ]; then
    fdir=$(dirname -- "$(sed -n 's/^--font-regular=//p' "$D2W/.fontflags" | head -1)")
    fonts_line="fonts: $fontfam (${fdir#"$SKILL"/})"
  else
    : > "$D2W/.fontflags"
    fonts_line="fonts: d2 default (font-flags.sh $fontfam: ${fmiss:+missing }${fmiss:-no --font-* flags})"
  fi
fi
say "$fonts_line"
# re-render line: the bundled fonts as one readable command substitution, not 8 absolute paths
fontcmd=""
case $HERE in *[!A-Za-z0-9_./-]*) ;; *) [ -s "$D2W/.fontflags" ] && fontcmd="\$(sh $HERE/font-flags.sh $fontfam)" ;; esac

# --- source location + fix hint for a d2 error message --------------------------------------------
indir=$(CDPATH='' cd -- "$(dirname -- "$in")" && pwd)
strip_dir() {  # d2 prints absolute paths; drop IN's folder so the message itself fits on the line
  awk -v d="$indir/" '{ while (d != "/" && (i = index($0, d)) > 0) $0 = substr($0, 1, i - 1) substr($0, i + length(d)); print }'
}
explain_error() {
  loc=$(printf '%s\n' "$1" | grep -o '[^ :]*\.d2:[0-9][0-9]*:[0-9][0-9]*' | tail -1)
  if [ -n "$loc" ]; then
    lf=${loc%%:*} lr=${loc#*:}
    ln=${lr%%:*}
    [ -f "$lf" ] && say "  $(basename -- "$lf"):$ln: $(sed -n "${ln}p" "$lf" | cut -c1-140)"
  fi
  h=""
  [ -n "$PY" ] && [ -f "$HERE/semcheck.py" ] && h=$("$PY" "$HERE/semcheck.py" --hint "$1" 2>/dev/null | head -1)
  case $h in
    hint:*) say "$h" ;;
    ?*) say "hint: $h" ;;
    *) say "hint: see $ANCHORS#compile-and-command-errors" ;;
  esac
}

# --- 1. format (fails fast on syntax errors) ------------------------------------------------------
if [ "$checkfmt" = 1 ]; then
  fmsg=$(d2 fmt --check "$in" 2>&1)
  frc=$?
else
  before=$(cksum < "$in")
  fmsg=$(d2 fmt "$in" 2>&1)
  frc=$?
fi
fmsg=$(printf '%s\n' "$fmsg" | sed "s/${ESC}\[[0-9;]*m//g")
if [ "$frc" -ne 0 ] && printf '%s\n' "$fmsg" | grep -q 'failed to fmt'; then
  say "fmt: FAILED - the file does not parse"
  printf '%s\n' "$fmsg" | grep 'err:' | sed 's/^err: /  /' | strip_dir | head -4 | cut -c1-240
  explain_error "$fmsg"
  say "result: exit 1 - fix the syntax error, then re-run d2check"
  exit 1
elif [ "$checkfmt" = 1 ] && [ "$frc" -ne 0 ]; then
  say "fmt: NOT formatted (d2check without --check-fmt applies d2 fmt)"
  issues=1
elif [ "$checkfmt" = 0 ] && [ "$before" != "$(cksum < "$in")" ]; then
  say "fmt: reformatted $in in place - Read it again before editing"
fi

# --- 2. ASCII tripwire (hard rule: plain ASCII, no tabs) ------------------------------------------
hits=$(LC_ALL=C grep -n '[^ -~]' "$in" 2>/dev/null || true)
if [ -n "$hits" ]; then
  n=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  say "tripwire: $n line(s) of $in contain non-ASCII bytes or tabs (labels must be plain ASCII):"
  printf '%s\n' "$hits" | head -3 | cut -c1-120 | sed 's/^/  line /'
  issues=1
fi

# --- 3. render into D2W, then move into place (a failed render never clobbers OUT) ---------------
nx=$#
while IFS= read -r l; do set -- "$@" "$l"; done < "$D2W/.fontflags"
set -- "$@" --scale 1
[ "$engine" = elk ] && set -- "$@" --elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20
i=0
while [ "$i" -lt "$nx" ]; do set -- "$@" "$1"; shift; i=$((i + 1)); done
nf=$(wc -l < "$D2W/.fontflags" | tr -d ' ')
rerender="d2" k=0
for a in "$@"; do
  k=$((k + 1))
  if [ -n "$fontcmd" ] && [ "$k" -le "$nf" ]; then  # our font flags come first
    [ "$k" = 1 ] && rerender="$rerender $fontcmd"
    continue
  fi
  rerender="$rerender $(quote "$a")"
done
rerender="$rerender $(quote "$in") $(quote "$out")"
rdir="$D2W/render"
rm -rf "$rdir" && mkdir -p "$rdir"
rlog=$(d2 "$@" "$in" "$rdir/$name.svg" 2>&1)
rc=$?
rlog=$(printf '%s\n' "$rlog" | sed "s/${ESC}\[[0-9;]*m//g" | grep -v '^success:' | grep -v '^info: ')
if [ "$rc" -ne 0 ]; then
  say "render: FAILED (d2 exit $rc) - $out was not written or changed"
  printf '%s\n' "$rlog" | sed 's/^err: //' | strip_dir | head -6 | cut -c1-240 | sed 's/^/  /'
  explain_error "$rlog"
  say "result: exit 1 - fix the compile error (d2 validate passing proves nothing), then re-run d2check"
  exit 1
fi
[ -z "$rlog" ] || printf '%s\n' "$rlog" | strip_dir | head -4 | cut -c1-200 | sed 's/^/d2: /'
postproc() {
  sed 's#<style type="text/css"><!\[CDATA\[#&.d2-svg text{text-rendering:geometricPrecision}#' "$1" > "$1.pp" &&
    mv -f "$1.pp" "$1" && chmod 644 "$1"
}
if [ -f "$rdir/$name.svg" ]; then
  postproc "$rdir/$name.svg"
  if ! { mkdir -p "$(dirname -- "$out")" && mv -f "$rdir/$name.svg" "$out"; }; then die "cannot write $out" 1; fi
  printf '%s\t%s\n' "$name" "$out" > "$D2W/.boards"
  say "render: ok $out ($engine)"
elif [ -d "$rdir/$name" ]; then
  outdir=${out%.svg}
  mkdir -p "$outdir" || die "cannot create $outdir" 1
  # root board first, then natural order (steps/2 before steps/10)
  (cd "$rdir/$name" && find . -name '*.svg' | sed 's#^\./##') | awk '{
      k = ($0 == "index.svg") ? "" : $0; key = ""
      while (match(k, /[0-9]+/)) { key = key substr(k, 1, RSTART - 1) sprintf("%012d", substr(k, RSTART, RLENGTH)); k = substr(k, RSTART + RLENGTH) }
      print key k "\t" $0 }' | LC_ALL=C sort | cut -f2 > "$D2W/.rel"
  while IFS= read -r rel; do
    postproc "$rdir/$name/$rel"
    mkdir -p "$(dirname -- "$outdir/$rel")" && cp -f "$rdir/$name/$rel" "$outdir/$rel" && chmod 644 "$outdir/$rel"
    base=$name
    [ "$rel" = index.svg ] || base="$name-$(printf '%s' "${rel%.svg}" | tr '/' '-')"
    printf '%s\t%s\n' "$base" "$outdir/$rel"
  done < "$D2W/.rel" > "$D2W/.boards"
  # boards this script wrote into this same folder on an earlier run that no longer exist: remove them
  # (only files we wrote, and never outside $outdir: an earlier OUT elsewhere is someone's deliverable)
  if [ -f "$D2W/.written" ]; then
    cut -f2 "$D2W/.boards" > "$D2W/.now"
    while IFS= read -r old; do
      case $old in "$outdir"/*) grep -qxF -- "$old" "$D2W/.now" || rm -f -- "$old" ;; esac
    done < "$D2W/.written"
  fi
  cut -f2 "$D2W/.boards" > "$D2W/.written"
  say "render: ok $(wc -l < "$D2W/.boards" | tr -d ' ') boards in $outdir/ (index.svg = root board; multi-board sources write a directory) ($engine)"
else
  say "render: FAILED - d2 reported success but wrote nothing"
  exit 1
fi

if [ -z "$PY" ]; then
  say "reviewed: NOT visually reviewed (python3 not found: no lint, no PNGs)"
  say "re-render: $rerender"
  say "result: exit 3 - rendered but unchecked"
  exit 3
fi

# --- 4. semantic check against the brief (root board) --------------------------------------------
semjson=""
if [ -z "$brief" ]; then
  say "semantic: skipped - no brief (write $D2W/$name.brief, see workflows/brief.md)"
elif [ ! -f "$HERE/semcheck.py" ]; then
  say "semantic: skipped - scripts/semcheck.py not found"
else
  target=$out
  [ -f "$out" ] || target=${out%.svg}
  "$PY" "$HERE/semcheck.py" "$brief" "$in" --svg "$target" --json > "$D2W/$name.sem.json" 2> "$D2W/$name.sem.err"
  src=$?
  if [ "$src" -le 1 ] && "$PY" -c 'import json,sys; json.load(open(sys.argv[1]))' "$D2W/$name.sem.json" 2>/dev/null; then
    semjson="$D2W/$name.sem.json"
    say "semantic: checked against $brief (S- findings are listed with the lint codes)"
  else
    say "semantic: FAILED to run (semcheck exit $src):"
    { cat "$D2W/$name.sem.err"; cat "$D2W/$name.sem.json"; } | grep -v '^[[:space:]]*$' | tail -3 | cut -c1-200 | sed 's/^/  /'
    issues=1
  fi
fi

# --- 5. lint every board (numbers match the .ann.png) ----------------------------------------------
display=""
nb=$(wc -l < "$D2W/.boards" | tr -d ' ')
first=1
while IFS="$(printf '\t')" read -r base svg; do
  if [ "$first" = 1 ] && [ -n "$semjson" ]; then
    set -- --sem-json "$semjson"
  else
    set --
  fi
  "$PY" "$HERE/d2lint.py" --compact --column "$column" --annotate "$D2W/$base.ann.svg" \
    --json-out "$D2W/$base.lint.json" "$@" "$svg" > "$D2W/$base.lint.txt" 2>&1
  lrc=$?
  if [ "$lrc" -ge 3 ]; then
    say "lint: FAILED on $svg:"
    sed 's/^/  /' "$D2W/$base.lint.txt" | head -3
    issues=1
  else
    [ "$lrc" -eq 2 ] && issues=1
    [ "$lrc" -eq 1 ] && warned=1
    if [ "$nb" -gt 1 ]; then
      say "board ${svg#"${out%.svg}"/}: $(sed -n 's/^lint: //p' "$D2W/$base.lint.txt")"
      grep -v '^lint: ' "$D2W/$base.lint.txt" | grep -v '^display: ' | sed 's/^/  /'
    else
      grep -v '^display: ' "$D2W/$base.lint.txt"
    fi
    [ "$first" = 1 ] && display=$(grep '^display: ' "$D2W/$base.lint.txt" | head -1)
  fi
  first=0
done < "$D2W/.boards"

# --- 6. rasterize the SVG(s) that ship ------------------------------------------------------------
reviewed="NOT visually reviewed (--no-raster)"
degraded=1
reads=""
if [ "$raster" = 1 ]; then
  set --
  while IFS="$(printf '\t')" read -r base svg; do set -- "$@" "$D2W/$base=$svg"; done < "$D2W/.boards"
  flags=""
  [ "$dark" = 1 ] && flags="--dark"
  [ "$nb" -gt 1 ] && flags="$flags --no-detail"
  # shellcheck disable=SC2086
  "$PY" "$HERE/d2raster.py" --inspect "$@" --column "$column" $flags > "$D2W/raster.log" 2>&1
  rrc=$?
  route=$(sed -n 's/^route: \([a-z]*\).*/\1/p' "$D2W/raster.log" | head -1)
  case $rrc in
    0) reviewed="faithful ($route)"; degraded=0 ;;
    3) reviewed="approximate ($route) - embedded fonts ignored: judge topology and colour only" ;;
    *) reviewed="NOT visually reviewed - no usable rasterizer:"
       sed -n -e 's/^raster: failed //p' -e 's/^raster: skipped //p' "$D2W/raster.log" | head -3 | cut -c1-160 | sed 's/^/  /' > "$D2W/.rfail" ;;
  esac
  while IFS="$(printf '\t')" read -r base svg; do
    for k in col ann 2x dark; do
      [ -f "$D2W/$base.$k.png" ] && reads="$reads $(quote "$D2W/$base.$k.png")"
    done
  done < "$D2W/.boards"
fi

# --- summary ---------------------------------------------------------------------------------------
say "reviewed: $reviewed"
[ -f "$D2W/.rfail" ] && cat "$D2W/.rfail" && rm -f "$D2W/.rfail"
[ -z "$display" ] || say "$display"
[ -z "$reads" ] || say "READ:$reads"
say "re-render: $rerender"
if [ "$issues" = 1 ]; then
  say "result: exit 2 - fix the E-/S- errors (recipes: $ANCHORS), then re-run"
  exit 2
fi
if [ "$strict" = 1 ] && [ "$warned" = 1 ]; then
  say "result: exit 2 - warnings fail under --strict"
  exit 2
fi
if [ "$degraded" = 1 ]; then
  case $reviewed in
    approximate*) say "result: exit 3 - no errors found, but only an approximate raster: report 'Reviewed: approximate (rsvg)', judge topology and colour only, claim nothing about label fit" ;;
    *) say "result: exit 3 - no errors found, but the diagram was not faithfully rendered: report 'NOT visually reviewed'" ;;
  esac
  exit 3
fi
if [ "$warned" = 1 ]; then
  say "result: exit 0 - warnings only: read the PNGs, fix what a reader would notice (polish cycles), re-run"
else
  say "result: exit 0 - clean: read the PNGs and walk the rubric before delivering"
fi
exit 0
