#!/bin/sh
# check_export.sh - run the commands of reference/export.md on fixtures.
#
# usage: sh check_export.sh [--native]
#   Each case: the command (or claim) must still appear verbatim in export.md;
#   it then runs with <target> = a fixture, <flags> = d2check's render flags,
#   ${CLAUDE_SKILL_DIR} = this skill, D2W = d2check's work dir for the
#   fixture, and its outputs are checked. A case whose script is not in
#   scripts/ yet prints SKIP.
#   --native also runs the Playwright driver install and the d2 PPTX/GIF
#   exports. It downloads about 170 MB unless PLAYWRIGHT_BROWSERS_PATH already
#   holds chromium-1134.
# Exit: 0 no FAIL | 1 a FAIL, or d2 or export.md missing | 64 usage (the skill's shared convention)

# Doc lines are literal text (SC2016), $FLAGS splits into flags on purpose
# (SC2086), and pass/fail always return 0, so "a && pass || fail" is safe.
# shellcheck disable=SC2016,SC2086,SC2015
NATIVE=
case "$1" in
  '') ;;
  --native) NATIVE=1 ;;
  -h | --help) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  *) sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 64 ;;
esac
S=$(cd "$(dirname "$0")/../../.." && pwd)
DOC=$S/reference/export.md
[ -f "$DOC" ] || { echo "check_export: $DOC missing" >&2; exit 1; }
command -v d2 > /dev/null 2>&1 || { echo "check_export: d2 not on PATH - install it: sh $S/scripts/doctor.sh" >&2; exit 1; }
unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE
T=$(mktemp -d "${TMPDIR:-/tmp}/check_export.XXXXXX") || exit 1
WPID=
# a watcher killed mid-compile still writes its SVG: give it a second before rm
trap '[ -z "$WPID" ] || { kill "$WPID" 2> /dev/null; sleep 1; }; rm -rf "$T"' EXIT
trap 'exit 130' INT TERM
umask 022
D2_WORK=$T/work
export D2_WORK

# d2check's render flags: $FLAGS for direct use (globbing is off: the padding has brackets),
# $FLAGS_SH (padding quoted) where <flags> is pasted into a command line that sh -c runs
set -f
PAD='[top=50,left=50,bottom=30,right=50]'
FLAGS="--scale 1 --elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20 --elk-padding $PAD"
FLAGS_SH="--scale 1 --elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20 --elk-padding '$PAD'"
if [ -f "$S/scripts/font-flags.sh" ]; then
  FF=$(sh "$S/scripts/font-flags.sh" default 2> /dev/null | tr '\n' ' ')
  FLAGS="$FLAGS $FF" FLAGS_SH="$FLAGS_SH $FF"
fi
HAVE_CHECK=
[ -f "$S/scripts/d2check.sh" ] && HAVE_CHECK=1
nfail=0 npass=0 nskip=0
pass() { npass=$((npass + 1)); echo "PASS $1"; }
fail() { nfail=$((nfail + 1)); echo "FAIL $1"; }
skip() { nskip=$((nskip + 1)); echo "SKIP $1"; }
mode() { stat -c %a "$1" 2> /dev/null || stat -f %Lp "$1"; }
inode() { stat -c %i "$1" 2> /dev/null || stat -f %i "$1"; }
# doc TEXT: the doc must still contain TEXT verbatim (else the test is stale)
doc() {
  grep -F -q -- "$1" "$DOC" && return 0
  fail "export.md no longer contains: $1"
  return 1
}
# cmd LINE TARGET: LINE with its placeholders filled in (D2W = d2check's
# work dir for TARGET's name)
cmd() {
  nm=$(basename "$2")
  printf '%s\n' "$1" | sed -e "s|[\$]{CLAUDE_SKILL_DIR}|$S|g" -e "s|<target>|$2|g" \
    -e "s|<flags>|$FLAGS_SH|g" -e "s|D2W|$D2_WORK/$nm|g" -e "s|<name>|$nm|g"
}
run() { (cd "$T" && sh -c "$1") > "$T/run.log" 2>&1; }
svgw() { sed -n 's/.*<svg[^>]*width="\([0-9]*\)".*/\1/p' "$1" | head -n 1; }
pngw() { python3 -c "import struct,sys; b=open(sys.argv[1],'rb').read(24); print(struct.unpack('>I',b[16:20])[0])" "$1" 2> /dev/null; }

