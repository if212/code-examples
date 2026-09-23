#!/usr/bin/env python3
"""d2lint - geometric and legibility lint for SVGs rendered by d2 (tested on d2 v0.7.1).

Standard library only (Python 3.8+). Reads the SVG that d2 wrote and reports what `d2 validate`
cannot see, measured at the size a reader sees it: displayed width = min(svg width, --column).
d2check.sh runs it on every render; run it by hand only to lint an SVG d2check did not make.

usage: python3 d2lint.py [--column 800] [--json | --compact] [--annotate ANN.svg]
                         [--json-out F.json] [--sem-json SEM.json] [--strict] [--quiet] FILE.svg...

Every finding ends with its recipe: workflows/review-and-fix.md#<code>.
E- must be fixed, W- fix what a reader would notice, I- information only.
  legibility   E-small-text W-small-text W-tall W-aspect E-contrast E-contrast-dark W-non-ascii
  collisions   E-label-overlap E-edge-label-on-node E-icon-collision E-label-overflow
               E-node-overlap E-child-outside E-off-canvas
  routing      E-edge-through-node E-edge-through-label W-edge-through-container W-edge-crossing
               W-edge-overlap W-edge-label-on-border W-diagonal-edge W-curved-edge W-long-edge
               W-fanout W-edge-jog W-label-on-bend W-short-label
  consistency  W-title-size W-unclassed W-sibling-size W-seq-group-ragged W-remote-image I-sparse
--sem-json merges semcheck's JSON report (S- codes) into the same listing and exit code.

How d2 output is decoded (verified on d2 v0.7.1):
  * every object is a <g class="BASE64(html-escaped id) [user classes]"> under <svg class="d2-svg">;
    nodes with a link are wrapped in <a>; style.opacity lands on that <g> as style='opacity:N'
  * node geometry is in the child <g class="shape">; labels and icons are direct <text>/<image>
  * edges are <path class="connection">; ELK rounds corners as 'L .. S corner end'; dagre uses C
  * sequence lifelines are edges with an empty end: "(alice -- )[0]"
  * the native legend (vars.d2-legend) is drawn after the diagram: frame <rect>s, <text>s and
    items wrapped in <g transform="translate(..) scale(..)">
  * fonts are embedded as WOFF; label widths come from their advance tables
"""
import argparse
import base64
import html
import json
import math
import os
import re
import statistics
import struct
import sys
import xml.etree.ElementTree as ET
import zlib

ANCHOR = "workflows/review-and-fix.md#"
SMALL_ERR_PX = 10.0      # displayed text below this is an error
SMALL_WARN_PX = 12.0     # ... below this a warning
TALL_FACTOR = 1.6        # displayed height budget = 1.6 x column
# Label widths come from the embedded font's advance table. With text-rendering:geometricPrecision
# (d2check injects it) Chromium lays text out at those advances; without it, Chromium on Linux snaps
# each glyph to whole pixels and labels come out ~2% wider on average (round-1 calibration, 365 labels).
SLACK_PRECISE = 1.0
SLACK_HINTED = 1.02
# 1-2 character edge labels that are real words (decision branches etc.) are not flagged
SHORT_LABEL_WORDS = {"no", "ok", "on", "up", "go", "in", "to", "by", "if", "or", "as", "is", "at", "of", "do", "so"}
ICON_TOUCH_PX = 1.0      # glyph ink this close to icon ink counts as a collision (a descender resting on the icon)
TILT_PX = 8.0            # a straight segment drifting more than this sideways off its axis reads as a lean

# print order: severity first, then the review rubric (legible, accurate, clean routing, direction, focus, clutter)
CODE_ORDER = [
    "E-small-text", "E-contrast", "E-contrast-dark", "E-off-canvas", "E-node-overlap", "E-child-outside",
    "E-label-overlap", "E-label-overflow", "E-icon-collision", "E-edge-through-node", "E-edge-through-label",
    "E-edge-label-on-node",
    "W-small-text", "W-tall", "W-aspect", "W-edge-crossing", "W-edge-overlap", "W-edge-through-container",
    "W-long-edge", "W-fanout", "W-curved-edge", "W-diagonal-edge", "W-edge-jog", "W-label-on-bend",
    "W-edge-label-on-border", "W-seq-group-ragged", "W-title-size", "W-sibling-size", "W-unclassed",
    "W-short-label", "W-remote-image", "W-non-ascii", "I-sparse",
]
SEV_ORDER = {"error": 0, "warn": 1, "info": 2}


def anchor(code):
    return ANCHOR + code.lower()


def floor1(v):
    """round down to 0.1: 9.99px shows as 9.9, never as a 10.0 that is still under the 10px limit"""
    return math.floor(v * 10 + 1e-6) / 10


# ----------------------------------------------------------------------------
# geometry helpers
# ----------------------------------------------------------------------------


class Box:
    __slots__ = ("x0", "y0", "x1", "y1")

    def __init__(self, x0, y0, x1, y1):
        self.x0, self.y0, self.x1, self.y1 = min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)

    @staticmethod
    def of_points(pts):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return Box(min(xs), min(ys), max(xs), max(ys))

    def union(self, o):
        return Box(min(self.x0, o.x0), min(self.y0, o.y0), max(self.x1, o.x1), max(self.y1, o.y1))

    def shrink(self, m):
        return Box(self.x0 + m, self.y0 + m, self.x1 - m, self.y1 - m) if self.w > 2 * m and self.h > 2 * m else self

    def grow(self, m):
        return Box(self.x0 - m, self.y0 - m, self.x1 + m, self.y1 + m)

    @property
    def w(self):
        return self.x1 - self.x0

    @property
    def h(self):
        return self.y1 - self.y0

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    def contains_pt(self, x, y, m=0.0):
        return self.x0 + m < x < self.x1 - m and self.y0 + m < y < self.y1 - m

    def overlap(self, o):
        return (min(self.x1, o.x1) - max(self.x0, o.x0), min(self.y1, o.y1) - max(self.y0, o.y0))

    def intersects(self, o, m=0.0):
        ox, oy = self.overlap(o)
        return ox > m and oy > m

    def inside(self, o, tol=0.0):
        return (self.x0 >= o.x0 - tol and self.y0 >= o.y0 - tol and
                self.x1 <= o.x1 + tol and self.y1 <= o.y1 + tol)

    def dist_pt(self, x, y):
        dx = max(self.x0 - x, 0.0, x - self.x1)
        dy = max(self.y0 - y, 0.0, y - self.y1)
        return math.hypot(dx, dy)

    def as_list(self):
        return [round(self.x0, 1), round(self.y0, 1), round(self.w, 1), round(self.h, 1)]

    def __repr__(self):
        return "Box(%.1f,%.1f %.1fx%.1f)" % (self.x0, self.y0, self.w, self.h)


def union_all(boxes):
    out = None
    for b in boxes:
        if b is not None:
            out = b if out is None else out.union(b)
    return out


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            xint = (xj - xi) * (y - yi) / ((yj - yi) or 1e-12) + xi
            if x < xint:
                inside = not inside
        j = i
    return inside


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def dist_to_poly(x, y, poly):
    best = 1e18
    n = len(poly)
    for i in range(n):
        a = poly[i]
        b = poly[(i + 1) % n]
        d = seg_dist(x, y, a[0], a[1], b[0], b[1])
        if d < best:
            best = d
    return best


def seg_intersection(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 0 <= t <= 1 and 0 <= u <= 1:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def densify(pts, step=2.0):
    out = []
    for i in range(len(pts) - 1):
        (ax, ay), (bx, by) = pts[i], pts[i + 1]
        L = math.hypot(bx - ax, by - ay)
        n = max(1, int(L / step))
        for k in range(n):
            t = k / n
            out.append((ax + t * (bx - ax), ay + t * (by - ay)))
    if pts:
        out.append(pts[-1])
    return out


def grow_to_fit(poly, pts, strokes, axis, now, margin=3.0):
    """the size along axis (0 = width, 1 = height) at which every point sits inside the outline, margin px from
    it, with no inner stroke (cylinder rim, queue end cap) within margin px. d2 grows a shape one of two ways:
    the middle stretches while rims and caps keep their depth (rectangle, cylinder, queue, step), or the whole
    shape scales (diamond, hexagon, oval). The larger of the two answers is enough either way. None: no fit."""
    xs, ys = [q[0] for q in poly], [q[1] for q in poly]
    c = (min(xs) + max(xs)) / 2 if axis == 0 else (min(ys) + max(ys)) / 2
    x0, y0 = min(q[0] for q in pts) - margin, min(q[1] for q in pts) - margin
    x1, y1 = max(q[0] for q in pts) + margin, max(q[1] for q in pts) + margin

    def fits(move, with_strokes):
        sp = [move(q) for q in poly]
        if not all(point_in_poly(q[0], q[1], sp) and dist_to_poly(q[0], q[1], sp) >= margin for q in pts):
            return False
        return not with_strokes or not any(x0 < u < x1 and y0 < v < y1 for u, v in map(move, strokes))

    def stretch(d):  # each half moves d/2 away from the centre line
        if axis == 0:
            return lambda q: (q[0] + (d / 2 if q[0] > c else -d / 2), q[1])
        return lambda q: (q[0], q[1] + (d / 2 if q[1] > c else -d / 2))

    def scale(f):
        if axis == 0:
            return lambda q: ((q[0] - c) * f + c, q[1])
        return lambda q: (q[0], (q[1] - c) * f + c)

    def least(ok, lo, hi):  # smallest value in (lo, hi] with ok(value), or None
        if not ok(hi):
            return None
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (lo, mid) if ok(mid) else (mid, hi)
        return hi

    d = least(lambda v: fits(stretch(v), True), 0.0, 8.0 * max(now, 40.0))
    f = least(lambda v: fits(scale(v), False), 1.0, 8.0)
    if d is None or f is None:
        return None
    return max(now + d, now * f)


def poly_len(pts):
    return sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))


def _frange(a, b, step):
    out = []
    v = a
    while v <= b + 1e-9:
        out.append(v)
        v += step
    if not out or out[-1] < b - 1e-6:
        out.append(b)
    return out


# ----------------------------------------------------------------------------
# SVG path -> sampled polylines / corner polylines
# ----------------------------------------------------------------------------

def arc_points(x1, y1, rx, ry, rot, large, sweep, x2, y2, steps=12):
    """sample an SVG elliptical arc (endpoint -> centre parameterisation, SVG 1.1 F.6.5)"""
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(x2, y2)]
    phi = math.radians(rot)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = (x1p / rx) ** 2 + (y1p / ry) ** 2
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num_ = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = math.sqrt(max(0.0, num_ / den)) if den else 0.0
    if bool(large) == bool(sweep):
        co = -co
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(ux, uy, vx, vy):
        return math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    out = []
    for k in range(1, steps + 1):
        t = t1 + dt * k / steps
        ex, ey = rx * math.cos(t), ry * math.sin(t)
        out.append((cp * ex - sp * ey + cx, sp * ex + cp * ey + cy))
    return out


_TOK = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")


