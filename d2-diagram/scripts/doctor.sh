#!/bin/sh
# doctor.sh - check everything the d2-diagram skill needs, say how to fix each gap, and
# optionally install the parts that need no sudo.
#
# usage: sh doctor.sh [--install [--dry-run]] [--json] [--quiet] [--offline]
#   --install   after the report, run the user-space installs for what is missing (d2 into
#               ~/.local, else `go install`; Playwright into ~/.local/share/d2-diagram/node and
#               its Chromium into the user cache; never sudo), print each command first, then
#               check again
#   --dry-run   with --install: print the install commands, run none of them
#   --json      print one JSON object instead of the table
#   --quiet     print only the rows that are not PASS or INFO, the verdict and the fixes
#   --offline   skip the network check (api.iconify.design)
#   -h, --help  this text
# Checks: d2 (>= 0.7.1) and a real ELK test render with the bundled fonts, python3 (>= 3.8),
#   node + the playwright module + a Chromium it can launch (Playwright caches,
#   PLAYWRIGHT_BROWSERS_PATH, system Chrome/Chromium/Edge, macOS apps), an end-to-end faithful
#   PNG, rsvg-convert (optional, approximate fallback), curl (icon.sh), the bundled fonts,
#   api.iconify.design (optional), a writable work dir (D2_WORK or $TMPDIR/d2work).
# exit codes (the skill's convention; semcheck.py differs):
#   0 ready: d2check can render and faithfully review
#   1 cannot render: d2 missing, too old or broken, or the work dir is not writable
#   3 degraded: renders SVG, but no faithful review (no python3, or no Chromium: d2check then
#     reports "approximate (rsvg)" or "NOT visually reviewed")
#   64 usage error
# env: D2CHECK_ROUTE (read by d2check) is ignored by the raster check here, which always tries every
#   route; a set value other than auto gets its own WARN row.
# examples:
#   sh doctor.sh              the PASS/WARN/FAIL table, with install commands for each gap
#   sh doctor.sh --install    install what can be installed without sudo, then check again
#   sh doctor.sh --json       machine-readable result
set -u

HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(dirname -- "$HERE")
PYTHONDONTWRITEBYTECODE=1
export PYTHONDONTWRITEBYTECODE
# d2 reads these from the environment; D2_WATCH would turn the test render into a server that never exits
unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE D2_BUNDLE \
  D2_FORCE_APPENDIX D2_ANIMATE_INTERVAL D2_CHECK D2_NO_XML_TAG DEBUG D2_FONT_REGULAR D2_FONT_ITALIC \
  D2_FONT_BOLD D2_FONT_SEMIBOLD D2_FONT_MONO D2_FONT_MONO_BOLD D2_FONT_MONO_ITALIC D2_FONT_MONO_SEMIBOLD
DATA=${XDG_DATA_HOME:-${HOME:-/tmp}/.local/share}/d2-diagram
MIN_D2=0.7.1
MIN_PY=3.8
MIN_NODE=18
ORIG_PATH=$PATH
ESC=$(printf '\033')
D2_SCRIPT='curl -fsSL https://d2lang.com/install.sh | sh -s --'
D2_USER="$D2_SCRIPT --method standalone --prefix \"\$HOME/.local\""
D2_GO='go install oss.terrastruct.com/d2@latest'

quote() {  # one shell word, quoted when needed: printed commands stay copy-pasteable
  case $1 in
    '' | *[!A-Za-z0-9_./=:,+@%-]*) printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}
ME="sh $(quote "$HERE/doctor.sh")"
usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; }
install=0 dry=0 json=0 quiet=0 offline=0
while [ $# -gt 0 ]; do
  case $1 in
    --install) install=1 ;;
    --dry-run) dry=1 ;;
    --json) json=1 ;;
    --quiet | -q) quiet=1 ;;
    --offline) offline=1 ;;
    -h | --help) usage; exit 0 ;;
    *) printf 'doctor: unknown option %s - options: %s --help\n' "$1" "$ME" >&2; exit 64 ;;
  esac
  shift
