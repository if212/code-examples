#!/usr/bin/env python3
"""svgpost - finish what d2 draws: the d2-diagram skill's SVG post-processor (python3 stdlib only).

d2check.sh runs it on every rendered SVG, after d2 and before the lint; its re-render: line ends with it,
so that line reproduces the deliverable byte for byte. Run it yourself only on an SVG you rendered with d2.

usage: python3 svgpost.py [--brand neutral|snowflake] [--column N] [--quiet] OUT.svg [OUT2.svg ...]
  --brand   the theme the diagram imports (d2check detects it): colours come from its vars
  --column  the doc column the key must fit beside the diagram (default 800)
  --quiet   print nothing on success
Steps, in order (a second run changes nothing):
  1. text-rendering: geometricPrecision in the <style> (Chromium lays labels out at the font's advances)
  2. relabel: an edge label on a bend (within 14px of the corner: d2's 10px arc plus 4px of bare line),
     across a container border, on a lifeline its message does not touch, or (decision exits) far from its
     decision moves along its own edge - decision exits to the first straight run from the decision,
     sequence messages to the widest lifeline gap they span, others to the longest straight run - to the
     first spot that hits no node, label or other edge; its mask moves with it. No free spot: the label
     stays and the lint reports it.
  3. tables: sql_table / class row rules 1px ink-200 (the rule on the bottom border goes); header bold
  4. key: the native legend (vars.d2-legend) in the design system - no shadow, paper frame with an ink-300
     outline, title KEY, slate item text, 1px node swatches - kept at the right when the canvas fits the
     column and the key is no taller than the diagram (top-aligned with the diagram, the frame hugging its
     items, d2's pad to the canvas edge), else re-flowed into rows under the diagram (the canvas grows in
     height); wrapped in <g class="d2-key">, which the lint and the semantic check skip
  5. sequence: activation bars 1px ink-400; a group title's chip in its frame's blended colour; a group
     title that covers a lifeline or bar slides right past it
  6. tech: in nodes with class `tech`, label lines 2 and later at 14px ink-600 (same face)
  7. aria-hidden="true" on invisible (opacity 0) groups
  8. fit: after a label, title or the key moved, a margin wider than d2's pad (where the moved thing used
     to be) is trimmed back to the pad; invisible ghosts keep their space
The file stays readable by everyone (mode 644), as d2check leaves it.
Prints one line: post: <what changed>; "no fixes needed" when only step 1 applied, "nothing to change"
when the file was already finished.
exit codes (the skill's convention; semcheck.py differs):
  0 done | 1 an input cannot be read as a d2 SVG, or cannot be written | 64 usage error
examples:
  python3 svgpost.py docs/flow.svg
  d2 in.d2 out.svg && python3 svgpost.py --brand snowflake out.svg
"""
import argparse
import base64
import glob
import math
import os
import re
import struct
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep the skill's scripts/ free of __pycache__
import d2lint  # noqa: E402
from d2lint import Box  # noqa: E402

SKILL = os.path.dirname(HERE)
PALETTE = {  # FIXPLAN I4: the names svgpost reads from the imported theme's vars (fallback values)
    "neutral": {"paper": "#FFFFFF", "ink-200": "#E2E8F0", "ink-300": "#CBD5E1", "ink-400": "#7A889C",
                "ink-600": "#475569", "ink-900": "#1E293B"},
    "snowflake": {"sf-rule": "#BCE3F7", "sf-mid-blue": "#11567F", "sf-gray": "#5B5B5B"},
}
THEME_FILE = {"neutral": "neutral-theme.d2", "snowflake": "snowflake-brand.d2"}
DIAMOND = "path:MCLCLCLCLCZ"  # d2lint's signature of shape: diamond
# d2 rounds every corner of an ELK route with a 10px arc; a label needs bare line between its mask and the
# arc (else the text runs into the curve), and room for the arrowhead at an end of the edge
ARC, AIR, END = 10.0, 4.0, 12.0
NEAR_BEND = ARC + AIR  # a label mask this close to a corner is on the bend


# ----------------------------------------------------------------------------------------------------
# the SVG as text: elements with their offsets, in the order ElementTree iterates them
# ----------------------------------------------------------------------------------------------------

_TOKEN = re.compile(r"<!\[CDATA\[.*?\]\]>|<!--.*?-->|<\?.*?\?>|<!DOCTYPE[^>]*>|"
                    r"<(/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:\"[^\"]*\"|'[^']*'))?)*)\s*(/?)>", re.S)
_ATTR = re.compile(r"([^\s=/>]+)(?:\s*=\s*(?:\"([^\"]*)\"|'([^']*)'))?")


class El:
    __slots__ = ("tag", "start", "tag_end", "end", "attrs", "parent", "idx")

    def __init__(self, tag, start, tag_end, attrs, parent, idx):
        self.tag, self.start, self.tag_end, self.attrs, self.parent, self.idx = tag, start, tag_end, attrs, parent, idx
        self.end = tag_end


def scan(raw, skip_foreign=False):
    """every element of the SVG text, in document order (the order of ElementTree's iter())"""
    out, stack = [], []
    for m in _TOKEN.finditer(raw):
        if m.group(2) is None:
            continue  # CDATA, comment, processing instruction
        closing, tag, attrs, selfclose = m.group(1), m.group(2), m.group(3) or "", m.group(4)
        if closing:
            while stack:
                el = stack.pop()
                el.end = m.end()
                if el.tag == tag:
                    break
            continue
        inside_fo = skip_foreign and any(s.tag == "foreignObject" for s in stack)
        a = {k: (v1 if v1 is not None else v2) for k, v1, v2 in _ATTR.findall(attrs)}
        el = El(tag, m.start(), m.end(), a, stack[-1] if stack else None, len(out))
        if not inside_fo:
            out.append(el)
        if not selfclose:
            stack.append(el)
    return out


