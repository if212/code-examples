#!/usr/bin/env python3
"""pngstats - decide whether a rasterized d2 diagram actually shows the diagram.

Standard library only (uses Pillow for speed when it is installed). d2raster.py runs it on every PNG
it writes; run it by hand to check a PNG made some other way.
usage: python3 pngstats.py [--json] OUT.png [SOURCE.svg]   -> one line (or a JSON object)

Signals:
  ink      share of pixels that differ from the SVG's background colour
  fills    how many of the SVG's large opaque solid fill colours appear in the raster
  lines    how many of the SVG's text and line colours appear (at least one must: no letter and no
           line drawn means the renderer failed)
  black    share of near-black pixels (cairosvg paints d2's label masks as black bars)
  cropped  the inked area stops short of the right/bottom of where d2 drew content (short
           headless viewports)
Verdict:
  BLANK    ink < 0.05 %, or ink < 0.2 % and none of the expected fills found
  SUSPECT  fewer than half of the expected fills found, none of the text and line colours found,
           > 3 % near-black pixels although the SVG has no dark fills, or cropped
  OK       otherwise
"""
import re
import struct
import sys
import zlib
from collections import Counter

sys.dont_write_bytecode = True  # keep the skill's scripts/ free of __pycache__ (B57)

MAX_SAMPLES = 400000  # pixels examined per image (subsampled on a grid above that)


def _paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    return b if pb <= pc else c


def png_size(path):
    """(width, height) from the IHDR chunk, without decoding"""
    with open(path, "rb") as fh:
        head = fh.read(24)
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG: %s" % path)
    return struct.unpack(">II", head[16:24])


def decode_png(path):
    """-> (width, height, channels, list_of_row_bytearrays); 8-bit non-interlaced only without Pillow"""
    try:
        from PIL import Image  # optional fast path
        im = Image.open(path).convert("RGB")
        w, h = im.size
        buf = im.tobytes()
        return w, h, 3, [buf[y * w * 3:(y + 1) * w * 3] for y in range(h)]
    except ImportError:
        pass
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    pos, idat, plte = 8, [], None
    w = h = bd = ct = il = 0
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if typ == b"IHDR":
            w, h, bd, ct, _, _, il = struct.unpack(">IIBBBBB", body)
        elif typ == b"PLTE":
            plte = body
        elif typ == b"IDAT":
            idat.append(body)
        elif typ == b"IEND":
            break
    if bd != 8 or il:
        raise ValueError("only 8-bit non-interlaced PNGs supported without Pillow (bd=%d il=%d)" % (bd, il))
    bpp = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ct]
    raw = zlib.decompress(b"".join(idat))
    stride = w * bpp
    rows, prev, i = [], bytearray(stride), 0
    for _ in range(h):
        f = raw[i]
        line = bytearray(raw[i + 1:i + 1 + stride])
        i += 1 + stride
        if f == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 255
        elif f == 2:
            line = bytearray([(a + b) & 255 for a, b in zip(line, prev)])
        elif f == 3:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((left + prev[x]) >> 1)) & 255
        elif f == 4:
            for x in range(stride):
                if x >= bpp:
                    line[x] = (line[x] + _paeth(line[x - bpp], prev[x], prev[x - bpp])) & 255
                else:
                    line[x] = (line[x] + prev[x]) & 255
        rows.append(line)
        prev = line
    if ct == 3:  # palette -> RGB
        rows = [bytearray(b for idx in r for b in plte[idx * 3:idx * 3 + 3]) for r in rows]
        bpp = 3
    return w, h, bpp, rows


def crop_png(path, w, h):
    """crop PNG in place to the top-left w x h pixels (Pillow if present, else a stdlib encoder)"""
    try:
        from PIL import Image
        im = Image.open(path)
        im.crop((0, 0, min(w, im.size[0]), min(h, im.size[1]))).save(path)
        return
    except ImportError:
        pass
    W, H, bpp, rows = decode_png(path)
    w, h = min(w, W), min(h, H)
    ct = {1: 0, 2: 4, 3: 2, 4: 6}[bpp]
    raw = b"".join(b"\x00" + bytes(rows[y][:w * bpp]) for y in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ct, 0, 0, 0)) +
                chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def _alpha(el):
    """opacity x fill-opacity set on one element (attribute or inline style)"""
    a = 1.0
    st = el.get("style") or ""
    for key in ("opacity", "fill-opacity"):
        m = re.search(r"(?:^|;)\s*%s\s*:\s*([\d.]+)" % key, st)
        v = m.group(1) if m else el.get(key)
        try:
            a *= float(v) if v not in (None, "") else 1.0
        except ValueError:
            pass
    return a