done
[ "$dry" = 0 ] || [ "$install" = 1 ] || { printf 'doctor: --dry-run goes with --install: %s --install --dry-run\n' "$ME" >&2; exit 64; }

os=generic osname="this OS" distro=""
case $(uname -s 2> /dev/null) in
  Darwin) os=macos osname=macOS ;;
  Linux)
    if [ -r /etc/os-release ] && grep -qiE '^(ID|ID_LIKE)=.*(debian|ubuntu)' /etc/os-release; then
      os=debian osname=Debian/Ubuntu distro=debian
      # Ubuntu ships Chromium only as a snap: `apt install chromium` has no candidate there
      grep -qiE '^(ID|ID_LIKE)=.*ubuntu' /etc/os-release && distro=ubuntu
    else
      os=linux osname=Linux
    fi ;;
esac

WORK=${D2_WORK:-${TMPDIR:-/tmp}/d2work}
TMPD=""
# shellcheck disable=SC2317 # called by the EXIT trap
cleanup() { [ -z "$TMPD" ] || rm -rf "$TMPD"; }
trap cleanup EXIT
trap 'exit 130' INT TERM

# run with a time limit when timeout(1) exists (macOS has none by default)
# a time limit where the system has one that works as `timeout SECS CMD` (GNU; macOS coreutils: gtimeout)
limited() {
  lim_s=$1
  shift
  lim_t=$(command -v timeout || command -v gtimeout || true)
  if [ -n "$lim_t" ] && "$lim_t" 5 true > /dev/null 2>&1; then "$lim_t" "$lim_s" "$@"; else "$@"; fi
}
# 1 when version $1 >= $2 (dotted numbers; a leading v is ignored)
ver_ge() {
  awk -v a="${1#v}" -v b="${2#v}" 'BEGIN { na = split(a, x, "."); nb = split(b, y, ".")
    for (i = 1; i <= 3; i++) { p = x[i] + 0; q = y[i] + 0; if (p > q) { print 1; exit } if (p < q) { print 0; exit } }
    print 1 }'
}

find_chrome() {  # the same places d2raster.py's chrome route looks
  for p in "${CHROME_PATH:-}" "${D2CHECK_CHROME:-}"; do
    [ -n "$p" ] && [ -x "$p" ] && { printf '%s\n' "$p"; return 0; }
  done
  for n in google-chrome google-chrome-stable chromium chromium-browser chrome microsoft-edge microsoft-edge-stable brave-browser; do
    command -v "$n" 2> /dev/null && return 0
  done
  for p in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
    [ -x "$p" ] && { printf '%s\n' "$p"; return 0; }
  done
  if [ "${PLAYWRIGHT_BROWSERS_PATH+set}" = set ]; then set -- "$PLAYWRIGHT_BROWSERS_PATH"
  else set -- /opt/pw-browsers "${HOME:-/nonexistent}/.cache/ms-playwright" "${HOME:-/nonexistent}/Library/Caches/ms-playwright"; fi
  for r in "$@"; do
    [ -n "$r" ] || continue
    # Playwright's layouts: before 1.57 (chrome-linux, chrome-mac) and after (Chrome for Testing builds)
    for p in "$r"/chromium-*/chrome-linux/chrome "$r"/chromium-*/chrome-linux64/chrome "$r"/chromium-*/chrome-linux-arm64/chrome \
      "$r"/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium \
      "$r"/chromium-*/chrome-mac-arm64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing \
      "$r"/chromium-*/chrome-mac-x64/Google\ Chrome\ for\ Testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing \
      "$r"/chromium_headless_shell-*/chrome-linux/headless_shell "$r"/chromium_headless_shell-*/chrome-mac/headless_shell \
      "$r"/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell; do
      [ -x "$p" ] && { printf '%s\n' "$p"; return 0; }
    done
  done
  return 1
}

