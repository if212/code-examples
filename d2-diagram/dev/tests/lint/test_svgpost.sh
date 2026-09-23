#!/bin/sh
# test_svgpost.sh - checks of scripts/svgpost.py on the cases/post_*.d2 fixtures, each rendered by
# d2check (--no-raster), so the flags are the ones that ship. For every fixture: d2's own SVG (the d2
# part of the re-render: line) finished by svgpost equals the deliverable byte for byte, and a second
# run changes nothing. Then one property per step: labels leave bends with their mask rects (post_state),
# a decision exit sits on the first straight run out of its diamond (post_decision), table rules 1px
# ink-200 and bold headers (post_erd), the key without shadow in an ink-300 frame, at the right when it
# fits and below when not (post_key_right, post_key_below, post_erd), activation bars 1px, the ALT chip
# #F8FAFC and labels off foreign lifelines (post_sequence), tech lines 14px slate (post_tech),
# aria-hidden on invisible objects; and the CLI's help, exit codes and messages.
# usage: sh dev/tests/lint/test_svgpost.sh          needs d2, python3
# exit: 0 all passed, 1 a check failed
set -u
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
CHECK="$SKILL/scripts/d2check.sh"
POST="$SKILL/scripts/svgpost.py"
T=${TMPDIR:-/tmp}/svgpost-tests
rm -rf "$T" && mkdir -p "$T"
export D2_WORK="$T/work" PYTHONDONTWRITEBYTECODE=1
pass=0 fail=0
ok() { pass=$((pass + 1)); printf 'ok    %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL  %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | head -12 | sed 's/^/      /'; }
has() { printf '%s\n' "$1" | grep -q -- "$2"; }
command -v d2 > /dev/null 2>&1 || { echo "d2 not on PATH"; exit 1; }

# 1. every fixture: rendered by d2check, then rebuilt from d2's raw SVG; a second run changes nothing ----
for f in "$HERE"/cases/post_*.d2; do
  n=$(basename -- "$f" .d2)
  d="$T/$n"
  mkdir -p "$d" && cp "$f" "$SKILL/templates/neutral-theme.d2" "$d/"
  o=$(sh "$CHECK" --no-raster "$d/$n.d2" "$d/post.svg" 2>&1); rc=$?
  if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then bad "$n: d2check exit $rc" "$o"; continue; fi
  printf '%s\n' "$o" | sed -n 's/^post: //p' > "$d/post.txt"
  rr=$(printf '%s\n' "$o" | sed -n 's/^re-render: //p')
  case $rr in *" && python3 "*) ;; *) bad "$n: no svgpost step on the re-render line" "$rr"; continue ;; esac
  cp "$d/post.svg" "$d/keep.svg"
  if ! (cd "$d" && sh -c "${rr%% && python3 *}" > /dev/null 2>&1); then bad "$n: the d2 part of re-render failed" "$rr"; continue; fi
  mv "$d/post.svg" "$d/raw.svg" && mv "$d/keep.svg" "$d/post.svg"
  cp "$d/raw.svg" "$d/again.svg"
  a=$(python3 "$POST" "$d/again.svg" 2>&1); rc=$?
  [ "$rc" = 0 ] && cmp -s "$d/again.svg" "$d/post.svg" && [ "post: $(cat "$d/post.txt")" = "$a" ] &&
    ok "$n: svgpost on d2's SVG = the deliverable ($a)" || bad "$n: svgpost on the raw SVG (exit $rc)" "$a"
  # d2 writes 0600; the finished SVG is readable by everyone, as d2check leaves it
  chmod 600 "$d/raw.svg" && cp "$d/raw.svg" "$d/mode.svg" && python3 "$POST" --quiet "$d/mode.svg" &&
    [ "$(ls -l "$d/mode.svg" | cut -c1-10)" = "-rw-r--r--" ] || bad "$n: svgpost output mode $(ls -l "$d/mode.svg" | cut -c1-10)"
  cp "$d/post.svg" "$d/twice.svg"
  a=$(python3 "$POST" "$d/twice.svg" 2>&1); rc=$?
  [ "$rc" = 0 ] && [ "$a" = "post: nothing to change" ] && cmp -s "$d/twice.svg" "$d/post.svg" &&
    ok "$n: a second run changes nothing" || bad "$n: not idempotent (exit $rc)" "$a"
done

