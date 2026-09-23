#!/usr/bin/env python3
"""Design-system rules of the two theme files (stdlib only).

usage: theme_rules.py NEUTRAL.d2 SNOWFLAKE.d2
  (a) no node role's fill equals a container tint of its theme, so a node never
      looks hollow on the panel it sits on (actor on zone, sf-datastore on
      sf-container, focal on zone-blue, queue on zone-violet, note on zone-amber)
  (b) the neutral AA2 (table constraint tags, class member types) is a slate
      ink-* value, never a primary-* hue: blue means focus
  (c) the six geometry classes exist in both themes with the same geometry:
      every key but fill, stroke, font-color and border-radius is equal
  (d) compact, chip, tech and ghost set no color, so they may follow a modifier
      (semcheck's SHAPE_ONLY list relies on it)
  (e) modifiers (focal ... success, sf-primary ... sf-accent-*) set no size or shape, so a
      geometry class keeps its size in any position: [sf-node; chip; sf-muted] is 14px
  (f) the six geometry classes carry the interface values (FIXPLAN I3, title centered)
Parses `d2 fmt` output of a theme file (maps, quoted strings, ${var} references).
exit: 0 every rule holds | 1 a rule failed | 2 usage or parse error
"""
import re
import sys

GEOMETRY = ('compact', 'chip', 'tech', 'ghost', 'title', 'key')
PLAIN = ('compact', 'chip', 'tech', 'ghost')
MODIFIERS = ('focal', 'focal-solid', 'muted', 'external', 'danger', 'success', 'sf-primary', 'sf-external',
             'sf-muted', 'sf-accent-orange', 'sf-accent-star', 'sf-accent-pink', 'sf-accent-purple')
SIZE_KEYS = ('shape', 'width', 'height', 'style.font-size')
I3 = {  # geometry both themes must carry (colours may differ)
    'compact': {'height': '48'},
    'chip': {'width': '104', 'height': '32', 'style.font-size': '14'},
    'tech': {'style.opacity': '1'},
    'ghost': {'width': '12', 'height': '48', 'style.opacity': '0', 'style.font-size': '14', 'style.italic': 'false'},
    'title': {'shape': 'text', 'near': 'top-center', 'style.font-size': '18', 'style.bold': 'true'},
    'key': {'label': '', 'grid-rows': '1', 'horizontal-gap': '12', 'vertical-gap': '8', 'style.stroke-width': '1'},
}
COLOR_KEYS = ('style.fill', 'style.stroke', 'style.font-color', 'style.border-radius')
TOKEN = re.compile(r'"(?:[^"\\]|\\.)*"|#[^\n]*|(?:\$\{[^}\n]*\}|[^\s{};:#"])+|[{};:\n]')


def parse(src):
    toks = [t for t in TOKEN.findall(src) if not t.startswith('#')]
    pos = 0

    def parse_map():
        nonlocal pos
        out, key = {}, None
        while pos < len(toks):
            t = toks[pos]
            pos += 1
            if t == '}':
                return out
            if t in ('\n', ';'):
                key = None
            elif t == ':':
                continue
            elif t == '{':
                sub = parse_map()
                if key is not None:
                    out[key] = sub
                key = None
            elif key is None:
                key = t.strip('"')
                out.setdefault(key, None)
            else:
                out[key] = t.strip('"')
                key = None
        return out

    return parse_map()


def flat(m, prefix=''):
    out = {}
    for k, v in (m or {}).items():
        path = prefix + k
        if isinstance(v, dict):
            out.update(flat(v, path + '.'))
        else:
            out[path] = v
    return out


