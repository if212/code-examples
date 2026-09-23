#!/usr/bin/env python3
"""d2raster - rasterize a d2 SVG with the most faithful renderer available, and refuse to hand back a
blank, garbled or cropped image. Standard library only.

usage:
  d2raster.py IN.svg --out OUT.png [--scale 2] [--width PX] [--dark]     one PNG (PNG deliverables)
  d2raster.py --inspect PREFIX=IN.svg [PREFIX=IN.svg ...] [--column 800] [--dark] [--no-detail]
      the review set d2check reads, per SVG:
        PREFIX.col.png   the reader's view: displayed width min(svg width, column) at 1x
        PREFIX.2x.png    detail: 2x, capped so the long edge stays within 2000px (the Read tool's limit)
        PREFIX.ann.png   PREFIX.ann.svg (from d2lint --annotate) at the reader's-view size, if that file exists
        PREFIX.dark.png  --dark: the reader's view with prefers-color-scheme: dark on a dark page
  --route auto|playwright|chrome|rsvg|cairosvg   default $D2CHECK_ROUTE, else auto = playwright, chrome, rsvg
Routes: playwright (raster.cjs) and chrome (any Chrome/Chromium binary) render the embedded fonts and
icons exactly = faithful. rsvg-convert ignores embedded fonts (DejaVu, no bold/italic) = approximate:
judge topology and colour only. cairosvg paints d2 SVGs blank with black bars; it runs only when asked
for and its output is checked and rejected like any other.
Every PNG is checked by pngstats (blank, missing fill colours, black bars, cropped); a route whose output
fails is discarded and the next one is tried.
exit: 0 faithful | 3 only an approximate route worked | 1 nothing usable
"""
import argparse
import base64
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # keep the skill's scripts/ free of __pycache__
import pngstats  # noqa: E402

FAITHFUL = ("playwright", "chrome")
AUTO = ["playwright", "chrome", "rsvg"]
READ_LIMIT = 2000  # px on the long edge that the Read tool shows without downscaling


def svg_geometry(path):
    """(viewBox width, height, intrinsic width attribute or None)"""
    head = open(path, encoding="utf-8", errors="replace").read(8192)
    tag = re.search(r"<svg\b[^>]*>", head)  # the outer <svg>; the inner d2-svg always has a width
    m = re.search(r'viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"', tag.group(0) if tag else "")
    if not m:
        raise ValueError("no viewBox in %s" % path)
    w = re.search(r'\swidth="([\d.]+)"', tag.group(0))
    return float(m.group(3)), float(m.group(4)), (float(w.group(1)) if w else None)


def display_width(path, column):
    W, _, attr = svg_geometry(path)
    return min(attr, column) if attr else column  # no intrinsic size: <img max-width:100%> fills the column


def run(cmd, timeout=180, env=None):
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, env=env)
        return p.returncode, (p.stdout + p.stderr).decode("utf-8", "replace")
    except FileNotFoundError as e:
        return 127, str(e)
    except subprocess.TimeoutExpired:
        return 124, "timeout after %ss" % timeout


def find_chrome():
    env = os.environ.get("CHROME_PATH") or os.environ.get("D2CHECK_CHROME")
    if env and os.path.exists(env):
        return env
    for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome",
              "microsoft-edge", "microsoft-edge-stable", "brave-browser"):
        p = shutil.which(n)
        if p:
            return p
    for p in ("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"):
        if os.path.exists(p):
            return p
    import glob
    pwb = os.environ.get("PLAYWRIGHT_BROWSERS_PATH")  # when set it is authoritative; else the usual caches
    for r in ([pwb] if pwb is not None else ["/opt/pw-browsers", os.path.expanduser("~/.cache/ms-playwright"),
                                              os.path.expanduser("~/Library/Caches/ms-playwright")]):
        if not r:
            continue
        for pat in ("chromium-*/chrome-linux/chrome", "chromium-*/chrome-linux64/chrome",
                    "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium",
                    "chromium_headless_shell-*/chrome-linux/headless_shell"):
            hits = sorted(glob.glob(os.path.join(r, pat)), reverse=True)
            if hits:
                return hits[0]
    return None


# --- routes: each renders a list of jobs {in, out, scale, width, dark} -> (ok, why) ---------------------


def route_playwright(jobs):
    if not shutil.which("node"):
        return False, "node not on PATH"
    fd, jf = tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd, "w") as fh:
        json.dump(jobs, fh)
    try:
        for attempt in (1, 2):  # a browser launch can fail transiently on a loaded machine: retry once
            code, log = run(["node", os.path.join(HERE, "raster.cjs"), "--jobs", jf])
            if code in (0, 10):
                break
    finally:
        os.remove(jf)
    last = log.strip().splitlines()[-1] if log.strip() else "exit %d" % code
    return code == 0, ("ok" if code == 0 else last)