mkdir -p "$T/one" "$D2_WORK/demo" "$D2_WORK/flow"
cat > "$T/one/demo.d2" << 'EOF'
vars: {d2-config: {layout-engine: elk; pad: 24}}
web: Web app
api: Orders API
db: Orders DB {shape: cylinder}
web -> api: HTTPS
api -> db: SQL
EOF
cat > "$T/one/flow.d2" << 'EOF'
vars: {d2-config: {layout-engine: elk; pad: 24}}
client: Client
api: API
db: DB {shape: cylinder}
client -> api: request
api -> db: query
steps: {
  "1": {api.style.stroke: "#1D4ED8"}
  "2": {db.style.stroke: "#1D4ED8"}
}
EOF
printf '# request: "the client calls the API, which queries the DB"\ntype: steps\nreader: test\nwidth: 800\ndirection: down\nout: none\nnodes:\n  client: Client\n  api: API\n  db: DB {shape: cylinder}\nedges:\n  client -> api: request\n  api -> db: query\n' > "$D2_WORK/flow/flow.brief"
ONE=$T/one/demo
FLOW=$T/one/flow

# ---- header: env overrides d2-config; the check and the unset
L='unset D2_LAYOUT D2_THEME D2_DARK_THEME D2_PAD D2_SKETCH D2_CENTER D2_WATCH SCALE; d2 ...'
E="env | grep -E '^(D2_(LAYOUT|THEME|DARK_THEME|PAD|SKETCH|CENTER|WATCH)|SCALE)='"
if doc "$L" && doc "$E"; then
  vb() { grep -o 'viewBox="[^"]*"' "$1" | head -n 1; }
  d2 "$ONE.d2" "$T/env0.svg" > /dev/null 2>&1
  D2_PAD=100 d2 "$ONE.d2" "$T/pad.svg" > /dev/null 2>&1
  D2_LAYOUT=dagre d2 "$ONE.d2" "$T/lay.svg" > /dev/null 2>&1
  D2_DARK_THEME=200 d2 "$ONE.d2" "$T/dark.svg" > /dev/null 2>&1
  D2_CENTER=true d2 "$ONE.d2" "$T/ctr.svg" > /dev/null 2>&1
  SCALE=2 d2 "$ONE.d2" "$T/sc.svg" > /dev/null 2>&1
  (eval "D2_PAD=100; export D2_PAD; ${L% d2 ...}" && d2 "$ONE.d2" "$T/nopad.svg") > /dev/null 2>&1
  seen=$(D2_PAD=100 D2_WORK=x sh -c "$E")
  if [ "$(vb "$T/pad.svg")" != "$(vb "$T/env0.svg")" ] && [ "$(vb "$T/nopad.svg")" = "$(vb "$T/env0.svg")" ] &&
    [ "$(vb "$T/lay.svg")" != "$(vb "$T/env0.svg")" ] && grep -q 'prefers-color-scheme' "$T/dark.svg" &&
    grep -q 'xMidYMid' "$T/ctr.svg" && [ "$(svgw "$T/sc.svg")" -gt 0 ] 2> /dev/null && [ "$seen" = "D2_PAD=100" ]; then
    pass "env D2_PAD, D2_LAYOUT, D2_DARK_THEME, D2_CENTER, SCALE take effect; the env check shows them; unset restores"
  else
    fail "env overrides: pad $(vb "$T/pad.svg") lay $(vb "$T/lay.svg") nopad $(vb "$T/nopad.svg") check '$seen'"
  fi
fi

# ---- header: raw d2 renames a temp file over the output path
if doc "The old file's mode is lost (the new file is 600), a symlink" && doc "is replaced by a plain file"; then
  mkdir -p "$T/fx" && echo old > "$T/fx/old.svg" && chmod 644 "$T/fx/old.svg"
  i1=$(inode "$T/fx/old.svg")
  echo real > "$T/fx/real.svg" && ln -s real.svg "$T/fx/link.svg"
  d2 "$ONE.d2" "$T/fx/old.svg" > /dev/null 2>&1
  d2 "$ONE.d2" "$T/fx/link.svg" > /dev/null 2>&1
  if [ "$(mode "$T/fx/old.svg")" = 600 ] && [ "$(inode "$T/fx/old.svg")" != "$i1" ] &&
    [ ! -L "$T/fx/link.svg" ] && [ "$(cat "$T/fx/real.svg")" = real ]; then
    pass "raw d2 replaces its output: new inode, mode 600, symlink replaced"
  else
    fail "rename claim: mode $(mode "$T/fx/old.svg"), link $(ls -l "$T/fx/link.svg")"
  fi
  if mkfifo "$T/fx/special" 2> /dev/null; then  # a special file, like /dev/null
    d2 "$ONE.d2" "$T/fx/special" > /dev/null 2>&1
    [ -f "$T/fx/special" ] && [ ! -p "$T/fx/special" ] && pass "a special file as output becomes a regular file" ||
      fail "the fifo output path was not replaced"
  fi
