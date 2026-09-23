#!/usr/bin/env python3
"""WCAG 2.x contrast audit for D2 theme files (stdlib only).

usage:
  contrast.py FG BG [FG BG ...]      ratio for each color pair
  contrast.py --check THEME.d2 ...   audit every class and the theme-overrides
                                     defaults of a theme file

Rules (--check):
  text                   font-color >= 4.5:1 on what it sits on: the class fill,
                         or (no fill) the canvas and every container tint
  informative stroke     >= 3.0:1 against the canvas and every container tint:
                         edges, node outlines, transparent containers (boundary)
  decorative stroke      exempt: a container with a tinted fill (the tint and the
                         title mark the region), a node whose fill alone reaches
                         3.0:1, and any class marked with a `# decorative` comment
Works on `d2 fmt` output in both the compact and the expanded layout.

exit codes (shared by every script of the skill):
  0   pass (every pair meets its minimum)
  1   hard failure: a theme file cannot be read
  2   findings: a contrast failure (--check), or a pair below 4.5:1
  64  usage error
examples:
  python3 contrast.py --check neutral-theme.d2       audit a theme after editing its colors
  python3 contrast.py 475569 FFFFFF                  one pair: 7.58, passes
"""
import os
import re
import sys

THEME0 = {  # d2 theme 0, used for codes a theme file does not override
    'N1': '#0A0F25', 'N2': '#676C7E', 'N3': '#9499AB', 'N4': '#CFD2DD', 'N5': '#DEE1EB',
    'N6': '#EEF1F8', 'N7': '#FFFFFF', 'B1': '#0D32B2', 'B2': '#0D32B2', 'B3': '#E3E9FD',
    'B4': '#E3E9FD', 'B5': '#EDF0FD', 'B6': '#F7F8FE', 'AA2': '#4A6FF3', 'AA4': '#EDF0FD',
    'AA5': '#F7F8FE', 'AB4': '#EDF0FD', 'AB5': '#F7F8FE'}
NAMED = {'white': '#FFFFFF', 'black': '#000000'}
EDGE_HINTS = ('source-arrowhead', 'target-arrowhead')


def hexcolor(v):
    v = NAMED.get(str(v).lower(), v)
    if isinstance(v, str) and re.fullmatch(r'#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?', v):
        v = v.upper()
        return '#' + ''.join(c * 2 for c in v[1:]) if len(v) == 4 else v
    return None


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


# ---------------------------------------------------------------- d2 subset parser
TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|\'[^\']*\'|#[^\n]*|\[[^\]\n]*\]|(?:\$\{[^}\n]*\}|[^\s{};:#"\'\[])+|[{};:\n]')


def tokenize(src):
    out = []
    for m in TOKEN.finditer(src):
        t = m.group(0)
        if t.startswith('#'):
            out.append(('comment', t))
        elif t == '\n' or t == ';':
            out.append(('sep', t))
        elif t in '{}:':
            out.append((t, t))
        else:
            out.append(('word', t.strip('"\'') if t[0] in '"\'' else t))
    return out


def parse(tokens):
    """Return nested dicts; each map keeps its trailing/leading comments in '__comments__'."""
    pos = 0

    def parse_map():
        nonlocal pos
        m = {'__comments__': []}
        key = None
        while pos < len(tokens):
            kind, val = tokens[pos]
            if kind == '}':
                pos += 1
                return m
            if kind == 'comment':
                m['__comments__'].append((key, val))
                pos += 1
            elif kind == 'sep':
                key = None
                pos += 1
            elif kind == 'word':
                key, pos = val, pos + 1
                value = None
                if pos < len(tokens) and tokens[pos][0] == ':':
                    pos += 1
                    if pos < len(tokens) and tokens[pos][0] == 'word':
                        value, pos = tokens[pos][1], pos + 1
                if pos < len(tokens) and tokens[pos][0] == '{':
                    pos += 1
                    sub = parse_map()
                    if value is not None:
                        sub['__label__'] = value
                    value = sub
                    # a comment right after the closing brace belongs to this entry
                    if pos < len(tokens) and tokens[pos][0] == 'comment':
                        sub['__comments__'].append((None, tokens[pos][1]))
                        pos += 1
                put(m, key, value)
            else:
                pos += 1
        return m

    return parse_map()