def route_chrome(jobs):
    exe = find_chrome()
    if not exe:
        return False, "no Chrome/Chromium binary found (set CHROME_PATH)"
    for j in jobs:
        W, H, _ = svg_geometry(j["in"])
        css_w = int(round(j["width"] or W))
        css_h = int(math.ceil(H * css_w / W - 0.01))
        tmp = tempfile.mkdtemp(prefix="d2raster-")
        try:
            uri = "data:image/svg+xml;base64," + base64.b64encode(open(j["in"], "rb").read()).decode()
            page = os.path.join(tmp, "page.html")
            with open(page, "w") as f:
                f.write('<!doctype html><html><body style="margin:0;background:%s"><img src="%s" '
                        'style="display:block;width:%dpx;height:auto"></body></html>' % (
                            "#0d1117" if j.get("dark") else "#fff", uri, css_w))
            # new-headless Chrome's viewport is ~87px shorter than --window-size: oversize the window, then crop
            cmd = [exe, "--headless", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run",
                   "--no-default-browser-check", "--user-data-dir=" + os.path.join(tmp, "prof"),
                   "--force-device-scale-factor=%s" % j["scale"], "--window-size=%d,%d" % (css_w, css_h + 240),
                   "--screenshot=" + os.path.abspath(j["out"]), "file://" + page]
            if hasattr(os, "geteuid") and os.geteuid() == 0:
                cmd.insert(1, "--no-sandbox")
            if j.get("dark"):
                cmd.insert(1, "--force-dark-mode")
            code, log = run(cmd, timeout=90)
            if code != 0 or not os.path.exists(j["out"]) or not os.path.getsize(j["out"]):
                return False, "%s: %s" % (os.path.basename(exe), log.strip()[-160:])
            pngstats.crop_png(j["out"], int(round(css_w * j["scale"])), int(round(css_h * j["scale"])))
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    return True, "ok"


def route_rsvg(jobs):
    if not shutil.which("rsvg-convert"):
        return False, "rsvg-convert not installed"
    for j in jobs:
        if j.get("dark"):
            continue  # no prefers-color-scheme support
        W, _, _ = svg_geometry(j["in"])
        px = int(round((j["width"] or W) * j["scale"]))
        # d2 writes icons as 'data:image/svg+xml; charset=utf-8;base64,' which rsvg rejects: normalise a copy
        fd, fixed = tempfile.mkstemp(suffix=".svg")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(re.sub(r"data:image/svg\+xml;\s*charset=[^;,]*;base64,", "data:image/svg+xml;base64,",
                            open(j["in"], encoding="utf-8", errors="replace").read()))
        try:
            code, log = run(["rsvg-convert", "-w", str(px), "-o", j["out"], fixed])
        finally:
            os.remove(fixed)
        if code:
            return False, log.strip()[-160:] or "exit %d" % code
    return True, "ok"


def route_cairosvg(jobs):
    for j in jobs:
        if j.get("dark"):
            continue
        W, _, _ = svg_geometry(j["in"])
        code, log = run([sys.executable, "-c", "import sys,cairosvg; cairosvg.svg2png(url=sys.argv[1], write_to=sys.argv[2], "
                         "output_width=int(sys.argv[3]))", j["in"], j["out"], str(int(round((j["width"] or W) * j["scale"])))])
        if code:
            return False, log.strip().splitlines()[-1][:160] if log.strip() else "exit %d" % code
    return True, "ok"


ROUTES = {"playwright": route_playwright, "chrome": route_chrome, "rsvg": route_rsvg, "cairosvg": route_cairosvg}


def verify(jobs):
    """pngstats every output; returns (all_ok, lines)"""
    lines, ok = [], True
    for j in jobs:
        if not os.path.exists(j["out"]):
            if j.get("dark"):
                lines.append("raster: dark view skipped (this route cannot render prefers-color-scheme)")
                continue
            ok = False
            lines.append("raster: %s missing" % j["out"])
            continue
        st = pngstats.analyse(j["out"], j["check_svg"], j.get("ebox"), check_fills=not j.get("dark"))
        exp_w = int(round((j["width"] or svg_geometry(j["in"])[0]) * j["scale"]))
        size_ok = abs(st["size"][0] - exp_w) <= 2
        good = st["verdict"] == "OK" and size_ok
        ok = ok and good
        lines.append("raster: %-4s %s %dx%d %s%s%s%s" % (
            j["kind"], j["out"], st["size"][0], st["size"][1], j["note"], "" if good else " REJECTED (%s" % st["verdict"],
            "" if good else ", fills %d/%d, ink %.1f%%%s)" % (st["fills_found"], st["fills_expected"], st["ink"] * 100,
                                                                "" if size_ok else ", expected width %d" % exp_w),
            (" " + st["cropped"]) if st["cropped"] else ""))
    return ok, lines