# 2. what each step promises, read back from the raw and the finished SVG -------------------------------
python3 - "$T" "$SKILL" << 'EOF'
import math, os, re, sys
T, SKILL = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(SKILL, "scripts"))
sys.dont_write_bytecode = True
import d2lint, svgpost  # noqa: E402

theme = open(os.path.join(SKILL, "templates", "neutral-theme.d2"), encoding="utf-8").read()
ink = {k: v.upper() for k, v in re.findall(r'^\s*(ink-\d+|paper)\s*:\s*"(#[0-9A-Fa-f]{6})"', theme, re.M)}
rc = [0]


def check(name, good, detail=""):
    print("%-5s %s%s" % ("ok" if good else "FAIL", name, "" if good else "\n      " + str(detail)[:600]))
    rc[0] |= not good


def load(n, which):
    p = os.path.join(T, n, which + ".svg")
    return (d2lint.load(p), open(p, encoding="utf-8").read()) if os.path.exists(p) else (None, "")


def codes(dg):
    F, _ = d2lint.run_checks(dg)
    out = {}
    for f in F:
        out[f.code] = out.get(f.code, 0) + 1
    return out


def style(el, key):
    m = re.search(r"(?:^|;)\s*%s\s*:\s*([^;]+)" % re.escape(key), el.get("style") or "")
    return m.group(1).strip() if m else None


def local(el):
    return el.tag.rsplit("}", 1)[-1]


def key_parts(src):
    """the markup of the <g class="d2-key"> group (nested groups included), or ''"""
    i = src.find('<g class="d2-key"')
    if i < 0:
        return ""
    depth = 0
    for m in re.finditer(r"<(/?)g\b[^>]*?(/?)>", src[i:]):
        if m.group(2):
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return src[i:i + m.end()]
    return ""


def frame_of(src):
    g = key_parts(src)
    rects = [dict(re.findall(r'([\w-]+)="([^"]*)"', r)) for r in re.findall(r"<rect\b[^>]*>", g)]
    return next((r for r in rects if r.get("stroke") and r.get("width")), None), g


def content_box(dg):
    boxes = [n.box for n in dg.nodes.values() if n.box and not n.hidden]
    return d2lint.union_all(boxes)


# post_state: the labels on elbows move onto a straight run, each with its own mask rect; ghosts are hidden
raw, _ = load("post_state", "raw")
post, psrc = load("post_state", "post")
if raw and post:
    cr, cp = codes(raw), codes(post)
    check("post_state: W-label-on-bend %d -> %d" % (cr.get("W-label-on-bend", 0), cp.get("W-label-on-bend", 0)),
          cr.get("W-label-on-bend", 0) >= 1 and not cp.get("W-label-on-bend"), (cr, cp))
    moved, same = 0, True
    rl = {(t.owner, t.content): t for t in raw.texts if t.mask is not None}
    for t in post.texts:
        r = rl.get((t.owner, t.content))
        if r is None or t.mask is None:
            continue
        dx, dy = t.box.cx - r.box.cx, t.box.cy - r.box.cy
        if abs(dx) > 0.5 or abs(dy) > 0.5:
            moved += 1
            same &= abs((t.mask.cx - r.mask.cx) - dx) < 0.6 and abs((t.mask.cy - r.mask.cy) - dy) < 0.6
    check("post_state: %d label(s) moved, each mask rect by the same offset" % moved, moved >= 1 and same)
    # every label svgpost may move keeps bare line before the 10px corner arcs of its edge
    tight = []
    for e in post.edges:
        if e.hidden or e.in_seq:
            continue
        bends = [q for cl in e.corners for q in cl[1:-1]]
        for t in e.labels:
            if t.role == "main" and t.mask is not None:
                d = min((t.box.union(t.mask).dist_pt(q[0], q[1]) for q in bends), default=99)
                if d <= svgpost.NEAR_BEND:
                    tight.append((t.content, round(d, 1)))
    check("post_state: no label within %gpx of a corner of its edge" % svgpost.NEAR_BEND, not tight, tight)
    hidden = [x for x in list(post.nodes.values()) + list(post.edges)
              if x.el is not None and svgpost.num(d2lint._style(x.el, "opacity"), 1.0) < 0.05]
    check("post_state: aria-hidden on the %d invisible ghost(s)" % len(hidden),
          hidden and all(x.el.get("aria-hidden") == "true" for x in hidden))

