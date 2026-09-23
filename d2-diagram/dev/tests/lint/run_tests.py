#!/usr/bin/env python3
"""Regression suite for scripts/d2lint.py, d2raster.py and pngstats.py.

Each cases/*.d2 is rendered the way d2check renders (`d2 --scale 1`, plus any `# flags:`) and linted.
Header comments in a case:
  # flags: -l dagre          extra d2 render flags
  # column: 800              doc column width for the lint (default 800)
  # expect: CODE CODE        every listed code must be reported
  # expect-clean: E- W-      no reported code may start with these prefixes
  # expect-text: some words  this text must appear in some finding message
Also runs synthetic SVG edits (defects d2 itself never draws), a check that d2lint only emits codes
from the frozen contract list, the compact/--sem-json output, and the rasterizer checks.
usage: python3 dev/tests/lint/run_tests.py [--no-raster] [-k NAME]      (needs d2; raster tests need Chromium)
exit: 0 all passed, 1 a test failed
"""
import argparse
import base64
import concurrent.futures
import glob
import json
import os
import re
import shlex
import shutil
import struct
import subprocess
import sys
import zlib

sys.dont_write_bytecode = True  # no __pycache__ inside the skill's scripts/
HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SCRIPTS = os.path.join(SKILL, "scripts")
CASES = os.path.join(HERE, "cases")
sys.path.insert(0, SCRIPTS)
import d2lint  # noqa: E402
import pngstats  # noqa: E402

OUT = os.path.join(os.environ.get("TMPDIR", "/tmp"), "d2lint-tests")
# d2 reads these from the environment (D2_WATCH turns a render into a server that never exits)
for _k in ("D2_LAYOUT", "D2_THEME", "D2_DARK_THEME", "D2_PAD", "D2_SKETCH", "D2_CENTER", "D2_WATCH", "SCALE",
           "D2_BUNDLE", "D2_FORCE_APPENDIX", "D2_ANIMATE_INTERVAL"):
    os.environ.pop(_k, None)
# cases that must not live in the repo as files (every shipped or dev file stays pure ASCII)
GENERATED = {
    "bad_nonascii": "# expect: W-non-ascii\nvars: {d2-config: {layout-engine: elk; pad: 24}}\n"
                    "a: \"Caf\u00e9 service\"\nb: \"Deploy \u2192 prod\"\na -> b\n",
}
# PLAN.md 5.1: the only codes d2lint may emit (each has a heading in workflows/review-and-fix.md)
FROZEN = set("""E-label-overlap E-edge-label-on-node E-edge-through-node E-edge-through-label E-icon-collision
E-label-overflow E-node-overlap E-child-outside E-off-canvas E-contrast E-contrast-dark W-edge-crossing W-edge-overlap
W-edge-through-container W-edge-label-on-border W-diagonal-edge W-aspect W-remote-image W-non-ascii E-small-text
W-small-text W-curved-edge W-tall W-title-size W-unclassed W-sibling-size W-long-edge W-fanout W-edge-jog
W-label-on-bend W-short-label W-seq-group-ragged I-sparse""".split())

results = []


def check(name, ok, detail=""):
    results.append(bool(ok))
    print("%-5s %-30s %s" % ("ok" if ok else "FAIL", name, detail))


def header(path, key):
    vals = []
    for line in open(path, encoding="utf-8"):
        if line.startswith("# %s:" % key):
            vals.append(line.split(":", 1)[1].strip())
    return vals


def render(case):
    name = os.path.basename(case)[:-3]
    svg = os.path.join(OUT, name + ".svg")
    flags = shlex.split(" ".join(header(case, "flags")))
    if not any(f.startswith("--scale") for f in flags):
        flags = ["--scale", "1"] + flags
    # d2check's ELK spacing defaults (ignored by dagre)
    flags = ["--elk-nodeNodeBetweenLayers", "40", "--elk-edgeNodeBetweenLayers", "20",
             "--elk-padding", "[top=50,left=50,bottom=30,right=50]"] + flags
    r = subprocess.run(["d2"] + flags + [os.path.basename(case), svg], cwd=os.path.dirname(case),
                       capture_output=True, text=True)
    return case, svg, r.returncode, r.stderr.strip()[-200:]