TAB=$(printf '\t')
NL='
'
ROWS="" FIXES=""
# one line of plain text: no colour codes, no control characters (the table and the JSON stay intact)
clean() { printf '%s' "$1" | sed "s/${ESC}\[[0-9;?]*[A-Za-z]//g" | tr '\t\r\n' '   ' | tr -d '\000-\010\013\014\016-\037\177'; }
row() { ROWS="$ROWS$1$TAB$2$TAB$(clean "$3")$NL"; }  # status, check, detail
fix() { FIXES="$FIXES$1$TAB$2$TAB$3$TAB$4$NL"; }       # check, macOS, Debian/Ubuntu, any OS

check_all() {
  ROWS="" FIXES="" cannot=0 degraded=0 pwdir="" have_node=0 have_pw=0 chromium_ok=0 d2ok=0 chrome=""
  TMPD=""
  # --- work dir ---------------------------------------------------------------------------------------
  workok=0
  if mkdir -p "$WORK" 2> /dev/null && TMPD=$(mktemp -d "$WORK/.doctor.XXXXXX" 2> /dev/null); then workok=1; else cannot=1; fi
  # --- d2 + a real render -------------------------------------------------------------------------------
  if command -v d2 > /dev/null 2>&1; then
    v=$(d2 --version 2> /dev/null | head -1 | sed 's/^v//; s/[^0-9.].*//')
    if [ -z "$v" ]; then
      row FAIL d2 "$(command -v d2) does not answer --version"
      cannot=1
    elif [ "$(ver_ge "$v" "$MIN_D2")" = 1 ]; then
      row PASS d2 "v$v at $(command -v d2)"
      d2ok=1
    else
      row FAIL d2 "v$v at $(command -v d2); the templates need $MIN_D2 or newer"
      cannot=1
    fi
  else
    row FAIL d2 "not on PATH: nothing can be rendered"
    cannot=1
  fi
  if [ "$d2ok" = 0 ]; then
    fix d2 "brew install d2" "$D2_USER   (d2 has no apt package; then put ~/.local/bin on PATH)" "$D2_SCRIPT   or: $D2_GO   (then put \$(go env GOPATH)/bin on PATH)"
  fi
  # every family d2check can pick; only the default one decides fontsok (the test render uses it)
  fontsok=0 ferr="" fbad=""
  if [ -f "$HERE/font-flags.sh" ]; then
    for fam in default brand-snowflake geist; do
      if ! e=$(sh "$HERE/font-flags.sh" "$fam" 2>&1 > /dev/null); then
        fbad="$fbad${fbad:+, }$fam"
        [ -n "$ferr" ] || ferr=$(printf '%s' "$e" | head -1 | sed 's/^font-flags: //; s/ - reinstall.*//; s|missing .*/assets/fonts/|missing assets/fonts/|' | cut -c1-100)
      elif [ "$fam" = default ]; then
        fontsok=1
      fi
    done
  else
    fbad="default, brand-snowflake, geist" ferr="scripts/font-flags.sh is missing"
  fi
  if [ -z "$fbad" ]; then
    kb=$(du -sk "$SKILL/assets/fonts" 2> /dev/null | cut -f1)
    row PASS fonts "bundled fonts present (IBM Plex Sans, Geist, Geist Mono, Lato; ${kb:-?} KB)"
  else
    case $fbad in
      *default*) what="every diagram falls back to d2's built-in fonts" ;;
      brand-snowflake) what="Snowflake-brand diagrams fall back to d2's built-in fonts (the others are fine)" ;;
      geist) what="only D2_FONT_FAMILY=geist falls back to d2's built-in fonts (the default is fine)" ;;
      *) what="$fbad diagrams fall back to d2's built-in fonts (the default is fine)" ;;
    esac
    row WARN fonts "$ferr: $what"
    fix fonts "reinstall the skill (assets/fonts is part of the package)" "reinstall the skill (assets/fonts is part of the package)" "reinstall the skill (assets/fonts is part of the package)"
  fi
  svg=""
  if [ "$d2ok" = 1 ] && [ -n "$TMPD" ]; then
    printf '%s\n' 'vars: {d2-config: {layout-engine: elk; pad: 24}}' 'app: Doctor check' 'db: Database' \
      'app -> db: renders' > "$TMPD/doctor.d2"
    set --
    if [ "$fontsok" = 1 ]; then
      ff=$(sh "$HERE/font-flags.sh" default)
      while IFS= read -r l; do [ -z "$l" ] || set -- "$@" "$l"; done << EOF