def render(jobs, route_pref):
    routes = AUTO if route_pref == "auto" else [route_pref]
    tried = []
    for r in routes:
        for j in jobs:
            if os.path.exists(j["out"]):
                os.remove(j["out"])
        ok, why = ROUTES[r](jobs)
        if not ok:
            tried.append("%s: %s" % (r, why))
            continue
        good, lines = verify(jobs)
        if not good:
            tried.append("%s: output rejected" % r)
            for ln in lines:
                if "REJECTED" in ln or "missing" in ln:
                    print(ln)
            for j in jobs:
                if os.path.exists(j["out"]):
                    os.replace(j["out"], j["out"] + ".rejected-%s.png" % r)
            continue
        for t in tried:
            print("raster: skipped %s" % t)
        for ln in lines:
            print(ln)
        return r
    for t in tried:
        print("raster: failed %s" % t)
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="?")
    ap.add_argument("--out", help="PNG to write (single-PNG mode)")
    ap.add_argument("--scale", "--dpr", type=float, default=2.0, dest="scale", help="pixel ratio (single-PNG mode, default 2)")
    ap.add_argument("--width", type=float, default=0, help="CSS width to display the SVG at (default: its own width)")
    ap.add_argument("--inspect", nargs="+", metavar="PREFIX=IN.svg", help="write the d2check review set per SVG")
    ap.add_argument("--column", type=float, default=800, help="doc column width for the reader's view (default 800)")
    ap.add_argument("--dark", action="store_true", help="also render prefers-color-scheme: dark")
    ap.add_argument("--no-detail", action="store_true", help="skip PREFIX.2x.png")
    ap.add_argument("--route", default=os.environ.get("D2CHECK_ROUTE", "auto") or "auto",
                    choices=["auto", "playwright", "chrome", "rsvg", "cairosvg"])
    a = ap.parse_args()
    jobs = []
    if a.inspect:
        for spec in a.inspect:
            prefix, _, svg = spec.partition("=")
            if not svg:
                ap.error("--inspect wants PREFIX=IN.svg, got %r" % spec)
            W, H, _ = svg_geometry(svg)
            cw = display_width(svg, a.column)
            ebox = pngstats.expected_box(svg)
            base = {"check_svg": svg, "ebox": ebox}
            jobs.append(dict(base, kind="col", **{"in": svg, "out": prefix + ".col.png", "scale": 1, "width": cw,
                        "note": "(reader's view: %dpx column, scale %.2f)" % (a.column, cw / W)}))
            if not a.no_detail:
                # round down, with a few px of margin: Chromium rounds fractional device scales up
                det = min(2.0, math.floor((READ_LIMIT - 4) / max(W, H) * 1000) / 1000)
                jobs.append(dict(base, kind="2x", **{"in": svg, "out": prefix + ".2x.png", "scale": det, "width": 0,
                            "note": "(detail %.2fx)" % det}))
            if os.path.exists(prefix + ".ann.svg"):
                jobs.append(dict(base, kind="ann", **{"in": prefix + ".ann.svg", "out": prefix + ".ann.png", "scale": 1,
                            "width": cw, "note": "(numbered findings)"}))
            if a.dark:
                jobs.append(dict(base, kind="dark", dark=True, **{"in": svg, "out": prefix + ".dark.png", "scale": 1,
                            "width": cw, "note": "(dark page, prefers-color-scheme: dark)"}))
    elif a.svg and a.out:
        W, H, _ = svg_geometry(a.svg)
        jobs.append({"kind": "png", "in": a.svg, "out": a.out, "scale": a.scale, "width": a.width, "dark": a.dark,
                     "check_svg": a.svg, "ebox": pngstats.expected_box(a.svg), "note": "(%.2fx)" % a.scale})
    else:
        ap.error("give IN.svg --out OUT.png, or --inspect PREFIX=IN.svg")
    for j in jobs:
        d = os.path.dirname(os.path.abspath(j["out"]))
        os.makedirs(d, exist_ok=True)
    used = render(jobs, a.route)
    if used is None:
        print("route: none - NO USABLE RASTER: not visually reviewed")
        return 1
    if used in FAITHFUL:
        print("route: %s (faithful)" % used)
        return 0
    print("route: %s (approximate: embedded fonts ignored - judge topology and colour only, not label fit)" % used)
    return 3


if __name__ == "__main__":
    sys.exit(main())
