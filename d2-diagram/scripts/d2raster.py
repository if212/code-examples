#!/usr/bin/env python3
"""d2raster - rasterize a d2 SVG with the most faithful renderer available, and refuse to hand back a
blank, garbled or cropped image. Standard library only.

usage:
  d2raster.py IN.svg --out OUT.png [--scale 2] [--width PX] [--dark]     one PNG (PNG deliverables)
  d2raster.py IN.svg --out OUT.pdf                                       one vector PDF page (PDF deliverables)
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
for and its output is checked and rejected like any other. PDF: playwright, then chrome (no approximate
route). Text is antialiased in grayscale (no LCD colour fringes). Outputs are written with mode 644.
Every PNG is checked by pngstats (blank, missing fill colours, black bars, cropped); a route whose col,
2x (or single) output fails is discarded and the next one is tried. The annotated and dark views are aids:
a doubt about them is noted, never fatal (finding boxes tint the fills pngstats looks for).
"""
import argparse
import base64
import json
import math
import os
import re
import shlex
import shutil
import signal
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
DOCTOR = "sh %s" % shlex.quote(os.path.join(HERE, "doctor.sh"))
EPILOG = """exit codes (the skill's convention; semcheck.py differs):
  0   faithful: rendered by Chromium (playwright or a Chrome binary)
  1   hard failure: no usable output (no renderer worked, or the input is not a d2 SVG)
  3   degraded: only rsvg-convert worked - fonts are substitutes, do not ship the PNG
  64  usage error
examples:
  python3 d2raster.py docs/flow.svg --out docs/flow.png --scale 2     PNG deliverable (2x)
  python3 d2raster.py docs/flow.svg --out docs/flow.pdf               vector PDF deliverable
  python3 d2raster.py --inspect /tmp/d2work/flow/flow=docs/flow.svg   the review set (d2check does this)
setup problems (no node, playwright or Chromium): %s""" % DOCTOR


class ArgParser(argparse.ArgumentParser):
    """argparse with the skill's exit convention: a usage error exits 64, not 2"""

    def error(self, message):
        self.print_usage(sys.stderr)
        self.exit(64, "%s: error: %s (run with --help for the options)\n" % (self.prog, message))


def svg_geometry(path):
    """(viewBox width, height, intrinsic width attribute or None)"""
    head = open(path, encoding="utf-8", errors="replace").read(8192)
    tag = re.search(r"<svg\b[^>]*>", head)  # the outer <svg>; the inner d2-svg always has a width
    m = re.search(r'viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"', tag.group(0) if tag else "")
    if not m:
        raise ValueError("no viewBox in %s - is it an SVG written by d2?" % path)
    w = re.search(r'\swidth="([\d.]+)"', tag.group(0))
    return float(m.group(3)), float(m.group(4)), (float(w.group(1)) if w else None)


def display_width(path, column):
    W, _, attr = svg_geometry(path)
    return min(attr, column) if attr else column  # no intrinsic size: <img max-width:100%> fills the column


def run(cmd, timeout=180, env=None):
    """run a renderer in its own process group: on a timeout the whole group goes (a browser it started too)"""
    try:
        p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, start_new_session=True)
    except FileNotFoundError as e:
        return 127, str(e)
    try:
        out, err = p.communicate(timeout=timeout)
        return p.returncode, (out + err).decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except (OSError, AttributeError):
            p.kill()
        p.communicate()
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
        # Playwright's layouts before 1.57 (chrome-linux, chrome-mac) and after (Chrome for Testing builds)
        cft = "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
        for pat in ("chromium-*/chrome-linux/chrome", "chromium-*/chrome-linux64/chrome", "chromium-*/chrome-linux-arm64/chrome",
                    "chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chromium-*/chrome-mac-arm64/" + cft,
                    "chromium-*/chrome-mac-x64/" + cft, "chromium_headless_shell-*/chrome-linux/headless_shell",
                    "chromium_headless_shell-*/chrome-mac/headless_shell",
                    "chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell"):
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
    # Playwright makes its scratch folders under $TMPDIR and fails (ENOENT mkdtemp) when that folder is
    # gone; python has already picked a usable temp folder (TMPDIR if it works, else /tmp, ...)
    env = dict(os.environ, TMPDIR=tempfile.gettempdir())
    try:
        for attempt in (1, 2):  # a browser launch can fail transiently on a loaded machine: retry once
            code, log = run(["node", os.path.join(HERE, "raster.cjs"), "--jobs", jf, "--quiet"], env=env)
            if code in (0, 64, 124) or "module not found" in log:
                break  # a hang does not get better on a second try
    finally:
        os.remove(jf)
    last = log.strip().splitlines()[0] if log.strip() else "exit %d" % code
    return code == 0, ("ok" if code == 0 else last)