def lint_cases(pattern):
    gen = os.path.join(OUT, "generated")
    os.makedirs(gen, exist_ok=True)
    for name, text in GENERATED.items():
        with open(os.path.join(gen, name + ".d2"), "w", encoding="utf-8") as fh:
            fh.write(text)
    cases = sorted(glob.glob(os.path.join(CASES, "*.d2")) + glob.glob(os.path.join(gen, "*.d2")))
    cases = [c for c in cases if not pattern or pattern in os.path.basename(c)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as ex:
        rendered = list(ex.map(render, cases))
    emitted = set()
    for case, svg, rc, err in rendered:
        name = os.path.basename(case)[:-3]
        if rc:
            check(name, False, "render failed: " + err)
            continue
        column = (header(case, "column") or ["800"])[0]
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "d2lint.py"), "--json", "--column", column, svg],
                           capture_output=True, text=True)
        rep = json.loads(r.stdout)
        codes = sorted({f["code"] for f in rep["findings"]})
        emitted.update(codes)
        need = " ".join(header(case, "expect")).split()
        clean = " ".join(header(case, "expect-clean")).split()
        texts = header(case, "expect-text")
        missing = [c for c in need if c not in codes]
        forbidden = [c for c in codes if any(c.startswith(p) for p in clean) and c not in need]
        msgs = " ".join(f["message"] for f in rep["findings"])
        notext = [t for t in texts if t not in msgs]
        anchors_ok = all(f["anchor"] == "workflows/review-and-fix.md#" + f["code"].lower() for f in rep["findings"])
        detail = "expect=%s got=%s" % (",".join(need) or "-", ",".join(codes) or "-")
        if missing:
            detail += "  MISSING=" + ",".join(missing)
        if forbidden:
            detail += "  FORBIDDEN=" + ",".join(forbidden)
        if notext:
            detail += "  NO-TEXT=" + "|".join(notext)
        check(name, not missing and not forbidden and not notext and anchors_ok, detail)
    return emitted


def synthetic():
    """defects d2 never draws: move a child out of its container and an edge label off the canvas;
    put a 10px jog into a straight edge"""
    src = os.path.join(OUT, "ok_pipeline_grid.svg")
    if not os.path.exists(src):
        subprocess.run(["d2", "--scale", "1", "ok_pipeline_grid.d2", src], cwd=CASES, capture_output=True)
    s = open(src, encoding="utf-8").read()
    cls = base64.b64encode(b"src.kafka").decode()
    i = s.index('<g class="%s"' % cls)
    j = s.index("<text", i)
    blk = re.sub(r'\by="([-\d.]+)"', lambda m: 'y="%.6f"' % (float(m.group(1)) - 140), s[i:j])
    t = s[:i] + blk + s[j:]
    t = re.sub(r'(<text x=")([-\d.]+)("[^>]*>load<)', lambda m: m.group(1) + str(float(m.group(2)) - 900) + m.group(3), t)
    dst = os.path.join(OUT, "synthetic_moved.svg")
    open(dst, "w", encoding="utf-8").write(t)
    F, _ = d2lint.run_checks(d2lint.load(dst))
    codes = {f.code for f in F}
    check("synthetic child/off-canvas", {"E-child-outside", "E-off-canvas"} <= codes, ",".join(sorted(codes)))
    # jog: rewrite the first straight vertical edge as down / 10px right / down
    src = os.path.join(OUT, "bad_tall.svg")
    s = open(src, encoding="utf-8").read()
    m = re.search(r'd="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)"', s)
    x, y0, y1 = float(m.group(1)), float(m.group(2)), float(m.group(4))
    mid = (y0 + y1) / 2
    jog = 'd="M %.1f %.1f L %.1f %.1f L %.1f %.1f L %.1f %.1f"' % (x, y0, x, mid, x + 10, mid, x + 10, y1)
    dst = os.path.join(OUT, "synthetic_jog.svg")
    open(dst, "w", encoding="utf-8").write(s[:m.start()] + jog + s[m.end():])
    F, _ = d2lint.run_checks(d2lint.load(dst))
    check("synthetic edge jog", any(f.code == "W-edge-jog" for f in F), ",".join(sorted({f.code for f in F})))