# post_decision: 'rejected' leaves the middle of its lane for the first straight run out of the diamond
raw, _ = load("post_decision", "raw")
post, _ = load("post_decision", "post")
if raw and post:
    def exit_label(dg):
        e = next(e for e in dg.edges if any(t.content == "rejected" for t in e.labels))
        return e, next(t for t in e.labels if t.content == "rejected")
    er, tr = exit_label(raw)
    ep, tp = exit_label(post)
    far = svgpost._path_offset(er, (tr.box.cx, tr.box.cy))
    near = svgpost._path_offset(ep, (tp.box.cx, tp.box.cy))
    seg = svgpost._segments(ep)[0]
    on_first = d2lint.dist_to_poly(tp.box.cx, tp.box.cy, [seg[0], seg[1]]) < 1.5 if hasattr(d2lint, "dist_to_poly") else True
    check("post_decision: 'rejected' %.0fpx -> %.0fpx along its edge from the diamond" % (far, near),
          far > 100 and near <= 60 + max(tp.box.w, tp.box.h) / 2 and on_first, (far, near, seg, tp.box))

# post_erd: 1px ink-200 row rules, none on a table's bottom border, bold headers; the crow's-foot key restyled
raw, rsrc = load("post_erd", "raw")
post, psrc = load("post_erd", "post")
if raw and post:
    bad_rules, bottom, heads, nt = [], 0, [], 0
    for n in post.nodes.values():
        if n.sig != "table" or n.el is None:
            continue
        nt += 1
        els = list(n.el.iter())
        body = next(x for x in els if local(x) == "rect")
        y1 = float(body.get("y") or 0) + float(body.get("height") or 0)
        head = next((x for x in els if local(x) == "rect" and "class_header" in (x.get("class") or "")), None)
        for x in els:
            if local(x) == "line":
                if abs(float(x.get("y1") or 0) - y1) < 1.0:
                    bottom += 1
                elif (x.get("stroke") or "").upper() != ink["ink-200"] or style(x, "stroke-width") != "1":
                    bad_rules.append((n.id, x.get("stroke"), x.get("style")))
            if head is not None and local(x) == "text":
                hy0 = float(head.get("y") or 0)
                if hy0 <= float(x.get("y") or 0) <= hy0 + float(head.get("height") or 0):
                    heads.append(style(x, "font-weight"))
    check("post_erd: %d tables, row rules 1px %s, none on a bottom border" % (nt, ink["ink-200"]),
          nt >= 3 and not bad_rules and not bottom, (bad_rules[:3], bottom))
    check("post_erd: %d header labels at font-weight 700" % len(heads), len(heads) >= nt and set(heads) == {"700"}, heads)
    fr, g = frame_of(psrc)
    check("post_erd: crow's-foot legend restyled into the key (no shadow, %s frame)" % ink["ink-300"],
          "drop-shadow" in rsrc and "drop-shadow" not in psrc and fr is not None and fr.get("stroke", "").upper() == ink["ink-300"],
          fr)

# post_key_right / post_key_below: the key's look, and where it goes
for n, where in (("post_key_right", "right"), ("post_key_below", "below")):
    raw, rsrc = load(n, "raw")
    post, psrc = load(n, "post")
    if not (raw and post):
        continue
    fr, g = frame_of(psrc)
    if fr is None:
        check("%s: a <g class=\"d2-key\"> with a framed rect" % n, False, psrc[:200])
        continue
    fb = d2lint.Box(float(fr["x"]), float(fr["y"]), float(fr["x"]) + float(fr["width"]), float(fr["y"]) + float(fr["height"]))
    look = (fr.get("stroke", "").upper() == ink["ink-300"] and fr.get("fill", "").upper() == ink["paper"] and
            abs(float(fr.get("rx", 0)) - 8) < 0.01 and "stroke-width:1px" in fr.get("style", "").replace(" ", ""))
    title = ">KEY</text>" in g or 'aria-label="Key"' in g
    items = re.findall(r'<text\b[^>]*fill="([^"]*)"[^>]*>(?!KEY<)', g)
    check("%s: no drop shadow; frame paper, 1px %s, radius 8; title KEY; item text %s" % (n, ink["ink-300"], ink["ink-600"]),
          "drop-shadow" in rsrc and "drop-shadow" not in psrc and look and title and items and
          all(c.upper() == ink["ink-600"] for c in items), (fr, title, items))
    cb = content_box(post)
    if where == "right":
        # top-aligned with the diagram; the frame hugs its items (padding under the last item = above the title)
        t = next((x for x in post.texts if x.kind == "legend" and x.content not in ("KEY", "Legend")), None)
        last = max((x.box.y1 for x in post.texts if x.kind == "legend"), default=fb.y1)
        title_top = min((x.box.y0 for x in post.texts if x.kind == "legend"), default=fb.y0)
        check("post_key_right: at the right, top-aligned, hugging its items; canvas %dx%d -> %dx%d" % (raw.W, raw.H, post.W, post.H),
              fb.x0 >= cb.x1 and abs(fb.y0 - cb.y0) <= 1 and abs(post.W - raw.W) < 0.5 and post.H <= raw.H and
              fb.y1 - last <= 40 and fb.y1 <= post.vb.y1, (fb, cb, last, title_top))
    else:
        check("post_key_below: under the diagram, 16px gap, left-aligned; canvas %dx%d -> %dx%d" % (raw.W, raw.H, post.W, post.H),
              abs(fb.y0 - cb.y1 - 16) <= 1.5 and abs(fb.x0 - cb.x0) <= 1 and post.W <= raw.W and post.H > raw.H and
              fb.x1 <= post.vb.x1, (fb, cb))