class Editor:
    """text edits on the raw SVG: attribute changes, deletions, insertions, replaced text content"""

    def __init__(self, raw, els):
        self.raw, self.els = raw, els
        self.attrs = {}     # El -> {name: value}
        self.cuts = []      # (start, end, text)

    def set(self, el, name, value):
        self.attrs.setdefault(el, {})[name] = value

    def get(self, el, name):
        return self.attrs.get(el, {}).get(name, el.attrs.get(name))

    def style(self, el, **kv):
        """merge css declarations into the element's style attribute"""
        st = self.get(el, "style") or ""
        decl = [d.strip() for d in st.split(";") if d.strip()]
        keys = [d.split(":", 1)[0].strip() for d in decl]
        for k, v in kv.items():
            k = k.replace("_", "-")
            item = "%s:%s" % (k, v)
            if k in keys:
                decl[keys.index(k)] = item
            else:
                decl.append(item)
                keys.append(k)
        self.set(el, "style", ";".join(decl) + (";" if st.rstrip().endswith(";") else ""))

    def delete(self, el):
        self.cuts.append((el.start, el.end, ""))

    def insert(self, pos, text):
        self.cuts.append((pos, pos, text))

    def content(self, el, text):
        close = self.raw.rfind("</", el.tag_end, el.end)
        self.cuts.append((el.tag_end, close, text))

    def changed(self):
        return bool(self.cuts) or any(self.attrs.values())

    def apply(self):
        cuts = list(self.cuts)
        for el, kv in self.attrs.items():
            tag = self.raw[el.start:el.tag_end]
            for k, v in kv.items():
                v = str(v).replace('"', "&quot;")
                pat = re.compile(r'(\s%s=")[^"]*(")' % re.escape(k))
                if pat.search(tag):
                    tag = pat.sub(lambda m: m.group(1) + v + m.group(2), tag, count=1)
                else:
                    end = len(tag) - (2 if tag.endswith("/>") else 1)
                    while end > 0 and tag[end - 1] == " ":
                        end -= 1
                    tag = tag[:end] + ' %s="%s"' % (k, v) + tag[end:]
            cuts.append((el.start, el.tag_end, tag))
        # insertions at a point go before a replacement that starts there
        cuts.sort(key=lambda c: (c[0], 0 if c[1] == c[0] else 1))
        out, pos = [], 0
        for s, e, t in cuts:
            if s < pos:
                raise ValueError("overlapping edits at %d" % s)
            out.append(self.raw[pos:s])
            out.append(t)
            pos = e
        out.append(self.raw[pos:])
        return "".join(out)


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def fmt(v):
    return "%.6f" % v


def hexcol(c):
    return "#%02X%02X%02X" % tuple(int(round(x)) for x in c)


def palette(brand):
    """the theme's colour tokens, read from the skill's copy of the theme (fallback: the built-in values)"""
    pal = dict(PALETTE["neutral"])
    if brand == "snowflake":
        pal.update(PALETTE["snowflake"])
    try:
        src = open(os.path.join(SKILL, "templates", THEME_FILE[brand]), encoding="utf-8").read()
        for k, v in re.findall(r'^\s*([a-z][a-z0-9-]*)\s*:\s*"(#[0-9A-Fa-f]{6})"', src, re.M):
            pal[k] = v.upper()
    except OSError:
        pass
    if brand == "snowflake":
        pal.update({"rule": pal["sf-rule"], "frame": "#FFFFFF", "frame-stroke": pal["sf-rule"], "radius": 6,
                    "title": pal["sf-mid-blue"], "text": pal["sf-gray"], "span": pal["sf-mid-blue"]})
    else:
        pal.update({"rule": pal["ink-200"], "frame": pal["paper"], "frame-stroke": pal["ink-300"], "radius": 8,
                    "title": pal["ink-600"], "text": pal["ink-600"], "span": pal["ink-400"]})
    return pal


# ----------------------------------------------------------------------------------------------------
# glyph outlines from a bundled TrueType font (the key title, when d2's font subset lacks its letters)
# ----------------------------------------------------------------------------------------------------