fi

# ---- the deliverable SVG as d2check writes it (render + chmod 644)
d2 $FLAGS "$ONE.d2" "$ONE.svg" > /dev/null 2>&1
m=$(mode "$ONE.svg")
[ "$m" = 600 ] && pass "d2 writes SVG as 600" || fail "d2 wrote SVG as $m (doc says 600)"
chmod 644 "$ONE.svg"
W=$(svgw "$ONE.svg")
[ -n "$W" ] && pass "--scale 1 SVG has width=$W" || fail "--scale 1 SVG has no width attribute"

# ---- section 2: inline SVG through d2check
L='sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh <target>.d2 <target>-inline.svg -- --no-xml-tag'
if doc "$L" && doc 'add `--salt <name>` after it'; then
  if [ -z "$HAVE_CHECK" ]; then
    skip "inline SVG: scripts/d2check.sh not there yet (WP1)"
  else
    run "$(cmd "$L" "$ONE")"
    rc=$?
    case $rc in 0 | 3) ;; *) rc=bad ;; esac
    [ "$rc" != bad ] && head -c 4 "$ONE-inline.svg" | grep -q '<svg' && [ "$(mode "$ONE-inline.svg")" = 644 ] &&
      pass "inline SVG via d2check: starts with <svg, mode 644" || fail "inline SVG via d2check: $(tail -n 1 "$T/run.log")"
    a=$(grep -o 'd2-[0-9][0-9]*' "$ONE-inline.svg" | head -n 1)
    run "$(cmd "$L --salt demo" "$ONE")"
    b=$(grep -o 'd2-[0-9][0-9]*' "$ONE-inline.svg" | head -n 1)
    [ -n "$a" ] && [ "$a" != "$b" ] && pass "--salt changes the SVG ids ($a -> $b)" || fail "--salt: ids $a / $b"
  fi
fi

# ---- header: the re-render line reproduces the layout, not d2check's post-processing
if doc 'reproduces the layout only' && doc 'geometricPrecision` to the SVG and sets mode 644' && [ -n "$HAVE_CHECK" ]; then
  mkdir -p "$T/rr" && cp "$ONE.d2" "$T/rr/demo.d2"
  (cd "$T/rr" && sh "$S/scripts/d2check.sh" --no-raster demo.d2 checked.svg) > "$T/rr.log" 2>&1
  rr=$(sed -n 's/^re-render: //p' "$T/rr.log" | sed 's/ checked\.svg$/ again.svg/')
  (cd "$T/rr" && sh -c "$rr") > /dev/null 2>&1
  a=$(grep -o 'viewBox="[^"]*"' "$T/rr/checked.svg" | head -n 1) b=$(grep -o 'viewBox="[^"]*"' "$T/rr/again.svg" 2> /dev/null | head -n 1)
  if [ -n "$a" ] && [ "$a" = "$b" ] && grep -q geometricPrecision "$T/rr/checked.svg" && ! grep -q 'text{text-rendering:geometricPrecision}' "$T/rr/again.svg" &&
    [ "$(mode "$T/rr/checked.svg")" = 644 ] && [ "$(mode "$T/rr/again.svg")" = 600 ]; then
    pass "re-render line: same layout ($a); no geometricPrecision rule, mode 600 (d2check: rule added, 644)"
  else
    fail "re-render line: '$rr' gave '$b' vs '$a'"
  fi
fi