def path_polylines(d, tx=0.0, ty=0.0, curve_steps=12, corners=False):
    """Sample an SVG path into polylines. corners=True instead returns the vertex polylines with
    rounded corners (S/Q control points) folded back into their corner point, plus whether the
    path uses free cubic curves (C = dagre splines)."""
    toks = _TOK.findall(d or "")
    subs, cur = [], []
    i, cmd = 0, None
    x = y = sx = sy = 0.0
    lcx = lcy = None
    curved = False

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                if cur:
                    cur.append((sx + tx, sy + ty))
                    subs.append(cur)
                    cur = []
                x, y = sx, sy
                lcx = lcy = None
                continue
        if cmd is None:
            i += 1
            continue
        rel = cmd.islower()
        C = cmd.upper()
        ox, oy = (x, y) if rel else (0.0, 0.0)
        start = i
        try:
            if C == "M":
                if cur:
                    subs.append(cur)
                x, y = num() + ox, num() + oy
                sx, sy = x, y
                cur = [(x + tx, y + ty)]
                cmd = "l" if rel else "L"
                lcx = lcy = None
            elif C == "L":
                x, y = num() + ox, num() + oy
                cur.append((x + tx, y + ty))
                lcx = lcy = None
            elif C == "H":
                x = num() + (x if rel else 0.0)
                cur.append((x + tx, y + ty))
                lcx = lcy = None
            elif C == "V":
                y = num() + (y if rel else 0.0)
                cur.append((x + tx, y + ty))
                lcx = lcy = None
            elif C in "CS":
                if C == "C":
                    x1, y1 = num() + ox, num() + oy
                    curved = True
                else:
                    x1, y1 = (2 * x - lcx, 2 * y - lcy) if lcx is not None else (x, y)
                x2, y2 = num() + ox, num() + oy
                x3, y3 = num() + ox, num() + oy
                if corners:
                    if C == "S":
                        cur.append((x2 + tx, y2 + ty))
                    cur.append((x3 + tx, y3 + ty))
                else:
                    for k in range(1, curve_steps + 1):
                        t = k / curve_steps
                        mt = 1 - t
                        px = mt ** 3 * x + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t ** 3 * x3
                        py = mt ** 3 * y + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t ** 3 * y3
                        cur.append((px + tx, py + ty))
                lcx, lcy = x2, y2
                x, y = x3, y3
            elif C in "QT":
                if C == "Q":
                    x1, y1 = num() + ox, num() + oy
                else:
                    x1, y1 = (2 * x - lcx, 2 * y - lcy) if lcx is not None else (x, y)
                x2, y2 = num() + ox, num() + oy
                if corners:
                    cur.append((x1 + tx, y1 + ty))
                    cur.append((x2 + tx, y2 + ty))
                else:
                    for k in range(1, curve_steps + 1):
                        t = k / curve_steps
                        mt = 1 - t
                        cur.append((mt * mt * x + 2 * mt * t * x1 + t * t * x2 + tx,
                                    mt * mt * y + 2 * mt * t * y1 + t * t * y2 + ty))
                lcx, lcy = x1, y1
                x, y = x2, y2
            elif C == "A":
                rx, ry, rot, large, sweep = abs(num()), abs(num()), num(), num(), num()
                x2, y2 = num() + ox, num() + oy
                if corners:
                    cur.append((x2 + tx, y2 + ty))
                else:
                    for px, py in arc_points(x, y, rx, ry, rot, large, sweep, x2, y2, curve_steps):
                        cur.append((px + tx, py + ty))
                x, y = x2, y2
                lcx = lcy = None
            else:
                i += 1
        except (IndexError, ValueError):
            break
        if i == start:  # nothing consumed: skip the stray token
            i += 1
    if cur:
        subs.append(cur)
    subs = [s for s in subs if len(s) >= 2]
    if corners:
        # dagre splines are C-only; ELK draws tiny jogs as a short C between straight runs
        straight = re.search(r"[LlHhVvSs]", d or "")
        return [simplify_polyline(s) for s in subs], curved and not straight
    return subs


def simplify_polyline(pts, eps_deg=4.0):
    """drop repeated points and interior points where the direction does not change"""
    out = []
    for p in pts:
        if out and math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) < 0.5:
            continue
        out.append(p)
    s = math.sin(math.radians(eps_deg))
    k = 1
    while k < len(out) - 1:
        a, b, c = out[k - 1], out[k], out[k + 1]
        ux, uy = b[0] - a[0], b[1] - a[1]
        vx, vy = c[0] - b[0], c[1] - b[1]
        lu, lv = math.hypot(ux, uy), math.hypot(vx, vy)
        if lu < 1e-9 or lv < 1e-9 or (abs(ux * vy - uy * vx) <= s * lu * lv and ux * vx + uy * vy > 0):
            del out[k]
            k = max(1, k - 1)
        else:
            k += 1
    return out


# ----------------------------------------------------------------------------
# fonts: embedded WOFF -> advance widths
# ----------------------------------------------------------------------------


class FontMetrics:
    def __init__(self, data):
        self.upem = 1000
        self.adv = {}
        self.ink_box = {}  # codepoint -> (xMin, yMin, xMax, yMax) of the glyph outline, font units
        self.default_adv = 500
        self._parse(data)

    def _parse(self, d):
        if d[:4] != b"wOFF":
            raise ValueError("not WOFF")
        n = struct.unpack(">H", d[12:14])[0]
        tabs = {}
        for i in range(n):
            tag, off, cl, ol, _ = struct.unpack(">4sIIII", d[44 + i * 20:64 + i * 20])
            raw = d[off:off + cl]
            if cl < ol:
                raw = zlib.decompress(raw)
            tabs[tag.decode("latin1")] = raw
        self.upem = struct.unpack(">H", tabs["head"][18:20])[0]
        nh = struct.unpack(">H", tabs["hhea"][34:36])[0]
        hm = tabs["hmtx"]
        advs = [struct.unpack(">H", hm[i * 4:i * 4 + 2])[0] for i in range(nh)]
        cmap = self._cmap(tabs["cmap"])
        for cp, gid in cmap.items():
            self.adv[cp] = advs[gid] if gid < nh else advs[-1]
        if advs:
            self.default_adv = sum(advs) / len(advs)
        # where each glyph actually has ink (TrueType outlines: each glyf record starts with its bbox)
        try:
            ng = struct.unpack(">H", tabs["maxp"][4:6])[0]
            lo = tabs["loca"]
            if struct.unpack(">h", tabs["head"][50:52])[0] == 1:
                offs = struct.unpack(">%dI" % (ng + 1), lo[:4 * (ng + 1)])
            else:
                offs = [v * 2 for v in struct.unpack(">%dH" % (ng + 1), lo[:2 * (ng + 1)])]
            gl = tabs["glyf"]
            for cp, gid in cmap.items():
                if gid < ng and offs[gid + 1] - offs[gid] >= 10:
                    self.ink_box[cp] = struct.unpack(">hhhh", gl[offs[gid] + 2:offs[gid] + 10])
        except (KeyError, struct.error, IndexError):
            self.ink_box = {}  # CFF or unusual font: glyph extents are estimated

    @staticmethod
    def _cmap(c):
        n = struct.unpack(">H", c[2:4])[0]
        best = None
        for i in range(n):
            pid, eid, off = struct.unpack(">HHI", c[4 + i * 8:12 + i * 8])
            fmt = struct.unpack(">H", c[off:off + 2])[0]
            if fmt in (4, 12) and (best is None or fmt == 12):
                best = (fmt, off)
        out = {}
        if not best:
            return out
        fmt, off = best
        if fmt == 4:
            segx2 = struct.unpack(">H", c[off + 6:off + 8])[0]
            seg = segx2 // 2
            e0 = off + 14
            ends = struct.unpack(">%dH" % seg, c[e0:e0 + segx2])
            s0 = e0 + segx2 + 2
            starts = struct.unpack(">%dH" % seg, c[s0:s0 + segx2])
            d0 = s0 + segx2
            deltas = struct.unpack(">%dh" % seg, c[d0:d0 + segx2])
            r0 = d0 + segx2
            ranges = struct.unpack(">%dH" % seg, c[r0:r0 + segx2])
            for k in range(seg):
                for cp in range(starts[k], ends[k] + 1):
                    if cp == 0xFFFF:
                        continue
                    if ranges[k] == 0:
                        g = (cp + deltas[k]) & 0xFFFF
                    else:
                        a = r0 + k * 2 + ranges[k] + (cp - starts[k]) * 2
                        g = struct.unpack(">H", c[a:a + 2])[0]
                        if g:
                            g = (g + deltas[k]) & 0xFFFF
                    if g:
                        out[cp] = g
        else:
            ng = struct.unpack(">I", c[off + 12:off + 16])[0]
            for k in range(ng):
                a, b, g = struct.unpack(">III", c[off + 16 + k * 12:off + 28 + k * 12])
                for cp in range(a, b + 1):
                    out[cp] = g + cp - a
        return out

    def width(self, s, size):
        return sum(self.adv.get(ord(ch), self.default_adv) for ch in s) * size / self.upem


def glyph_top(ch):
    """approximate ink top above the baseline, in em"""
    if ch in "t":
        return 0.62
    if ch.isupper() or ch.isdigit() or ch in "bdfhijkl!?'\"#$%&()[]{}/\\|@^":
        return 0.72
    if ch in ".,_":
        return 0.12
    if ch in "-~=+*":
        return 0.40
    return 0.50


def glyph_bot(ch):
    """approximate ink bottom below the baseline, in em"""
    if ch in "gjpqy(){}[]|/\\_@$,;":
        return 0.21
    if ch in "Q":
        return 0.12
    return 0.01


def icon_ink_box(href, b):
    """Where an <image> icon actually has ink. Icon sets pad their art (Lucide: 2 of 24 units per side), so the
    <image> box overstates the collision area. Parses embedded SVG icons; falls back to the box shrunk by 8%."""
    fallback = Box(b.x0 + b.w * 0.08, b.y0 + b.h * 0.08, b.x1 - b.w * 0.08, b.y1 - b.h * 0.08)
    if not href.startswith("data:image/svg+xml"):
        return fallback
    try:
        head, payload = href.split(",", 1)
        svg = base64.b64decode(payload).decode("utf-8", "replace") if ";base64" in head \
            else __import__("urllib.parse").parse.unquote(payload)
        root = ET.fromstring(svg.encode("utf-8"))
        vb = [float(v) for v in re.split(r"[ ,]+", (root.get("viewBox") or "").strip()) if v]
        if len(vb) != 4:
            vb = [0, 0, float(re.sub(r"[^\d.]", "", root.get("width") or "24") or 24),
                  float(re.sub(r"[^\d.]", "", root.get("height") or "24") or 24)]
        sw_root = float(root.get("stroke-width") or 0) if (root.get("stroke") or "none") != "none" else 0
        pts, pad = [], 0.0
        for el in root.iter():
            tag = _local(el.tag)
            sw = float(el.get("stroke-width") or sw_root or 0)
            q = []
            if tag == "path":
                for sub in path_polylines(el.get("d"), 0, 0, 8):
                    q += sub
            elif tag in ("circle", "ellipse"):
                cx, cy = float(el.get("cx") or 0), float(el.get("cy") or 0)
                rx, ry = float(el.get("rx") or el.get("r") or 0), float(el.get("ry") or el.get("r") or 0)
                q = [(cx - rx, cy - ry), (cx + rx, cy + ry)]
            elif tag == "rect":
                x, y = float(el.get("x") or 0), float(el.get("y") or 0)
                q = [(x, y), (x + float(el.get("width") or 0), y + float(el.get("height") or 0))]
            elif tag == "line":
                q = [(float(el.get("x1") or 0), float(el.get("y1") or 0)), (float(el.get("x2") or 0), float(el.get("y2") or 0))]
            elif tag in ("polyline", "polygon"):
                n = [float(v) for v in re.findall(r"[-\d.eE+]+", el.get("points") or "")]
                q = [(n[k], n[k + 1]) for k in range(0, len(n) - 1, 2)]
            if q:
                pts += q
                pad = max(pad, sw / 2)
            if el.get("transform") and tag != "svg":
                return fallback  # transformed icon art: not worth modelling
        if not pts:
            return fallback
        ib = Box.of_points(pts).grow(pad)
        sc = min(b.w / vb[2], b.h / vb[3])
        ox = b.x0 + (b.w - vb[2] * sc) / 2 - vb[0] * sc
        oy = b.y0 + (b.h - vb[3] * sc) / 2 - vb[1] * sc
        return Box(ox + ib.x0 * sc, oy + ib.y0 * sc, ox + ib.x1 * sc, oy + ib.y1 * sc)
    except Exception:
        return fallback


# ----------------------------------------------------------------------------
# colors
# ----------------------------------------------------------------------------


def parse_color(v):
    if not v:
        return None
    v = v.strip()
    if v.startswith("#"):
        h = v[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) >= 6:
            try:
                return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                return None
    m = re.match(r"rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)", v)
    if m:
        return tuple(int(float(m.group(k))) for k in (1, 2, 3))
    named = {"white": (255, 255, 255), "black": (0, 0, 0)}
    return named.get(v.lower())


def rel_lum(c):
    def ch(v):
        v = v / 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


def blend(top, bottom, alpha):
    return tuple(round(top[i] * alpha + bottom[i] * (1 - alpha)) for i in range(3))


# ----------------------------------------------------------------------------
# d2 SVG model
# ----------------------------------------------------------------------------


def decode_id(cls):
    cls = (cls or "").split()
    cls = cls[0] if cls else ""
    if not cls or len(cls) % 4:
        return None
    if not re.fullmatch(r"[A-Za-z0-9+/]+={0,2}", cls):
        return None
    try:
        s = base64.b64decode(cls, validate=True).decode("utf-8")
    except Exception:
        return None
    s = html.unescape(s)
    if not s or any(ord(c) < 32 for c in s):
        return None
    return s


