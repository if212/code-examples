#!/bin/sh
# d2check.sh - the d2-diagram skill's one review command: format, render, lint, check against the
# brief, and rasterize the exact SVG that ships, then print a short actionable summary.
#
# usage: sh d2check.sh [options] IN.d2 [OUT.svg] [-- extra d2 flags]
#   --column N     doc column width in px, 200..10000 (default: the brief's width, else 800)
#   --brief F      brief for the semantic check (default: D2W/<name>.brief when it exists;
#                  with no brief, semcheck --lint runs the source checks alone)
#   --out OUT.svg  the deliverable, same as the OUT.svg argument (default: IN with .svg)
#   --check-fmt    only report formatting; do not rewrite IN.d2
#   --strict       warnings fail too (exit 2)
#   --dark         also render the dark-mode view
#   --no-raster    lint only; the review is then NOT visual
#   --quiet        summary only: no progress lines, codes without their numbered findings
#   --json         print one JSON object instead (exit, reviewed, display, codes, boards with their
#                  findings, read, rerender, result, text = the summary lines)
#   -h, --help     this text
# Steps: d2 fmt -> ASCII tripwire -> render OUT.svg (--scale 1, bundled fonts, ELK spacing defaults)
#   -> post-process (text-rendering:geometricPrecision, chmod 644) -> d2lint -> semcheck -> Chromium PNGs.
# Summary: render: | display: | lint: + one line per code with its recipe | reviewed: | READ: the PNGs
#   to Read, in order | re-render: the d2 command (geometry only: no geometricPrecision, no chmod) | result:
# Working files go to D2W = ${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>/, never next to OUT.
# Layout, theme and pad belong in vars.d2-config: -l/-t after -- only draw a warning, and d2's own
# environment variables (D2_LAYOUT, D2_THEME, D2_PAD, D2_WATCH, SCALE, ...) are ignored.
# exit codes (shared by every script of the skill):
#   0 clean (warnings allowed)
#   1 fmt, compile or render failed (d2's error, then hint:); IN or the brief missing; no d2 on PATH
#   2 E-/S- errors, tripwire hits, or (--check-fmt) not formatted: the result: line names what to fix
#   3 clean, but not faithfully rasterized (run doctor.sh)
#   64 usage error
# env: D2CHECK_ROUTE=auto|playwright|chrome|rsvg forces a rasterizer; D2_WORK moves D2W;
#      D2_FONT_FAMILY=default|geist|brand-snowflake|d2-default overrides the font choice.
# examples:
#   sh d2check.sh docs/flow.d2                        writes docs/flow.svg; review PNGs in D2W
#   sh d2check.sh --brief /tmp/d2work/flow/flow.brief --column 800 docs/flow.d2
#   sh d2check.sh docs/flow.d2 docs/flow-inline.svg -- --no-xml-tag
set -u

HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(dirname -- "$HERE")
PY=$(command -v python3 || command -v python || true)
pywhy="python3 not found"
if [ -n "$PY" ] && ! "$PY" -c 'import sys; sys.exit(sys.version_info < (3, 8))' 2> /dev/null; then
  pywhy="$PY is older than python 3.8"
  PY=""
fi
ESC=$(printf '\033')
TAB=$(printf '\t')
ANCHORS="workflows/review-and-fix.md"
# ELK spacing defaults (CLI-only in d2): tighter layers, and 30px under a container's last row instead of 50
ELK_PAD="[top=50,left=50,bottom=30,right=50]"
PYTHONDONTWRITEBYTECODE=1
export PYTHONDONTWRITEBYTECODE