def svg_expectations(svg_text):
    """large solid fills drawn by d2 shapes, background colour, and whether any fill is dark. Shapes that
    are translucent (style.opacity, legend helpers at opacity 0) or blended (sequence groups) are left
    out: their pixels never carry the fill's exact colour."""
    bgm = re.search(r'<svg class="[^"]*d2-svg[^"]*"[^>]*>\s*<rect[^>]*fill="(#[0-9A-Fa-f]{6})"', svg_text)
    bg = bgm.group(1).upper() if bgm else "#FFFFFF"
    fills = Counter()

    def consider(tag, attrs_get):
        col = (attrs_get("fill") or "").upper()
        if not re.fullmatch(r"#[0-9A-F]{6}", col) or col == bg:
            return
        if tag == "rect":
            try:
                if float(attrs_get("width") or 0) * float(attrs_get("height") or 0) < 600:
                    return  # tiny rects (mask cut-outs, table dividers)
            except ValueError:
                return
        fills[col] += 1
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(svg_text.encode("utf-8"))

        def walk(el, alpha):
            tag = el.tag.split("}", 1)[-1] if isinstance(el.tag, str) else ""
            if tag in ("mask", "defs", "clipPath", "marker", "pattern", "style", "foreignObject"):
                return
            a = alpha * _alpha(el)
            if a < 0.99 or "blend" in (el.get("class") or "").split():
                return
            if tag in ("rect", "ellipse", "path", "polygon"):
                consider(tag, el.get)
            for ch in el:
                walk(ch, a)
        walk(root, 1.0)
    except Exception:  # not parseable as XML: plain scan of the markup
        fills.clear()
        for m in re.finditer(r'<(rect|ellipse|path|polygon)\b([^>]*)>', svg_text):
            attrs = m.group(2)

            def get(k, attrs=attrs):
                v = re.search(r'(?<![\w-])%s="([^"]*)"' % k, attrs)
                return v.group(1) if v else None
            consider(m.group(1), get)
    dark = any(sum(int(c[i:i + 2], 16) for i in (1, 3, 5)) < 150 for c in fills)
    return bg, [c for c, _ in fills.most_common(8)], dark


def svg_ink_colours(svg_text, bg="#FFFFFF"):
    """the colours d2 writes text and lines in (label text, shape outlines, edges): opaque, clearly off the
    background and not near-black. A raster in which none of them appears drew no letter and no line (cairosvg
    paints white-filled d2 diagrams as an empty page with black bars, which the fill check cannot see)."""
    bgc = hexrgb(bg)
    cols = Counter()

    def add(col):
        col = (col or "").upper()
        if not re.fullmatch(r"#[0-9A-F]{6}", col):
            return
        c = hexrgb(col)
        if sum(abs(c[i] - bgc[i]) for i in range(3)) < 60 or max(c) < 24:
            return  # invisible on the canvas, or indistinguishable from a black bar
        cols[col] += 1
    try:
        import xml.etree.ElementTree as ET
        root = ET.fromstring(svg_text.encode("utf-8"))

        def walk(el, alpha):
            tag = el.tag.split("}", 1)[-1] if isinstance(el.tag, str) else ""
            if tag in ("mask", "defs", "clipPath", "marker", "pattern", "style", "foreignObject"):
                return
            a = alpha * _alpha(el)
            if a < 0.99:
                return
            if tag == "text":
                add(el.get("fill"))
            elif tag in ("rect", "ellipse", "path", "polygon", "line", "polyline") and el.get("stroke"):
                sw = re.search(r"stroke-width:\s*([\d.]+)", el.get("style") or "") or re.match(r"([\d.]+)", el.get("stroke-width") or "1")
                if sw and float(sw.group(1)) >= 1:
                    add(el.get("stroke"))
            for ch in el:
                walk(ch, a)
        walk(root, 1.0)
    except Exception:  # not parseable as XML: plain scan of the markup
        for m in re.finditer(r'<text\b[^>]*\bfill="(#[0-9A-Fa-f]{6})"', svg_text):
            add(m.group(1))
    return [c for c, _ in cols.most_common(12)]