def split_path(idstr):
    """split a d2 absolute id on '.' outside double quotes"""
    out, cur, q = [], "", False
    for ch in idstr:
        if ch == '"':
            q = not q
        if ch == "." and not q:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


_EDGE_TAIL = re.compile(r"\)\[(\d+)\]$")


def parse_edge_id(eid):
    m = _EDGE_TAIL.search(eid)
    if not m:
        return None
    close = m.start()
    depth, q, open_ = 0, False, None
    for k in range(close, -1, -1):
        ch = eid[k]
        if ch == '"':
            q = not q
        if q:
            continue
        if ch == ")":
            depth += 1
        elif ch == "(":
            depth -= 1
            if depth == 0:
                open_ = k
                break
    if open_ is None:
        return None
    scope = eid[:open_].rstrip(".")
    inner = eid[open_ + 1:close]
    am = re.search(r" (<->|->|<-|--) ?", inner)
    if not am:
        return None
    a, arrow, b = inner[:am.start()].strip(), am.group(1), inner[am.end():].strip()

    def absid(x):
        if not x:
            return ""
        return scope + "." + x if scope else x
    return {"scope": scope, "src": absid(a), "dst": absid(b), "arrow": arrow, "index": int(m.group(1))}


class Text:
    def __init__(self, owner, kind, lines, box, fs, color, bold, content):
        self.owner = owner      # node/edge id ('legend' for legend text)
        self.kind = kind        # node-label | container-label | edge-label | internal | legend
        self.lines = lines
        self.box = box
        self.fs = fs
        self.color = color
        self.bold = bold
        self.content = content
        self.z = 0
        self.cls = None
        self.glyphs = []
        self.line_boxes = []  # one box per line; `box` is their union (empty beside short lines)
        self.alpha = 1.0
        self.mask = None      # edge labels: the knock-out rect d2 cuts into the edge line
        self.role = "main"    # edge labels: main | arrowhead


class Node:
    def __init__(self, nid):
        self.id = nid
        self.polys = []       # outline polygons (first = main shape)
        self.box = None       # union of everything the shape draws
        self.core = None      # the node's own outline (front copy for style.multiple)
        self.sig = ""         # shape signature: same d2 shape -> same signature
        self.fill = None
        self.opacity = 1.0
        self.hidden = False
        self.classes = []
        self.labels = []
        self.internal = []
        self.icons = []       # Box list (the <image> element)
        self.icon_ink = []    # Box list (where the icon art actually is)
        self.parent = None
        self.children = []
        self.is_text_shape = False
        self.z = 0
        self.in_seq = False
        self.remote_image = False  # shape: image with a URL: draws nothing where the SVG is shown via <img>
        self.paints = False   # draws a visible fill, stroke or image (transparent grid cells draw nothing)
        self.seq_role = None  # actor | group | span | note (sequence diagrams)
        self.is_group = False  # translucent sequence-diagram group (drawn with class "blend")
        self.strokes = []     # open inner strokes of the shape (cylinder rim, queue end cap)

    @property
    def is_container(self):
        return bool(self.children) and self.seq_role != "actor"

    def contains_pt(self, x, y, m=0.0):
        b = self.box
        if b is None or not (b.x0 - 1 < x < b.x1 + 1 and b.y0 - 1 < y < b.y1 + 1):
            return False
        if not self.polys:
            return self.box.contains_pt(x, y, m)
        poly = self.polys[0]
        if not point_in_poly(x, y, poly):
            return False
        return m <= 0 or dist_to_poly(x, y, poly) > m


class Edge:
    def __init__(self, eid, info):
        self.id = eid
        self.src = info["src"]
        self.dst = info["dst"]
        self.scope = info["scope"]
        self.arrow = info["arrow"]
        self.lines = []        # sampled polylines
        self.corners = []      # vertex polylines (rounded corners folded)
        self.labels = []
        self.box = None
        self.z = 0
        self.in_seq = False
        self.curved = False
        self.hidden = False
        self.classes = []

    @property
    def lifeline(self):
        return self.dst == "" or self.src == ""

    @property
    def length(self):
        return sum(poly_len(l) for l in self.lines)


class Diagram:
    def __init__(self):
        self.W = self.H = 0.0     # outer viewBox size
        self.width_attr = None    # intrinsic width (d2 --scale 1 writes it); None = stretches to the column
        self.vb = None            # inner viewBox Box
        self.bg = (255, 255, 255)
        self.nodes = {}
        self.edges = []
        self.texts = []
        self.fonts = {}
        self.class_colors = {}
        self.dark_colors = {}
        self.bg_cls = None
        self.fill_regions = []
        self.appendix = []
        self.remote_images = []
        self.mask_rects = []
        self.warnings = []
        self.seq_scopes = set()
        self.legend = None        # Box of the native legend frame
        self.precise_text = False


def _translate(el):
    t = el.get("transform") or ""
    m = re.search(r"translate\(\s*([-\d.eE+]+)[ ,]+([-\d.eE+]+)?\s*\)", t)
    if m:
        return float(m.group(1)), float(m.group(2) or 0)
    return 0.0, 0.0


def _local(tag):
    return tag.split("}", 1)[1] if "}" in tag else tag


# subtrees that draw nothing where they sit: arrowhead <marker>s (drawn via url(#..)), masks, defs
_NOT_DRAWN = ("marker", "mask", "defs", "clipPath", "pattern", "style", "title")


def _iter_drawn(el):
    """el and its descendants without the _NOT_DRAWN subtrees. A crow's-foot marker path lives in marker
    space (M4.8,0 4.8,18): counted as drawn, it stretches the edge and the content box to the canvas corner."""
    yield el
    for ch in el:
        if _local(ch.tag) not in _NOT_DRAWN:
            yield from _iter_drawn(ch)


def _open_path(d, pts):
    """an unclosed stroke (no Z, ends away from its start): a cylinder's rim, a queue's end cap"""
    return bool(pts) and not re.search(r"[Zz]", d or "") and math.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) > 1.0


def _style(el, key):
    st = el.get("style") or ""
    m = re.search(r"(?:^|;)\s*%s\s*:\s*([^;]+)" % re.escape(key), st)
    return m.group(1).strip() if m else el.get(key)


def _num(v, default=None):
    try:
        return float(re.sub(r"px$", "", (v or "").strip()))
    except ValueError:
        return default