def load(path):
    try:
        top = parse(open(path, encoding='ascii').read())
    except (OSError, UnicodeDecodeError) as err:
        print(f'theme_rules: cannot read {path}: {err}')
        raise SystemExit(2)
    vars_ = {k: v for k, v in (top.get('vars') or {}).items() if isinstance(v, str)}
    classes = {k: flat(v) for k, v in (top.get('classes') or {}).items() if isinstance(v, dict)}
    if not classes:
        print(f'theme_rules: no classes parsed in {path}')
        raise SystemExit(2)

    def res(v):
        return re.sub(r'\$\{([\w-]+)\}', lambda m: vars_.get(m.group(1), m.group(0)), v or '').upper()

    over = flat((top.get('vars') or {}).get('d2-config') or {}).items()
    codes = {k.split('.')[-1]: res(v) for k, v in over if k.startswith('theme-overrides.')}
    return vars_, {n: {k: (res(v) if k in COLOR_KEYS[:3] else v) for k, v in c.items()}
                   for n, c in classes.items()}, codes


def is_container(name, cls):
    return 'label.near' in cls or re.match(r'(zone|boundary|sf-container|key$)', name)


def main(argv):
    if len(argv) != 2:
        print(__doc__.strip())
        return 2
    themes = {p: load(p) for p in argv}
    fails = []
    for path, (vars_, classes, codes) in themes.items():
        canvas = codes.get('N7', '#FFFFFF')
        tints = {n: c['style.fill'] for n, c in classes.items() if is_container(n, c)
                 and c.get('style.fill') not in (None, '', 'TRANSPARENT', canvas)}
        for n, c in sorted(classes.items()):
            if is_container(n, c) or not c.get('style.fill'):
                continue
            for z, t in sorted(tints.items()):
                if c['style.fill'] == t:
                    fails.append(f'(a) {path}: node class {n} has the fill of container {z} ({t}): '
                                 f'it looks hollow on that panel')
        for n in PLAIN:
            colors = [k for k in COLOR_KEYS[:3] if classes.get(n, {}).get(k)]
            if colors:
                fails.append(f'(d) {path}: geometry class {n} sets {", ".join(colors)}')
        for n in MODIFIERS:
            sizes = [k for k in SIZE_KEYS if classes.get(n, {}).get(k) is not None]
            if sizes:
                fails.append(f'(e) {path}: modifier {n} sets {", ".join(sizes)}: a geometry class before it '
                             f'loses its size')
        for n, want in I3.items():
            got = classes.get(n)
            bad = sorted(k for k, v in want.items() if got is not None and (k not in got or (got[k] or '') != v))
            if bad:
                fails.append(f'(f) {path}: class {n} has {", ".join(f"{k}={got.get(k)!r}" for k in bad)}; the '
                             f'interface says {", ".join(f"{k}={want[k]!r}" for k in bad)}')
    (npath, (nvars, nclasses, ncodes)), (spath, (_, sclasses, _)) = themes.items()
    aa2 = ncodes.get('AA2', '')
    inks = {v.upper() for k, v in nvars.items() if k.startswith('ink-')}
    blues = {v.upper() for k, v in nvars.items() if k.startswith('primary-')}
    if aa2 not in inks or aa2 in blues:
        fails.append(f'(b) {npath}: AA2 {aa2 or "(unset)"} is not a slate ink-* value: constraint tags '
                     f'and class member types would not be slate')
    for n in GEOMETRY:
        a, b = nclasses.get(n), sclasses.get(n)
        if a is None or b is None:
            fails.append(f'(c) class {n} missing from {npath if a is None else spath}')
            continue
        ga = {k: v for k, v in a.items() if k not in COLOR_KEYS}
        gb = {k: v for k, v in b.items() if k not in COLOR_KEYS}
        if ga != gb:
            diff = sorted(k for k in set(ga) | set(gb) if ga.get(k) != gb.get(k))
            fails.append(f'(c) class {n} differs between the themes in: {", ".join(diff)}')
    for f in fails:
        print('FAIL ' + f)
    print(f'theme rules: {"PASS" if not fails else "FAIL"} - {len(fails)} failure(s) '
          f'(a node fills, b AA2, c shared geometry, d plain geometry, '
          f'e modifier sizes, f interface values)')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
