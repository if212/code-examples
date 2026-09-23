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
import tempfile
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
    flags = ["--elk-nodeNodeBetweenLayers", "40", "--elk-edgeNodeBetweenLayers", "20"] + flags
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
        wide = os.path.join(OUT, "bad_wide_chain.svg")
        subprocess.run([sys.executable, d2raster, "--inspect", os.path.join(OUT, "wide") + "=" + wide], capture_output=True)
        det = os.path.join(OUT, "wide.2x.png")
        size = pngstats.png_size(det) if os.path.exists(det) else (0, 0)
        check("raster: detail PNG <= 2000px", 0 < max(size) <= 2000, "%dx%d for a %.0fpx-wide svg" % (size + (d2lint.load(wide).W,)))
        pdf = os.path.join(OUT, "flow.pdf")
        r = subprocess.run(["node", os.path.join(SCRIPTS, "raster.cjs"), svg, pdf], capture_output=True, text=True)
        head = open(pdf, "rb").read(5) if os.path.exists(pdf) else b""
        check("raster: pdf export", r.returncode == 0 and head == b"%PDF-", (r.stdout + r.stderr).strip()[-100:])


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
        output_modes()
        contract_codes(emitted)
        if not a.no_raster:
            raster_cases()
    print("\n%d passed, %d failed" % (sum(results), len(results) - sum(results)))
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