def chrome_base():
    """Chrome makes a Unix socket under $TMPDIR (SingletonSocket), and a socket path over ~100 characters
    makes it crash (SIGTRAP): with a long $TMPDIR, Chrome gets /tmp instead"""
    base = tempfile.gettempdir()
    if len(base) > 48 and os.path.isdir("/tmp") and os.access("/tmp", os.W_OK):
        base = "/tmp"
    return base


def chrome_cmd(exe, tmp, extra):
    cmd = [exe, "--headless", "--disable-gpu", "--disable-lcd-text", "--hide-scrollbars", "--mute-audio",
           "--no-first-run", "--no-default-browser-check", "--user-data-dir=" + os.path.join(tmp, "prof")] + extra
    if hasattr(os, "geteuid") and os.geteuid() == 0:
        cmd.insert(1, "--no-sandbox")
    return cmd


def route_chrome(jobs):
    exe = find_chrome()
    if not exe:
        return False, "no Chrome/Chromium binary found (set CHROME_PATH)"
    for j in jobs:
        W, H, _ = svg_geometry(j["in"])
        base = chrome_base()
        tmp = tempfile.mkdtemp(prefix="d2r-", dir=base)
        env = dict(os.environ, TMPDIR=base)
        try:
            page = os.path.join(tmp, "page.html")
            if j["out"].lower().endswith(".pdf"):
                inline = re.sub(r"^<\?xml[^>]*>\s*", "", open(j["in"], encoding="utf-8").read())
                with open(page, "w", encoding="utf-8") as f:
                    f.write('<!doctype html><html><head><style>@page{size:%spx %spx;margin:0}html,body{margin:0}'
                            'svg{display:block}</style></head><body>%s</body></html>' % (W, H, inline))
                cmd = chrome_cmd(exe, tmp, ["--no-pdf-header-footer", "--print-to-pdf-no-header",
                                            "--print-to-pdf=" + os.path.abspath(j["out"]), "file://" + page])
                code, log = run(cmd, timeout=90, env=env)
                if code != 0 or not os.path.exists(j["out"]) or not os.path.getsize(j["out"]):
                    return False, "%s: exit %d: %s" % (os.path.basename(exe), code, log.strip()[-160:])
                continue
            css_w = int(round(j["width"] or W))
            css_h = int(math.ceil(H * css_w / W - 0.01))
            uri = "data:image/svg+xml;base64," + base64.b64encode(open(j["in"], "rb").read()).decode()
            with open(page, "w") as f:
                f.write('<!doctype html><html><body style="margin:0;background:%s"><img src="%s" '
                        'style="display:block;width:%dpx;height:auto"></body></html>' % (
                            "#0d1117" if j.get("dark") else "#fff", uri, css_w))
            # new-headless Chrome's viewport is ~87px shorter than --window-size: oversize the window, then crop
            extra = ["--force-device-scale-factor=%s" % j["scale"], "--window-size=%d,%d" % (css_w, css_h + 240),
                     "--screenshot=" + os.path.abspath(j["out"]), "file://" + page]
            if j.get("dark"):
                extra.insert(0, "--force-dark-mode")
            code, log = run(chrome_cmd(exe, tmp, extra), timeout=90, env=env)
            if code != 0 or not os.path.exists(j["out"]) or not os.path.getsize(j["out"]):
                return False, "%s: exit %d: %s" % (os.path.basename(exe), code, log.strip()[-160:])
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