def synthetic_multiline():
    """E-label-overlap and multi-line labels: a label beside the short last line of a 3-line label sits
    inside the union box but clear of every line (no finding); the same label on the long line is one"""
    src = os.path.join(OUT, "multiline.d2")
    with open(src, "w", encoding="utf-8") as fh:
        fh.write('vars: {d2-config: {layout-engine: elk; pad: 24}}\n'
                 'db: "Database\\n[Container: Postgres]\\nProducts"\nx: Short\n')
    svg = os.path.join(OUT, "multiline.svg")
    subprocess.run(["d2", "--scale", "1", src, svg], capture_output=True)
    s = open(svg, encoding="utf-8").read()
    dg = d2lint.load(svg)
    db = next(t for t in dg.texts if t.content.startswith("Database"))
    short_ = next(t for t in dg.texts if t.content == "Short")
    m = re.search(r'<text x="[-\d.]+" y="[-\d.]+"([^>]*>Short</text>)', s)
    res = {}
    for name, cx, by in (("beside", db.line_boxes[2].x1 + 3 + short_.box.w / 2, db.lines[2][1]),
                         ("on", db.line_boxes[1].cx, db.lines[1][1])):
        p = os.path.join(OUT, "synthetic_ml_%s.svg" % name)
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(s[:m.start()] + '<text x="%.3f" y="%.3f"%s' % (cx, by, m.group(1)) + s[m.end():])
        d = d2lint.load(p)
        a = next(t for t in d.texts if t.content.startswith("Database"))
        b = next(t for t in d.texts if t.content == "Short")
        F, _ = d2lint.run_checks(d)
        res[name] = (min(a.box.overlap(b.box)) > 1.0, any(f.code == "E-label-overlap" for f in F))
    check("synthetic multi-line overlap", res["beside"] == (True, False) and res["on"] == (True, True),
          "beside: union overlap=%s flagged=%s; on: flagged=%s" % (res["beside"] + res["on"][1:]))


def synthetic_tilt():
    """B27: a straight edge whose ends are a few degrees off axis (a leaning serpentine turn) is W-diagonal-edge"""
    src = os.path.join(OUT, "bad_tall.svg")
    s = open(src, encoding="utf-8").read()
    m = re.search(r'd="M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+)"', s)
    x, y0, y1 = float(m.group(1)), float(m.group(2)), float(m.group(4))
    res = {}
    for name, dx, dy in (("lean", 14.0, 0.0), ("long-lean", 10.0, 120.0), ("straight", 3.0, 0.0)):
        dst = os.path.join(OUT, "synthetic_%s.svg" % name)
        open(dst, "w", encoding="utf-8").write(s[:m.start()] + 'd="M %.1f %.1f L %.1f %.1f"' % (x, y0, x + dx, y1 + dy) + s[m.end():])
        F, _ = d2lint.run_checks(d2lint.load(dst))
        res[name] = [f.msg for f in F if f.code == "W-diagonal-edge"]
    check("synthetic lean (B27)", res["lean"] and "leans 14px off vertical" in res["lean"][0] and res["long-lean"] and
          "leans 10px off vertical over 15" in res["long-lean"][0] and not res["straight"],
          "lean=%s long=%s straight=%s" % (res["lean"], res["long-lean"], res["straight"]))


def marker_geometry():
    """B23: crow's-foot <marker> paths sit in marker space (M4.8,0 4.8,18); they are not drawn geometry"""
    svg = os.path.join(OUT, "ok_erd_crowsfoot.svg")
    dg = d2lint.load(svg)
    c = d2lint.content_box(dg)
    ebox = pngstats.expected_box(svg)
    ok = c is not None and c.x0 >= dg.vb.x0 + 20 and c.y0 >= dg.vb.y0 + 20 and ebox and min(ebox[0], ebox[1]) > 0.02
    check("markers are not content (B23)", ok, "content %s in %s, expected box %s" % (c, dg.vb, ebox))


def cli_exit_codes():
    """the shared convention: 0 ok (warnings allowed), 1 unreadable, 2 findings (or warnings with --strict), 64 usage"""
    lint = os.path.join(SCRIPTS, "d2lint.py")
    runs = {"warnings": [os.path.join(OUT, "bad_short_label.svg")],
            "strict": ["--strict", os.path.join(OUT, "bad_short_label.svg")],
            "errors": [os.path.join(OUT, "bad_small_text.svg")],
            "unreadable": [os.path.join(OUT, "no-such.svg")],
            "usage": ["--column", "-5", os.path.join(OUT, "bad_short_label.svg")]}
    got = {k: subprocess.run([sys.executable, lint] + v, capture_output=True).returncode for k, v in runs.items()}
    check("d2lint exit codes", got == {"warnings": 0, "strict": 2, "errors": 2, "unreadable": 1, "usage": 64}, str(got))