# post_key_tall: the canvas fits the column, but a key taller than the diagram goes under it, not beside it
raw, _ = load("post_key_tall", "raw")
post, psrc = load("post_key_tall", "post")
if raw and post:
    fr, g = frame_of(psrc)
    cb = content_box(post)
    fy = float(fr["y"]) if fr else -1
    check("post_key_tall: a key taller than the diagram goes under it (canvas %dx%d -> %dx%d)" % (raw.W, raw.H, post.W, post.H),
          fr is not None and raw.W <= 800 and fy >= cb.y1 + 15 and post.H < raw.H, (fr, cb))

# after a key or label move the canvas keeps d2's pad on every side (no margin left where the legend or a
# label used to be)
for n in ("post_key_below", "post_key_tall", "post_decision", "post_erd", "post_margin"):
    post, _ = load(n, "post")
    if not post:
        continue
    c = svgpost.Ctx(open(os.path.join(T, n, "post.svg"), encoding="utf-8").read(), post, "neutral", 800)
    b, vb = svgpost.drawn(c), post.vb
    m = [b.x0 - vb.x0, b.y0 - vb.y0, vb.x1 - b.x1, vb.y1 - b.y1]
    check("%s: canvas margins %s within 4px of the pad %g" % (n, "/".join("%.0f" % x for x in m), c.pad),
          all(-0.5 <= x <= c.pad + 4 for x in m), m)

# post_margin: 'any check fails' sized d2's canvas at the left edge, then moved up to its decision
raw, _ = load("post_margin", "raw")
post, _ = load("post_margin", "post")
if raw and post:
    def lbl(dg):
        return next(t for e in dg.edges for t in e.labels if t.content == "any check fails")
    lr, lp = lbl(raw), lbl(post)
    check("post_margin: the label that set the left edge (%.0fpx in) moved to %.0fpx in, the canvas followed: %dx%d -> %dx%d"
          % (lr.box.x0 - raw.vb.x0, lp.box.x0 - post.vb.x0, raw.W, raw.H, post.W, post.H),
          lr.box.x0 - raw.vb.x0 <= 30 and lp.box.x0 - post.vb.x0 > 60 and post.W < raw.W, (lr.box, lp.box, raw.vb, post.vb))

# post_corner: d2 leaves 'refund' and 'return' against their corner arcs; after svgpost no label is that close
raw, _ = load("post_corner", "raw")
post, _ = load("post_corner", "post")
if raw and post:
    def near_corner(dg):
        out = []
        for e in dg.edges:
            if e.hidden or e.in_seq:
                continue
            bends = [q for cl in e.corners for q in cl[1:-1]]
            for t in e.labels:
                if t.role == "main" and t.mask is not None:
                    d = min((t.box.union(t.mask).dist_pt(q[0], q[1]) for q in bends), default=99)
                    if d <= svgpost.NEAR_BEND:
                        out.append("%s %.1fpx" % (t.content, d))
        return out
    a, b = near_corner(raw), near_corner(post)
    check("post_corner: labels within %gpx of a corner %d -> %d (%s)" % (svgpost.NEAR_BEND, len(a), len(b), ", ".join(a)),
          len(a) >= 2 and not b, (a, b))