def put(m, key, value):
    parts = key.split('.')
    for p in parts[:-1]:
        nxt = m.get(p)
        if not isinstance(nxt, dict):
            nxt = {'__comments__': []}
            m[p] = nxt
        m = nxt
    last = parts[-1]
    if isinstance(value, dict) and isinstance(m.get(last), dict):
        m[last].update(value)
    else:
        m[last] = value


def resolve(v, vars_):
    if isinstance(v, str):
        return re.sub(r'\$\{([\w-]+)\}', lambda mm: str(vars_.get(mm.group(1), mm.group(0))), v)
    return v


# ---------------------------------------------------------------- audit
EDGE_NAMES = {'flow', 'dep', 'secondary', 'async', 'failure', 'ok'}


def kind_of(name, cls):
    style = cls.get('style', {}) if isinstance(cls.get('style'), dict) else {}
    if name in EDGE_NAMES or any(k in cls for k in EDGE_HINTS) or re.search(r'(^|-)(edge|flow|failure)$', name):
        return 'edge'
    label = cls.get('label', {})
    if (isinstance(label, dict) and 'near' in label) or 'text-transform' in style \
            or re.search(r'zone|boundary|container', name):
        return 'container'
    return 'node'


def check(path):
    src = open(path, encoding='ascii', errors='replace').read()
    top = parse(tokenize(src))
    vars_ = {k: v for k, v in top.get('vars', {}).items() if isinstance(v, str) and not k.startswith('__')}
    cfg = top.get('vars', {}).get('d2-config', {})
    over = {k: hexcolor(resolve(v, vars_)) for k, v in (cfg.get('theme-overrides') or {}).items()
            if not k.startswith('__')}
    codes = dict(THEME0, **{k: v for k, v in over.items() if v})
    canvas = codes['N7']
    classes = {k: v for k, v in top.get('classes', {}).items() if not k.startswith('__') and isinstance(v, dict)}
    if not classes and not over:  # a diagram, not a theme: nothing would be checked, so say so instead of PASS
        print(f'contrast.py: {path} has no classes and no theme-overrides - --check audits a theme file, '
              f'e.g. python3 contrast.py --check neutral-theme.d2', file=sys.stderr)
        raise SystemExit(64)

    def st(cls, key):
        s = cls.get('style', {})
        return resolve(s.get(key), vars_) if isinstance(s, dict) else None

    tints = {}
    for name, cls in classes.items():
        if kind_of(name, cls) == 'container':
            f = hexcolor(st(cls, 'fill'))
            if f and f != canvas:
                tints[name] = f
    grounds = [('canvas', canvas)] + sorted(tints.items())
    fails, rows = 0, []

    def worst(fg, bgs):
        return min(((ratio(fg, c), n) for n, c in bgs), key=lambda t: t[0])

    def judge(label, fg, bgs, need):
        nonlocal fails
        r, where = worst(fg, bgs)
        ok = r >= need
        fails += not ok
        return f'{label} {r:5.2f} on {where}{"" if ok else "  FAIL (<%.1f)" % need}'

    for name, cls in classes.items():
        kind = kind_of(name, cls)
        comments = ' '.join(c for _, c in cls.get('__comments__', []))
        for sub in cls.values():
            if isinstance(sub, dict):
                comments += ' '.join(c for _, c in sub.get('__comments__', []))
        fill, stroke = hexcolor(st(cls, 'fill')), hexcolor(st(cls, 'stroke'))
        text = hexcolor(st(cls, 'font-color'))
        out = []
        if text:
            bgs = [('fill', fill)] if fill else grounds
            out.append(judge('text', text, bgs, 4.5))
        if stroke:
            decorative = 'decorative' in comments
            if kind == 'container' and fill and fill != canvas:
                decorative = True
            fill_id = kind == 'node' and fill and worst(fill, grounds)[0] >= 3.0
            if decorative:
                out.append(f'stroke {worst(stroke, grounds)[0]:5.2f} decorative')
            elif fill_id:
                out.append(f'stroke n/a (fill {worst(fill, grounds)[0]:.2f} marks the shape)')
            else:
                out.append(judge('stroke', stroke, grounds, 3.0))
        if not out:
            out.append('no colors (theme defaults apply)')
        rows.append((name, kind, out))

    print(f'{path}: canvas {canvas}; container tints: ' +
          (', '.join(f'{n} {c}' for n, c in sorted(tints.items())) or 'none'))
    w = max(len(r[0]) for r in rows) if rows else 8
    for name, kind, out in rows:
        print(f'  {name:<{w}}  {kind:<9} ' + ' | '.join(out))
    if over:
        print('  defaults (theme-overrides, used by un-classed shapes and sql_table/class):')
        dflt = [('label text N1 on B6/B5/B4', codes['N1'], [('B6', codes['B6']), ('B5', codes['B5']), ('B4', codes['B4'])], 4.5),
                ('edge label N2 on N7/B4', codes['N2'], [('N7', canvas), ('B4', codes['B4'])], 4.5),
                ('stroke B1 on N7/B4', codes['B1'], [('N7', canvas), ('B4', codes['B4'])], 3.0),
                ('table header N7 on N1', codes['N7'], [('N1', codes['N1'])], 4.5),
                ('table column B2 on N7', codes['B2'], [('N7', canvas)], 4.5),
                ('table type N2 on N7', codes['N2'], [('N7', canvas)], 4.5),
                ('table constraint AA2 on N7', codes['AA2'], [('N7', canvas)], 4.5)]
        for label, fg, bgs, need in dflt:
            print('    ' + judge(label, fg, bgs, need))
    print(f'RESULT: {"PASS" if not fails else "FAIL"} - {fails} failure(s) '
          '(text >= 4.5:1, informative strokes >= 3.0:1)')
    return fails