# ---- section 3: PNG
L='python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py <target>.svg --out <target>.png --scale 2'
if doc "$L"; then
  if [ ! -f "$S/scripts/d2raster.py" ]; then
    skip "PNG: scripts/d2raster.py not there yet (WP1)"
  elif run "$(cmd "$L" "$ONE")"; then
    pw=$(pngw "$ONE.png")
    [ "$pw" = $((W * 2)) ] && [ "$(mode "$ONE.png")" = 644 ] && pass "PNG: exit 0, ${pw}px = 2 x SVG width, mode 644" ||
      fail "PNG width $pw (expected $((W * 2))), mode $(mode "$ONE.png")"
  else
    fail "PNG: exit $? ($(tail -n 1 "$T/run.log"))"
  fi
  if [ -f "$S/scripts/d2raster.py" ] && command -v rsvg-convert > /dev/null 2>&1 && doc 'Exit 3 means only rsvg-convert worked'; then
    python3 "$S/scripts/d2raster.py" "$ONE.svg" --out "$T/rsvg.png" --scale 2 --route rsvg > /dev/null 2>&1
    rc=$?
    [ "$rc" = 3 ] && pass "PNG: the rsvg-convert route exits 3 (approximate)" || fail "PNG rsvg route exited $rc, doc says 3"
  fi
fi

# ---- section 4: PDF
L='python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py <target>.svg --out <target>.pdf'
if doc "$L"; then
  if [ ! -f "$S/scripts/d2raster.py" ]; then
    skip "PDF: scripts/d2raster.py not there yet (WP1)"
  elif run "$(cmd "$L" "$ONE")" && head -c 5 "$ONE.pdf" | grep -q '%PDF-'; then
    got=$(python3 - "$ONE.pdf" "$W" << 'EOF'
import re, sys
b = open(sys.argv[1], "rb").read()
pages = len(re.findall(rb"/Type\s*/Page[^s]", b))
box = re.search(rb"/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)", b)
w = float(box.group(3)) / 0.75 if box else 0
print("ok" if pages == 1 and abs(w - float(sys.argv[2])) <= 2 else "%d page(s), %.1fpx wide" % (pages, w))
EOF
)
    [ "$got" = ok ] && [ "$(mode "$ONE.pdf")" = 644 ] && pass "PDF: one vector page as wide as the SVG (${W}px, +-2), mode 644" ||
      fail "PDF: $got, mode $(mode "$ONE.pdf"); want 1 page ${W}px wide"
  else
    fail "PDF: $(tail -n 1 "$T/run.log")"
  fi
fi

# ---- section 5: board layouts (raw d2)
printf 'a -> b\nsteps: {"1": {b -> c}}\n' > "$T/kind1.d2"
printf 'a -> b\nlayers: {x: {c -> d}}\nsteps: {"1": {b -> c}}\n' > "$T/mixed.d2"
printf 'a -> b\nlayers: {x: {c -> d; steps: {s1: {d -> e}}}}\n' > "$T/nested.d2"
for f in kind1 mixed nested; do d2 "$T/$f.d2" "$T/$f.svg" > /dev/null 2>&1; done
if [ -f "$T/kind1/index.svg" ] && [ -f "$T/kind1/1.svg" ] && [ -f "$T/mixed/layers/x.svg" ] &&
  [ -f "$T/mixed/steps/1.svg" ] && [ -f "$T/nested/x/index.svg" ] && [ -f "$T/nested/x/s1.svg" ]; then
  pass "board layout: flat for one kind, kind folders when mixed, nested boards in subfolders"
else
  fail "board layout differs: $(cd "$T" && find kind1 mixed nested -type f | tr '\n' ' ')"
fi

# ---- section 5: data loss with raw d2, and what is safe
keep() { rm -rf "$T/docs" && mkdir -p "$T/docs" && echo keep > "$T/docs/index.md"; }
lost() { [ ! -f "$T/docs/index.md" ]; }
if doc 'DELETES the' && doc 'an output path with no extension is itself replaced'; then
  keep; d2 "$T/mixed.d2" "$T/docs.svg" > /dev/null 2>&1; a=$(lost && echo y)
  keep; d2 --animate-interval 1000 "$T/mixed.d2" "$T/docs.svg" > /dev/null 2>&1; b=$(lost && echo y)
  keep; d2 --ascii-mode standard "$T/mixed.d2" "$T/docs.txt" > /dev/null 2>&1; c=$(lost && echo y)
  echo x > "$T/noext"; d2 "$T/mixed.d2" "$T/noext" > /dev/null 2>&1
  [ "$a$b$c" = yyy ] && [ -d "$T/noext" ] &&
    pass "DATA LOSS: .svg, --animate-interval and .txt renders delete docs/; an extensionless path becomes a directory" ||
    fail "data loss claims: svg=$a animate=$b txt=$c noext=$(ls -ld "$T/noext")"
  keep; d2 --target='' "$T/mixed.d2" "$T/docs.svg" > /dev/null 2>&1; a=$(lost || echo y)
  printf 'a -> \n' > "$T/broken.d2"
  keep; d2 "$T/broken.d2" "$T/docs.svg" > /dev/null 2>&1; b=$(lost || echo y)
  [ "$a$b" = yy ] && pass "a one-board --target render and a failed compile keep docs/" ||
    fail "safe renders deleted docs/ (target=$a failed=$b)"