def fonts_bundle():
    """B16: the bundled fonts stay under 1.5 MB and the brand family is the small official Lato build"""
    fonts = os.path.join(SKILL, "assets", "fonts")
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(fonts) for f in fs)
    head = open(os.path.join(fonts, "lato", "Lato-Regular.ttf"), "rb").read()
    check("fonts under 1.5 MB, Lato 1.104", total < 1500000 and b"V\x00e\x00r\x00s\x00i\x00o\x00n\x00 \x001\x00.\x001\x000\x004" in head,
          "%d bytes" % total)


def output_modes():
    svg = os.path.join(OUT, "bad_fanout.svg")
    sem = os.path.join(OUT, "sem.json")
    vb = d2lint.load(svg).vb
    box = [vb.x0 + 20, vb.y0 + 20, vb.x0 + 90, vb.y0 + 50]  # semcheck writes [x0, y0, x1, y1]
    json.dump({"errors": 1, "items": [{"level": "error", "code": "missing-edge", "msg": "api -> db: writes is missing"},
                                      {"level": "warn", "code": "S-node-label-case", "msg": "label case differs",
                                       "box": box, "objects": ["a"]}]},
              open(sem, "w"))
    ann = os.path.join(OUT, "bad_fanout.ann.svg")
    r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "d2lint.py"), "--compact", "--sem-json", sem,
                        "--annotate", ann, svg], capture_output=True, text=True)
    out = r.stdout
    check("compact + sem-json merge", r.returncode == 2 and "S-missing-edge x1 -> workflows/review-and-fix.md#s-missing-edge"
          in out and "W-fanout x1 -> workflows/review-and-fix.md#w-fanout" in out and out.strip().splitlines()[-1].startswith("display: "),
          "exit=%d" % r.returncode)
    a = open(ann, encoding="utf-8").read() if os.path.exists(ann) else ""
    nums = re.findall(r'text-anchor="middle">(\d+)</text>', a)
    listed = re.findall(r"^  \[(\d+)\]", out, re.M)
    check("annotation numbers match", nums and nums == listed, "svg=%s listed=%s" % (nums, listed))
    check("S- finding with a box is numbered", "  [1] label case differs" in out and len(nums) == 2, "listed=%s" % listed)


def contract_codes(emitted):
    src = open(os.path.join(SCRIPTS, "d2lint.py"), encoding="utf-8").read()
    in_source = set(re.findall(r'"([EWI]-[a-z]+(?:-[a-z]+)*)"', src))
    extra = sorted((in_source | emitted) - FROZEN)
    check("codes within contract", not extra, "extra=%s" % ",".join(extra) if extra else "%d codes" % len(in_source))
    unseen = sorted(FROZEN - emitted - {"W-edge-jog", "E-child-outside", "E-off-canvas"})
    check("every code has a case", not unseen, "no case triggers: %s" % ",".join(unseen) if unseen else "")