# the views the review verdict rests on (and single-output files); the annotated and dark views are aids:
# the finding boxes of .ann.png tint the very fills pngstats looks for (B55), so a doubt about an aid is
# reported and never rejects the route
GATING = ("col", "2x", "png", "pdf")


def verify(jobs):
    """pngstats every output (a PDF: its header); returns (all_ok, lines). Only the GATING views decide
    all_ok: a missing or doubtful annotated or dark view is noted and the route still counts"""
    lines, ok = [], True
    for j in jobs:
        gate = j["kind"] in GATING
        if not os.path.exists(j["out"]):
            if j.get("dark"):
                lines.append("raster: dark view skipped (this route cannot render prefers-color-scheme)")
                continue
            if not gate:
                lines.append("raster: %-4s %s not written (an aid only: the col and 2x views decide the review)" % (
                    j["kind"], j["out"]))
                continue
            ok = False
            lines.append("raster: %s missing" % j["out"])
            continue
        if j["out"].lower().endswith(".pdf"):
            with open(j["out"], "rb") as fh:
                good = fh.read(5) == b"%PDF-"
            ok = ok and good
            lines.append("raster: pdf  %s %s%s" % (j["out"], j["note"], "" if good else " REJECTED (not a PDF)"))
            continue
        st = pngstats.analyse(j["out"], j["check_svg"], j.get("ebox"), check_fills=not j.get("dark"))
        exp_w = int(round((j["width"] or svg_geometry(j["in"])[0]) * j["scale"]))
        size_ok = abs(st["size"][0] - exp_w) <= 2
        good = st["verdict"] == "OK" and size_ok
        if gate:
            ok = ok and good
        lines.append("raster: %-4s %s %dx%d %s%s%s%s%s" % (
            j["kind"], j["out"], st["size"][0], st["size"][1], j["note"],
            "" if good else (" REJECTED (%s" if gate else " doubtful (%s") % st["verdict"],
            "" if good else ", fills %d/%d, lines %d/%d, ink %.1f%%%s)" % (
                st["fills_found"], st["fills_expected"], st["lines_found"], st["lines_expected"], st["ink"] * 100,
                "" if size_ok else ", expected width %d" % exp_w),
            (" " + st["cropped"]) if st["cropped"] else "",
            "" if good or gate else " - an aid only: the col and 2x views decide the review"))
    return ok, lines


def render(jobs, routes, quiet=False):
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
                    os.replace(j["out"], j["out"] + ".rejected-%s%s" % (r, os.path.splitext(j["out"])[1]))
            continue
        for j in jobs:
            if os.path.exists(j["out"]):
                os.chmod(j["out"], 0o644)
        if not quiet:
            for t in tried:
                print("raster: skipped %s" % t)
            for ln in lines:
                print(ln)
        return r
    for t in tried:
        print("raster: failed %s" % t)
    return None