def main(argv):
    if argv and argv[0] in ('-h', '--help'):
        print(__doc__.strip())
        return 0
    if not argv:
        print('usage: contrast.py --check THEME.d2 [...] | contrast.py FG BG [FG BG ...] (see --help)', file=sys.stderr)
        return 64
    if argv[0] == '--check':
        if len(argv) < 2:
            print('usage: contrast.py --check THEME.d2 [...] - name the theme file(s) to audit', file=sys.stderr)
            return 64
        for p in argv[1:]:  # a missing file is a hard failure (1), not a contrast finding (2)
            try:
                open(p, encoding='ascii', errors='replace').close()
            except OSError as err:
                print(f'contrast.py: cannot read {p}: {err.strerror}', file=sys.stderr)
                return 1
        return 2 if sum(check(p) for p in argv[1:]) else 0
    for a in argv:
        if a.startswith('-') and not a.startswith('#'):
            print(f'contrast.py: unknown option {a} - use --check THEME.d2, or color pairs FG BG (see --help)', file=sys.stderr)
            return 64
        if a.endswith('.d2') or os.path.isfile(a):
            print(f'contrast.py: {a} is a file - audit a theme with: python3 contrast.py --check {a}', file=sys.stderr)
            return 64
    if len(argv) % 2:
        print('usage: contrast.py FG BG [FG BG ...] - colors come in pairs, e.g. 475569 FFFFFF', file=sys.stderr)
        return 64
    low = False
    for fg, bg in zip(argv[::2], argv[1::2]):
        a, b = hexcolor(fg if fg.startswith('#') else '#' + fg), hexcolor(bg if bg.startswith('#') else '#' + bg)
        if not a or not b:
            print(f'contrast.py: not a hex color: {fg if not a else bg} (use RRGGBB or #RRGGBB)', file=sys.stderr)
            return 64
        r = ratio(a, b)
        low = low or r < 4.5
        print(f'{a} on {b}: {r:.2f}{"" if r >= 4.5 else "  below 4.5:1 (text); " + ("ok for strokes" if r >= 3 else "below 3:1 (strokes)")}')
    return 2 if low else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