def write_png(path, w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) +
                           chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def raster_cases():
    svg = os.path.join(OUT, "ok_flowchart.svg")
    if not os.path.exists(svg):
        print("skip  raster tests (ok_flowchart.svg missing)")
        return
    d2raster = os.path.join(SCRIPTS, "d2raster.py")
    pre = os.path.join(OUT, "flow")
    r = subprocess.run([sys.executable, d2raster, "--inspect", pre + "=" + svg, "--column", "800"],
                       capture_output=True, text=True)
    col, det = pre + ".col.png", pre + ".2x.png"
    faithful = r.returncode == 0
    check("raster: inspect set", r.returncode in (0, 3) and os.path.exists(col) and os.path.exists(det),
          (r.stdout.strip().splitlines() or [r.stderr.strip()])[-1][:120])
    if os.path.exists(col):
        w, h = pngstats.png_size(col)
        W, H = d2lint.load(svg).W, d2lint.load(svg).H
        check("raster: column view size", abs(w - round(min(W, 800))) <= 1, "%dx%d for a %dx%d svg" % (w, h, W, H))
    if os.path.exists(det):
        ebox = pngstats.expected_box(svg)
        w, h, bpp, rows = pngstats.decode_png(det)
        blank = os.path.join(OUT, "blank.png")
        write_png(blank, w, h, [bytearray([255] * (w * 3)) for _ in range(h)])
        check("raster: blank PNG detected", pngstats.analyse(blank, svg)["verdict"] == "BLANK")
        crop = os.path.join(OUT, "cropped.png")
        cut = int(h * 0.65)
        rgb = [bytearray(rr[x * bpp + k] for x in range(w) for k in range(3)) if bpp != 3 else bytearray(rr) for rr in rows]
        write_png(crop, w, h, rgb[:cut] + [bytearray([255] * (w * 3)) for _ in range(h - cut)])
        st = pngstats.analyse(crop, svg, ebox)
        check("raster: cropped PNG detected", st["verdict"] == "SUSPECT", st.get("cropped", ""))
        check("raster: good PNG passes", pngstats.analyse(det, svg, ebox)["verdict"] == "OK")
    # cairosvg's failure on white-filled diagrams: an empty page with one black bar (a label mask). No fill colour
    # to miss and too little black to flag - only the missing text and line colours give it away
    wf = os.path.join(OUT, "whitefill.d2")
    with open(wf, "w", encoding="utf-8") as fh:
        fh.write('vars: {d2-config: {layout-engine: elk; pad: 24}}\n*.style: {fill: "#FFFFFF"; stroke: "#64748B"; '
                 'font-color: "#1E293B"}\na: Alpha\nb: Beta\na -> b: calls {style.stroke: "#2563EB"}\n')
    wsvg = os.path.join(OUT, "whitefill.svg")
    subprocess.run(["d2", "--scale", "1", wf, wsvg], capture_output=True)
    if os.path.exists(wsvg):
        g = d2lint.load(wsvg)
        w, h = int(round(g.W)), int(round(g.H))
        rows = [bytearray([255] * (w * 3)) for _ in range(h)]
        for y in range(h // 2 - 10, h // 2 + 10):
            rows[y][(w // 2 - 20) * 3:(w // 2 + 20) * 3] = bytearray([0] * 120)
        bar = os.path.join(OUT, "whitebar.png")
        write_png(bar, w, h, rows)
        st = pngstats.analyse(bar, wsvg, pngstats.expected_box(wsvg))
        check("raster: empty page + black bar is SUSPECT", st["verdict"] == "SUSPECT" and st["lines_found"] == 0,
              "%s lines %d/%d" % (st["verdict"], st["lines_found"], st["lines_expected"]))
    if shutil.which("rsvg-convert"):
        env = dict(os.environ, D2CHECK_ROUTE="rsvg")
        r = subprocess.run([sys.executable, d2raster, "--inspect", pre + "-rsvg=" + svg], capture_output=True, text=True, env=env)
        check("raster: rsvg is approximate", r.returncode == 3 and "approximate" in r.stdout, "exit=%d" % r.returncode)
    try:
        import cairosvg  # noqa: F401
        env = dict(os.environ, D2CHECK_ROUTE="cairosvg")
        r = subprocess.run([sys.executable, d2raster, "--inspect", pre + "-cairo=" + svg], capture_output=True, text=True, env=env)
        check("raster: cairosvg rejected", r.returncode == 1 and "rejected" in r.stdout, "exit=%d" % r.returncode)
    except ImportError:
        print("skip  raster: cairosvg not installed")
    if faithful:
        # translucent fills (style.opacity, legend helpers) never show their exact colour: not 'suspect'
        op = os.path.join(OUT, "opacity.d2")
        with open(op, "w", encoding="utf-8") as fh:
            fh.write('vars: {d2-config: {layout-engine: elk; pad: 24}}\n*.style.opacity: 0.45\na: A {style.fill: "#1D4ED8"}\n'
                     'b: B {style.fill: "#DC2626"}\nc: C {style.fill: "#16A34A"}\nd: D {style.fill: "#9333EA"}\na -> b -> c -> d\n')
        osvg = os.path.join(OUT, "opacity.svg")
        subprocess.run(["d2", "--scale", "1", op, osvg], capture_output=True)
        r = subprocess.run([sys.executable, d2raster, "--inspect", os.path.join(OUT, "op") + "=" + osvg, "--no-detail"],
                           capture_output=True, text=True)
        check("raster: translucent fills pass", r.returncode == 0, (r.stdout.strip().splitlines() or [""])[-1][:120])
        # transparent grid cells paint nothing: a bottom row of them is not content the raster 'cropped'
        tc = os.path.join(OUT, "transparent_cells.d2")
        with open(tc, "w", encoding="utf-8") as fh:
            fh.write('vars: {d2-config: {layout-engine: elk; pad: 24}}\ngrid-rows: 3\ngrid-columns: 3\n'
                     'classes: {slot: {width: 120; height: 60; style: {fill: transparent; stroke: transparent}}}\n'
                     'a: A\nb: B\nc: C\n' + ''.join('s%d: "" {class: slot}\n' % i for i in range(6)))
        tsvg = os.path.join(OUT, "transparent_cells.svg")
        subprocess.run(["d2", "--scale", "1", tc, tsvg], capture_output=True)
        r = subprocess.run([sys.executable, d2raster, "--inspect", os.path.join(OUT, "tc") + "=" + tsvg, "--no-detail"],
                           capture_output=True, text=True)
        check("raster: transparent cells are not 'cropped'", r.returncode == 0, (r.stdout.strip().splitlines() or [""])[-1][:160])
        wide = os.path.join(OUT, "bad_wide_chain.svg")
        subprocess.run([sys.executable, d2raster, "--inspect", os.path.join(OUT, "wide") + "=" + wide], capture_output=True)
        det = os.path.join(OUT, "wide.2x.png")
        size = pngstats.png_size(det) if os.path.exists(det) else (0, 0)
        check("raster: detail PNG <= 2000px", 0 < max(size) <= 2000, "%dx%d for a %.0fpx-wide svg" % (size + (d2lint.load(wide).W,)))
        pdf = os.path.join(OUT, "flow.pdf")
        r = subprocess.run(["node", os.path.join(SCRIPTS, "raster.cjs"), svg, pdf], capture_output=True, text=True)
        head = open(pdf, "rb").read(5) if os.path.exists(pdf) else b""
        check("raster: pdf export", r.returncode == 0 and head == b"%PDF-", (r.stdout + r.stderr).strip()[-100:])
        # B9: PDF through d2raster.py (python3 only in the docs), on both Chromium routes
        for route in ("playwright", "chrome"):
            pdf = os.path.join(OUT, "flow-%s.pdf" % route)
            r = subprocess.run([sys.executable, d2raster, svg, "--out", pdf, "--route", route], capture_output=True, text=True)
            head = open(pdf, "rb").read(5) if os.path.exists(pdf) else b""
            check("raster: d2raster --out x.pdf (%s)" % route, r.returncode == 0 and head == b"%PDF-" and
                  oct(os.stat(pdf).st_mode & 0o777) == "0o644", (r.stdout + r.stderr).strip()[-120:])
        grayscale_text(d2raster)
        # the chrome route under a long $TMPDIR: Chrome's socket path must stay short (it used to crash)
        env = dict(os.environ, TMPDIR=os.path.join(OUT, "a-rather-long-temporary-directory-name-" + "x" * 40))
        os.makedirs(env["TMPDIR"], exist_ok=True)
        r = subprocess.run([sys.executable, d2raster, svg, "--out", os.path.join(OUT, "longtmp.png"), "--route", "chrome"],
                           capture_output=True, text=True, env=env)
        check("raster: chrome route, long TMPDIR", r.returncode == 0, (r.stdout + r.stderr).strip()[-120:])
    # pngstats as a command: 0 OK, 2 BLANK/SUSPECT, 1 unreadable, 64 usage
    ps = os.path.join(SCRIPTS, "pngstats.py")
    got = [subprocess.run([sys.executable, ps] + a, capture_output=True).returncode for a in
           ([col, svg], [os.path.join(OUT, "blank.png"), svg], [os.path.join(OUT, "no-such.png")], [])]
    check("pngstats exit codes", got == [0, 2, 1, 64], str(got))


def grayscale_text(d2raster):
    """B17: text is antialiased in grayscale - black text on white leaves no coloured pixel (LCD AA gave ~70%)"""
    src = os.path.join(OUT, "gray.d2")
    with open(src, "w", encoding="utf-8") as fh:
        fh.write('vars: {d2-config: {layout-engine: elk; pad: 24}}\n*.style: {fill: "#FFFFFF"; stroke: "#FFFFFF"; '
                 'font-color: "#000000"}\na: "Gateway services\\nPOST /orders?id=42"\n')
    svg = os.path.join(OUT, "gray.svg")
    subprocess.run(["d2", "--scale", "1", src, svg], capture_output=True)
    for route in ("playwright", "chrome"):
        png = os.path.join(OUT, "gray-%s.png" % route)
        r = subprocess.run([sys.executable, d2raster, svg, "--out", png, "--scale", "1", "--route", route], capture_output=True,
                           text=True)
        if r.returncode:
            check("raster: grayscale text (%s)" % route, False, (r.stdout + r.stderr).strip()[-120:])
            continue
        w, h, bpp, rows = pngstats.decode_png(png)
        ink = colored = 0
        for row in rows:
            for x in range(w):
                p = row[x * bpp:x * bpp + 3]
                if min(p) < 250:
                    ink += 1
                    colored += max(p) - min(p) > 8
        check("raster: grayscale text (%s)" % route, ink > 200 and colored == 0, "%d of %d ink px coloured" % (colored, ink))


def overflow_sizes():
    """E-label-overflow names a size that clears the label, on each shape, with the fonts d2check uses:
    render a fixed size that is too small, apply every suggested width/height, the finding must go"""
    ff = subprocess.run(["sh", os.path.join(SCRIPTS, "font-flags.sh")], capture_output=True, text=True).stdout.split()
    d = os.path.join(OUT, "overflow")
    os.makedirs(d, exist_ok=True)

    def msgs(text, name):
        with open(os.path.join(d, name + ".d2"), "w", encoding="utf-8") as fh:
            fh.write("vars: {d2-config: {layout-engine: elk; pad: 24}}\n" + text)
        subprocess.run(["d2"] + ff + ["--scale", "1", name + ".d2", name + ".svg"], cwd=d, capture_output=True)
        r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "d2lint.py"), "--json", os.path.join(d, name + ".svg")],
                           capture_output=True, text=True)
        return [f["message"] for f in json.loads(r.stdout)["findings"] if f["code"] == "E-label-overflow"]

    bad = []
    for shape, size in (("queue", "width: 90"), ("queue", "width: 130"), ("cylinder", "height: 60"),
                        ("cylinder", "height: 90"), ("diamond", "width: 100"), ("hexagon", "width: 90"),
                        ("rectangle", "width: 60"), ("parallelogram", "width: 90"), ("document", "height: 40")):
        name = "%s-%s" % (shape, size.replace(": ", ""))
        text = 'q: "Queue\\nKafka topic" {shape: %s; %s}\n' % (shape, size)
        m = msgs(text, name)
        sizes = re.findall(r"(width|height): (\d+) or more", m[0]) if m else []
        if not sizes:
            bad.append("%s: %s" % (name, m[0] if m else "no finding"))
        for dim, val in sizes:
            t2 = re.sub(dim + r": \d+", "%s: %s" % (dim, val), text) if dim in text else text.replace("}", "; %s: %s}" % (dim, val), 1)
            if msgs(t2, name + "-fixed"):
                bad.append("%s: %s %s still overflows" % (name, dim, val))
    check("E-label-overflow sizes clear it", not bad, "; ".join(bad)[:300])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-raster", action="store_true")
    ap.add_argument("-k", default="", help="only cases whose file name contains this")
    a = ap.parse_args()
    if not shutil.which("d2"):
        print("d2 not on PATH")
        return 1
    os.makedirs(OUT, exist_ok=True)
    emitted = lint_cases(a.k)
    if not a.k:
        synthetic()
        synthetic_multiline()
        synthetic_tilt()
        marker_geometry()
        output_modes()
        cli_exit_codes()
        fonts_bundle()
        overflow_sizes()
        contract_codes(emitted)
        if not a.no_raster:
            raster_cases()
    print("\n%d passed, %d failed" % (sum(results), len(results) - sum(results)))
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