def main():
    ap = ArgParser(prog="d2raster.py", description=__doc__.split("\n\n")[0].replace("\n", " "),
                   epilog=EPILOG, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="?", metavar="IN.svg", help="SVG written by d2check (single-output mode)")
    ap.add_argument("--out", metavar="OUT.png|OUT.pdf", help="file to write (single-output mode); .pdf makes a vector PDF")
    ap.add_argument("--scale", "--dpr", type=float, default=2.0, dest="scale", help="pixel ratio of a PNG (default 2)")
    ap.add_argument("--width", type=float, default=0, help="CSS width to display the SVG at (default: its own width)")
    ap.add_argument("--inspect", nargs="+", metavar="PREFIX=IN.svg", help="write the d2check review set per SVG")
    ap.add_argument("--column", type=float, default=800, help="doc column width for the reader's view (default 800)")
    ap.add_argument("--dark", action="store_true", help="also render prefers-color-scheme: dark")
    ap.add_argument("--no-detail", action="store_true", help="skip PREFIX.2x.png")
    ap.add_argument("--quiet", action="store_true", help="print only the route line (and problems)")
    ap.add_argument("--route", default=os.environ.get("D2CHECK_ROUTE", "auto") or "auto",
                    choices=["auto", "playwright", "chrome", "rsvg", "cairosvg"],
                    help="force one renderer (default $D2CHECK_ROUTE, else auto)")
    a = ap.parse_args()
    if a.route != "auto" and a.route not in ROUTES:  # argparse checks choices on the command line, not a default
        ap.error("D2CHECK_ROUTE=%r is not a route: auto, playwright, chrome, rsvg or cairosvg (unset it for auto)" % a.route)
    if not 0 < a.scale <= 8:
        ap.error("--scale wants a pixel ratio in (0, 8], e.g. 2")
    jobs = []
    try:
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
            if a.svg.lower().endswith(".d2"):
                ap.error("%s is the d2 source: render it with sh %s %s, then rasterize the SVG it writes" % (
                    a.svg, shlex.quote(os.path.join(HERE, "d2check.sh")), shlex.quote(a.svg)))
            if not a.out.lower().endswith((".png", ".pdf")):
                ap.error("--out must end in .png or .pdf (SVG comes from d2check.sh): %s" % a.out)
            W, H, _ = svg_geometry(a.svg)
            if a.out.lower().endswith(".pdf"):
                jobs.append({"kind": "pdf", "in": a.svg, "out": a.out, "scale": 1, "width": 0, "dark": False,
                             "check_svg": a.svg, "note": "(vector, %dx%d px page)" % (W, H)})
            else:
                jobs.append({"kind": "png", "in": a.svg, "out": a.out, "scale": a.scale, "width": a.width, "dark": a.dark,
                             "check_svg": a.svg, "ebox": pngstats.expected_box(a.svg), "note": "(%.2fx)" % a.scale})
        else:
            ap.error("give IN.svg --out OUT.png (or OUT.pdf), or --inspect PREFIX=IN.svg")
    except (OSError, ValueError) as e:
        print("d2raster: %s - give the SVG that d2check.sh wrote (the path is relative to %s)" % (
            ("%s: %s" % (e.filename, e.strerror)) if isinstance(e, OSError) and e.filename else e, os.getcwd()),
            file=sys.stderr)
        return 1
    for j in jobs:
        d = os.path.dirname(os.path.abspath(j["out"]))
        try:
            os.makedirs(d, exist_ok=True)
            if not os.access(d, os.W_OK):
                raise PermissionError(13, "not writable", d)
            probe = tempfile.NamedTemporaryFile(dir=d, prefix=".d2raster-", delete=True)
            probe.close()
        except OSError as e:
            print("d2raster: cannot write %s (%s) - choose another --out" % (d, e.strerror or e), file=sys.stderr)
            return 1
    pdf = any(j["out"].lower().endswith(".pdf") for j in jobs)
    if a.route == "auto":
        routes = ["playwright", "chrome"] if pdf else AUTO
    elif pdf and a.route not in FAITHFUL:
        ap.error("a PDF needs a Chromium route (playwright or chrome), not %s" % a.route)
    else:
        routes = [a.route]
    used = render(jobs, routes, a.quiet)
    if used is None:
        if a.inspect:
            print("route: none - NO USABLE RASTER: not visually reviewed. Check the setup: %s" % DOCTOR)
        else:
            print("route: none - no %s written: no renderer worked (raster: lines above). Check the setup: %s" % (
                "PDF" if pdf else "PNG", DOCTOR))
        return 1
    if used in FAITHFUL:
        print("route: %s (faithful)" % used)
        return 0
    print("route: %s (approximate: embedded fonts ignored - judge topology and colour only, not label fit; "
          "for a faithful render see %s)" % (used, DOCTOR))
    return 3


if __name__ == "__main__":
    sys.exit(main())