say() { printf '%s\n' "$*"; }
info() { [ "$quiet" = 1 ] || printf '%s\n' "$*"; }
die() { printf 'd2check: %s\n' "$1" >&2; exit "${2:-64}"; }
usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }
quote() {  # print one shell word, quoted when needed
  case $1 in
    '' | *[!A-Za-z0-9_./=:,+@%-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}
short() { case $1 in "$PWD"/*) printf '%s' "${1#"$PWD"/}" ;; *) printf '%s' "$1" ;; esac; }
# copy-pasteable commands, also when the skill lives under a path with spaces
ME="sh $(quote "$0")"
DOCTOR="sh $(quote "$HERE/doctor.sh")"

column="" brief="" checkfmt=0 strict=0 dark=0 raster=1 quiet=0 json=0 in="" out="" oout=""
while [ $# -gt 0 ]; do
  case $1 in
    --column) [ $# -ge 2 ] || die "--column needs a value, e.g. --column 800"; column=$2; shift 2 ;;
    --column=*) column=${1#*=}; shift ;;
    --brief) [ $# -ge 2 ] || die "--brief needs a file, e.g. --brief /tmp/d2work/flow/flow.brief"; brief=$2; shift 2 ;;
    --brief=*) brief=${1#*=}; shift ;;
    --out) [ $# -ge 2 ] || die "--out needs a file, e.g. --out docs/flow.svg"; oout=$2; shift 2 ;;
    --out=*) oout=${1#*=}; shift ;;
    --check-fmt) checkfmt=1; shift ;;
    --strict) strict=1; shift ;;
    --dark) dark=1; shift ;;
    --no-raster) raster=0; shift ;;
    --quiet | -q) quiet=1; shift ;;
    --json) json=1; shift ;;
    -h | --help) usage; exit 0 ;;
    --) shift; break ;;
    -*) die "unknown option '$1' - d2 flags go after --; options: $ME --help" ;;
    *)
      if [ -z "$in" ]; then in=$1
      elif [ -z "$out" ]; then out=$1
      else die "unexpected argument '$1' - d2 flags go after --: $ME IN.d2 [OUT.svg] -- <d2 flags>"; fi
      shift ;;
  esac
done
if [ -n "$oout" ]; then
  [ -z "$out" ] || [ "$out" = "$oout" ] || die "two outputs: '$out' and --out '$oout' - give one"
  out=$oout
fi
[ -n "$in" ] || { usage >&2; exit 64; }
# usage errors (64) first, then what is missing on disk or on PATH (1)
in_range() { case $1 in '' | *[!0-9]* | ??????*) return 1 ;; esac; [ "$1" -ge 200 ] && [ "$1" -le 10000 ]; }
if [ -n "$column" ] && ! in_range "$column"; then
  die "--column wants whole px in 200..10000 (800 = doc column, 1600 = slides), not '$column'"
fi
case $in in
  *.d2) ;;
  *.svg) die "the input must be the .d2 source, not $in - lint an existing SVG with python3 $(quote "$HERE/d2lint.py") $(quote "$in")" ;;
  *) die "the input must be a .d2 file: $in - usage: $ME IN.d2 [OUT.svg]" ;;
esac
out=${out:-${in%.d2}.svg}
case $out in *.svg) ;; *) die "the output must end in .svg: $out - PNG and PDF come from the SVG afterwards (reference/export.md)" ;; esac
for a in "$@"; do
  case $a in -w | --watch | --watch=*) die "never run d2 --watch through d2check (it never returns): see reference/export.md, watch mode" ;; esac
done
[ -f "$in" ] || die "no such file: $in - check the path (relative to $PWD)" 1
[ -z "$brief" ] || [ -f "$brief" ] || die "no such brief: $brief - write it first (workflows/brief.md) or drop --brief" 1
if ! command -v d2 > /dev/null 2>&1; then
  die "d2 is not on PATH, so nothing can be rendered - run $DOCTOR: it prints the install command for this OS (macOS: brew install d2; elsewhere: curl -fsSL https://d2lang.com/install.sh | sh -s --), and $DOCTOR --install installs d2 for this user without sudo" 1
fi

name=$(basename -- "$in" .d2)
D2W=${D2_WORK:-${TMPDIR:-/tmp}/d2work}/$name
mkdir -p "$D2W" || die "cannot create the work dir $D2W - set D2_WORK to a writable folder" 1

main() {
  rm -f "$D2W/$name".*.png "$D2W/$name"-*.png "$D2W/$name".*.svg "$D2W/$name"-*.svg "$D2W/$name".*.json "$D2W"/.boards
  if [ -z "$brief" ]; then
    for b in "$D2W/$name.brief" "$D2W/$name.inv"; do [ -f "$b" ] && { brief=$b; break; }; done
  fi
  if [ -z "$column" ] && [ -n "$brief" ] && [ -n "$PY" ] && [ -f "$HERE/semcheck.py" ]; then
    column=$("$PY" "$HERE/semcheck.py" --field width "$brief" 2> /dev/null | tr -dc '0-9')
    if [ -n "$column" ] && ! in_range "$column"; then
      say "warning: the brief's width: $column is outside 200..10000 px; linting at 800"
      column=""
    fi
  fi
  column=${column:-800}
  issues=0 warned=0 why="" nerr=0
  # exit 2: remember each reason once, so the result line names what to fix
  fail() { issues=1; case "; $why; " in *"; $1; "*) ;; *) why="${why:+$why; }$1" ;; esac; }

  # --- d2 reads settings from the environment: each would change the deliverable, D2_WATCH would hang ---
  envs=""
  for v in D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE D2_BUNDLE D2_FORCE_APPENDIX \
    D2_ANIMATE_INTERVAL D2_CHECK D2_NO_XML_TAG D2_FONT_REGULAR D2_FONT_ITALIC D2_FONT_BOLD D2_FONT_SEMIBOLD \
    D2_FONT_MONO D2_FONT_MONO_BOLD D2_FONT_MONO_ITALIC D2_FONT_MONO_SEMIBOLD; do
    eval "val=\${$v:-}"
    # shellcheck disable=SC2154
    [ -z "$val" ] || envs="$envs $v=$val"
    unset "$v"
  done
  unset DEBUG
  [ -z "$envs" ] || say "warning: ignored d2 settings from the environment:$envs (put layout-engine/theme-id/pad in vars.d2-config; d2 flags go after --)"

  # --- extra d2 flags: warn about overrides of the file's d2-config ---------------------------------
  engine="" prev="" animated=0
  for a in "$@"; do
    case $prev in -l | --layout) engine=$a ;; --animate-interval) [ "$a" = 0 ] || animated=1 ;; esac
    case $a in --animate-interval=*) [ "${a#*=}" = 0 ] || animated=1 ;; esac
    case $a in
      --layout=*) engine=${a#*=} ;;
      -l?*) engine=${a#-l} ;;
    esac
    case $a in
      -l | -l?* | --layout | --layout=* | -t | -t?* | --theme | --theme=*)
        say "warning: '$a' overrides the file's vars.d2-config; put layout-engine/theme-id there instead" ;;
    esac
    prev=$a
  done

  # --- the file plus the local .d2 files it imports (two levels): engine and brand detection -------
  imports_of() {
    d=$(dirname -- "$1")
    grep -o '@[A-Za-z0-9_./-]*' "$1" 2> /dev/null | sed 's/^@//' | while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      case $ref in /*) set -- "$ref" "$ref.d2" ;; *) set -- "$d/$ref" "$d/$ref.d2" ;; esac
      for f in "$@"; do
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
  fontfam=default
  while IFS= read -r f; do
    if grep -q 'snowflake-brand' "$f" 2> /dev/null; then fontfam=brand-snowflake; break; fi
  done < "$D2W/.srcfiles"
  fontfam=${D2_FONT_FAMILY:-$fontfam}  # an explicit choice beats the brand detection

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
      fonts_line="fonts: d2 default (font-flags.sh $fontfam: ${fmiss:+missing }${fmiss:-no --font-* flags}; restore assets/fonts or check: $DOCTOR)"
    fi
  fi
  case $fonts_line in "fonts: default ("*) info "$fonts_line" ;; *) say "$fonts_line" ;; esac
  # re-render line: the bundled fonts as one readable command substitution, not 8 absolute paths
  fontcmd=""
  case $HERE in *[!A-Za-z0-9_./-]*) ;; *) [ -s "$D2W/.fontflags" ] && fontcmd="\$(sh $HERE/font-flags.sh $fontfam)" ;; esac

  # --- source location + fix hint for a d2 error message --------------------------------------------
  indir=$(CDPATH='' cd -- "$(dirname -- "$in")" && pwd)
  # d2 names IN twice: relative to the cwd (../../w3/x/in.d2) and absolute; both shrink to in.d2 BEFORE a
  # line is cut, so d2's own advice at the end of a long line survives a deep folder
  from=$PWD relin=""
  while [ "$from" != / ]; do
    case $indir/ in "$from"/*) break ;; esac
    from=$(dirname -- "$from") relin="../$relin"
  done
  rest=${indir#"$from"}
  relin=$relin${rest#/}
  inbase=$(basename -- "$in")
  strip_dir() {
    # the longer spelling goes first: ../../../tmp/x/in.d2 holds /tmp/x/, and /tmp/x/in.d2 holds x/in.d2
    awk -v d="$indir/" -v r="${relin:+${relin%/}/}$inbase" -v b="$inbase" '
      function cut(s, p, w,   i) { while (p != w && p != "/" && (i = index(s, p)) > 0) s = substr(s, 1, i - 1) w substr(s, i + length(p)); return s }
      { if (length(r) > length(d) + length(b)) $0 = cut(cut($0, r, b), d, ""); else $0 = cut(cut($0, d, ""), r, b); print }'
  }
  explain_error() {
    loc=$(printf '%s\n' "$1" | grep -o '[^ :]*\.d2:[0-9][0-9]*:[0-9][0-9]*' | tail -1)
    if [ -n "$loc" ]; then
      lf=${loc%%:*} lr=${loc#*:}
      ln=${lr%%:*}
      [ -f "$lf" ] && say "  $(basename -- "$lf"):$ln: $(sed -n "${ln}p" "$lf" | cut -c1-140)"
    fi
    h=""
    [ -n "$PY" ] && [ -f "$HERE/semcheck.py" ] && h=$("$PY" "$HERE/semcheck.py" --hint "$1" 2> /dev/null | head -1)
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
    fail "format the source (run d2check without --check-fmt, or: d2 fmt $(quote "$in"))"
  elif [ "$checkfmt" = 0 ] && [ "$before" != "$(cksum < "$in")" ]; then
    say "fmt: reformatted $in in place - Read it again before editing"
  fi

  # --- 2. ASCII tripwire (hard rule: plain ASCII, no tabs) ------------------------------------------
  hits=$(LC_ALL=C grep -n '[^ -~]' "$in" 2> /dev/null || true)
  if [ -n "$hits" ]; then
    n=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
    say "tripwire: $n line(s) of $in contain non-ASCII bytes or tabs (labels must be plain ASCII):"
    printf '%s\n' "$hits" | head -3 | cut -c1-120 | sed 's/^/  line /'
    fail "replace the non-ASCII characters and tabs on the tripwire lines"
  fi

  # --- 3. render into D2W, then move into place (a failed render never clobbers OUT) ---------------
  nx=$#
  while IFS= read -r l; do set -- "$@" "$l"; done < "$D2W/.fontflags"
  set -- "$@" --scale 1
  [ "$engine" = elk ] && set -- "$@" --elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20 --elk-padding "$ELK_PAD"
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
    if ! { mkdir -p "$(dirname -- "$out")" && mv -f "$rdir/$name.svg" "$out"; }; then
      say "render: FAILED - cannot write $out (is its folder writable?)"
      say "result: exit 1 - make the folder writable, or name another OUT.svg: $ME $(quote "$in") <OUT.svg>"
      exit 1
    fi
    printf '%s\t%s\n' "$name" "$out" > "$D2W/.boards"
    say "render: ok $out ($engine)"
  elif [ -d "$rdir/$name" ]; then
    outdir=${out%.svg}
    if ! mkdir -p "$outdir"; then
      say "render: FAILED - cannot create the board folder $outdir"
      say "result: exit 1 - make its parent writable, or name another OUT.svg: $ME $(quote "$in") <OUT.svg>"
      exit 1
    fi
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
    say "render: FAILED - d2 wrote no SVG: the file draws nothing (vars and classes only, like a theme file)"
    say "hint: a theme is imported by a diagram (first line ...@neutral-theme), never rendered on its own; add shapes, or check the path"
    say "result: exit 1 - nothing to render (see hint:)"
    exit 1
  fi

  if [ -z "$PY" ]; then
    say "reviewed: NOT visually reviewed ($pywhy: no lint, no PNGs)"
    say "re-render: $rerender"
    say "result: exit 3 - rendered but unchecked: install python3 (3.8 or newer), then re-run; check the setup: $DOCTOR"
    exit 3
  fi

  # --- 4. semantic check against the brief (root board); without one, the source checks alone --------
  semjson=""
  target=$out
  [ -f "$out" ] || target=${out%.svg}
  if [ "$animated" = 1 ]; then  # every frame in one SVG: the brief is checked on the normal (board) render
    info "semantic: skipped for an animated SVG - run d2check without --animate-interval to check the boards"
  elif [ ! -f "$HERE/semcheck.py" ]; then
    say "semantic: skipped - scripts/semcheck.py not found"
  elif [ -z "$brief" ]; then
    # classes nothing defines, `#`/`;` slips, mixed icon families, no pinned engine: the brief is not needed
    "$PY" "$HERE/semcheck.py" --lint "$in" --svg "$target" --json > "$D2W/$name.sem.json" 2> "$D2W/$name.sem.err"
    src=$?
    if [ "$src" -le 1 ] && "$PY" -c 'import json,sys; json.load(open(sys.argv[1]))' "$D2W/$name.sem.json" 2> /dev/null; then
      semjson="$D2W/$name.sem.json"
      info "semantic: source checks only - no brief (write $D2W/$name.brief, format: workflows/brief.md)"
    else
      say "semantic: source checks FAILED to run (semcheck --lint exit $src): python3 $(quote "$HERE/semcheck.py") --lint $(quote "$in")"
      { cat "$D2W/$name.sem.err"; cat "$D2W/$name.sem.json"; } | grep -v '^[[:space:]]*$' | tail -3 | cut -c1-200 | sed 's/^/  /'
    fi
  else
    "$PY" "$HERE/semcheck.py" "$brief" "$in" --svg "$target" --json > "$D2W/$name.sem.json" 2> "$D2W/$name.sem.err"
    src=$?
    if [ "$src" -le 1 ] && "$PY" -c 'import json,sys; json.load(open(sys.argv[1]))' "$D2W/$name.sem.json" 2> /dev/null; then
      semjson="$D2W/$name.sem.json"
      info "semantic: checked against $(short "$brief")"
    else
      say "semantic: FAILED to run (semcheck exit $src) - fix the brief, then re-run; details: python3 $(quote "$HERE/semcheck.py") $(quote "$brief") $(quote "$in")"
      { cat "$D2W/$name.sem.err"; cat "$D2W/$name.sem.json"; } | grep -v '^[[:space:]]*$' | tail -3 | cut -c1-200 | sed 's/^/  /'
      fail "fix the brief so the semantic check runs (semantic: above)"
    fi
  fi

  # --- 5. lint every board (numbers match the .ann.png) ----------------------------------------------
  nb=$(wc -l < "$D2W/.boards" | tr -d ' ')
  first=1
  while IFS="$TAB" read -r base svg; do
    if [ "$first" = 1 ] && [ -n "$semjson" ]; then  # the brief describes the root board (index.svg)
      set -- --sem-json "$semjson"
    else
      set --
    fi
    "$PY" "$HERE/d2lint.py" --compact --column "$column" --annotate "$D2W/$base.ann.svg" \
      --json-out "$D2W/$base.lint.json" "$@" "$svg" > "$D2W/$base.lint.txt" 2>&1
    lrc=$?
    if [ "$lrc" != 0 ] && [ "$lrc" != 2 ]; then
      say "lint: FAILED on $svg (d2lint exit $lrc) - details: python3 $(quote "$HERE/d2lint.py") $(quote "$svg")"
      sed 's/^/  /' "$D2W/$base.lint.txt" | head -3
      fail "d2lint could not run (lint: FAILED above)"
    else
      ne=$(sed -n 's/^lint: \([0-9]*\) error(s).*/\1/p' "$D2W/$base.lint.txt")
      nerr=$((nerr + ${ne:-0}))
      [ "$lrc" = 2 ] && issues=1
      nw=$(sed -n 's/^lint: [0-9]* error(s), \([0-9]*\) warning.*/\1/p' "$D2W/$base.lint.txt")
      [ "${nw:-0}" = 0 ] || warned=1
      if [ "$first" = 1 ]; then
        display=$(grep '^display: ' "$D2W/$base.lint.txt" | head -1)
        [ -z "$display" ] || say "$display"
      fi
      if [ "$nb" -gt 1 ]; then
        say "board ${svg#"${out%.svg}"/}: $(sed -n 's/^lint: //p' "$D2W/$base.lint.txt")"
        prefix="  "
      else
        say "$(grep '^lint: ' "$D2W/$base.lint.txt")"
        prefix=""
      fi
      if [ "$quiet" = 1 ]; then
        grep -v '^lint: ' "$D2W/$base.lint.txt" | grep -v -e '^display: ' -e '^ ' -e '^d2lint: note: ' | sed "s/^/$prefix/"
      else
        grep -v '^lint: ' "$D2W/$base.lint.txt" | grep -v '^display: ' | sed "s/^/$prefix/"
      fi
    fi
    first=0
  done < "$D2W/.boards"

  # --- 6. rasterize the SVG(s) that ship ------------------------------------------------------------
  reviewed="NOT visually reviewed (--no-raster)"
  degraded=1
  reads=""
  if [ "$raster" = 1 ]; then
    set --
    while IFS="$TAB" read -r base svg; do set -- "$@" "$D2W/$base=$svg"; done < "$D2W/.boards"
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
    while IFS="$TAB" read -r base svg; do
      for k in col ann 2x dark; do
        [ -f "$D2W/$base.$k.png" ] && reads="$reads $(quote "$D2W/$base.$k.png")"
      done
    done < "$D2W/.boards"
  fi

  # --- summary ---------------------------------------------------------------------------------------
  say "reviewed: $reviewed"
  [ -f "$D2W/.rfail" ] && cat "$D2W/.rfail" && rm -f "$D2W/.rfail"
  [ -z "$reads" ] || say "READ:$reads"
  say "re-render: $rerender"
  [ "$nerr" = 0 ] || why="fix the $nerr E-/S- error(s) with their recipes ($ANCHORS)${why:+; $why}"
  if [ "$issues" = 1 ]; then
    say "result: exit 2 - ${why:-fix the E-/S- errors (recipes: $ANCHORS)}, then re-run"
    exit 2
  fi
  if [ "$strict" = 1 ] && [ "$warned" = 1 ]; then
    say "result: exit 2 - warnings fail under --strict"
    exit 2
  fi
  if [ "$degraded" = 1 ]; then
    case $reviewed in
      approximate*) say "result: exit 3 - no errors found, but only an approximate raster: report 'Reviewed: approximate ($route)', judge topology and colour only, claim nothing about label fit; fix the setup: $DOCTOR" ;;
      *"(--no-raster)") say "result: exit 3 - no errors found, but nothing was rasterized (--no-raster): report 'NOT visually reviewed'" ;;
      *) say "result: exit 3 - no errors found, but the diagram was not faithfully rendered: report 'NOT visually reviewed'; fix the setup: $DOCTOR" ;;
    esac
    exit 3
  fi
  if [ "$warned" = 1 ]; then
    say "result: exit 0 - warnings only: read the PNGs, fix what a reader would notice (polish cycles), re-run"
  else
    say "result: exit 0 - clean: read the PNGs and walk the rubric before delivering"
  fi
  exit 0
}