fi

# ---- section 5: d2check writes <target>/ safely
L='(`sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh --brief D2W/<name>.brief <target>.d2`)'
if doc "$L" && doc 'Other files in `<target>/` are kept'; then
  if [ -z "$HAVE_CHECK" ]; then
    skip "d2check boards: scripts/d2check.sh not there yet (WP1)"
  else
    mkdir -p "$FLOW" && echo keep > "$FLOW/marker"
    run "$(cmd "$(printf '%s' "$L" | tr -d '()`')" "$FLOW")"
    rc=$?
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      fail "d2check on the boards fixture exited $rc: $(tail -n 3 "$T/run.log" | tr '\n' ' ')"
    elif [ -f "$FLOW/index.svg" ] && [ -f "$FLOW/2.svg" ] && [ -f "$FLOW/marker" ] && [ "$(mode "$FLOW/2.svg")" = 644 ]; then
      pass "d2check writes the boards into <target>/ (644) and keeps other files"
    else
      fail "d2check boards: $(find "$FLOW" | tr '\n' ' ')"
    fi
  fi
fi
[ -f "$FLOW/2.svg" ] || d2 $FLAGS "$FLOW.d2" "$FLOW.svg" > /dev/null 2>&1
L="find <target> -name '*.svg' | sort"
if doc "$L" && run "$(cmd "$L" "$FLOW")" && [ "$(grep -c '\.svg$' "$T/run.log")" = 3 ]; then
  pass "find lists the 3 board SVGs"
else
  fail "find: $(tr '\n' ' ' < "$T/run.log")"
fi
L='find <target> -name '"'*.svg'"' | while read -r f; do python3 ${CLAUDE_SKILL_DIR}/scripts/d2raster.py "$f" --out "${f%.svg}.png" --scale 2; done'
if doc "$L"; then
  if [ ! -f "$S/scripts/d2raster.py" ]; then
    skip "per-board PNG: scripts/d2raster.py not there yet (WP1)"
  elif run "$(cmd "$L" "$FLOW")" && [ -f "$FLOW/index.png" ] && [ -f "$FLOW/1.png" ] && [ -f "$FLOW/2.png" ]; then
    pass "per-board PNG loop: one PNG beside each board SVG"
  else
    fail "per-board PNG loop: $(tail -n 1 "$T/run.log")"
  fi
fi
L='cp <target>/2.svg <target>-step-2.svg'
if doc "$L" && run "$(cmd "$L" "$FLOW")" && cmp -s "$FLOW/2.svg" "$FLOW-step-2.svg"; then
  pass "one board as one file: a copy of the reviewed board SVG (mode $(mode "$FLOW-step-2.svg"))"
else
  fail "$L"
fi

# ---- section 6: animated SVG (and the naming rule: the board dir survives)
L='sh ${CLAUDE_SKILL_DIR}/scripts/d2check.sh <target>.d2 <target>-animated.svg -- --animate-interval 2000'
if doc "$L" && run "$(cmd "$L" "$FLOW")" && grep -q '@keyframes' "$FLOW-animated.svg"; then
  [ -f "$FLOW/2.svg" ] && pass "animated SVG via d2check: one file with keyframes, exit 0; <target>/ untouched" ||
    fail "animated render deleted <target>/"
  [ "$(mode "$FLOW-animated.svg")" = 644 ] || fail "animated SVG mode is not 644"
  grep -q 'only the first (the base board) is linted' "$T/run.log" || fail "d2check did not lint the first frame only"
else
  fail "animated SVG: $(tail -n 1 "$T/run.log")"