$ff
EOF
    fi
    if out=$(limited 120 d2 "$@" --scale 1 --timeout 110 "$TMPD/doctor.d2" "$TMPD/doctor.svg" 2>&1) && [ -s "$TMPD/doctor.svg" ]; then
      svg="$TMPD/doctor.svg"
      if ! grep -q ' C ' "$svg"; then  # dagre would draw the edge as a cubic curve
        if [ "$fontsok" = 1 ]; then row PASS render "a test diagram renders with ELK and the bundled fonts"
        else row PASS render "a test diagram renders with ELK (d2's built-in fonts)"; fi
      else
        row WARN render "the test render drew curves: is the ELK layout plugin missing? (d2 layout lists the engines)"
      fi
    else
      row FAIL render "d2 cannot render a two-node test diagram: $(printf '%s' "$out" | tail -1 | cut -c1-120)"
      fix render "brew reinstall d2" "$D2_USER --force" "$D2_SCRIPT --force"
      cannot=1
    fi
  fi
  # --- python3 --------------------------------------------------------------------------------------------
  py=$(command -v python3 2> /dev/null || true)
  if [ -n "$py" ]; then
    pv=$("$py" -c 'import sys; print("%d.%d.%d" % sys.version_info[:3])' 2> /dev/null)
    if [ "$(ver_ge "${pv:-0}" "$MIN_PY")" = 1 ]; then
      row PASS python3 "$pv at $py"
    else
      row FAIL python3 "${pv:-unknown version} at $py; the lint and raster scripts need $MIN_PY or newer"
      py="" degraded=1
    fi
  else
    row FAIL python3 "not on PATH: no lint, no semantic check, no PNGs (d2check exits 3)"
    degraded=1
  fi
  [ -n "$py" ] || fix python3 "brew install python" "sudo apt install python3" "https://www.python.org/downloads/"
  # a browser for the no-node route; also the alternative every browser fix below names
  chrome=$(find_chrome) || chrome=""
  case $distro in
    ubuntu) apt_browser="Google Chrome's .deb from google.com/chrome (Ubuntu's chromium is a snap)" ;;
    debian) apt_browser="sudo apt install chromium" ;;
    *) apt_browser="Debian: sudo apt install chromium; Ubuntu: Google Chrome's .deb from google.com/chrome" ;;
  esac
  # --- node + playwright + chromium -----------------------------------------------------------------------
  if command -v node > /dev/null 2>&1; then
    nv=$(node --version 2> /dev/null)
    have_node=1
    if [ "$(ver_ge "${nv:-0}" "$MIN_NODE")" = 1 ]; then
      row PASS node "$nv at $(command -v node)"
    else
      row WARN node "$nv at $(command -v node); Playwright needs node $MIN_NODE or newer"
      fix node "brew install node" "sudo apt install nodejs npm   (Debian 12+ / Ubuntu 24.04+ ship node 18+)" "https://nodejs.org/en/download"
    fi
    probe=$(limited 90 node "$HERE/raster.cjs" --probe 2>&1)
    pwline=$(printf '%s\n' "$probe" | sed -n 's/^playwright: //p' | head -1)
    chline=$(printf '%s\n' "$probe" | sed -n 's/^chromium: //p' | head -1)
    case $pwline in
      '' | none)
        row WARN playwright "node cannot find the playwright module (NODE_PATH, global npm, $DATA/node)"
        fix playwright "npm i -g playwright && npx playwright install chromium" "npm i -g playwright && npx playwright install chromium   (no sudo: $ME --install)" "npm i -g playwright && npx playwright install chromium" ;;
      *)
        have_pw=1 pwdir=${pwline% *}
        row PASS playwright "$pwline" ;;
    esac
    if [ "$have_pw" = 1 ]; then
      case $chline in
        ok\ playwright-managed\ *)
          chromium_ok=1
          row PASS chromium "Chromium ${chline##* } (installed by Playwright)" ;;
        ok\ *)
          chromium_ok=1
          chl=${chline#ok }
          row PASS chromium "Chromium ${chl##* } at ${chl% *}" ;;
        *)
          row WARN chromium "Playwright cannot launch a Chromium: $(printf '%s' "${chline#none - }" | cut -c1-110)"
          # this Playwright's own CLI: `npx playwright` may run another version, whose browser this one cannot use
          cli="$(quote "$(command -v node)") $(quote "$pwdir/cli.js")"
          fix chromium "$cli install chromium   (or a browser: brew install --cask google-chrome)" \
            "$cli install chromium   (missing system libraries: sudo $cli install-deps chromium; or a browser: $apt_browser)" \
            "$cli install chromium   or install Chrome/Chromium and set CHROME_PATH to it" ;;
      esac
    fi
  elif [ -n "$chrome" ]; then
    row INFO node "not on PATH: no Playwright route, the browser binary below renders instead"
  else
    row WARN node "not on PATH: no Playwright route, and no Chrome/Chromium binary either"
    fix node "brew install node && npm i -g playwright && npx playwright install chromium   (or only a browser: brew install --cask google-chrome)" \
      "sudo apt install nodejs npm, then: $ME --install   (or only a browser: $apt_browser)" \
      "node 18+ (https://nodejs.org/en/download), then: npm i -g playwright && npx playwright install chromium   (or install Chrome/Chromium)"
  fi
  if [ -n "$chrome" ]; then
    row PASS chrome "browser binary for the no-node route: $chrome"
  else
    row INFO chrome "no Chrome/Chromium/Edge binary (the fallback when the Playwright route fails)"
  fi
  # --- the whole raster chain on the test SVG ---------------------------------------------------------------
  approx=0
  # d2check honours D2CHECK_ROUTE; this check tries every route, and a forced one gets its own row
  case ${D2CHECK_ROUTE:-auto} in
    auto) ;;
    playwright | chrome | rsvg | cairosvg)
      row WARN route "D2CHECK_ROUTE=$D2CHECK_ROUTE forces one rasterizer for d2check; unset it for auto" ;;
    *) row WARN route "D2CHECK_ROUTE='$D2CHECK_ROUTE' is not a route (auto, playwright, chrome, rsvg, cairosvg): d2check stops with a usage error; unset it" ;;
  esac
  if [ -n "$svg" ] && [ -n "$py" ]; then
    rout=$(D2CHECK_ROUTE=auto limited 180 "$py" "$HERE/d2raster.py" "$svg" --out "$TMPD/doctor.png" --scale 1 --quiet 2>&1)
    rrc=$?
    route=$(printf '%s\n' "$rout" | sed -n 's/^route: \([a-z]*\).*/\1/p' | head -1)
    case $rrc in
      0) row PASS raster "faithful PNG of the test diagram via $route" ;;
      3) row WARN raster "only rsvg-convert worked: reviews are approximate (fonts substituted)"; degraded=1 approx=1 ;;
      *) why=$(printf '%s\n' "$rout" | sed -n 's/^raster: failed //p' | sed 's/raster.cjs: //; s/ - .*//' | head -3 | tr '\n' ';' | sed 's/;/; /g')
         row FAIL raster "no renderer produced a usable PNG (${why%; }): d2check will say NOT visually reviewed"; degraded=1 ;;
    esac
    if [ "$rrc" != 0 ] && [ -n "$chrome" ] && [ "$chromium_ok" = 0 ]; then
      fix raster "the browser at $chrome did not render: set CHROME_PATH to a working Chrome, or: brew install --cask google-chrome" \
        "the browser at $chrome did not render: set CHROME_PATH to a working Chrome, or: $apt_browser" \
        "the browser at $chrome did not render: set CHROME_PATH to a working Chrome/Chromium"
    fi
  elif [ -z "$py" ]; then
    row FAIL raster "skipped: needs python3"
  fi
  # --- optional tools -------------------------------------------------------------------------------------
  if command -v rsvg-convert > /dev/null 2>&1; then
    row PASS rsvg "$(rsvg-convert --version 2> /dev/null | head -1) (approximate fallback only)"
  else
    row INFO rsvg "rsvg-convert not installed (optional: an approximate fallback when no Chromium works)"
    fix rsvg "brew install librsvg" "sudo apt install librsvg2-bin" "install librsvg with your package manager"
  fi
  if command -v curl > /dev/null 2>&1; then
    row PASS curl "$(command -v curl) (icon.sh search, verify, get)"
    if [ "$offline" = 1 ]; then
      row INFO iconify "not checked (--offline)"
    else
      code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' 'https://api.iconify.design/collections?prefix=lucide' 2> /dev/null)
      if [ "$code" = 200 ]; then
        row PASS iconify "api.iconify.design answers (icon search and fetch)"
      else
        row WARN iconify "api.iconify.design unreachable (HTTP ${code:-000}): icon.sh falls back to unpkg and the bundled pack"
        fix iconify "check the network or proxy (HTTPS_PROXY)" "check the network or proxy (HTTPS_PROXY)" "check the network or proxy; offline: sh $(quote "$HERE/icon.sh") tint <hex> <dir>"
      fi
    fi
  else
    row WARN curl "not on PATH: icon.sh search/verify/get cannot run (the bundled pack still works)"
    fix curl "brew install curl" "sudo apt install curl" "install curl with your package manager"
  fi
  if [ "$workok" = 1 ]; then
    row PASS workdir "$WORK is writable (D2W, d2check's working files)"
  else
    row FAIL workdir "cannot write to $WORK: d2check keeps its working files there"
    fix workdir "export D2_WORK=\"\$HOME/.cache/d2work\"" "export D2_WORK=\"\$HOME/.cache/d2work\"" "export D2_WORK=<a writable folder>"
  fi
  if [ "$cannot" = 1 ]; then verdict=cannot-render rc=1
  elif [ "$degraded" = 1 ]; then verdict=degraded rc=3
  else verdict=ready rc=0; fi
  # what --install can do here without sudo
  can_install=""
  if [ "$d2ok" = 0 ] && printf '%s' "$ROWS" | grep -q "^FAIL${TAB}d2${TAB}"; then
    { [ "$os" = macos ] && command -v brew > /dev/null 2>&1; } || command -v curl > /dev/null 2>&1 ||
      command -v go > /dev/null 2>&1 && can_install="d2"
  fi
  if [ "$have_node" = 1 ] && [ "$have_pw" = 0 ] && command -v npm > /dev/null 2>&1; then
    can_install="${can_install:+$can_install, }Playwright and its Chromium"
  elif [ "$have_pw" = 1 ] && [ "$chromium_ok" = 0 ]; then
    can_install="${can_install:+$can_install, }Playwright's Chromium"
  fi
  [ -z "$TMPD" ] || rm -rf "$TMPD"
  TMPD=""
}