if [ "$json" = 0 ]; then
  main "$@"
fi
# --json: run quietly into D2W/check.txt, then print one JSON object built from it and the lint reports
(main "$@") > "$D2W/check.txt" 2>&1
rc=$?
if [ -z "$PY" ]; then  # no python to build the JSON with: the essentials by hand
  jq_() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'; }
  printf '{"exit": %d, "error": "%s", "log": "%s"}\n' "$rc" "$(jq_ "$pywhy")" "$(jq_ "$D2W/check.txt")"
  exit "$rc"
fi
"$PY" - "$rc" "$D2W" "$in" "$out" << 'EOF'
import json, os, re, shlex, sys
rc, d2w, src, out = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
log = os.path.join(d2w, "check.txt")
text = open(log, encoding="utf-8", errors="replace").read()
line = lambda k: next((l[len(k):].strip() for l in text.splitlines() if l.startswith(k)), None)
def words(s):  # the READ: line holds shell-quoted paths (spaces, quotes)
    try:
        return shlex.split(s or "")
    except ValueError:
        return (s or "").split()
res = {"exit": rc, "input": src, "output": out, "reviewed": line("reviewed:"), "log": log}
res["faithful"] = bool(res["reviewed"] and res["reviewed"].startswith("faithful"))
boards, codes, err, warn, inf = [], {}, 0, 0, 0
try:
    rows = [l.rstrip("\n").split("\t") for l in open(os.path.join(d2w, ".boards"), encoding="utf-8")]
except OSError:
    rows = []
for base, svg in rows:
    try:
        rep = json.load(open(os.path.join(d2w, base + ".lint.json"), encoding="utf-8"))
    except (OSError, ValueError):
        continue
    if not boards:
        s = rep["summary"]
        res["display"] = {"width": s["display_px"][0], "height": s["display_px"][1], "column": s["column"],
                          "scale": s["scale"], "min_text_px": s["min_text_display_px"]}
    err, warn, inf = err + rep["errors"], warn + rep["warnings"], inf + rep["infos"]
    for f in rep["findings"]:
        m = re.match(r"\.\.\. and (\d+) more", f["message"])
        codes[f["code"]] = codes.get(f["code"], 0) + (int(m.group(1)) if m else 1)
    boards.append({"svg": svg, "errors": rep["errors"], "warnings": rep["warnings"], "findings": rep["findings"]})
res.update({"errors": err, "warnings": warn, "infos": inf, "codes": codes, "boards": boards,
            "read": words(line("READ:")), "rerender": line("re-render:"), "result": line("result:"),
            # the human summary as well: d2's error and the hint: line on exit 1, warnings, tripwire lines
            "text": text.splitlines()})
print(json.dumps(res, indent=1))
EOF
exit "$rc"