class TTF:
    def __init__(self, path):
        d = open(path, "rb").read()
        n = struct.unpack(">H", d[4:6])[0]
        self.t = {}
        for i in range(n):
            tag, _, off, ln = struct.unpack(">4sIII", d[12 + 16 * i:28 + 16 * i])
            self.t[tag.decode("latin1")] = d[off:off + ln]
        self.upem = struct.unpack(">H", self.t["head"][18:20])[0]
        nh = struct.unpack(">H", self.t["hhea"][34:36])[0]
        hm = self.t["hmtx"]
        self.adv = [struct.unpack(">H", hm[i * 4:i * 4 + 2])[0] for i in range(nh)]
        self.cmap = d2lint.FontMetrics._cmap(self.t["cmap"])
        ng = struct.unpack(">H", self.t["maxp"][4:6])[0]
        lo = self.t["loca"]
        if struct.unpack(">h", self.t["head"][50:52])[0] == 1:
            self.loca = struct.unpack(">%dI" % (ng + 1), lo[:4 * (ng + 1)])
        else:
            self.loca = [v * 2 for v in struct.unpack(">%dH" % (ng + 1), lo[:2 * (ng + 1)])]

    def advance(self, cp):
        g = self.cmap.get(cp)
        return None if g is None else self.adv[g if g < len(self.adv) else -1]

    def contours(self, gid, depth=0):
        """[[(x, y, on_curve), ...], ...] in font units; composite glyphs with x/y offsets are resolved"""
        gl = self.t["glyf"]
        a, b = self.loca[gid], self.loca[gid + 1]
        if b - a < 10:
            return []
        nc = struct.unpack(">h", gl[a:a + 2])[0]
        p = a + 10
        if nc < 0:
            if depth > 4:
                return []
            out, more = [], True
            while more:
                flags, comp = struct.unpack(">HH", gl[p:p + 4])
                p += 4
                if flags & 1:
                    dx, dy = struct.unpack(">hh", gl[p:p + 4])
                    p += 4
                else:
                    dx, dy = struct.unpack(">bb", gl[p:p + 2])
                    p += 2
                if not flags & 2 or flags & (8 | 0x40 | 0x80):
                    raise ValueError("unsupported composite glyph")
                out += [[(x + dx, y + dy, on) for x, y, on in c] for c in self.contours(comp, depth + 1)]
                more = bool(flags & 0x20)
            return out
        ends = struct.unpack(">%dH" % nc, gl[p:p + 2 * nc])
        p += 2 * nc
        ilen = struct.unpack(">H", gl[p:p + 2])[0]
        p += 2 + ilen
        npts = ends[-1] + 1 if ends else 0
        flags = []
        while len(flags) < npts:
            f = gl[p]
            p += 1
            flags.append(f)
            if f & 8:
                r = gl[p]
                p += 1
                flags += [f] * r
        xs, ys = [], []
        for coords, short, same in ((xs, 2, 16), (ys, 4, 32)):
            v = 0
            for f in flags:
                if f & short:
                    d = gl[p]
                    p += 1
                    v += d if f & same else -d
                elif not f & same:
                    v += struct.unpack(">h", gl[p:p + 2])[0]
                    p += 2
                coords.append(v)
        out, s = [], 0
        for e in ends:
            out.append([(xs[i], ys[i], bool(flags[i] & 1)) for i in range(s, e + 1)])
            s = e + 1
        return out

    def path(self, text, size, x, baseline):
        """SVG path data of `text` set at `size` px from (x, baseline); None when a glyph is missing"""
        k = size / self.upem
        parts = []
        for ch in text:
            gid = self.cmap.get(ord(ch))
            if gid is None:
                return None, 0
            for c in self.contours(gid):
                if not c:
                    continue
                pts = [(x + px * k, baseline - py * k, on) for px, py, on in c]
                # start on an on-curve point (or the midpoint of two off-curve ones)
                i0 = next((i for i, q in enumerate(pts) if q[2]), None)
                if i0 is None:
                    a, b = pts[0], pts[1]
                    pts = [((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, True)] + pts[1:] + pts[:1]
                    i0 = 0
                pts = pts[i0:] + pts[:i0]
                d = ["M%.2f %.2f" % pts[0][:2]]
                ctrl = None
                for q in pts[1:] + [pts[0]]:
                    if q[2]:
                        d.append("Q%.2f %.2f %.2f %.2f" % (ctrl[0], ctrl[1], q[0], q[1]) if ctrl else "L%.2f %.2f" % q[:2])
                        ctrl = None
                    elif ctrl:
                        mx, my = (ctrl[0] + q[0]) / 2, (ctrl[1] + q[1]) / 2
                        d.append("Q%.2f %.2f %.2f %.2f" % (ctrl[0], ctrl[1], mx, my))
                        ctrl = q
                    else:
                        ctrl = q
                d.append("Z")
                parts.append("".join(d))
            x += self.advance(ord(ch)) * k
        return "".join(parts), x


def matching_font(fm):
    """the bundled bold TrueType file whose advances match the embedded (subset) bold face, or None"""
    if fm is None or not fm.adv:
        return None
    for path in sorted(glob.glob(os.path.join(SKILL, "assets", "fonts", "*", "*-Bold.ttf"))):
        try:
            f = TTF(path)
        except (OSError, KeyError, struct.error, ValueError):
            continue
        if f.upem != fm.upem:
            continue
        if all(f.advance(cp) == a for cp, a in fm.adv.items() if cp > 32):
            return f
    return None


# ----------------------------------------------------------------------------------------------------
# the steps
# ----------------------------------------------------------------------------------------------------


class Ctx:
    def __init__(self, raw, dg, brand, column):
        self.raw, self.dg, self.brand, self.column = raw, dg, brand, column
        self.els = scan(raw, dg.cleaned)
        ets = list(dg.root.iter())
        if len(ets) != len(self.els) or any(d2lint._local(a.tag) != b.tag.split(":")[-1] for a, b in zip(ets, self.els)):
            raise ValueError("the SVG text and its parse disagree (%d/%d elements)" % (len(ets), len(self.els)))
        self.of = {id(e): el for e, el in zip(ets, self.els)}
        self.ed = Editor(raw, self.els)
        self.pal = palette(brand)
        self.done = []
        self.vb = dg.vb          # the canvas as it stands (resize() keeps it current)
        self.key_box = None      # the key's frame once step_key has placed it
        self.moved = False       # a label, title or the key left its place: step_fit checks the margins
        # d2's pad: the drawing's margin at the top and left, where the native legend never sits
        b = drawn(self, legend=False)
        self.pad = max(8.0, min(b.x0 - dg.vb.x0, b.y0 - dg.vb.y0)) if b else 24.0

    def el(self, et):
        return self.of.get(id(et)) if et is not None else None


def drawn(c, legend=True):
    """the box of everything the diagram draws where it is now: moved labels at their new places, the key
    where step_key put it, and the invisible ghosts too (they hold their space on purpose)"""
    dg = c.dg
    boxes = [n.box for n in dg.nodes.values() if n.box]
    for e in dg.edges:
        if e.box:
            boxes.append(e.box)
        boxes += [t.box for t in e.labels]
    boxes += [t.box for t in dg.texts if t.kind != "legend"]
    if legend:
        k = c.key_box if c.key_box is not None else dg.legend
        if k is not None:
            boxes.append(k)
    return d2lint.union_all(boxes)


def step_fit(c):
    """a label moved off the canvas edge, or the key moved under the diagram, leaves a margin wider than d2's
    pad on that side: trim it back to the pad (never grow, never cut into anything drawn)"""
    b = drawn(c)
    if b is None or not c.moved:
        return
    vb, pad, slack = c.vb, c.pad, 4.0
    x0 = vb.x0 if b.x0 - vb.x0 <= pad + slack else math.floor(b.x0 - pad)
    y0 = vb.y0 if b.y0 - vb.y0 <= pad + slack else math.floor(b.y0 - pad)
    x1 = vb.x1 if vb.x1 - b.x1 <= pad + slack else math.ceil(b.x1 + pad)
    y1 = vb.y1 if vb.y1 - b.y1 <= pad + slack else math.ceil(b.y1 + pad)
    if (x0, y0, x1, y1) != (vb.x0, vb.y0, vb.x1, vb.y1):
        resize(c, x0, y0, math.ceil(x1 - x0), math.ceil(y1 - y0))


def step_precision(c):
    if re.search(r"text-rendering\s*:\s*geometricPrecision", c.raw):
        return
    i = c.raw.find('<style type="text/css"><![CDATA[')
    if i >= 0:
        c.ed.insert(i + len('<style type="text/css"><![CDATA['), ".d2-svg text{text-rendering:geometricPrecision}")


def _seg_pts(pts, step=2.0):
    return d2lint.densify(pts, step)


class Scene:
    """what a moved label must stay clear of"""

    def __init__(self, dg):
        self.dg = dg
        vis = [n for n in dg.nodes.values() if not n.hidden and n.box]
        self.leaves = [n for n in vis if not n.is_container and not n.is_group]
        self.containers = [n for n in vis if (n.is_container or n.is_group) and not n.in_seq]
        self.edges = [e for e in dg.edges if not e.hidden and e.lines]
        self.dense = {id(e): [p for l in e.lines for p in _seg_pts(l)] for e in self.edges}

    @staticmethod
    def hits_shape(n, g):
        """the box reaches into the node's outline (a diamond, oval or cylinder is not its bounding box)"""
        if n.sig in ("rect", "text", "table", "markdown") or not n.polys:
            return True
        poly = n.core_poly or n.polys[0]
        pts = [(x, y) for x in d2lint._frange(g.x0, g.x1, 3.0) for y in d2lint._frange(g.y0, g.y1, 3.0)]
        return any(d2lint.point_in_poly(x, y, poly) for x, y in pts) or \
            any(d2lint.dist_to_poly(x, y, poly) < 1.0 for x, y in pts[::3])

    def clear(self, t, e, glyph, mask):
        area = glyph.union(mask)
        g = area.grow(3)
        if not g.inside(self.dg.vb):
            return False
        for n in self.leaves:
            if n.box.intersects(g, 0) and self.hits_shape(n, g):
                return False
        for o in self.dg.texts:
            if o is not t and o.box.intersects(g, 0):
                return False
        for o in self.edges:
            if o is e or not o.box or not o.box.intersects(g, -1):
                continue
            if any(g.contains_pt(p[0], p[1]) for p in self.dense[id(o)]):
                return False
        for cn in self.containers:
            if cn.box.intersects(g, 0) and not g.inside(cn.box.shrink(1)):
                return False
        bends = [p for cl in e.corners for p in cl[1:-1]]
        return not any(area.dist_pt(p[0], p[1]) <= NEAR_BEND or math.hypot(p[0] - area.cx, p[1] - area.cy) <= 9
                       for p in bends)


def _on_bend(t, e):
    """the label runs into a corner of its own edge: its mask within NEAR_BEND of a bend (d2lint's
    W-label-on-bend flags 10px, where the text already covers the arc; this also moves the ones that touch it)"""
    area = t.box.union(t.mask) if t.mask else t.box.grow(3)
    bends = [p for cl in e.corners for p in cl[1:-1]]
    return any(area.dist_pt(p[0], p[1]) <= NEAR_BEND or math.hypot(p[0] - t.box.cx, p[1] - t.box.cy) <= 8 for p in bends)


def _on_border(dg, t, e, containers):
    pts = [(t.box.x0 + dx, t.box.y0 + dy) for dx in d2lint._frange(0, t.box.w, 2.0) for dy in d2lint._frange(0, t.box.h, 2.0)]
    for c in containers:
        if not c.box.intersects(t.box, 1.0) or t.box.inside(c.box.shrink(1)):
            continue
        inside = sum(1 for (x, y) in pts if c.contains_pt(x, y, 0))
        if 0 < inside < len(pts) and min(inside, len(pts) - inside) >= 4:
            return True
    return False


def _is_decision(n):
    return n is not None and ("decision" in n.classes or n.sig == DIAMOND)


def _path_offset(e, pt):
    """distance along the edge's route from its tail to the point nearest `pt`"""
    tail_first = e.arrow != "<-"
    pts = [p for c in e.corners for p in c]
    if not tail_first:
        pts = pts[::-1]
    best, acc, at = 1e18, 0.0, 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L:
            u = max(0.0, min(1.0, ((pt[0] - a[0]) * (b[0] - a[0]) + (pt[1] - a[1]) * (b[1] - a[1])) / (L * L)))
            q = (a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1]))
            d = math.hypot(pt[0] - q[0], pt[1] - q[1])
            if d < best:
                best, at = d, acc + u * L
        acc += L
    return at