say_i() { if [ "$json" = 1 ]; then printf 'doctor: %s\n' "$*" >&2; else printf 'install: %s\n' "$*"; fi; }
cmdline() { s=""; for a in "$@"; do s="$s${s:+ }$(quote "$a")"; done; printf '%s' "$s"; }
# print a command, then run it (--dry-run: print only); a failure is reported with its exit code
attempt() {
  tries=$((tries + 1))
  say_i "$verb: $(cmdline "$@")"
  [ "$dry" = 1 ] && return 0
  # --json keeps stdout for the one JSON object: the installers' own output goes to stderr
  if [ "$json" = 1 ]; then "$@" 1>&2; else "$@"; fi
  r=$?
  [ "$r" = 0 ] || say_i "FAILED (exit $r): $(cmdline "$@")"
  return "$r"
}

run_install() {
  verb=running
  [ "$dry" = 0 ] || verb="would run"
  failed=0 tries=0
  if [ "$d2ok" = 0 ] && printf '%s' "$ROWS" | grep -q "^FAIL${TAB}d2${TAB}"; then
    # where the user-space installs put d2 (the check after --install looks there too)
    gobin=""
    command -v go > /dev/null 2>&1 && gobin="$(go env GOPATH 2> /dev/null)/bin"
    PATH="${HOME:-/nonexistent}/.local/bin${gobin:+:$gobin}:$PATH"
    export PATH
    got=0 n=0
    for m in brew curl go; do
      [ "$got" = 1 ] && break
      case $m in
        brew) { [ "$os" = macos ] && command -v brew > /dev/null 2>&1; } || continue
              set -- brew install d2 ;;
        curl) command -v curl > /dev/null 2>&1 || continue
              set -- sh -c "$D2_USER" ;;
        go) command -v go > /dev/null 2>&1 || continue
            say_i "(go builds d2 from source: about a minute)"
            set -- go install oss.terrastruct.com/d2@latest ;;
      esac
      n=$((n + 1))
      [ "$dry" = 1 ] && [ "$n" -gt 1 ] && verb="would run if that fails"
      if attempt "$@" && [ "$dry" = 0 ]; then
        # `curl ... | sh` exits 0 even when the download failed: only a d2 on PATH counts
        if command -v d2 > /dev/null 2>&1; then got=1
        else say_i "that exited 0, but no d2 appeared (PATH, ~/.local/bin${gobin:+, $gobin})"; fi
      fi
    done
    [ "$dry" = 0 ] || verb="would run"
    if [ "$n" = 0 ]; then
      say_i "cannot install d2: needs curl, go or (macOS) brew - see the d2 commands above"
      failed=1
    elif [ "$got" = 0 ] && [ "$dry" = 0 ]; then
      say_i "d2 could not be installed: every method above failed"
      failed=1
    fi
    if [ "$got" = 1 ]; then
      d2dir=$(dirname -- "$(command -v d2)")
      case ":$ORIG_PATH:" in
        *":$d2dir:"*) ;;
        *) say_i "d2 is in $d2dir, which is not on your PATH: add export PATH=\"$d2dir:\$PATH\" to your shell profile" ;;
      esac
    fi
  fi
  if [ "$have_node" = 1 ] && [ "$have_pw" = 0 ]; then
    if command -v npm > /dev/null 2>&1; then
      if [ "$dry" = 1 ] || mkdir -p "$DATA/node"; then
        if attempt npm install --prefix "$DATA/node" --no-audit --no-fund playwright; then
          pwdir="$DATA/node/node_modules/playwright" have_pw=1
        else
          failed=1
        fi
      fi
    else
      say_i "cannot install Playwright: npm is not on PATH (Debian/Ubuntu: sudo apt install npm)"
      failed=1
    fi
  fi
  if [ "$have_pw" = 1 ] && [ "$chromium_ok" = 0 ] && [ -n "$pwdir" ] && { [ "$dry" = 1 ] || [ -f "$pwdir/cli.js" ]; }; then
    # Playwright 1.49+ launches the headless shell: installing only that saves ~600 MB
    pv=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' "$pwdir/package.json" 2> /dev/null | head -1)
    shell=""
    [ "$(ver_ge "${pv:-1.49}" 1.49)" = 1 ] && shell="--only-shell"
    # shellcheck disable=SC2086 # $shell is one optional flag
    attempt node "$pwdir/cli.js" install $shell chromium || failed=1
  fi
  printf '%s' "$ROWS" | grep -qE "^(FAIL|WARN)${TAB}(python3|node|curl)${TAB}" &&
    say_i "not installed by --install (needs your package manager): see the commands above"
  if [ "$failed" = 1 ]; then
    say_i "an install FAILED (above); the check below shows what is still missing"
  elif [ "$tries" = 0 ]; then
    say_i "nothing to install without sudo"
  fi
}