fi
if doc 'base, then layers, then scenarios, then steps, whatever the order'; then
  printf '%s\n' 'b: BASE0' 'steps: {s: {x: STEP3}}' 'scenarios: {c: {y: SCEN2}}' 'layers: {l: {z: LAYER1}}' > "$T/order.d2"
  d2 --animate-interval 500 "$T/order.d2" "$T/order.svg" > /dev/null 2>&1
  got=$(grep -o 'BASE0\|LAYER1\|SCEN2\|STEP3' "$T/order.svg" | awk '!s[$0]++' | tr '\n' ' ')
  [ "$got" = "BASE0 LAYER1 SCEN2 STEP3 " ] && pass "frame order: base, layers, scenarios, steps" || fail "frame order: $got"
fi

# ---- section 6 tip: a class list re-assigned in a step is ignored; reset first. The rule lives in
# syntax.md section 7 (one home) and export.md links it: check both, then prove the rule itself
L='db.class: null; db.class: [datastore; focal]'
if doc 'reference/syntax.md` section 7' &&
  { grep -F -q -- "$L" "$S/reference/syntax.md" || { fail "syntax.md section 7 no longer contains: $L"; false; }; }; then
  printf '%s\n' 'classes: {datastore: {shape: cylinder}; focal: {style.stroke: "#2563EB"}}' \
    'db: DB {class: datastore}' 'a -> db' \
    'steps: {s1: {db.class: [datastore; focal]}; s2: {db.class: focal}; s3: {'"$L"'}}' > "$T/cls.d2"
  d2 "$T/cls.d2" "$T/cls.svg" > /dev/null 2>&1
  n1=$(grep -o 'stroke="#2563EB"' "$T/cls/s1.svg" 2> /dev/null | wc -l)
  n3=$(grep -o 'stroke="#2563EB"' "$T/cls/s3.svg" 2> /dev/null | wc -l)
  # db's group is <g class="ZGI= ..."> (base64 of its key); its shape is a <path> while it is a cylinder
  rect2=$(grep -c '<g class="ZGI=[^"]*"><g class="shape" ><rect' "$T/cls/s2.svg" 2> /dev/null)
  if [ "$n1" -eq 0 ] && [ "$n3" -gt 0 ] && [ "$rect2" = 1 ] && grep -q 'class="[^"]* datastore focal"' "$T/cls/s3.svg"; then
    pass "class list in a step: ignored as is; one class drops the cylinder; applied after the reset"
  else
    fail "class reset claim: list gave $n1 focal strokes, one class gave rect=$rect2, reset gave $n3"
  fi
fi

# ---- section 7: d2's own PPTX and GIF (opt-in)
L1='D="$HOME/.cache/d2-playwright/ms-playwright-go/1.47.2"'
L2='mkdir -p "$D" && (cd "$D" && npm pack playwright-core@1.47.2 && tar xzf playwright-core-1.47.2.tgz && ln -sf "$(command -v node)" node)'
L3='PLAYWRIGHT_DRIVER_PATH="$HOME/.cache/d2-playwright" d2 <flags> --scale 2 <target>.d2 <target>.pptx'
L4='PLAYWRIGHT_DRIVER_PATH="$HOME/.cache/d2-playwright" d2 <flags> --animate-interval 2000 <target>.d2 <target>.gif'
if doc "$L1" && doc "$L2" && doc "$L3" && doc "$L4"; then
  if [ -z "$NATIVE" ]; then
    skip "d2 driver install, PPTX, GIF: run with --native"
  else
    HOME="$T/home"
    export HOME
    mkdir -p "$HOME"
    FW=$(svgw "$FLOW/index.svg")
    if run "$L1 && $L2" && run "$(cmd "$L3" "$FLOW")" &&
      got=$(python3 - "$FLOW.pptx" << 'EOF'
import re, struct, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
slides = [n for n in z.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)]
w = [struct.unpack(">I", z.read(n)[16:20])[0] for n in z.namelist() if n.startswith("ppt/media/") and z.read(n)[:4] == b"\x89PNG"]
print(len(slides), max(w) if w else 0)
EOF
) && [ "$got" = "3 $((FW * 4))" ]; then
      pass "driver from npm + PPTX: 3 slides, images 4x the SVG width with --scale 2"
    else
      fail "PPTX: '$got' (want '3 $((FW * 4))') $(tail -n 2 "$T/run.log" | tr '\n' ' ')"
    fi
    if run "$(cmd "$L4" "$FLOW")" && head -c 6 "$FLOW.gif" | grep -q 'GIF89a'; then
      gw=$(python3 -c "import struct,sys; print(struct.unpack('<H', open(sys.argv[1],'rb').read(8)[6:8])[0])" "$FLOW.gif")
      [ "$gw" = $((FW * 2)) ] && pass "GIF written, 2x the SVG width at <flags>" || fail "GIF width $gw, want $((FW * 2))"
    else
      fail "GIF: $(tail -n 1 "$T/run.log")"
    fi
  fi