def _segments(e, from_tail=True):
    """the axis-parallel straight runs of the edge, tail first: (a, b, a_is_bend, b_is_bend)"""
    out = []
    for c in e.corners:
        n = len(c)
        for i in range(n - 1):
            a, b = c[i], c[i + 1]
            if abs(a[0] - b[0]) > 1 and abs(a[1] - b[1]) > 1:
                continue  # diagonal: labels stay off it
            out.append((a, b, i > 0, i + 1 < n - 1))
    if (e.arrow == "<-") == from_tail:
        out = [(b, a, bb, ab) for a, b, ab, bb in out[::-1]]
    return out


def _spots(seg, w, h, near_start=False):
    """label centres along one straight run, the mask clear of its corner arcs and of the arrowhead"""
    a, b, abend, bbend = seg
    horiz = abs(a[1] - b[1]) <= 1
    L = abs(b[0] - a[0]) if horiz else abs(b[1] - a[1])
    ext = w if horiz else h
    lo = (NEAR_BEND + 1 if abend else END) + ext / 2
    hi = L - (NEAR_BEND + 1 if bbend else END) - ext / 2
    if hi < lo:
        return []
    if near_start:  # as close to the decision as its outline allows: step away from it 4px at a time
        ds = [lo + 4 * k for k in range(0, 21) if lo + 4 * k <= hi]
    else:
        ds = [lo + (hi - lo) * t for t in (0.5, 0.35, 0.65, 0.2, 0.8, 0.05, 0.95)]
    out = []
    for d in ds:
        f = d / L if L else 0
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
    return out


def _spot_at(seg, w, h, at):
    """the label centre on one straight run whose along-run coordinate is `at`, if the label fits there"""
    a, b, abend, bbend = seg
    horiz = abs(a[1] - b[1]) <= 1
    i = 0 if horiz else 1
    ext = (w if horiz else h) / 2
    lo_end, hi_end = (a, b) if a[i] <= b[i] else (b, a)
    lo_pad = NEAR_BEND + 1 if (abend if lo_end is a else bbend) else END
    hi_pad = NEAR_BEND + 1 if (bbend if hi_end is b else abend) else END
    if not lo_end[i] + lo_pad + ext <= at <= hi_end[i] - hi_pad - ext:
        return None
    return (at, a[1]) if horiz else (a[0], at)


def _near_decision(e, t):
    """a label within reach of the decision its edge leaves (the 'far' test of step_relabel, negated)"""
    return _path_offset(e, (t.box.cx, t.box.cy)) <= 60 + max(t.box.w, t.box.h) / 2