report() {
  if [ "$json" = 1 ]; then
    js() { printf '"%s"' "$(clean "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"; }
    printf '{"verdict": %s, "exit": %d, "os": %s, "skill": %s, "work_dir": %s, "checks": [' \
      "$(js "$verdict")" "$rc" "$(js "$os")" "$(js "$SKILL")" "$(js "$WORK")"
    sep=""
    printf '%s' "$ROWS" | while IFS="$TAB" read -r st nm de; do
      [ -n "$nm" ] || continue
      fx=$(printf '%s' "$FIXES" | awk -F '\t' -v n="$nm" '$1 == n { print; exit }')
      printf '%s\n  {"check": %s, "status": %s, "detail": %s' "$sep" "$(js "$nm")" "$(js "$st")" "$(js "$de")"
      if [ -n "$fx" ]; then
        m=$(printf '%s' "$fx" | cut -f2) d=$(printf '%s' "$fx" | cut -f3) g=$(printf '%s' "$fx" | cut -f4)
        printf ', "fix": {"macos": %s, "debian": %s, "generic": %s}' "$(js "$m")" "$(js "$d")" "$(js "$g")"
      fi
      printf '}'
      sep=","
    done
    printf '\n]}\n'
    return
  fi
  printf 'd2-diagram doctor - skill at %s (%s)\n' "$SKILL" "$osname"
  printf '%s' "$ROWS" | while IFS="$TAB" read -r st nm de; do
    [ -n "$nm" ] || continue
    [ "$quiet" = 1 ] && { [ "$st" = PASS ] || [ "$st" = INFO ]; } && continue
    printf '  %-5s %-11s %s\n' "$st" "$nm" "$de"
  done
  case $verdict in
    ready) printf 'verdict: READY - d2check renders and gives a faithful visual review (exit 0)\n' ;;
    degraded)
      if [ "$approx" = 1 ]; then
        printf 'verdict: DEGRADED - d2check renders SVG, but its reviews are only "approximate (rsvg)": substitute fonts, label fit unchecked (exit 3)\n'
      else
        printf 'verdict: DEGRADED - d2check renders SVG but cannot look at it: its reviews say "NOT visually reviewed" (exit 3)\n'
      fi ;;
    *) printf 'verdict: CANNOT RENDER - fix the FAIL rows first (exit 1)\n' ;;
  esac
  # optional tools are listed only when something needs them
  printf '%s' "$ROWS" | grep -qE "^(FAIL|WARN)${TAB}raster${TAB}" || FIXES=$(printf '%s' "$FIXES" | grep -v "^rsvg${TAB}")
  [ -n "$FIXES" ] || return 0
  printf 'how to fix (this machine: %s):\n' "$osname"
  printf '%s\n' "$FIXES" | while IFS="$TAB" read -r nm m d g; do
    [ -n "$nm" ] || continue
    printf '  %s\n' "$nm"
    for line in "macos${TAB}macOS:${TAB}$m" "debian${TAB}Debian/Ubuntu:${TAB}$d" "generic${TAB}any OS:${TAB}$g"; do
      k=${line%%"$TAB"*} rest=${line#*"$TAB"}
      mark=" "
      [ "$k" = "$os" ] && mark="*"
      [ "$k" = generic ] && { [ "$os" = generic ] || [ "$os" = linux ]; } && mark="*"
      printf '   %s %-15s %s\n' "$mark" "${rest%%"$TAB"*}" "${rest#*"$TAB"}"
    done
  done
  if [ "$install" = 0 ] && [ -n "$can_install" ]; then
    printf '  %s --install   installs %s for this user (no sudo)\n' "$ME" "$can_install"
  fi
}

check_all
if [ "$install" = 1 ] && [ "$rc" != 0 ]; then
  [ "$json" = 1 ] || report
  run_install
  if [ "$dry" = 1 ]; then
    [ "$json" = 0 ] || report
    exit "$rc"
  fi
  [ "$json" = 1 ] || printf '\nafter --install:\n'
  check_all
fi
report
exit "$rc"