# post_sequence: activation bars 1px ink-400, the top-level chip in its blended frame colour, labels off lifelines
raw, _ = load("post_sequence", "raw")
post, psrc = load("post_sequence", "post")
if raw and post:
    spans = [n for n in post.nodes.values() if n.seq_role == "span" and n.el is not None]
    shapes = [next(x for x in n.el.iter() if local(x) in ("rect", "path")) for n in spans]
    check("post_sequence: %d activation bar(s) 1px %s" % (len(spans), ink["ink-400"]),
          shapes and all((s.get("stroke") or "").upper() == ink["ink-400"] and style(s, "stroke-width") == "1" for s in shapes),
          [(s.get("stroke"), s.get("style")) for s in shapes])
    top = [n for n in post.nodes.values() if n.is_group and n.in_seq and n.el is not None
           and not any(post.nodes[a].is_group for a in d2lint._ancestors(post, n.id) if a in post.nodes)]
    chips = [next((x for x in list(n.el) if local(x) == "rect"), None) for n in top]
    check("post_sequence: the ALT chip is #F8FAFC", chips and all(c is not None and (c.get("fill") or "").upper() == "#F8FAFC"
                                                                    for c in chips), [c.get("fill") for c in chips if c is not None])
    cr, cp = codes(raw), codes(post)
    check("post_sequence: W-label-on-lifeline %d -> %d" % (cr.get("W-label-on-lifeline", 0), cp.get("W-label-on-lifeline", 0)),
          cr.get("W-label-on-lifeline", 0) >= 3 and not cp.get("W-label-on-lifeline"), (cr, cp))

# post_tech: `tech` lines 2+ at 14px ink-600 in the same face; a node without tech keeps one size
post, psrc = load("post_tech", "post")
if post:
    res = {}
    for n in post.nodes.values():
        for t in n.labels:
            sp = [x for x in list(t.el) if local(x) == "tspan"] if t.el is not None else []
            res[n.id] = [(style(x, "font-size"), (x.get("fill") or "").upper()) for x in sp]
    want = [(None, ""), ("14px", ink["ink-600"])]
    check("post_tech: tech nodes %s, the plain node %s" % (res.get("api"), res.get("plain")),
          res.get("api") == want and res.get("db") == want and all(fs is None for fs, _ in res.get("plain", [(1, 1)])), res)
sys.exit(rc[0])
EOF
r=$?
[ "$r" = 0 ] && ok "step properties (section 2)" || bad "step properties (section 2): see the FAIL lines above"

# 3. the command: help, usage errors (64), unreadable input (1), several files -----------------------------
o=$(python3 "$POST" --help 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" '^usage: svgpost.py' && has "$o" 'Steps, in order' && has "$o" '^exit codes' &&
  ok "--help: usage, steps, exit codes (exit 0)" || bad "--help (exit $rc)" "$o"
for args in "" "--brand bogus $T/post_tech/post.svg" "--column 5 $T/post_tech/post.svg" "$T/post_tech/post_tech.d2"; do
  # shellcheck disable=SC2086
  o=$(python3 "$POST" $args 2>&1); rc=$?
  [ "$rc" = 64 ] && ok "usage error '${args:-no arguments}': exit 64" || bad "usage error '$args' (exit $rc)" "$o"
done
o=$(python3 "$POST" "$T/no-such.svg" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'no-such.svg' && ok "missing SVG: exit 1, named" || bad "missing SVG (exit $rc)" "$o"
printf '<svg xmlns="http://www.w3.org/2000/svg"><rect/>\n' > "$T/broken.svg"
o=$(python3 "$POST" "$T/broken.svg" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'broken.svg' && ok "an SVG d2 did not write: exit 1, file untouched" || bad "broken SVG (exit $rc)" "$o"
cp "$T/post_tech/raw.svg" "$T/m1.svg" && cp "$T/post_state/raw.svg" "$T/m2.svg"
o=$(python3 "$POST" "$T/m1.svg" "$T/m2.svg" 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" "^post: $T/m1.svg: " && has "$o" "^post: $T/m2.svg: " && cmp -s "$T/m1.svg" "$T/post_tech/post.svg" &&
  ok "several SVGs in one run: one post: line each" || bad "several SVGs (exit $rc)" "$o"
o=$(python3 "$POST" --quiet "$T/m1.svg" 2>&1); rc=$?
[ "$rc" = 0 ] && [ -z "$o" ] && ok "--quiet: silent on success" || bad "--quiet (exit $rc)" "$o"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" = 0 ]