def step_relabel(c):
    dg = c.dg
    sc = Scene(dg)
    actors = {n.id for n in dg.nodes.values() if n.seq_role == "actor"}
    vis = [n for n in dg.nodes.values() if not n.hidden and n.box]
    lifeline_warn = {}
    for f in d2lint.labels_on_lifelines(dg, vis):
        if f.objs and f.msg.startswith("label "):
            lifeline_warn.setdefault(f.objs[0], True)
    moved = 0
    for e in list(sc.edges):
        if e.lifeline or e.curved:
            continue
        for t in e.labels:
            if t.role != "main" or t.mask is None or t.el is None:
                continue
            tail = e.dst if e.arrow == "<-" else e.src
            dec = _is_decision(dg.nodes.get(tail))
            far = dec and _path_offset(e, (t.box.cx, t.box.cy)) > 60 + max(t.box.w, t.box.h) / 2
            if e.in_seq:
                trig = lifeline_warn.get(e.id, False)
            else:
                trig = _on_bend(t, e) or _on_border(dg, t, e, sc.containers) or far
            if not trig:
                continue
            w, h = t.mask.w, t.mask.h
            cands = []
            if e.in_seq:
                if n_corners(e):
                    continue  # a self-message loops: leave it
                pts = [p for cl in e.corners for p in cl]
                y = pts[0][1]
                xa, xb = min(p[0] for p in pts), max(p[0] for p in pts)
                cuts = [xa, xb]
                for o in dg.edges:
                    if o.lifeline and o.lines:
                        x = o.lines[0][0][0]
                        if xa < x < xb:
                            cuts.append(x)
                for n in sc.leaves:
                    if n.seq_role == "span" and n.box.y0 - 1 <= y <= n.box.y1 + 1:
                        cuts += [x for x in (n.box.x0, n.box.x1) if xa < x < xb]
                cuts.sort()
                gaps = sorted(((b - a, a, b) for a, b in zip(cuts, cuts[1:])), reverse=True)
                cands = [((a + b) / 2, y) for gw, a, b in gaps if gw >= w + 8]
            else:
                segs = _segments(e)
                if dec:
                    # level with a sibling exit's label that already sits by the diamond: the two read as one choice
                    for o in sc.edges:
                        if o is e or (o.dst if o.arrow == "<-" else o.src) != tail or not segs:
                            continue
                        for ot in o.labels:
                            if ot.role == "main" and _near_decision(o, ot) and not _on_bend(ot, o):
                                m = ot.mask or ot.box
                                horiz = abs(segs[0][0][1] - segs[0][1][1]) <= 1
                                p = _spot_at(segs[0], w, h, m.cx if horiz else m.cy)
                                if p:
                                    cands.append(p)
                    for s in segs:  # else as close to the diamond as the first run with room allows
                        near = _spots(s, w, h, near_start=True)
                        cands += near
                        if near:
                            break
                for s in sorted(segs, key=lambda s: -math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1])):
                    cands += _spots(s, w, h)
            for cx, cy in cands:
                dx, dy = cx - t.mask.cx, cy - t.mask.cy
                if abs(dx) < 0.5 and abs(dy) < 0.5:
                    break  # already there
                glyph = Box(t.box.x0 + dx, t.box.y0 + dy, t.box.x1 + dx, t.box.y1 + dy)
                mask = Box(t.mask.x0 + dx, t.mask.y0 + dy, t.mask.x1 + dx, t.mask.y1 + dy)
                if not sc.clear(t, e, glyph, mask):
                    continue
                if move_text(c, t, dx, dy):
                    t.box, t.mask = glyph, mask
                    t.line_boxes = [Box(b.x0 + dx, b.y0 + dy, b.x1 + dx, b.y1 + dy) for b in t.line_boxes]
                    moved += 1
                break
    if moved:
        c.done.append("moved %d label(s)" % moved)
        c.moved = True


def n_corners(e):
    return sum(max(0, len(cl) - 2) for cl in e.corners)


def mask_rect(c, box):
    """the black <rect> of the label mask whose box is `box`"""
    for el in c.els:
        if el.tag == "rect" and el.attrs.get("fill") == "black" and el.parent is not None and el.parent.tag == "mask":
            x, y = num(el.attrs.get("x")), num(el.attrs.get("y"))
            if abs(x - box.x0) < 0.01 and abs(y - box.y0) < 0.01:
                return el
    return None


def move_text(c, t, dx, dy):
    """shift a label's <text> (and its tspans) and its mask rect"""
    tel = c.el(t.el)
    if tel is None:
        return False
    ed = c.ed
    if t.mask is not None:
        mr = mask_rect(c, t.mask)
        if mr is None:
            return False
        ed.set(mr, "x", fmt(num(ed.get(mr, "x")) + dx))
        ed.set(mr, "y", fmt(num(ed.get(mr, "y")) + dy))
    ed.set(tel, "x", fmt(num(ed.get(tel, "x")) + dx))
    ed.set(tel, "y", fmt(num(ed.get(tel, "y")) + dy))
    for sp in c.els[tel.idx + 1:]:
        if sp.parent is not tel:
            if sp.start >= tel.end:
                break
            continue
        if sp.tag == "tspan" and ed.get(sp, "x") is not None:
            ed.set(sp, "x", fmt(num(ed.get(sp, "x")) + dx))
    return True


def children(c, el):
    out = []
    for x in c.els[el.idx + 1:]:
        if x.start >= el.end:
            break
        if x.parent is el:
            out.append(x)
    return out


def descendants(c, el):
    out = []
    for x in c.els[el.idx + 1:]:
        if x.start >= el.end:
            break
        out.append(x)
    return out


def step_tables(c):
    n_done = 0
    rule = c.pal["rule"]
    for n in c.dg.nodes.values():
        if n.sig != "table" or n.el is None:
            continue
        g = c.el(n.el)
        els = descendants(c, g)
        head = next((x for x in els if x.tag == "rect" and "class_header" in (x.attrs.get("class") or "")), None)
        body = next((x for x in els if x.tag == "rect"), None)
        bottom = num(body.attrs.get("y")) + num(body.attrs.get("height")) if body is not None else None
        for x in els:
            if x.tag == "line":
                y = num(x.attrs.get("y1"))
                if bottom is not None and abs(y - bottom) < 1.0:
                    c.ed.delete(x)  # the last row's rule would paint over the table's own bottom border
                    n_done += 1
                elif (x.attrs.get("stroke") or "").upper() != rule or "stroke-width:1" not in (x.attrs.get("style") or ""):
                    c.ed.set(x, "stroke", rule)
                    c.ed.style(x, stroke_width="1")
                    n_done += 1
        if head is not None:
            y0, y1 = num(head.attrs.get("y")), num(head.attrs.get("y")) + num(head.attrs.get("height"))
            for x in els:
                if x.tag == "text" and y0 <= num(x.attrs.get("y")) <= y1 and "font-weight" not in (x.attrs.get("style") or ""):
                    c.ed.style(x, font_weight="700")  # synthetic bold: the subset font has only the faces d2 used
                    n_done += 1
    if n_done:
        c.done.append("table rules")


