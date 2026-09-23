#!/usr/bin/env python3
"""Print the family and style of every font embedded in a d2 SVG.
usage: fontnames.py IN.svg   ->  one line per @font-face: <css name> <family> <subfamily>
d2 embeds WOFF subsets whose tables are zlib-compressed, so `grep Lato` finds
nothing; this reads each WOFF 'name' table instead (stdlib only)."""
import base64
import re
import struct
import sys
import zlib

sys.dont_write_bytecode = True  # keep the skill's scripts/ free of __pycache__ (B57)


def woff_names(raw):
    if raw[:4] != b'wOFF':
        return {}
    num = struct.unpack('>H', raw[12:14])[0]
    for i in range(num):
        tag, off, clen, olen, _ = struct.unpack('>4sIIII', raw[44 + 20 * i:64 + 20 * i])
        if tag != b'name':
            continue
        data = raw[off:off + clen]
        data = zlib.decompress(data) if clen < olen else data
        _, count, soff = struct.unpack('>HHH', data[:6])
        names = {}
        for j in range(count):
            pid, _, _, nid, ln, noff = struct.unpack('>HHHHHH', data[6 + 12 * j:18 + 12 * j])
            s = data[soff + noff:soff + noff + ln]
            txt = s.decode('utf-16-be', 'replace') if pid in (0, 3) else s.decode('latin-1')
            names.setdefault(nid, txt)
        return names
    return {}


def main(argv):
    if len(argv) != 1:
        print(__doc__.strip())
        return 2
    src = open(argv[0], encoding='utf-8').read()
    faces = re.findall(r'font-family:\s*([^;]+);\s*src:\s*url\("data:application/font-woff;base64,([^"]+)"\)', src)
    for css, data in faces:
        n = woff_names(base64.b64decode(data))
        print(f'{css.strip()}  {n.get(16) or n.get(1, "?")}  {n.get(17) or n.get(2, "?")}')
    return 0 if faces else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