def expected_box(svg):
    """where d2 drew content, as fractions of the canvas - lets analyse() notice a cropped raster"""
    try:
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        sys.dont_write_bytecode = True  # keep the skill's scripts/ free of __pycache__
        import d2lint
        dg = d2lint.load(svg)
        vb = dg.vb
        # what actually paints: remote images (shape: image with a URL) never load inside <img>
        # (and transparent cells - grid slots, spacers - draw nothing either)
        boxes = [n.box for n in dg.nodes.values()
                 if n.box and not n.hidden and not n.remote_image and getattr(n, "paints", True)]
        boxes += [t.box for t in dg.texts] + [e.box for e in dg.edges if e.box and not e.hidden] + [dg.legend]
        b = d2lint.union_all(boxes)
        return ((b.x0 - vb.x0) / vb.w, (b.y0 - vb.y0) / vb.h, (b.x1 - vb.x0) / vb.w, (b.y1 - vb.y0) / vb.h)
    except Exception:
        return None


def hexrgb(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def _stats_pillow(png, bgc):
    """(w, h, n, ink, black, hist, ink_box) using Pillow; hist maps colour -> sampled count"""
    from PIL import Image, ImageChops
    im = Image.open(png).convert("RGB")
    w, h = im.size
    step = max(1, int(((w * h) / MAX_SAMPLES) ** 0.5))
    sm = im.resize((max(1, w // step), max(1, h // step)), Image.NEAREST) if step > 1 else im
    cols = sm.getcolors(maxcolors=sm.size[0] * sm.size[1] + 1)
    hist = Counter({c: n for n, c in cols})
    n = sm.size[0] * sm.size[1]
    ink = sum(v for c, v in hist.items() if abs(c[0] - bgc[0]) + abs(c[1] - bgc[1]) + abs(c[2] - bgc[2]) > 30)
    black = sum(v for c, v in hist.items() if c[0] < 24 and c[1] < 24 and c[2] < 24)
    diff = ImageChops.difference(im, Image.new("RGB", im.size, bgc)).convert("L").point(lambda v: 255 if v > 10 else 0)
    bb = diff.getbbox()
    box = [bb[0], bb[1], bb[2] - 1, bb[3] - 1] if bb else [10 ** 9, 10 ** 9, -1, -1]
    return w, h, n, ink, black, hist, box


def _stats_stdlib(png, bgc):
    w, h, bpp, rows = decode_png(png)
    step = max(1, int(((w * h) / MAX_SAMPLES) ** 0.5))
    n = ink = black = 0
    hist = Counter()
    ix0 = iy0 = 10 ** 9
    ix1 = iy1 = -1
    for y in range(0, h, step):
        r = rows[y]
        for x in range(0, w, step):
            o = x * bpp
            if bpp >= 3:
                p = (255, 255, 255) if bpp == 4 and r[o + 3] < 128 else (r[o], r[o + 1], r[o + 2])
            else:
                p = (r[o], r[o], r[o])
            n += 1
            if abs(p[0] - bgc[0]) + abs(p[1] - bgc[1]) + abs(p[2] - bgc[2]) > 30:
                ink += 1
                ix0, iy0, ix1, iy1 = min(ix0, x), min(iy0, y), max(ix1, x), max(iy1, y)
            if p[0] < 24 and p[1] < 24 and p[2] < 24:
                black += 1
            hist[p] += 1
    return w, h, n, ink, black, hist, [ix0, iy0, ix1, iy1]


def analyse(png, svg=None, expect_box=None, check_fills=True):
    """expect_box: (x0, y0, x1, y1) of the drawn content as fractions of the canvas (expected_box());
    if the raster's ink stops well short of it, the image was cropped."""
    bg, expected, dark, lines = ("#FFFFFF", [], False, [])
    if svg:
        text = open(svg, encoding="utf-8", errors="replace").read()
        bg, expected, dark = svg_expectations(text)
        lines = svg_ink_colours(text, bg)
    if not check_fills:
        expected, lines = [], []
    bgc = hexrgb(bg)
    try:
        w, h, n, ink, black, hist, ibox = _stats_pillow(png, bgc)
    except ImportError:
        w, h, n, ink, black, hist, ibox = _stats_stdlib(png, bgc)
    found = []
    for c in expected:
        cc = hexrgb(c)
        cnt = sum(v for k, v in hist.items() if abs(k[0] - cc[0]) <= 3 and abs(k[1] - cc[1]) <= 3 and abs(k[2] - cc[2]) <= 3)
        if cnt >= 4:
            found.append(c)
    lines_found = [c for c in lines if sum(v for k, v in hist.items() if all(abs(k[i] - hexrgb(c)[i]) <= 12 for i in range(3))) >= 4]
    ink_r, black_r = ink / max(n, 1), black / max(n, 1)
    # a tiny diagram (one short label, pale fills) can ink < 0.2 %: blank only if its fills are missing too
    if ink_r < 0.0005 or (ink_r < 0.002 and not (expected and found)):
        verdict = "BLANK"
    elif expected and len(found) * 2 < len(expected):
        verdict = "SUSPECT"
    elif lines and not lines_found:  # not one letter or line in the colours the SVG draws them in
        verdict = "SUSPECT"
    elif black_r > 0.03 and not dark:
        verdict = "SUSPECT"
    else:
        verdict = "OK"
    cropped = ""
    if expect_box and ink and verdict == "OK":
        ix0, iy0, ix1, iy1 = ibox
        ex0, ey0, ex1, ey1 = expect_box[0] * w, expect_box[1] * h, expect_box[2] * w, expect_box[3] * h
        tol_x, tol_y = max(4, 0.03 * w), max(4, 0.03 * h)
        # a short viewport cuts the right or bottom off; the top-left still starts where d2 drew it
        # (ink missing on every side is pale or unloadable content, not a crop)
        short_br = ix1 < ex1 - tol_x or iy1 < ey1 - tol_y
        if short_br and ix0 <= ex0 + tol_x and iy0 <= ey0 + tol_y:
            verdict = "SUSPECT"
            cropped = "ink bbox %d,%d-%d,%d but content expected to reach %d,%d-%d,%d (cropped?)" % (
                ix0, iy0, ix1, iy1, ex0, ey0, ex1, ey1)
    return {"verdict": verdict, "cropped": cropped, "ink_box": ibox, "size": [w, h], "ink": round(ink_r, 4),
            "black": round(black_r, 4), "fills_expected": len(expected), "fills_found": len(found),
            "lines_expected": len(lines), "lines_found": len(lines_found), "colors": len(hist)}


EPILOG = """exit codes (shared by every script of the skill):
  0   OK: the PNG shows the diagram
  1   hard failure: the PNG or the SVG cannot be read
  2   finding: BLANK or SUSPECT (do not ship or trust this PNG; re-make it with d2raster.py)
  64  usage error
examples:
  python3 pngstats.py docs/flow.png docs/flow.svg        compare against the SVG it came from
  python3 pngstats.py --json docs/flow.png               ink and colour counts only"""


def main(argv=None):
    import argparse

    class ArgParser(argparse.ArgumentParser):
        def error(self, message):  # the skill's convention: usage errors exit 64 (2 means a finding)
            self.print_usage(sys.stderr)
            self.exit(64, "%s: error: %s (run with --help for the options)\n" % (self.prog, message))

    ap = ArgParser(prog="pngstats.py", description=__doc__.split("\n\n")[0], epilog=EPILOG,
                   formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("png", metavar="OUT.png", help="the PNG to check (from d2raster.py or any other rasterizer)")
    ap.add_argument("svg", nargs="?", metavar="SOURCE.svg", help="the SVG it was rasterized from (enables the fills and crop checks)")
    ap.add_argument("--json", action="store_true", help="print the measurements as JSON")
    a = ap.parse_args(argv)
    if a.png.lower().endswith(".svg"):
        ap.error("the PNG comes first, then the SVG it was made from: pngstats.py OUT.png %s" % a.png)
    try:
        r = analyse(a.png, a.svg, expected_box(a.svg) if a.svg else None)
    except (OSError, ValueError, zlib.error, struct.error) as e:
        print("pngstats: cannot read %s: %s" % (a.png if not isinstance(e, OSError) or not e.filename else e.filename,
                                                  e.strerror if isinstance(e, OSError) and e.strerror else e), file=sys.stderr)
        return 1
    if a.json:
        import json
        print(json.dumps(dict(r, file=a.png)))
    else:
        print("%s %s %dx%d ink=%.1f%% fills=%d/%d lines=%d/%d black=%.1f%% colors=%d%s" % (
            r["verdict"], a.png, r["size"][0], r["size"][1], r["ink"] * 100, r["fills_found"],
            r["fills_expected"], r["lines_found"], r["lines_expected"], r["black"] * 100, r["colors"],
            " " + r["cropped"] if r["cropped"] else ""))
    return 0 if r["verdict"] == "OK" else 2


if __name__ == "__main__":
    sys.exit(main())