def step_sequence(c):
    dg = c.dg
    n_spans = n_chips = n_titles = 0
    span_col = c.pal["span"]
    vis = [n for n in dg.nodes.values() if not n.hidden and n.box]
    for n in vis:
        if n.seq_role == "span" and n.el is not None:
            shape = next((x for x in descendants(c, c.el(n.el)) if x.tag in ("rect", "path")), None)
            if shape is not None and ((shape.attrs.get("stroke") or "").upper() != span_col.upper()
                                      or "stroke-width:1;" not in (shape.attrs.get("style") or "") + ";"):
                c.ed.set(shape, "stroke", span_col)
                c.ed.style(shape, stroke_width="1")
                n_spans += 1
    # group title chips: the frame is drawn with mix-blend-mode multiply at 50%, the chip is not
    lines = [(e.src or e.dst, e.lines[0][0][0], min(p[1] for l in e.lines for p in l), max(p[1] for l in e.lines for p in l))
             for e in dg.edges if e.lifeline and e.lines and not e.hidden]
    spans = [n for n in vis if n.seq_role == "span"]
    texts = [t for t in dg.texts]
    for n in sorted((n for n in vis if n.is_group and n.el is not None), key=lambda n: n.id.count(".")):
        g = c.el(n.el)
        kids = children(c, g)
        chip = next((x for x in kids if x.tag == "rect"), None)
        chain = [dg.nodes[a] for a in reversed(d2lint._ancestors(dg, n.id)) if a in dg.nodes and dg.nodes[a].is_group] + [n]
        back = dg.bg
        for gn in chain:
            f = gn.fill or back
            back = tuple(back[i] * 0.5 + back[i] * f[i] / 255.0 * 0.5 for i in range(3))
        want = hexcol(back)
        if chip is not None and (chip.attrs.get("fill") or "").upper() != want:
            c.ed.set(chip, "fill", want)
            n_chips += 1
        # a guard over a lifeline or bar slides right past it
        for t in n.labels:
            if t.el is None:
                continue

            def covers(b):
                hit = [x for a, x, y0, y1 in lines if b.x0 - 2 < x < b.x1 + 2 and b.y1 > y0 and b.y0 < y1]
                hit += [s.box.x1 for s in spans if b.grow(2).intersects(s.box, 0)]
                return hit
            box = t.box
            dx = 0.0
            for _ in range(8):
                hit = covers(Box(box.x0 + dx, box.y0, box.x1 + dx, box.y1))
                if not hit:
                    break
                dx = max(hit) + 6 - box.x0
            else:
                continue
            nb = Box(box.x0 + dx, box.y0, box.x1 + dx, box.y1)
            if dx < 0.5 or nb.x1 > n.box.x1 - 4 or any(o is not t and o.box.intersects(nb.grow(2), 0) for o in texts):
                continue
            tel = c.el(t.el)
            c.ed.set(tel, "x", fmt(num(c.ed.get(tel, "x")) + dx))
            if chip is not None:
                c.ed.set(chip, "x", fmt(num(c.ed.get(chip, "x")) + dx))
            t.box = nb
            n_titles += 1
    if n_spans:
        c.done.append("activation bars")
    if n_chips:
        c.done.append("group chips")
    if n_titles:
        c.done.append("moved %d group title(s)" % n_titles)
        c.moved = True


def _lum(col):
    return d2lint.rel_lum(col) if col else 0.0


def step_tech(c):
    n_done = 0
    for n in c.dg.nodes.values():
        if "tech" not in n.classes or n.hidden or n.el is None:
            continue
        for t in n.labels:
            tel = c.el(t.el)
            if tel is None:
                continue
            spans = [x for x in children(c, tel) if x.tag == "tspan"]
            recolor = t.color is not None and _lum(t.color) < 0.2 and (n.fill is None or _lum(n.fill) > 0.6)
            for sp in spans[1:]:
                st = sp.attrs.get("style") or ""
                if "font-size" in st:
                    continue
                c.ed.style(sp, font_size="14px")
                if recolor:
                    c.ed.set(sp, "fill", c.pal["text"])
                n_done += 1
    if n_done:
        c.done.append("tech lines")


def step_aria(c):
    n_done = 0
    for n in list(c.dg.nodes.values()) + list(c.dg.edges):
        if n.el is None:
            continue
        op = d2lint._style(n.el, "opacity")
        if op is not None and num(op, 1.0) < 0.05:
            el = c.el(n.el)
            if el is not None and el.attrs.get("aria-hidden") != "true":
                c.ed.set(el, "aria-hidden", "true")
                n_done += 1
    if n_done:
        c.done.append("aria-hidden on %d invisible object(s)" % n_done)


def _translate(s):
    m = re.search(r"translate\(\s*([-\d.eE+]+)[ ,]+([-\d.eE+]+)\s*\)\s*scale\(\s*([-\d.eE+]+)", s or "")
    return (float(m.group(1)), float(m.group(2)), float(m.group(3))) if m else None