def load(path):
    raw = open(path, "r", encoding="utf-8", errors="replace").read()
    dg = Diagram()
    dg.precise_text = bool(re.search(r"text-rendering\s*:\s*geometricPrecision", raw))
    slack = SLACK_PRECISE if dg.precise_text else SLACK_HINTED
    # fonts
    fam_of_class = {}
    for cls, fam in re.findall(r"\.d2-\d+[^\s{]*\s+\.(text[\w-]*)\s*\{\s*font-family:\s*\"([^\"]+)\"", raw):
        fam_of_class[cls] = fam
    fam_data = {}
    for fam, b64 in re.findall(r"font-family:\s*([\w-]+);\s*src:\s*url\(\"data:application/font-woff;base64,([^\"]+)\"\)", raw):
        try:
            fam_data[fam] = FontMetrics(base64.b64decode(b64))
        except Exception as e:  # pragma: no cover
            dg.warnings.append("font %s unreadable (%s); widths estimated" % (fam, e))
    for cls, fam in fam_of_class.items():
        if fam in fam_data:
            dg.fonts[cls] = fam_data[fam]
    # class colors (light mode = rules outside @media)
    light = re.split(r"@media", raw, maxsplit=1)[0]
    for name, col in re.findall(r"\.(fill-[A-Za-z0-9]+)\s*\{\s*fill:\s*(#[0-9A-Fa-f]{3,8})", light):
        dg.class_colors.setdefault(name, parse_color(col))
    if "prefers-color-scheme:dark" in raw.replace(" ", ""):
        dark = raw.split("prefers-color-scheme:dark", 1)[1]
        for name, col in re.findall(r"\.(fill-[A-Za-z0-9]+)\s*\{\s*fill:\s*(#[0-9A-Fa-f]{3,8})", dark):
            dg.dark_colors.setdefault(name, parse_color(col))
    try:
        root = ET.fromstring(raw.encode("utf-8"))
    except ET.ParseError:
        cleaned = re.sub(r"(<foreignObject[^>]*>).*?(</foreignObject>)", r"\1\2", raw, flags=re.S)
        root = ET.fromstring(cleaned.encode("utf-8"))
    vb = [float(v) for v in (root.get("viewBox") or "0 0 0 0").split()]
    dg.W, dg.H = vb[2], vb[3]
    dg.width_attr = _num(root.get("width"))
    inner = None
    for el in root.iter():
        if _local(el.tag) == "svg" and "d2-svg" in (el.get("class") or ""):
            inner = el
            break
    if inner is None:
        raise ValueError("no <svg class='d2-svg'> found - is this a d2 SVG?")
    ivb = [float(v) for v in (inner.get("viewBox") or "0 0 0 0").split()]
    dg.vb = Box(ivb[0], ivb[1], ivb[0] + ivb[2], ivb[1] + ivb[3])
    n_boards = sum(1 for el in root.iter() if _local(el.tag) == "svg" and "d2-svg" in (el.get("class") or ""))
    if n_boards > 1:
        dg.warnings.append("%d boards in one SVG; only the first is linted" % n_boards)
    z = [0]

    def fill_cls(el):
        return next((t for t in (el.get("class") or "").split() if t.startswith("fill-")), None)

    def color_of(el):
        c = parse_color(el.get("fill"))
        if c is None:
            for tok in (el.get("class") or "").split():
                if tok in dg.class_colors:
                    c = dg.class_colors[tok]
        if c is None:
            c = parse_color(_style(el, "fill") or "")
        return c

    def alpha_of(el, group_alpha=1.0):
        a = group_alpha
        for key in ("opacity", "fill-opacity"):
            v = _style(el, key)
            if v:
                try:
                    a *= float(v)
                except ValueError:
                    pass
        f = (el.get("fill") or "").lower()
        if f in ("none", "transparent"):
            return 0.0
        return a

    def text_from(el, tx, ty, owner, kind):
        x = float(el.get("x") or 0) + tx
        y = float(el.get("y") or 0) + ty
        fsm = re.search(r"font-size:\s*([\d.]+)px", el.get("style") or "")
        fs = float(fsm.group(1)) if fsm else 16.0
        am = re.search(r"text-anchor:\s*(\w+)", el.get("style") or "")
        anchor_ = am.group(1) if am else "start"
        cls = el.get("class") or ""
        fcls = next((t for t in cls.split() if t.startswith("text")), "text")
        fm = dg.fonts.get(fcls) or dg.fonts.get("text")
        lines = []
        tsp = [c for c in el if _local(c.tag) == "tspan"]
        if tsp:
            by = y
            for t in tsp:
                by += float(t.get("dy") or 0)
                lx = float(t.get("x")) + tx if t.get("x") else x
                lines.append((lx, by, "".join(t.itertext())))
        else:
            lines.append((x, y, "".join(el.itertext())))
        content = "\n".join(l[2] for l in lines)
        if not content.strip():
            return None
        box = None
        glyphs = []
        line_boxes = []
        mono = "mono" in fcls
        for lx, by, s in lines:
            w = fm.width(s, fs) if fm else len(s) * fs * (0.6 if mono else 0.53)
            w *= slack
            if anchor_ == "middle":
                x0 = lx - w / 2
            elif anchor_ == "end":
                x0 = lx - w
            else:
                x0 = lx
            top = max(glyph_top(ch) for ch in s) if s else 0.5
            bot = max(glyph_bot(ch) for ch in s) if s else 0.0
            b = Box(x0, by - top * fs, x0 + w, by + bot * fs)
            gx = x0
            for ch in s:
                adv = (fm.width(ch, fs) if fm else fs * (0.6 if mono else 0.53)) * slack
                ib = fm.ink_box.get(ord(ch)) if fm else None
                if ib and ib[2] > ib[0]:  # the glyph's real outline box
                    k = fs / fm.upem
                    glyphs.append(Box(gx + ib[0] * k, by - ib[3] * k, gx + ib[2] * k, by - ib[1] * k))
                elif not ch.isspace():
                    glyphs.append(Box(gx + adv * 0.06, by - glyph_top(ch) * fs, gx + adv * 0.94, by + glyph_bot(ch) * fs))
                gx += adv
            if s.strip():
                line_boxes.append(b)
            box = b if box is None else box.union(b)
        t = Text(owner, kind, lines, box, fs, color_of(el), "bold" in fcls, content)
        t.cls = fill_cls(el)
        t.glyphs = glyphs
        t.line_boxes = line_boxes or [box]
        z[0] += 1
        t.z = z[0]
        return t

    def shape_geometry(g, tx, ty, node, galpha):
        rects = []
        for el in _iter_drawn(g):
            tag = _local(el.tag)
            etx, ety = tx, ty
            ttx, tty = _translate(el)
            etx += ttx
            ety += tty
            poly = None
            if tag == "rect" and el.get("width"):
                x = float(el.get("x") or 0) + etx
                y = float(el.get("y") or 0) + ety
                w, h = float(el.get("width")), float(el.get("height"))
                poly = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
                rects.append(Box(x, y, x + w, y + h))
            elif tag in ("ellipse", "circle"):
                cx = float(el.get("cx") or 0) + etx
                cy = float(el.get("cy") or 0) + ety
                rx = float(el.get("rx") or el.get("r") or 0)
                ry = float(el.get("ry") or el.get("r") or 0)
                poly = [(cx + rx * math.cos(2 * math.pi * k / 48), cy + ry * math.sin(2 * math.pi * k / 48)) for k in range(48)]
            elif tag == "path":
                subs = path_polylines(el.get("d"), etx, ety)
                if subs:
                    poly = max(subs, key=lambda s: Box.of_points(s).w * Box.of_points(s).h)
                    for s in subs:
                        b = Box.of_points(s)
                        node.box = b if node.box is None else node.box.union(b)
            elif tag in ("polygon", "polyline"):
                nums = [float(v) for v in re.findall(r"[-\d.eE+]+", el.get("points") or "")]
                poly = [(nums[k] + etx, nums[k + 1] + ety) for k in range(0, len(nums) - 1, 2)]
            elif tag == "image":
                x = float(el.get("x") or 0) + etx
                y = float(el.get("y") or 0) + ety
                w, h = float(el.get("width") or 0), float(el.get("height") or 0)
                poly = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
                node.remote_image = _check_image(el) or node.remote_image
            elif tag == "text" and el is not g:
                t = text_from(el, etx, ety, node.id, "internal")
                if t:
                    node.internal.append(t)
                continue
            if poly and len(poly) >= 3:
                b = Box.of_points(poly)
                node.box = b if node.box is None else node.box.union(b)
                cls = el.get("class") or ""
                if "sketch-overlay" in cls:
                    continue
                if tag == "path" and node.polys and _open_path(el.get("d"), poly):
                    node.strokes.append(poly)  # drawn across the shape's inside: must clear the label
                if not node.sig:
                    node.sig = tag if tag != "path" else "path:" + re.sub(r"[^A-Za-z]", "", el.get("d") or "")[:24]
                    node.core = b
                node.polys.append(poly)
                c = color_of(el)
                a = alpha_of(el, galpha)
                sk = (el.get("stroke") or "").lower()
                if tag == "image" or (c is not None and a > 0) or (galpha > 0.05 and sk not in ("", "none", "transparent")
                                                                   and (_style(el, "stroke-width") or "1") not in ("0", "0.0")):
                    node.paints = True
                if c is not None and a > 0:
                    z[0] += 1
                    dg.fill_regions.append((z[0], poly, b, c, a, fill_cls(el)))
                    if node.fill is None:
                        node.fill = c
                        node.opacity = a
        if any("class_header" in (el.get("class") or "") for el in g.iter()):
            node.sig = "table"  # sql_table / class: height follows the row count
        # style.multiple draws a back copy first and the node itself last, same size
        elif len(rects) >= 2 and abs(rects[0].w - rects[-1].w) < 0.5 and abs(rects[0].h - rects[-1].h) < 0.5:
            node.core = rects[-1]

    def _check_image(el):
        href = el.get("href") or el.get("{http://www.w3.org/1999/xlink}href") or ""
        if href and not href.startswith("data:"):
            dg.remote_images.append(href)
            return True
        return False

    def walk(parent, tx, ty, galpha, top=False):
        seen_bg = False
        for el in parent:
            tag = _local(el.tag)
            if tag in ("style", "title", "marker", "defs"):
                continue
            if tag == "mask":
                for r in el:
                    if _local(r.tag) == "rect" and (r.get("fill") or "") == "black":
                        x, y = float(r.get("x")), float(r.get("y"))
                        dg.mask_rects.append(Box(x, y, x + float(r.get("width")), y + float(r.get("height"))))
                continue
            if top and tag == "rect":
                if not seen_bg:  # canvas background: fill attr, or only a class with --dark-theme
                    seen_bg = True
                    dg.bg_cls = fill_cls(el)
                    dg.bg = parse_color(el.get("fill")) or dg.class_colors.get(dg.bg_cls) or dg.bg
                elif el.get("width"):  # native legend frame
                    x, y = float(el.get("x") or 0), float(el.get("y") or 0)
                    b = Box(x, y, x + float(el.get("width")), y + float(el.get("height") or 0))
                    dg.legend = b if dg.legend is None else dg.legend.union(b)
                continue
            if top and tag == "text":  # native legend title and item labels
                t = text_from(el, tx, ty, "legend", "legend")
                if t:
                    dg.texts.append(t)
                continue
            dtx, dty = _translate(el)
            cls = el.get("class") or ""
            if tag == "a":
                walk(el, tx + dtx, ty + dty, galpha)
                continue
            if tag == "g" and "appendix-icon" in cls:
                dg.appendix.append(Box(tx + dtx, ty + dty, tx + dtx + 32, ty + dty + 32))
                continue
            if tag != "g":
                continue
            if "scale(" in (el.get("transform") or ""):
                continue  # legend sample (scaled copy of a node or edge): not part of the diagram
            oid = decode_id(cls)
            if oid is None:
                walk(el, tx + dtx, ty + dty, galpha)
                continue
            ga = galpha
            op = _style(el, "opacity")
            if op:
                try:
                    ga *= float(op)
                except ValueError:
                    pass
            user_classes = cls.split()[1:]
            einfo = parse_edge_id(oid)
            if einfo:
                e = Edge(oid, einfo)
                e.classes = user_classes
                e.hidden = ga < 0.05
                z[0] += 1
                e.z = z[0]
                for ch in _iter_drawn(el):
                    ctag = _local(ch.tag)
                    if ctag == "path" and "connection" in (ch.get("class") or ""):
                        ptx, pty = _translate(ch)
                        e.lines.extend(path_polylines(ch.get("d"), tx + dtx + ptx, ty + dty + pty, 16))
                        corners, curved = path_polylines(ch.get("d"), tx + dtx + ptx, ty + dty + pty, corners=True)
                        e.corners.extend(corners)
                        e.curved = e.curved or curved
                    elif ctag == "text":
                        t = text_from(ch, tx + dtx, ty + dty, oid, "edge-label")
                        if t:
                            t.alpha = ga
                            e.labels.append(t)
                if e.lines:
                    e.box = Box.of_points([p for l in e.lines for p in l])
                dg.edges.append(e)
                continue
            n = Node(oid)
            n.classes = user_classes
            n.hidden = ga < 0.05
            n.opacity = ga
            z[0] += 1
            n.z = z[0]
            for ch in el:
                ctag = _local(ch.tag)
                ccls = ch.get("class") or ""
                if ctag == "g" and ccls.split()[:1] == ["shape"]:
                    n.is_group = "blend" in ccls.split()
                    a2 = ga * (0.5 if n.is_group else 1.0)
                    shape_geometry(ch, tx + dtx, ty + dty, n, a2)
                elif ctag == "text":
                    t = text_from(ch, tx + dtx, ty + dty, oid, "label")
                    if t:
                        t.alpha = ga
                        n.labels.append(t)
                elif ctag == "image":
                    x = float(ch.get("x") or 0) + tx + dtx
                    y = float(ch.get("y") or 0) + ty + dty
                    ib = Box(x, y, x + float(ch.get("width") or 0), y + float(ch.get("height") or 0))
                    n.icons.append(ib)
                    n.icon_ink.append(icon_ink_box(ch.get("href") or ch.get("{http://www.w3.org/1999/xlink}href") or "", ib))
                    _check_image(ch)
                elif ctag == "g":
                    for fo in ch.iter():
                        if _local(fo.tag) == "foreignObject":
                            x = float(fo.get("x") or 0) + tx + dtx
                            y = float(fo.get("y") or 0) + ty + dty
                            b = Box(x, y, x + float(fo.get("width") or 0), y + float(fo.get("height") or 0))
                            n.box = b if n.box is None else n.box.union(b)
                            n.polys.append([(b.x0, b.y0), (b.x1, b.y0), (b.x1, b.y1), (b.x0, b.y1)])
                            if n.core is None:
                                n.core, n.sig = b, "markdown"
            if n.box is None and n.labels:
                n.is_text_shape = True
                n.box = union_all(t.box for t in n.labels)
                n.core, n.sig = n.box, "text"
            dg.nodes[oid] = n

    # --animate-interval packs every board into one SVG, one <g style="animation: d2Transition-..."> per frame
    frames = [el for el in inner if _local(el.tag) == "g" and "d2Transition" in (el.get("style") or "")]
    if len(frames) > 1:
        dg.warnings.append("animated SVG: %d frames; only the first (the base board) is linted" % len(frames))
    walk(frames[0] if len(frames) > 1 else inner, 0.0, 0.0, 1.0, top=True)

    # hierarchy (hidden containers still own their children)
    for nid, n in dg.nodes.items():
        parts = split_path(nid)
        for k in range(len(parts) - 1, 0, -1):
            pid = ".".join(parts[:k])
            if pid in dg.nodes:
                n.parent = pid
                dg.nodes[pid].children.append(nid)
                break
    # sequence diagram scopes (lifelines) and roles
    for e in dg.edges:
        if e.lifeline:
            dg.seq_scopes.add(e.scope)
    if dg.seq_scopes:
        for n in dg.nodes.values():
            n.in_seq = any(_in_scope(n.id, s) for s in dg.seq_scopes)
        for e in dg.edges:
            e.in_seq = any(_in_scope(e.src or e.dst, s) for s in dg.seq_scopes)
        actors = {x for e in dg.edges if e.lifeline for x in (e.src, e.dst) if x}
        for n in dg.nodes.values():
            if not n.in_seq:
                continue
            if n.is_group:
                n.seq_role = "group"
            elif n.id in actors:
                n.seq_role = "actor"
            elif n.parent in actors or (n.parent and dg.nodes[n.parent].seq_role in ("span", "note")):
                n.seq_role = "note" if n.labels else "span"
    # edge labels -> the knock-out rect d2 masks around them (the label's visual footprint). Arrowhead
    # labels (source-/target-arrowhead.label: multiplicities, cardinalities) get no mask and sit at an end.
    for e in dg.edges:
        ends = [l[0] for l in e.lines[:1]] + [l[-1] for l in e.lines[-1:]]
        mid = _point_at(e.lines, 0.5)
        for t in e.labels:
            t.mask = next((m for m in dg.mask_rects if m.contains_pt(t.box.cx, t.box.cy)), None)
            if t.mask is None and ends and mid:
                d_end = min(math.hypot(t.box.cx - p[0], t.box.cy - p[1]) for p in ends)
                if d_end < math.hypot(t.box.cx - mid[0], t.box.cy - mid[1]):
                    t.role = "arrowhead"
    # label kinds; hidden objects draw nothing
    for n in dg.nodes.values():
        if n.hidden:
            continue
        for t in n.labels:
            t.kind = "container-label" if n.is_container or n.is_group else "node-label"
            dg.texts.append(t)
        dg.texts.extend(n.internal)
    for e in dg.edges:
        if not e.hidden:
            dg.texts.extend(e.labels)
    return dg


def _point_at(lines, frac):
    """point at `frac` of the total length along a list of polylines"""
    total = sum(poly_len(l) for l in lines)
    if not total:
        return None
    goal = total * frac
    for l in lines:
        for k in range(len(l) - 1):
            L = math.hypot(l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1])
            if goal <= L and L > 0:
                t = goal / L
                return (l[k][0] + t * (l[k + 1][0] - l[k][0]), l[k][1] + t * (l[k + 1][1] - l[k][1]))
            goal -= L
    return lines[-1][-1]