fi

# ---- section 8: ASCII
L="d2 --ascii-mode standard --target='' <target>.d2 <target>.txt"
if doc "$L" && run "$(cmd "$L" "$ONE")" && [ -s "$ONE.txt" ]; then
  if LC_ALL=C grep -q '[^ -~]' "$ONE.txt"; then fail "ASCII output has non-ASCII bytes"; else pass "ASCII: plain ASCII text"; fi
else
  fail "ASCII: $(tail -n 1 "$T/run.log")"
fi
if run "$(cmd "$L" "$FLOW")" && [ -s "$FLOW.txt" ] && [ -f "$FLOW/2.svg" ]; then
  pass "ASCII with --target='' works on boards and keeps <target>/"
else
  fail "ASCII --target='' on boards: $(tail -n 1 "$T/run.log")"
fi
mkdir -p "$T/mb" && echo keep > "$T/mb/keep" && cp "$T/mixed.d2" "$T/mb.d2"
if doc 'layers, scenarios, steps, no `--target` | deletes `<target>/`, then fails'; then
  if (cd "$T" && d2 --ascii-mode standard mb.d2 mb.txt) > /dev/null 2>&1 || [ -f "$T/mb/keep" ]; then
    fail "ASCII of boards without --target should delete mb/ and fail"
  else
    pass "ASCII of boards without --target deletes <target>/ and fails"
  fi
fi

# ---- section 9: watch mode in the background, pid saved in the same command
L='nohup d2 -w --browser 0 <flags> <target>.d2 D2W/watch.svg > D2W/watch.log 2>&1 & echo $! > D2W/watch.pid'
G="grep -m 1 'listening on' D2W/watch.log"
K='kill "$(cat D2W/watch.pid)"'
if doc "$L" && doc "$G" && doc "$K"; then
  run "$(cmd "$L" "$ONE")"
  WPID=$(cat "$D2_WORK/demo/watch.pid" 2> /dev/null)
  i=0
  while [ "$i" -lt 30 ] && ! [ -s "$D2_WORK/demo/watch.svg" ]; do
    sleep 0.5
    i=$((i + 1))
  done
  run "$(cmd "$G" "$ONE")"
  url=$(grep -o 'http://[^ ]*' "$T/run.log")
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2> /dev/null)
  [ "$code" = 200 ] && [ -f "$D2_WORK/demo/watch.svg" ] && pass "watch: the grep gives $url, HTTP 200, SVG written" ||
    fail "watch: grep gave '$(cat "$T/run.log")', http=$code"
  run "$(cmd "$K" "$ONE")"
  sleep 1
  # a killed child of an exited shell can linger as a zombie: dead is "Z" or gone
  st=$(ps -o stat= -p "${WPID:-0}" 2> /dev/null)
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2> /dev/null)
  case "$st" in
    '' | Z*) [ "$code" = 000 ] && pass "watch: the saved pid stops it" || fail "watch: still answering after the kill ($code)"; WPID= ;;
    *) fail "watch: still running after the kill line (pid '$WPID', state '$st')" ;;
  esac
fi

# ---- section 10: modes
L='chmod 644 <file>'
if doc "$L" && [ "$(mode "$ONE.txt")" = 600 ]; then
  chmod 644 "$ONE.txt"
  [ "$(mode "$ONE.txt")" = 644 ] && pass "d2 writes .txt as 600; chmod 644 fixes it" || fail "chmod 644"
else
  fail "d2 .txt mode is $(mode "$ONE.txt"), doc says 600"
fi
L='chmod -R a+rX <target>/'
if doc "$L" && [ "$(mode "$T/kind1/1.svg")" = 600 ] && run "$(cmd "$L" "$T/kind1")" &&
  [ "$(mode "$T/kind1/1.svg")" = 644 ] && [ "$(mode "$T/kind1")" = 755 ]; then
  pass "raw board files are 600; chmod -R a+rX makes them 644, directory 755"
else
  fail "chmod -R a+rX on a raw board directory"
fi

echo "export: $npass passed, $nskip skipped, $nfail FAILED"
[ "$nfail" = 0 ]