def step_key(c):
    dg = c.dg
    if dg.keyed or not dg.legend_els:
        return
    els = [c.el(x) for x in dg.legend_els]
    if any(x is None for x in els):
        return
    ed, pal = c.ed, c.pal
    rects = [x for x in els if x.tag == "rect"]
    texts = [x for x in els if x.tag == "text"]
    swatches = [x for x in els if x.tag == "g"]
    rules = [x for x in els if x.tag == "line"]
    if not rects or not texts:
        return
    shadow = [r for r in rects if "drop-shadow" in (r.attrs.get("style") or "")]
    frame = next((r for r in rects if r not in shadow), rects[-1])
    for r in shadow:
        ed.delete(r)
    title = texts[0]
    items = []  # (swatch, text, kind)
    for sw in swatches:
        tr = _translate(sw.attrs.get("transform"))
        if not tr:
            continue
        nxt = next((t for t in texts[1:] if t.start >= sw.end), None)
        if nxt is None:
            continue
        kind = "edge" if tr[2] >= 0.4 else "node"
        items.append((sw, nxt, kind, tr))
        if kind == "node":  # outlines at 1px on screen, whatever the sample's scale
            for x in descendants(c, sw):
                if x.tag in ("rect", "path", "ellipse", "circle", "polygon") and "connection" not in (x.attrs.get("class") or ""):
                    ed.set(x, "vector-effect", "non-scaling-stroke")
                    ed.style(x, stroke_width="1")
    # measure what the diagram draws without the legend
    boxes = [n.box for n in dg.nodes.values() if n.box and not n.hidden]
    boxes += [t.box for t in dg.texts if t.kind != "legend"]
    boxes += [e.box for e in dg.edges if e.box and not e.hidden]
    content = d2lint.union_all(boxes) or dg.vb
    legend_texts = {c.el(t.el): t for t in dg.texts if t.kind == "legend"}
    fm = dg.fonts.get("text") or dg.fonts.get("text-bold")
    fb = dg.fonts.get("text-bold") or fm

    def text_w(t_el, size):
        t = legend_texts.get(t_el)
        s = t.content if t else ""
        return fm.width(s, size) if fm else len(s) * size * 0.53
    pad = c.pad
    # the title: KEY in the bold face of the diagram, as text when the subset has the letters, else as outlines
    tx0 = num(title.attrs.get("x"))
    ty0 = num(title.attrs.get("y"))
    title_size = 15.0
    have = fb is not None and all(ord(ch) in fb.adv for ch in "KEY")
    ttf = None if have else matching_font(fb)
    fr_x, fr_y = num(frame.attrs.get("x")), num(frame.attrs.get("y"))
    # the key's height when its frame hugs the items (d2 pads the frame down to the canvas bottom), with the
    # title's top padding under the last item too
    pad_top = max(8.0, ty0 - 0.72 * title_size - fr_y)
    bottom = ty0 + 4
    for sw, t, kind, tr in items:
        bottom = max(bottom, num(t.attrs.get("y")) + 4, tr[1] + (swatch_size(c, sw, tr[2])[1] if kind == "node" else 2))
    for r in rules:
        bottom = max(bottom, num(r.attrs.get("y1")), num(r.attrs.get("y2")))
    tight = bottom - fr_y + pad_top
    # at the right when the canvas fits the column and the key is no taller than the diagram beside it (a tall
    # key beside a short diagram leaves a dead band under the diagram); else a row under the diagram. At the
    # right the key keeps d2's pad to the canvas edge, as the diagram does (d2 leaves it about half a pad)
    right_w = max(dg.W, num(frame.attrs.get("x")) + num(frame.attrs.get("width")) + pad - dg.vb.x0)
    below = right_w > c.column + 0.5 or tight > content.h + 16
    if below:
        fr_x, fr_y = content.x0, content.y1 + 16
    row_h, top_pad, left = 28.0, 8.0, 12.0
    if have:
        title_w = fb.width("KEY", title_size)
    elif ttf is not None:
        title_w = sum(ttf.advance(ord(ch)) for ch in "KEY") * title_size / ttf.upem
    else:
        title_w = (fb.width("Legend", title_size) if fb else 52.0)
    new_title = None
    shift = 0.0
    if below:
        cy = fr_y + top_pad + row_h / 2
        t_x, t_base = fr_x + left, cy + 5
    else:
        # at the right: the frame hugs the items, top-aligned with the diagram
        fr_h = num(frame.attrs.get("height"))
        shift = content.y0 - fr_y
        if abs(shift) > 0.5 or fr_h - tight > 0.5:
            ed.set(frame, "y", fmt(fr_y + shift))
            ed.set(frame, "height", fmt(tight))
            for sw, t, kind, tr in items:
                ed.set(sw, "transform", "translate(%s, %s) scale(%s)" % (fmt(tr[0]), fmt(tr[1] + shift), "%.6f" % tr[2]))
                ed.set(t, "y", fmt(num(t.attrs.get("y")) + shift))
            for r in rules:
                for k in ("y1", "y2"):
                    ed.set(r, k, fmt(num(r.attrs.get(k)) + shift))
        t_x, t_base = tx0, ty0 + shift
    if have:
        new_title = '<text class="text-bold" x="%s" y="%s" fill="%s" style="font-size:%gpx">KEY</text>' % (
            fmt(t_x), fmt(t_base), pal["title"], title_size)
    elif ttf is not None:
        d, _ = ttf.path("KEY", title_size, t_x, t_base)
        if d:
            new_title = '<path d="%s" fill="%s" aria-label="Key" role="img"/>' % (d, pal["title"])
    if new_title is None:  # no bundled face matches (d2's own fonts): keep the word, restyle it
        ed.set(title, "fill", pal["title"])
        ed.style(title, font_size="%gpx" % title_size)
        if below or shift:
            ed.set(title, "x", fmt(t_x))
            ed.set(title, "y", fmt(t_base))
    else:
        ed.delete(title)
        ed.insert(title.start, new_title)
    for _, t, _, _ in items:
        ed.set(t, "fill", pal["text"])
    for r in rules:
        if below:
            ed.delete(r)
        else:
            ed.set(r, "stroke", pal["rule"])
            ed.set(r, "stroke-dasharray", "none")
    # frame look
    ed.set(frame, "fill", pal["frame"])
    ed.set(frame, "stroke", pal["frame-stroke"])
    ed.set(frame, "rx", fmt(pal["radius"]))
    ed.style(frame, stroke_width="1px")
    where = "right"
    fw, fh = num(frame.attrs.get("width")), num(frame.attrs.get("height"))
    if not below:
        c.key_box = Box(fr_x, fr_y, fr_x + fw, fr_y + fh)
        x0, y0 = dg.vb.x0, dg.vb.y0
        W, H = math.ceil(right_w), math.ceil(dg.H)
        if abs(shift) > 0.5 or fh - tight > 0.5:
            # the canvas: as tall as the diagram or the key, whichever reaches lower
            low = max(fr_y + fh, content.y1)
            H = math.ceil(max(content.y1, fr_y + shift + tight) + (dg.vb.y1 - low) - y0)
            c.key_box = Box(fr_x, fr_y + shift, fr_x + fw, fr_y + shift + tight)
        if W != math.ceil(dg.W) or H != math.ceil(dg.H) or abs(shift) > 0.5 or fh - tight > 0.5:
            resize(c, x0, y0, W, H)
    if below:
        where = "below"
        max_w = max(content.w, 320.0)
        x0_items = fr_x + left + title_w + 16
        x = x0_items
        row = 0
        placed = []
        for sw, t, kind, tr in items:
            sw_w, sw_h = swatch_size(c, sw, tr[2])
            w = sw_w + 8 + text_w(t, 14) + 20
            if x + w - 20 > fr_x + max_w and x > x0_items + 1:
                row += 1
                x = x0_items
            cy = fr_y + top_pad + row * (row_h + 4) + row_h / 2
            sy = cy - sw_h / 2 if kind == "node" else cy
            ed.set(sw, "transform", "translate(%s, %s) scale(%s)" % (fmt(x), fmt(sy), "%.6f" % tr[2]))
            ed.set(t, "x", fmt(x + sw_w + 8))
            ed.set(t, "y", fmt(cy + 5))
            placed.append(x + sw_w + 8 + text_w(t, 14))
            x += w
        width = max(placed + [fr_x + left + title_w]) + left - fr_x
        height = top_pad * 2 + (row + 1) * row_h + row * 4
        ed.set(frame, "x", fmt(fr_x))
        ed.set(frame, "y", fmt(fr_y))
        ed.set(frame, "width", fmt(width))
        ed.set(frame, "height", fmt(height))
        c.key_box = Box(fr_x, fr_y, fr_x + width, fr_y + height)
        # the canvas: back to the diagram's width (or the key's), taller by the key, d2's pad around both
        x0, y0 = dg.vb.x0, dg.vb.y0
        art = drawn(c, legend=False) or content
        W = math.ceil(max(art.x1, fr_x + width) + pad - x0)
        H = math.ceil(max(art.y1, fr_y + height) + pad - y0)
        resize(c, x0, y0, W, H)
    # wrap every key element in one group the lint and the semantic check skip
    first = min(els, key=lambda x: x.start)
    last = max(els, key=lambda x: x.end)
    ed.insert(first.start, '<g class="d2-key" role="group" aria-label="Key">')
    ed.insert(last.end, "</g>")
    c.done.append("restyled key (%s)" % where)
    c.moved = True