def content_box(dg):
    """union of everything d2 drew (nodes, labels, edges, legend) in inner-viewBox coordinates"""
    boxes = [n.box for n in dg.nodes.values() if n.box and not n.hidden]
    boxes += [t.box for t in dg.texts]
    boxes += [e.box for e in dg.edges if e.box and not e.hidden]
    boxes.append(dg.legend)
    return union_all(boxes)


def largest_empty_square(dg, content, cell=12.0, pad=6.0):
    """largest square of the drawing with no node, label, edge or legend in it (container
    interiors count as empty) - the 'dead space' readers notice. Returns a Box or None."""
    nx, ny = int(math.ceil(content.w / cell)), int(math.ceil(content.h / cell))
    if nx < 2 or ny < 2 or nx * ny > 400000:
        return None
    occ = [bytearray(nx) for _ in range(ny)]

    def mark(b):
        x0 = max(0, int((b.x0 - pad - content.x0) // cell))
        x1 = min(nx - 1, int((b.x1 + pad - content.x0) // cell))
        y0 = max(0, int((b.y0 - pad - content.y0) // cell))
        y1 = min(ny - 1, int((b.y1 + pad - content.y0) // cell))
        for y in range(y0, y1 + 1):
            occ[y][x0:x1 + 1] = b"\x01" * (x1 - x0 + 1) if x1 >= x0 else b""
    for n in dg.nodes.values():
        if n.box and not n.hidden and not n.is_container and not n.is_group:
            mark(n.box)
    for t in dg.texts:
        mark(t.box)
    for e in dg.edges:
        if not e.hidden:
            for l in e.lines:
                for p in densify(l, cell / 2):
                    mark(Box(p[0], p[1], p[0], p[1]))
    if dg.legend:
        mark(dg.legend)
    best, where_ = 0, None
    h = [0] * nx
    for y in range(ny):
        row = occ[y]
        for x in range(nx):
            h[x] = 0 if row[x] else h[x] + 1
        st = []
        for x in range(nx + 1):
            cur = h[x] if x < nx else 0
            start = x
            while st and st[-1][1] >= cur:
                sx, sh = st.pop()
                side = min(sh, x - sx)
                if side > best:
                    best, where_ = side, (sx, y - sh + 1, x - sx, sh)
                start = sx
            st.append((start, cur))
    if not where_:
        return None
    sx, sy, w, hgt = where_
    x0 = content.x0 + (sx + (w - best) / 2) * cell
    y0 = content.y0 + (sy + (hgt - best) / 2) * cell
    return Box(x0, y0, x0 + best * cell, y0 + best * cell)


def where(b, content):
    """'bottom-left' style position of box b inside the content box"""
    fx = (b.cx - content.x0) / content.w if content.w else 0.5
    fy = (b.cy - content.y0) / content.h if content.h else 0.5
    v = "top" if fy < 1 / 3 else "bottom" if fy > 2 / 3 else "middle"
    hz = "left" if fx < 1 / 3 else "right" if fx > 2 / 3 else "center"
    return "centre" if (v, hz) == ("middle", "center") else "%s-%s" % (v, hz)


def display(dg, column):
    """(displayed width, displayed height, scale) of the diagram in a `column`-px doc column"""
    if not dg.W:
        return 0.0, 0.0, 1.0
    if dg.width_attr:
        disp_w = min(dg.width_attr, column)
    else:
        disp_w = column  # no intrinsic size: an <img> with max-width:100% stretches it to the column
    scale = disp_w / dg.W
    return disp_w, dg.H * scale, scale


def _in_scope(nid, scope):
    return scope == "" or nid == scope or nid.startswith(scope + ".")


def is_ancestor(dg, a, b):
    """a is b or an ancestor of b"""
    while b:
        if a == b:
            return True
        b = dg.nodes[b].parent if b in dg.nodes else None
    return False


# ----------------------------------------------------------------------------
# checks
# ----------------------------------------------------------------------------


class Finding:
    def __init__(self, sev, code, msg, box=None, objs=(), boxes=None):
        self.sev, self.code, self.msg, self.box, self.objs = sev, code, msg, box, list(objs)
        self.boxes = boxes if boxes is not None else ([box] if box else [])
        self.num = None

    def as_dict(self):
        d = {"severity": self.sev, "code": self.code, "message": self.msg, "objects": self.objs,
             "anchor": anchor(self.code)}
        if self.num:
            d["num"] = self.num
        if self.box:
            d["box"] = self.box.as_list()
        return d


def short(s, n=48):
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[:n - 3] + "..."


def names(ids, n=4):
    ids = list(ids)
    out = ", ".join(ids[:n])
    return out + (" +%d more" % (len(ids) - n) if len(ids) > n else "")


def run_checks(dg, column=800.0):
    F = []
    vis = [n for n in dg.nodes.values() if not n.hidden and n.box]
    leaves = [n for n in vis if not n.is_container and not n.is_group]
    containers = [n for n in vis if n.is_container or n.is_group]
    edges = [e for e in dg.edges if not e.hidden and e.box]
    real = [e for e in edges if not e.lifeline and not e.in_seq]
    texts = dg.texts

    # --- display geometry (what the reader sees) -------------------------------
    disp_w, disp_h, scale = display(dg, column)
    content = content_box(dg)
    ar = (content.w / content.h) if content and content.h else (dg.W / dg.H if dg.H else 0)
    fs_all = [t.fs for t in texts]
    min_fs = min(fs_all) if fs_all else None
    summary = {
        "canvas_px": [round(dg.W), round(dg.H)],
        "intrinsic_size": bool(dg.width_attr),
        "column": column,
        "display_px": [round(disp_w), round(disp_h)],
        "scale": round(scale, 2),  # the same rounding as every message
        "min_font_px": min_fs,
        "min_text_display_px": floor1(min_fs * scale) if min_fs else None,
        "aspect": round(ar, 2),
        "nodes": len(leaves), "containers": len(containers), "edges": len(edges),
        "labels": len(texts),
        "fonts_measured": sorted(dg.fonts),
        "text_layout": "geometricPrecision" if dg.precise_text else "hinted",
        "sequence_scopes": sorted(dg.seq_scopes),
    }
    col = "%dpx column" % column
    small_e = [t for t in texts if t.fs * scale < SMALL_ERR_PX - 1e-6]
    small_w = [t for t in texts if SMALL_ERR_PX - 1e-6 <= t.fs * scale < SMALL_WARN_PX - 1e-6]
    for code, sev, grp, limit in (("E-small-text", "error", small_e, SMALL_ERR_PX), ("W-small-text", "warn", small_w, SMALL_WARN_PX)):
        if grp:
            worst = min(grp, key=lambda t: t.fs)
            if scale < 0.999:  # shrunk to fit the column: how narrow must the canvas get for 12px text
                need = "canvas must be <= %dpx wide for %gpx (now %d)" % (column * worst.fs / SMALL_WARN_PX, SMALL_WARN_PX, round(dg.W))
            else:
                need = "shown at full size: raise its font-size to >= %g" % SMALL_WARN_PX
            F.append(Finding(sev, code, "%d label(s) under %.0fpx at column %d (scale %.2f): '%s' %gpx -> %.1fpx; %s" % (
                len(grp), limit, column, scale, short(worst.content, 24), worst.fs, floor1(worst.fs * scale), need),
                worst.box, [worst.owner]))
    if disp_h > TALL_FACTOR * column + 0.5:
        F.append(Finding("warn", "W-tall", "displays %dx%d in a %s: %d%% over the %dpx height budget (%.1fx the column)" % (
            round(disp_w), round(disp_h), col, round(100 * (disp_h / (TALL_FACTOR * column) - 1)), round(TALL_FACTOR * column),
            TALL_FACTOR)))
    if ar and ((ar > 2.5 and scale < 0.95) or (ar < 0.4 and disp_h > column)):
        F.append(Finding("warn", "W-aspect", "content aspect %.2f:1 (%s): %s" % (
            ar, "wide" if ar > 1 else "tall and narrow",
            "it shrinks to scale %.2f in a %s" % (scale, col) if ar > 1 else
            "%dpx tall but only %dpx wide in a %s" % (round(disp_h), round(content.w * scale), col))))
    if content and content.w * content.h > 0 and leaves and not dg.seq_scopes:
        hole = largest_empty_square(dg, content)
        if hole:
            side = hole.w * scale
            summary["largest_hole_px"] = round(side)
            if side >= max(200.0, 0.3 * disp_w):
                F.append(Finding("info", "I-sparse", "a %dx%dpx empty region (%s) - dead space in the column view" % (
                    round(side), round(side), where(hole, content)), hole))

    # --- off-canvas --------------------------------------------------------
    for n in vis:
        if not n.box.inside(dg.vb, 1.0):
            F.append(Finding("error", "E-off-canvas", "node '%s' extends outside the canvas" % n.id, n.box, [n.id]))
    for t in texts:
        if not t.box.inside(dg.vb, 1.0):
            F.append(Finding("error", "E-off-canvas", "label '%s' is clipped by the canvas edge" % short(t.content), t.box, [t.owner]))

    # --- label overlaps -----------------------------------------------------
    T = texts
    for i in range(len(T)):
        for j in range(i + 1, len(T)):
            a, b = T[i], T[j]
            if a.kind == "internal" and b.kind == "internal" and a.owner == b.owner:
                continue
            if a.kind == "legend" and b.kind == "legend":
                continue
            ox, oy = a.box.overlap(b.box)
            if ox > 1.0 and oy > 1.0:
                if len(a.line_boxes) > 1 or len(b.line_boxes) > 1:  # multi-line: the lines must meet
                    ov = [p.overlap(q) for p in a.line_boxes for q in b.line_boxes]
                    ov = [o for o in ov if o[0] > 1.0 and o[1] > 1.0]
                    if not ov:
                        continue
                    ox, oy = max(ov, key=lambda o: o[0] * o[1])
                F.append(Finding("error", "E-label-overlap",
                                 "labels overlap: '%s' (%s) and '%s' (%s), %.0fx%.0fpx" % (
                                     short(a.content, 30), a.owner, short(b.content, 30), b.owner, ox, oy),
                                 a.box.union(b.box), [a.owner, b.owner]))

    # --- edge labels on nodes / straddling containers -----------------------
    for e in edges:
        for t in e.labels:
            pts = [(t.box.x0 + dx, t.box.y0 + dy)
                   for dx in _frange(0, t.box.w, 2.0) for dy in _frange(0, t.box.h, 2.0)]
            for n in leaves:
                if not n.box.intersects(t.box, 1.0):
                    continue
                if t.role == "arrowhead" and any(is_ancestor(dg, n.id, x) or is_ancestor(dg, x, n.id) for x in (e.src, e.dst) if x):
                    continue  # multiplicity/cardinality labels sit against their own endpoint by design
                hit = sum(1 for (x, y) in pts if n.contains_pt(x, y, 1.0))
                if hit * 4 >= 8:
                    F.append(Finding("error", "E-edge-label-on-node",
                                     "edge label '%s' of %s sits on node '%s' (~%dpx^2)" % (
                                         short(t.content, 30), e.id, n.id, hit * 4),
                                     t.box.union(n.box) if hit * 4 > 200 else t.box, [e.id, n.id]))
            for c in containers:
                if not c.box.intersects(t.box, 1.0) or t.box.inside(c.box.shrink(1)) or c.in_seq:
                    continue
                inside = sum(1 for (x, y) in pts if c.contains_pt(x, y, 0))
                if 0 < inside < len(pts) and min(inside, len(pts) - inside) >= 4:
                    F.append(Finding("warn", "W-edge-label-on-border",
                                     "edge label '%s' of %s straddles the border of container '%s'" % (
                                         short(t.content, 30), e.id, c.id), t.box, [e.id, c.id]))

    # --- icons ------------------------------------------------------------
    for n in vis:
        for ib, ink in zip(n.icons, n.icon_ink):
            for t in texts:
                if not ink.intersects(t.box.grow(ICON_TOUCH_PX + 4), 0):
                    continue
                # glyph ink within ICON_TOUCH_PX of the icon's ink: a descender resting on the icon reads as a collision
                hits = [g for g in (t.glyphs or [t.box]) if ink.intersects(g.grow(ICON_TOUCH_PX), 0)]
                if not hits:
                    continue
                ov = max(min(g.overlap(ink)) for g in hits)
                hint = ""
                if t.owner == n.id:
                    if n.sig == "rect" and not n.is_container:
                        lines = len(t.lines)
                        need = math.ceil(86 + 2 * t.fs * (1.3 + 1.16 * (lines - 1)))
                        hint = " - set height: %d or more (now %.0f), or drop the icon" % (need, n.box.h)
                    else:
                        hint = " - icons collide on this shape: move the icon to a rectangle or drop it"
                F.append(Finding("error", "E-icon-collision",
                                 "icon of '%s' touches label '%s' (%d glyph(s), %s)%s" % (
                                     n.id, short(t.content, 30), len(hits),
                                     "up to %.1fpx" % ov if ov > 0 else "less than %gpx apart" % ICON_TOUCH_PX, hint),
                                 ib.union(t.box), [n.id, t.owner]))
            for m in leaves:
                if m is n or is_ancestor(dg, m.id, n.id) or is_ancestor(dg, n.id, m.id):
                    continue
                if ib.intersects(m.box, 2.0):
                    F.append(Finding("error", "E-icon-collision", "icon of '%s' overlaps node '%s'" % (n.id, m.id),
                                     ib.union(m.box), [n.id, m.id]))
    for ab in dg.appendix:
        for t in texts:
            if ab.intersects(t.box, 1.0):
                F.append(Finding("error", "E-icon-collision",
                                 "tooltip/link badge overlaps label '%s'" % short(t.content, 30), ab.union(t.box), [t.owner]))

    # --- label overflow (label spills out of its shape, or was pushed outside a too-small fixed box) --
    for n in leaves:
        if n.is_text_shape or not n.polys or (n.in_seq and n.parent):
            continue
        for t in n.labels:
            if not n.contains_pt(t.box.cx, t.box.cy, 0):
                if (not n.icons and not n.in_seq and len(n.polys[0]) in (4, 5) and not n.box.intersects(t.box, 0)
                        and t.box.w > n.box.w * 0.9):
                    # d2 moves a label that does not fit outside the box; ~20px a side gives it room again
                    F.append(Finding("error", "E-label-overflow",
                                     "label '%s' is drawn outside its box '%s': drop its fixed size, or set width: %d or "
                                     "more (now %.0f)" % (short(t.content, 30), n.id, math.ceil(t.box.w + 40), n.box.w),
                                     t.box.union(n.box), [n.id]))
                continue  # outside label on purpose (person, label.near outside-*)
            per = [(x, t.box.y0) for x in _frange(t.box.x0, t.box.x1, 2)] + \
                  [(x, t.box.y1) for x in _frange(t.box.x0, t.box.x1, 2)] + \
                  [(t.box.x0, y) for y in _frange(t.box.y0, t.box.y1, 2)] + \
                  [(t.box.x1, y) for y in _frange(t.box.y0, t.box.y1, 2)]
            poly = n.polys[0]
            out = [p for p in per if not point_in_poly(p[0], p[1], poly) and dist_to_poly(p[0], p[1], poly) > 1.5]
            if len(out) >= 2:
                # the size at which the label clears the outline and the inner strokes (rim, end cap), per axis
                core = n.core or n.box
                inner = [p for s in n.strokes for p in densify(s, 2.0)]
                grow = []
                for axis, dim, now in ((0, "width", core.w), (1, "height", core.h)):
                    need = grow_to_fit(poly, per, inner, axis, now)
                    if need:
                        grow.append((need / max(now, 1.0), "%s: %d or more (now %.0f)" % (dim, math.ceil(need), now)))
                # a sensible size only (a diamond 4x taller is no fix), but always one if any fits
                grow = [g for r, g in sorted(grow) if r <= 3 or g == min(grow)[1]]
                hint = ("set " + " or ".join(grow)) if grow else "wrap it with \\n"
                F.append(Finding("error", "E-label-overflow",
                                 "label '%s' spills outside node '%s': drop its fixed size, or %s" % (
                                     short(t.content, 30), n.id, hint), t.box.union(n.box), [n.id]))
                continue
            # the shape's own inner stroke (cylinder rim, queue end cap) drawn across the label's glyphs
            pts = [p for s in n.strokes for p in densify(s, 1.0)]
            hits = [(p, g) for g in (t.glyphs or t.line_boxes) for p in pts if g.grow(0.5).contains_pt(p[0], p[1])]
            if hits:
                sb = Box.of_points([p for s in n.strokes for p in s])
                core = n.core or n.box
                gl = t.glyphs or t.line_boxes
                # d2 centres the label: growing the shape by D moves the label D/2 away from a rim or cap
                if sb.w >= sb.h:  # a rim across the top (cylinder): the label must sit lower
                    pen = max(max((p[1] for p in pts if g.x0 - 1 <= p[0] <= g.x1 + 1), default=g.y0) - g.y0 for g in gl)
                    need = "set height: %d or more (now %.0f)" % (math.ceil(core.h + 2 * (pen + 3)), core.h)
                else:             # an end cap at the side (queue): the label must sit further from it
                    pen = max(g.x1 - min((p[0] for p in pts if g.y0 - 1 <= p[1] <= g.y1 + 1), default=g.x1) for g in gl)
                    need = "set width: %d or more (now %.0f)" % (math.ceil(core.w + 2 * (pen + 3)), core.w)
                F.append(Finding("error", "E-label-overflow",
                                 "the %s of '%s' crosses its label '%s': %s, or drop the fixed size (d2 then clears it)" % (
                                     "top rim" if sb.w >= sb.h else "end cap", n.id, short(t.content, 30), need),
                                 t.box.union(sb), [n.id]))

    # --- node overlap & containment ----------------------------------------
    for i in range(len(leaves)):
        a = leaves[i]
        for j in range(i + 1, len(leaves)):
            b = leaves[j]
            if (a.in_seq or b.in_seq) or not a.box.intersects(b.box, 2.0):
                continue
            if is_ancestor(dg, a.id, b.id) or is_ancestor(dg, b.id, a.id):
                continue
            ob = Box(max(a.box.x0, b.box.x0), max(a.box.y0, b.box.y0), min(a.box.x1, b.box.x1), min(a.box.y1, b.box.y1))
            hits = sum(1 for x in _frange(ob.x0, ob.x1, 2) for y in _frange(ob.y0, ob.y1, 2)
                       if a.contains_pt(x, y, 1) and b.contains_pt(x, y, 1))
            if hits >= 3:
                F.append(Finding("error", "E-node-overlap", "nodes '%s' and '%s' overlap" % (a.id, b.id), ob, [a.id, b.id]))
    for n in vis:
        if n.parent and not n.in_seq:
            p = dg.nodes[n.parent]
            if p.box and not p.hidden and not n.box.inside(p.box, 1.0):
                F.append(Finding("error", "E-child-outside",
                                 "'%s' sticks out of its container '%s'" % (n.id, p.id), n.box, [n.id, p.id]))

    # --- edges vs nodes / labels / containers ------------------------------
    dense = {e.id: [densify(l, 2.0) for l in e.lines] for e in edges}
    label_obstacles = [(t.box.shrink(1.0), t) for t in texts]
    for e in real:
        ends = [x for x in (e.src, e.dst) if x]
        pts = [p for l in dense[e.id] for p in l]
        for n in leaves:
            if n.id in ends or any(is_ancestor(dg, n.id, x) for x in ends) or not n.box.intersects(e.box, -1):
                continue
            inside = [p for p in pts if n.contains_pt(p[0], p[1], 3.0)]
            if len(inside) >= 3:
                F.append(Finding("error", "E-edge-through-node",
                                 "edge %s passes through node '%s'" % (e.id, n.id), n.box, [e.id, n.id]))
        for c in containers:
            if c.in_seq or any(is_ancestor(dg, c.id, x) for x in ends) or not c.box.intersects(e.box, -1):
                continue
            inside = [p for p in pts if c.contains_pt(p[0], p[1], 3.0)]
            if len(inside) >= 6:
                F.append(Finding("warn", "W-edge-through-container",
                                 "edge %s cuts through container '%s' (neither endpoint is inside it)" % (e.id, c.id),
                                 Box.of_points(inside).grow(4), [e.id, c.id]))
        for ob, t in label_obstacles:
            if t.owner == e.id or not ob.intersects(e.box, -1):
                continue
            inside = [p for p in pts if ob.contains_pt(p[0], p[1])]
            if len(inside) >= 4:   # >= ~8px of line drawn across the glyphs
                F.append(Finding("error", "E-edge-through-label",
                                 "edge %s is drawn across label '%s' (%s)" % (e.id, short(t.content, 30), t.owner),
                                 t.box.grow(3), [e.id, t.owner]))

    # --- edge vs edge: crossings & overlaps (uniform grid over segments keeps big diagrams fast) --
    CELL = 48.0
    grid = {}
    segs = []
    for ei, e in enumerate(real):
        for l in e.lines:
            for k in range(len(l) - 1):
                p, q = l[k], l[k + 1]
                x0, x1 = min(p[0], q[0]), max(p[0], q[0])
                y0, y1 = min(p[1], q[1]), max(p[1], q[1])
                si = len(segs)
                segs.append((ei, p, q, x0, y0, x1, y1))
                for gx in range(int(x0 // CELL), int(x1 // CELL) + 1):
                    for gy in range(int(y0 // CELL), int(y1 // CELL) + 1):
                        grid.setdefault((gx, gy), []).append(si)
    shared_nodes = {}

    def shared(ai, bi):
        key = (ai, bi)
        if key not in shared_nodes:
            a, b = real[ai], real[bi]
            shared_nodes[key] = [dg.nodes[x] for x in {a.src, a.dst} & {b.src, b.dst} if x in dg.nodes]
        return shared_nodes[key]
    found = {}
    seen_pairs = set()
    for cell in grid.values():
        for i in range(len(cell)):
            sa = segs[cell[i]]
            for j in range(i + 1, len(cell)):
                sb = segs[cell[j]]
                if sa[0] == sb[0]:
                    continue
                key = (cell[i], cell[j]) if cell[i] < cell[j] else (cell[j], cell[i])
                if key in seen_pairs:
                    continue
                seen_pairs.add(key)
                if sa[5] + 0.5 < sb[3] or sb[5] + 0.5 < sa[3] or sa[6] + 0.5 < sb[4] or sb[6] + 0.5 < sa[4]:
                    continue
                p = seg_intersection(sa[1], sa[2], sb[1], sb[2])
                if not p:
                    continue
                ai, bi = (sa[0], sb[0]) if sa[0] < sb[0] else (sb[0], sa[0])
                pts_found = found.setdefault((ai, bi), [])
                if any(math.hypot(p[0] - q[0], p[1] - q[1]) < 6 for q in pts_found):
                    continue
                if any(n.box and n.box.grow(14).contains_pt(p[0], p[1]) for n in shared(ai, bi)):
                    continue  # fan-in / fan-out touching next to the shared node
                pts_found.append(p)
    crossings = [(real[ai].id, real[bi].id, p) for (ai, bi), ps in sorted(found.items()) for p in ps]
    if crossings:
        boxes = [Box(p[0] - 8, p[1] - 8, p[0] + 8, p[1] + 8) for _, _, p in crossings]
        if len(crossings) <= 4:
            for (aid, bid, p), bx in zip(crossings, boxes):
                F.append(Finding("warn", "W-edge-crossing", "edges %s and %s cross at (%.0f,%.0f)" % (aid, bid, p[0], p[1]),
                                 bx, [aid, bid]))
        else:
            F.append(Finding("warn", "W-edge-crossing", "%d edge crossings, e.g. %s x %s" % (
                len(crossings), crossings[0][0], crossings[0][1]),
                None, sorted({c[0] for c in crossings} | {c[1] for c in crossings}), boxes))
    summary["edge_crossings"] = len(crossings)
    run = {}
    for ai, a in enumerate(real):
        ends_a = [q for l in a.lines for q in (l[0], l[-1])]
        for la in dense[a.id]:
            for p in la[::2]:
                cell = grid.get((int(p[0] // CELL), int(p[1] // CELL)), ())
                hit = set()
                for si in cell:
                    sg = segs[si]
                    bi = sg[0]
                    if bi <= ai or bi in hit:
                        continue
                    b = real[bi]
                    if {a.src, a.dst} & {b.src, b.dst}:
                        continue  # fork / merge at a shared node is still traceable
                    if seg_dist(p[0], p[1], sg[1][0], sg[1][1], sg[2][0], sg[2][1]) < 1.6:
                        ends = ends_a + [q for l in b.lines for q in (l[0], l[-1])]
                        if not any(math.hypot(p[0] - q[0], p[1] - q[1]) < 6 for q in ends):
                            hit.add(bi)
                            run.setdefault((ai, bi), []).append(p)
    for (ai, bi), pts_run in sorted(run.items()):
        if len(pts_run) * 4 >= 20:
            F.append(Finding("warn", "W-edge-overlap",
                             "edges %s and %s run on top of each other for ~%dpx (reader cannot tell them apart)" % (
                                 real[ai].id, real[bi].id, len(pts_run) * 4), Box.of_points(pts_run).grow(5),
                             [real[ai].id, real[bi].id]))

    # --- edge shape: curved, diagonal, jogs, labels on bends ------------------
    curvy = [e for e in real if e.curved]
    if curvy:
        F.append(Finding("warn", "W-curved-edge", "%d of %d edges are curved splines (dagre layout); ELK draws them orthogonal" % (
            len(curvy), len(real)), None, [e.id for e in curvy], []))
    for e in real:
        if e.curved:
            continue
        tot = diag = 0.0
        lean = None  # (sideways drift, length) of the worst nearly-straight segment
        for l in e.lines:
            for k in range(len(l) - 1):
                dx, dy = l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1]
                L = math.hypot(dx, dy)
                if L < 0.5:
                    continue
                tot += L
                ang = math.degrees(math.atan2(abs(dy), abs(dx)))
                if 12 < ang < 78:
                    diag += L
                if min(abs(dx), abs(dy)) > TILT_PX and (lean is None or min(abs(dx), abs(dy)) > lean[0]):
                    lean = (min(abs(dx), abs(dy)), L, "vertical" if abs(dy) > abs(dx) else "horizontal")
        if tot > 0 and diag > 40 and diag / tot > 0.4:
            F.append(Finding("warn", "W-diagonal-edge", "edge %s is %.0f%% diagonal (%.0fpx)" % (e.id, 100 * diag / tot, diag),
                             e.box.grow(4), [e.id]))
        elif lean:
            F.append(Finding("warn", "W-diagonal-edge", "edge %s leans %.0fpx off %s over %.0fpx: its ends are not aligned" % (
                e.id, lean[0], lean[2], lean[1]), e.box.grow(4), [e.id]))
        for cl in e.corners:
            for k in range(1, len(cl) - 2):
                seg = math.hypot(cl[k + 1][0] - cl[k][0], cl[k + 1][1] - cl[k][1])
                if seg < 16:
                    F.append(Finding("warn", "W-edge-jog", "edge %s makes a %.0fpx jog between two bends" % (e.id, seg),
                                     Box.of_points([cl[k], cl[k + 1]]).grow(10), [e.id]))
                    break
        bends = [p for cl in e.corners for p in cl[1:-1]]
        for t in e.labels:
            if t.role != "main":
                continue
            area = t.box.union(t.mask) if t.mask else t.box.grow(3)
            near = [p for p in bends if area.dist_pt(p[0], p[1]) <= 10 or math.hypot(p[0] - t.box.cx, p[1] - t.box.cy) <= 8]
            if near:
                F.append(Finding("warn", "W-label-on-bend", "label '%s' of %s sits on a bend of its edge" % (
                    short(t.content, 30), e.id), t.box.union(Box.of_points(near)).grow(4), [e.id]))

    # --- fan-out: one node wired to 4+ children of one container ------------
    fan = {}
    for e in real:
        for a, b in ((e.src, e.dst), (e.dst, e.src)):
            if a not in dg.nodes or b not in dg.nodes:
                continue
            zc = dg.nodes[b].parent
            if not zc or is_ancestor(dg, zc, a) or dg.nodes[zc].hidden:
                continue
            fan.setdefault((a, zc), {}).setdefault(b, []).append(e)
    fanned = set()
    for (a, zc), ends in sorted(fan.items()):
        if len(ends) >= 4:
            es = [x for v in ends.values() for x in v]
            fanned.update(x.id for x in es)
            F.append(Finding("warn", "W-fanout", "'%s' has %d edges to children of '%s' (%s)" % (
                a, len(es), zc, names(sorted(ends))), union_all(x.box for x in es).grow(4), [a, zc]))

    # --- long edges: back-edge detours, and a node hanging off one edge far from its partner ----------
    lens = sorted(e.length for e in real)
    if len(lens) >= 4 and content:
        med = statistics.median(lens)
        deg = {}
        for e in real:
            for x in (e.src, e.dst):
                deg[x] = deg.get(x, 0) + 1
        disp = [(e.lines[-1][-1][0] - e.lines[0][0][0], e.lines[-1][-1][1] - e.lines[0][0][1]) for e in real if e.lines]
        # the reading direction most edges follow (counted per edge, so one long detour cannot flip it)
        axis = 1 if sum(1 for d in disp if abs(d[1]) >= abs(d[0])) * 2 >= len(disp) else 0
        sign = 1 if sum(1 for d in disp if d[axis] > 0) >= sum(1 for d in disp if d[axis] < 0) else -1
        for e in real:
            L = e.length
            if e.id in fanned:
                continue  # already reported as W-fanout
            if not (L > 2.5 * med and L > 0.2 * (content.w + content.h) and L > 300):
                continue
            d = (e.lines[-1][-1][axis] - e.lines[0][0][axis]) * sign
            lone = [x for x in (e.src, e.dst) if deg.get(x) == 1 and x in dg.nodes]
            if d < -20 and L > 3 * med:
                why = "a back-edge detour against the reading direction"
            elif lone:
                why = "'%s' hangs off this one edge far from its partner" % lone[0]
            else:
                continue  # a long run into a shared sink (terminal, side lane) is a layout choice
            F.append(Finding("warn", "W-long-edge", "edge %s runs %dpx (%.1fx the median edge): %s" % (e.id, L, L / med, why),
                             e.box.grow(4), [e.id]))

    # --- short edge labels ----------------------------------------------------
    for e in edges:
        for t in e.labels:
            s = t.content.strip()
            if t.role == "main" and len(s) <= 2 and s.lower() not in SHORT_LABEL_WORDS:
                F.append(Finding("warn", "W-short-label", "edge %s is labelled '%s': too short to read or mean much" % (e.id, s),
                                 t.box.grow(3), [e.id]))

    # --- sequence groups with ragged left/right edges --------------------------
    for sc in sorted(dg.seq_scopes):
        groups = [n for n in vis if n.is_group and _in_scope(n.id, sc)
                  and not any(dg.nodes[x].is_group for x in _ancestors(dg, n.id))]
        if len(groups) >= 2:
            d0 = max(g.box.x0 for g in groups) - min(g.box.x0 for g in groups)
            d1 = max(g.box.x1 for g in groups) - min(g.box.x1 for g in groups)
            if d0 > 40 or d1 > 40:
                F.append(Finding("warn", "W-seq-group-ragged", "%d sequence groups start/end at different x (spread %.0f / %.0fpx): %s" % (
                    len(groups), d0, d1, names(g.id for g in groups)), None, [g.id for g in groups], [g.box for g in groups]))

    # --- consistency: container title size, role classes, sibling sizes ---------
    leaf_fs = [t.fs for n in leaves if not n.is_text_shape and n.seq_role in (None, "actor") for t in n.labels]
    if leaf_fs:
        mx = max(leaf_fs)
        loud = [(c, max(t.fs for t in c.labels)) for c in containers if c.labels and not c.is_group and not c.in_seq]
        loud = [(c, f) for c, f in loud if f > mx + 0.5]
        if loud:
            F.append(Finding("warn", "W-title-size", "container titles outshout the %gpx node labels: %s" % (
                mx, names("%s %gpx" % (c.id, f) for c, f in loud)), None, [c.id for c, _ in loud],
                [union_all(t.box for t in c.labels) for c, _ in loud]))
    # sql_table / class shapes take no role class: a node class would paint their rows (playbooks/erd.md)
    cands = [n for n in vis if not n.is_text_shape and not n.is_group and n.seq_role != "span" and n.sig != "table"]
    if cands:
        bare = [n for n in cands if not n.classes]
        if bare and (len(cands) - len(bare)) * 2 >= len(cands):
            F.append(Finding("warn", "W-unclassed", "%d of %d nodes/containers carry no role class: %s" % (
                len(bare), len(cands), names(n.id for n in bare)), None, [n.id for n in bare], [n.box for n in bare]))
    styled = [e for e in edges if not e.lifeline]
    bare_e = [e for e in styled if not e.classes]
    if bare_e and len(styled) - len(bare_e) >= 2 and (len(styled) - len(bare_e)) * 2 >= len(styled):
        F.append(Finding("warn", "W-unclassed", "%d of %d edges carry no edge class (flow, dep, async...): %s" % (
            len(bare_e), len(styled), names(e.id for e in bare_e)), None, [e.id for e in bare_e],
            [e.box.grow(3) for e in bare_e]))
    rows = {}
    linked = {frozenset((e.src, e.dst)) for e in real}
    for n in leaves:
        if n.is_text_shape or n.in_seq or n.core is None or n.sig == "table":
            continue
        rows.setdefault((n.parent, n.sig), []).append(n)
    for (_, sig), lst in sorted(rows.items(), key=lambda kv: (str(kv[0][0]), kv[0][1])):
        lst.sort(key=lambda n: n.core.y0)
        used = set()
        for n in lst:
            if n.id in used:
                continue
            row = [n]
            for m in lst:  # side by side, and not one step of a chain (direction: right lines a chain up)
                if m.id in used or m is n or not (abs(m.core.y0 - n.core.y0) <= 2 or abs(m.core.cy - n.core.cy) <= 2
                                                 or abs(m.core.y1 - n.core.y1) <= 2):
                    continue
                if not any(frozenset((m.id, r.id)) in linked for r in row):
                    row.append(m)
            used.update(m.id for m in row)
            hs = [m.core.h for m in row]
            if len(row) >= 2 and max(hs) - min(hs) > 8:
                F.append(Finding("warn", "W-sibling-size", "siblings in one row have different heights (%s): %s" % (
                    "/".join("%.0f" % h for h in sorted(set(round(h) for h in hs))), names(m.id for m in row)),
                    None, [m.id for m in row], [m.core for m in row]))

    # --- contrast (grouped per colour pair to keep the report short) ------
    pairs = {}
    modes = [False] + ([True] if dg.dark_colors else [])
    for dark, t in [(d, t) for d in modes for t in texts]:
        if t.color is None:
            continue
        bg = background_at(dg, t.box.cx, t.box.cy, t.z, dark)
        fg = dg.dark_colors.get(t.cls, t.color) if dark and t.cls else t.color
        if t.alpha < 0.999:
            fg = blend(fg, bg, t.alpha)
        cr = contrast(fg, bg)
        if cr >= 3.0:
            continue
        key = (tuple(fg), tuple(bg), dark)
        pairs.setdefault(key, (cr, []))[1].append(t)
    for (fg, bg, dark), (cr, ts) in pairs.items():
        lbl = ", ".join("'%s'" % short(t.content, 20) for t in ts[:4]) + (" +%d more" % (len(ts) - 4) if len(ts) > 4 else "")
        F.append(Finding("error", "E-contrast-dark" if dark else "E-contrast",
                         "%s%d label(s) at %.2f:1 contrast (text #%02X%02X%02X on #%02X%02X%02X; need 3:1, 4.5:1 for body text): %s%s" % (
                             ("[dark mode] " if dark else "", len(ts), cr) + fg + bg + (
                                 lbl, " - explicit fills do not follow the dark theme" if dark else "")),
                         ts[0].box.grow(2) if len(ts) == 1 else None, [t.owner for t in ts],
                         [t.box.grow(2) for t in ts]))

    # --- misc ---------------------------------------------------------------
    for href in sorted(set(dg.remote_images)):
        F.append(Finding("warn", "W-remote-image",
                         "image not embedded (%s): it will not load when the SVG is shown via <img> (README/docs)" % short(href, 60)))
    for t in texts:
        bad = sorted(set(ch for ch in t.content if ord(ch) > 126))
        if bad:
            F.append(Finding("warn", "W-non-ascii", "label '%s' contains non-ASCII %s" % (
                short(t.content, 30), " ".join("U+%04X" % ord(c) for c in bad[:5])), t.box, [t.owner]))
    return F, summary


def _ancestors(dg, nid):
    out = []
    p = dg.nodes[nid].parent if nid in dg.nodes else None
    while p:
        out.append(p)
        p = dg.nodes[p].parent if p in dg.nodes else None
    return out


def background_at(dg, x, y, before_z, dark=False):
    def pick(c, cls):
        return dg.dark_colors.get(cls, c) if dark and cls else c
    col = pick(dg.bg, dg.bg_cls)
    for z, poly, box, c, a, cls in sorted(dg.fill_regions, key=lambda r: r[0]):
        if z > before_z:
            break
        if box.contains_pt(x, y) and point_in_poly(x, y, poly):
            c = pick(c, cls)
            col = c if a >= 0.999 else blend(c, col, a)
    return col


# ----------------------------------------------------------------------------
# semcheck merge, ordering, output
# ----------------------------------------------------------------------------


def load_sem(path, vb=None):
    """semcheck --json report -> Findings (S- codes). Unknown shapes are tolerated. A finding's `box`
    ([x0, y0, x1, y1] in the SVG's coordinates) gets it a numbered badge on the .ann.png, unless it is
    about another board or falls outside this one (`vb`)."""
    d = json.load(open(path, encoding="utf-8"))
    items = (d.get("items") or d.get("findings") or []) if isinstance(d, dict) else d
    out = []
    for it in items:
        lvl = str(it.get("level") or it.get("severity") or "warn").lower()
        sev = "error" if lvl.startswith("err") else "info" if lvl.startswith("info") else "warn"
        code = str(it.get("code") or "semantic")
        if not code.startswith("S-"):
            code = "S-" + code
        msg = str(it.get("msg") or it.get("message") or "")
        box = None
        b = it.get("box")
        if isinstance(b, (list, tuple)) and len(b) == 4 and " on board '" not in msg:
            try:
                x0, y0, x1, y1 = (float(v) for v in b)
                if x1 > x0 and y1 > y0:
                    box = Box(x0, y0, x1, y1)
            except (TypeError, ValueError):
                box = None
            if box is not None and vb is not None and not box.inside(vb, 2.0):
                box = None
        objs = it.get("objects")
        objs = [str(o) for o in objs] if isinstance(objs, list) else []
        out.append(Finding(sev, code, msg, box, objs))
    return out


def order_key(f):
    try:
        k = CODE_ORDER.index(f.code)
    except ValueError:
        k = len(CODE_ORDER) if not f.code.startswith("S-") else -1
    return (SEV_ORDER[f.sev], k, f.code)


def dedupe(F):
    seen, out = set(), []
    for f in F:
        k = (f.code, f.msg)
        if k in seen:
            continue
        seen.add(k)
        out.append(f)
    out.sort(key=order_key)
    return out


def fold(out, keep=3, limit=6):
    """keep reports readable on big diagrams: past `limit` findings of one code show `keep` and fold the rest"""
    by_code = {}
    for f in out:
        by_code.setdefault(f.code, []).append(f)
    folded = []
    for f in out:
        group = by_code[f.code]
        if len(group) <= limit or group.index(f) < keep:
            folded.append(f)
        elif group.index(f) == keep:
            rest = group[keep:]
            folded.append(Finding(f.sev, f.code, "... and %d more %s findings (%s)" % (
                len(rest), f.code, short(", ".join(sorted({o for r in rest for o in r.objs[:1]})), 160)),
                None, [o for r in rest for o in r.objs], [b for r in rest for b in r.boxes]))
    return folded


def number(F):
    k = 0
    for f in F:
        if f.boxes and f.sev != "info":
            k += 1
            f.num = k
    return k


def annotate(src_path, out_path, F, scale=1.0, vb=None):
    """copy of the SVG with a dashed box and a numbered badge per finding, sized to stay legible at `scale`;
    badges sit just outside the box's top-left corner (kept inside the canvas `vb`)"""
    raw = open(src_path, encoding="utf-8").read()
    s = 1.0 / max(scale, 0.05)
    parts = []
    placed = []
    for f in F:
        if not f.num:
            continue
        colr = "#E5484D" if f.sev == "error" else "#D97706"
        for bx in f.boxes:
            if bx.w <= 20 and bx.h <= 20:
                parts.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s" stroke-width="%.1f"/>' % (
                    bx.cx, bx.cy, 11 * s, colr, 2.5 * s))
            else:
                b = bx.grow(3 * s)
                parts.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" fill-opacity="0.08" stroke="%s" '
                             'stroke-width="%.1f" stroke-dasharray="%.1f,%.1f" rx="%.1f"/>' % (
                                 b.x0, b.y0, b.w, b.h, colr, colr, 2 * s, 6 * s, 4 * s, 4 * s))
        b = f.boxes[0].grow(3 * s)
        bx0, by0 = b.x0 - 8 * s, b.y0 - 8 * s
        if vb is not None:
            bx0 = min(max(bx0, vb.x0 + 12 * s), vb.x1 - 12 * s)
            by0 = min(max(by0, vb.y0 + 12 * s), vb.y1 - 12 * s)
        for _ in range(8):  # findings on the same spot: step the badge right so every number stays visible
            if not any(math.hypot(bx0 - px, by0 - py) < 23 * s for px, py in placed):
                break
            bx0 += 25 * s
        placed.append((bx0, by0))
        parts.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="#fff" stroke-width="%.1f"/>'
                     '<text x="%.1f" y="%.1f" fill="#fff" font-family="sans-serif" font-weight="bold" font-size="%.1f" '
                     'text-anchor="middle">%d</text>' % (bx0, by0, 11 * s, colr, 1.5 * s, bx0, by0 + 4.5 * s, 13 * s, f.num))
    overlay = '<g id="d2lint-annotations">%s</g>' % "".join(parts)
    idx = raw.rfind("</svg>")
    idx = raw.rfind("</svg>", 0, idx)  # close of the inner d2-svg
    raw = raw[:idx] + overlay + raw[idx:]
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(raw)


def display_line(summary):
    s = summary
    mt = s["min_text_display_px"]
    return "display: %dx%d at column %d (scale %.2f), min text %spx%s" % (
        s["display_px"][0], s["display_px"][1], s["column"], s["scale"],
        ("%g" % mt) if mt is not None else "-",
        "" if s["intrinsic_size"] else " (no intrinsic size: stretched to the column; render with --scale 1)")


def compact(F, n_err, n_warn, n_info):
    """d2check listing: one line per code with its recipe, then numbered findings (numbers match the .ann.png)"""
    lines = []
    by = {}
    for f in F:
        by.setdefault(f.code, []).append(f)
    for code in sorted(by, key=lambda c: order_key(by[c][0])):
        fs = by[code]
        total = sum(1 for f in fs if not f.msg.startswith("... and ")) + sum(
            int(re.match(r"\.\.\. and (\d+)", f.msg).group(1)) for f in fs if f.msg.startswith("... and "))
        lines.append("%s x%d -> %s" % (code, total, anchor(code)))
        for f in fs[:4]:
            lines.append("  %s%s" % ("[%d] " % f.num if f.num else "", short(f.msg, 170)))
        if len(fs) > 4:
            lines.append("  ...")
    return lines


EPILOG = """exit codes (shared by every script of the skill):
  0   no errors (warnings are listed but pass, unless --strict)
  1   hard failure: an input could not be read or is not a d2 SVG
  2   findings: E- or S- errors (with --strict, warnings too)
  64  usage error
examples:
  python3 d2lint.py --column 800 out/flow.svg          one report per SVG, with a verdict
  python3 d2lint.py --json out/flow.svg > lint.json    machine-readable report
  python3 d2lint.py --compact --annotate ann.svg out/flow.svg
                                                       d2check's listing + numbered boxes in ann.svg"""


class ArgParser(argparse.ArgumentParser):
    """argparse with the skill's exit convention: a usage error exits 64, not 2 (2 means findings)"""

    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(64, "%s: error: %s (run with --help for the options)\n" % (self.prog, message))


def main(argv=None):
    ap = ArgParser(prog="d2lint.py", description="Geometric and legibility lint for SVGs rendered by d2 (stdlib only). "
                   "Each finding names its recipe in workflows/review-and-fix.md.",
                   epilog=EPILOG, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="+", metavar="FILE.svg", help="SVG written by d2 (one per board)")
    ap.add_argument("--column", type=float, default=800, help="doc column width in px the diagram is read in (default 800)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of text")
    ap.add_argument("--compact", action="store_true", help="d2check listing: codes with recipe anchors + numbered findings")
    ap.add_argument("--json-out", metavar="F.json", help="also write the JSON report to a file")
    ap.add_argument("--annotate", metavar="OUT.svg", help="write a copy of the SVG with numbered boxes around findings "
                    "(single input only)")
    ap.add_argument("--sem-json", metavar="SEM.json", help="merge a semcheck --json report (S- codes)")
    ap.add_argument("--strict", action="store_true", help="exit 2 on warnings too")
    ap.add_argument("--quiet", action="store_true", help="omit I- findings and the notes on stderr")
    a = ap.parse_args(argv)
    if not 50 <= a.column <= 20000:
        ap.error("--column wants the doc column width in px, e.g. 800 (got %g)" % a.column)
    worst = 0
    unreadable = False
    all_out = []
    for p in a.svg:
        try:
            dg = load(p)
        except Exception as e:
            reason = e.strerror if isinstance(e, OSError) and e.strerror else str(e)
            print("d2lint: %s: cannot read it as a d2 SVG (%s); lint the SVG that d2 or d2check.sh wrote" % (p, reason),
                  file=sys.stderr)
            unreadable = True
            continue
        F, summary = run_checks(dg, a.column)
        if a.sem_json:
            try:
                F += load_sem(a.sem_json, dg.vb)
            except Exception as e:
                print("d2lint: cannot read semcheck report %s (%s)" % (a.sem_json, e), file=sys.stderr)
        for w in dg.warnings:
            if not a.quiet:
                print("d2lint: note: %s: %s" % (p, w), file=sys.stderr)
        F = dedupe(F)
        if a.quiet:
            F = [f for f in F if f.sev != "info"]
        n_err = sum(1 for f in F if f.sev == "error")
        n_warn = sum(1 for f in F if f.sev == "warn")
        n_info = sum(1 for f in F if f.sev == "info")
        F = fold(F)
        numbered = number(F)
        if a.annotate and len(a.svg) == 1:
            if numbered:
                annotate(p, a.annotate, F, summary["scale"], dg.vb)
            elif os.path.exists(a.annotate):
                os.remove(a.annotate)  # nothing to point at: no stale overlay
        rep = {"file": p, "summary": summary, "display": display_line(summary), "errors": n_err, "warnings": n_warn,
               "infos": n_info, "findings": [f.as_dict() for f in F]}
        all_out.append(rep)
        if a.compact:
            print("lint: %d error(s), %d warning(s)%s" % (n_err, n_warn, ", %d info" % n_info if n_info else ""))
            for line in compact(F, n_err, n_warn, n_info):
                print(line)
            print(display_line(summary))
        elif not a.json:
            s = summary
            print("d2lint %s" % p)
            print("  canvas %dx%d  aspect %.2f:1  %d nodes, %d containers, %d edges, %d labels  crossings=%d" % (
                s["canvas_px"][0], s["canvas_px"][1], s["aspect"], s["nodes"], s["containers"], s["edges"],
                s["labels"], s.get("edge_crossings", 0)))
            print("  " + display_line(s))
            for f in F:
                print("  %-5s %s%s %s -> %s" % (f.sev.upper(), ("[%d] " % f.num) if f.num else "", f.code, f.msg, anchor(f.code)))
            verdict = "FAIL" if n_err or (a.strict and n_warn) else ("PASS-with-warnings" if n_warn else "PASS")
            print("  verdict: %s (%d error(s), %d warning(s))" % (verdict, n_err, n_warn))
        if n_err or (a.strict and n_warn):
            worst = 2
    if a.json:
        print(json.dumps(all_out if len(all_out) != 1 else all_out[0], indent=1))
    if a.json_out:
        with open(a.json_out, "w", encoding="utf-8") as fh:
            json.dump(all_out if len(all_out) != 1 else all_out[0], fh, indent=1)
    return 1 if unreadable else worst


if __name__ == "__main__":
    try:
        sys.exit(main())
    except BrokenPipeError:  # e.g. piped into head
        sys.exit(0)