def swatch_size(c, sw, scale):
    """(width, height) a legend sample draws: its shapes' extent at its scale"""
    xs, ys = [], []
    for x in descendants(c, sw):
        if x.tag == "rect" and x.attrs.get("width"):
            x0, y0 = num(x.attrs.get("x")), num(x.attrs.get("y"))
            xs += [x0, x0 + num(x.attrs.get("width"))]
            ys += [y0, y0 + num(x.attrs.get("height"))]
        elif x.tag == "path" and c.els[x.idx].parent is not None and c.els[x.idx].parent.tag != "marker":
            for sub in d2lint.path_polylines(x.attrs.get("d"), 0, 0, 6):
                xs += [p[0] for p in sub]
                ys += [p[1] for p in sub]
    if not xs:
        return 24.0 * scale / 0.2, 24.0
    return (max(xs) - min(xs)) * scale + (6 if scale >= 0.4 else 0), (max(ys) - min(ys)) * scale


def resize(c, x0, y0, W, H):
    """the canvas becomes (x0, y0, W, H) in the drawing's coordinates: both viewBoxes and sizes, the white
    background and the label mask"""
    ed = c.ed
    outer = c.els[0]
    inner = c.el(c.dg.inner)
    ed.set(outer, "viewBox", "0 0 %d %d" % (W, H))
    for el in (outer, inner):
        if el.attrs.get("width") is not None:
            ed.set(el, "width", "%d" % W)
        if el.attrs.get("height") is not None:
            ed.set(el, "height", "%d" % H)
    ed.set(inner, "viewBox", "%s %s %d %d" % (_n(x0), _n(y0), W, H))
    bg = next((x for x in children(c, inner) if x.tag == "rect"), None)
    if bg is not None:
        ed.set(bg, "x", fmt(x0))
        ed.set(bg, "y", fmt(y0))
        ed.set(bg, "width", fmt(W))
        ed.set(bg, "height", fmt(H))
    for m in c.els:
        if m.tag == "mask" and m.attrs.get("maskUnits") == "userSpaceOnUse":
            ed.set(m, "x", _n(x0))
            ed.set(m, "y", _n(y0))
            ed.set(m, "width", "%d" % W)
            ed.set(m, "height", "%d" % H)
            white = next((x for x in children(c, m) if x.tag == "rect" and x.attrs.get("fill") == "white"), None)
            if white is not None:
                ed.set(white, "x", _n(x0))
                ed.set(white, "y", _n(y0))
                ed.set(white, "width", "%d" % W)
                ed.set(white, "height", "%d" % H)
    c.vb = Box(x0, y0, x0 + W, y0 + H)


def _n(v):
    return ("%d" % v) if abs(v - round(v)) < 1e-6 else ("%g" % v)


STEPS = (step_precision, step_relabel, step_tables, step_key, step_sequence, step_tech, step_aria, step_fit)


def process(path, brand, column):
    """post-process one SVG in place; returns the list of what changed"""
    raw = open(path, encoding="utf-8").read()
    dg = d2lint.load(path)
    c = Ctx(raw, dg, brand, column)
    for step in STEPS:
        step(c)
    if not c.ed.changed():
        return []
    done = c.done or ["no fixes needed"]  # only the text-rendering rule: the file changes, nothing visible does
    out = c.ed.apply()
    d = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(prefix=".svgpost-", suffix=".svg", dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(out)
        # readable by everyone, as d2check leaves it (d2 itself writes 0600): the re-render line matches
        os.chmod(tmp, (os.stat(path).st_mode | 0o644) & 0o777)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    return done


class ArgParser(argparse.ArgumentParser):
    """argparse with the skill's exit convention: a usage error exits 64, not 2"""

    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(64, "%s: error: %s (run with --help for the options)\n" % (self.prog, message))


def main(argv=None):
    doc = __doc__.split("\n")
    ap = ArgParser(prog="svgpost.py", description=doc[0], formatter_class=argparse.RawDescriptionHelpFormatter,
                   epilog="\n".join(doc[doc.index("Steps, in order (a second run changes nothing):"):]))
    ap.add_argument("svg", nargs="+", metavar="OUT.svg", help="an SVG written by d2 (one per board); changed in place")
    ap.add_argument("--brand", choices=("neutral", "snowflake"), default="neutral", help="theme colours (default neutral)")
    ap.add_argument("--column", type=float, default=800, help="doc column width in px (default 800)")
    ap.add_argument("--quiet", action="store_true", help="print nothing on success")
    a = ap.parse_args(argv)
    if not 50 <= a.column <= 20000:
        ap.error("--column wants the doc column width in px, e.g. 800 (got %g)" % a.column)
    rc = 0
    for p in a.svg:
        if not p.lower().endswith(".svg"):
            ap.error("%s is not an .svg (post-process the SVG that d2 wrote)" % p)
        try:
            done = process(p, a.brand, a.column)
        except (OSError, ValueError, SyntaxError) as e:
            reason = e.strerror if isinstance(e, OSError) and e.strerror else str(e)
            print("svgpost: %s: %s - post-process the SVG that d2 or d2check.sh wrote" % (p, reason), file=sys.stderr)
            rc = 1
            continue
        if not a.quiet:
            name = "" if len(a.svg) == 1 else "%s: " % p
            print("post: %s%s" % (name, ", ".join(done) if done else "nothing to change"))
    return rc


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:
        sys.exit(0)
