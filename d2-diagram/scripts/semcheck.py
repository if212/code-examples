#!/usr/bin/env python3
"""semcheck.py - does the rendered diagram say what the brief says? (python3 stdlib only)

The brief (D2W/<name>.brief, format in workflows/brief.md) is written from the
user's request before any D2. semcheck reads the graph d2 actually compiled
(from the rendered SVG, where every element carries its full d2 id), diffs it
against the brief's inventory and focus, and lints the source for slips that
compile into a different diagram.

usage:
  semcheck.py BRIEF IN.d2 [--svg OUT.svg|OUT_DIR]   check (d2check passes --svg to reuse its render)
  semcheck.py BRIEF OUT.svg                          check an SVG only (no source lint)
  semcheck.py --lint IN.d2 [--svg OUT.svg]           source slips only (quoting, classes, icons, engine)
  semcheck.py --explain IN.d2|OUT.svg                the drawn diagram as plain sentences
  semcheck.py --dump IN.d2|OUT.svg                   the drawn graph as a brief skeleton (edits)
  semcheck.py --compare OLD NEW                      meaning-level diff of two versions
  semcheck.py --hint "<d2 error text>" | -           one fix line per known d2 compile error
  semcheck.py --field KEY BRIEF                      print one brief header value (e.g. width)
options: --target BOARD (one board of a multi-board file), --json

exit: 0 clean (warnings allowed) | 1 S- errors | 2 missing or unusable input, compile error, no d2, or usage
Every finding ends with its recipe: workflows/review-and-fix.md#<code>.
"""
import base64
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict, deque

NS = '{http://www.w3.org/2000/svg}'
EDGE_RE = re.compile(r'^(?:(?P<scope>.*)\.)?\((?P<src>.*?) (?P<op><->|->|<-|--) (?P<dst>.*)\)\[(?P<idx>\d+)\]$')
B64_RE = re.compile(r'^[A-Za-z0-9+/]+=*$')
NUM_RE = re.compile(r'-?\d+(?:\.\d+)?')
RECIPES = 'workflows/review-and-fix.md#'

FOCAL_NODE = ('focal', 'focal-solid', 'sf-primary')
FOCAL_EDGE = ('flow', 'sf-flow')
SHAPE_ONLY = ('terminal', 'icon-card')     # set no colour, so they may follow a focal class
TYPES = ('architecture', 'deployment', 'c4', 'pipeline', 'sequence', 'erd', 'class',
         'flowchart', 'state', 'steps')
TYPE_ALIASES = {'flow': 'flowchart', 'cicd': 'flowchart', 'ci-cd': 'flowchart', 'uml': 'class',
                'uml-class': 'class', 'er': 'erd', 'sql': 'erd', 'schema': 'erd', 'k8s': 'deployment',
                'kubernetes': 'deployment', 'topology': 'deployment', 'state-machine': 'state',
                'data-pipeline': 'pipeline', 'seq': 'sequence', 'other': 'other',
                # catalog types (templates/<type>.d2 is the type; these are other names for it)
                'dfd': 'threat-model', 'threat': 'threat-model', 'vpc': 'network', 'dynamic': 'walkthrough',
                'lineage': 'depgraph', 'dependency': 'depgraph', 'dag': 'depgraph', 'before-after': 'compare',
                'delta': 'compare', 'gantt': 'roadmap', 'lanes': 'swimlane', 'org': 'tree', 'mindmap': 'tree',
                'hierarchy': 'tree', 'layers': 'stack', 'rag': 'llm-app', 'agent': 'llm-app', 'mcp': 'llm-app',
                'system-context': 'context', 'git': 'gitflow'}
HEADER_KEYS = ('type', 'reader', 'width', 'direction', 'focus', 'out', 'layout', 'title', 'brand')
SECTIONS = {'nodes': 'nodes', 'edges': 'edges', 'messages': 'edges', 'relationships': 'edges',
            'transitions': 'edges'}
NODE_ATTRS = ('shape', 'external', 'inferred', 'emphasis', 'start', 'end', 'decision', 'group',
              'note', 'cols', 'fields')
EDGE_ATTRS = ('dashed', 'solid', 'return', 'in', 'src', 'dst', 'src-label', 'dst-label', 'count', 'inferred')
HEADS = ('triangle', 'triangle-hollow', 'arrow', 'diamond', 'diamond-filled', 'circle',
         'circle-filled', 'box', 'box-filled', 'cross', 'cf-one', 'cf-one-required', 'cf-many',
         'cf-many-required', 'none')
CARD = {'cf-one': 'zero or one', 'cf-one-required': 'exactly one',
        'cf-many': 'zero or many', 'cf-many-required': 'one or many'}


class BriefError(Exception):
    pass


def overridden_by(classes, wanted):
    """The class after the last `wanted` one that re-sets its colours (in d2 the last class wins), or None."""
    idx = [i for i, c in enumerate(classes) if c in wanted]
    later = [c for c in classes[idx[-1] + 1:] if c not in SHAPE_ONLY] if idx else []
    return later[0] if later else None


def last_class_msg(obj, wanted, edge=False):
    cls = obj['classes']
    w = [c for c in cls if c in wanted][-1]
    fix = [c for c in cls if c != w and c not in SHAPE_ONLY] + [w] + [c for c in cls if c in SHAPE_ONLY]
    return ('' if edge else f"focus '{obj['id']}': ") + f"'{overridden_by(cls, wanted)}' comes after '{w}' and " \
        f"overrides it (the last class wins): write class: [{'; '.join(fix)}]"


# ---------------------------------------------------------------------------
# keys and labels
# ---------------------------------------------------------------------------

def split_key(key):
    """Split a d2 key path on dots outside quotes; strip the quotes."""
    parts, cur, q = [], '', None
    for ch in key:
        if q:
            if ch == q:
                q = None
            else:
                cur += ch
        elif ch in '"\'':
            q = ch
        elif ch == '.':
            parts.append(cur.strip())
            cur = ''
        else:
            cur += ch
    parts.append(cur.strip())
    return [p for p in parts if p != '']


def norm_key(key):
    """Canonical, case-insensitive form (d2 ids are case-insensitive)."""
    return '.'.join(p.lower() for p in split_key(key))


def parent_of(k):
    return '.'.join(split_key(k)[:-1])


def leaf_of(k):
    parts = split_key(k)
    return parts[-1] if parts else k


def ancestors(nk):
    parts = nk.split('.')
    return ['.'.join(parts[:i]) for i in range(1, len(parts))]


def norm_label(s):
    if s is None:
        return None
    s = s.replace('\\n', ' ').replace('\n', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def edit_distance(a, b):
    a, b = a.lower(), b.lower()
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def looks_like_typo(a, b):
    a, b = a.lower(), b.lower()
    if a == b or min(len(a), len(b)) < 3:
        return False
    return edit_distance(a, b) <= (1 if max(len(a), len(b)) <= 5 else 2)


def closest(word, choices):
    best = min(choices, key=lambda c: edit_distance(word, c))
    return best if edit_distance(word, best) <= 2 else None


# ---------------------------------------------------------------------------
# brief / inventory parsing
# ---------------------------------------------------------------------------

def strip_comment(line):
    out, q = '', None
    for ch in line:
        if q:
            out += ch
            if ch == q:
                q = None
            continue
        if ch in '"\'':
            q = ch
        elif ch == '#':
            break
        out += ch
    return out.rstrip()


def unquote(s):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in '"\'':
        return s[1:-1]
    return s


def split_attrs(s, allowed, where):
    """'Label {a, b: c}' -> ('Label', {'a': True, 'b': 'c'}). A trailing {...} counts as an
    attribute block only when a space precedes it and it holds identifier-like items;
    otherwise it is label text (GET /users/{id})."""
    m = re.search(r'(^|\s)\{([^{}]*)\}\s*$', s)
    if not m:
        return s, {}
    body, pos, items = m.group(2), 0, []
    for sep in split_outside_quotes(body, re.compile('[;,]')) + [None]:
        items.append(body[pos:sep.start() if sep else None].strip())
        pos = sep.end() if sep else pos
    items = [x for x in items if x]
    if items and all(re.match(r'^[A-Za-z][\w.-]*\s*(=.*)?$', x) for x in items) and any('=' in x for x in items):
        fixed = ', '.join(re.sub(r'\s*=\s*', ': ', x, count=1) for x in items)
        raise BriefError(f"{where}: write attributes as `{{key: value}}` with a colon, not `=`: {{{fixed}}}")
    if not items or not all(re.match(r'^[A-Za-z][\w.-]*\s*(:.*)?$', x) for x in items):
        return s, {}
    attrs = {}
    for x in items:
        k, v = (x.split(':', 1) + [None])[:2]
        k = k.strip().lower()
        if k not in allowed:
            near = closest(k, allowed)
            d2ish = k in ('class', 'style', 'label', 'icon', 'near', 'width', 'height') or k.startswith('style.')
            raise BriefError(f"{where}: unknown attribute '{k}'" + (f" (did you mean '{near}'?)" if near else '') +
                             (" - the brief records meaning ({dashed}, {inferred}); classes and styles go in the .d2"
                              if d2ish else '') + f"; allowed here: {', '.join(allowed)}")
        attrs[k] = unquote(v.strip()) if v is not None else True
    return s[:m.start()].rstrip(), attrs


def split_outside_quotes(s, sep_re):
    """Positions of sep_re matches that are not inside quotes."""
    out, q, i = [], None, 0
    while i < len(s):
        ch = s[i]
        if q:
            if ch == q:
                q = None
            i += 1
            continue
        if ch in '"\'':
            q = ch
            i += 1
            continue
        m = sep_re.match(s, i)
        if m:
            out.append(m)
            i = m.end()
            continue
        i += 1
    return out


OP_RE = re.compile(r'\s*(<->|->|<-|--)\s*')


def parse_edge_line(s, where):
    body, attrs = split_attrs(s, EDGE_ATTRS, where)
    colon = split_outside_quotes(body, re.compile(':'))     # the label starts at the first unquoted colon
    keys, label = (body[:colon[0].start()], body[colon[0].end():].strip()) if colon else (body, None)
    ops = split_outside_quotes(keys, OP_RE)
    if not ops:
        raise BriefError(f"{where}: cannot parse edge {s!r} - expected `src -> dst: label {{attrs}}` "
                         f"(operators -> <- <-> --)")
    ends, pos = [], 0
    for m in ops:
        ends.append(keys[pos:m.start()])
        pos = m.end()
    ends.append(keys[pos:])
    ends = [unquote(e.strip()) for e in ends]
    if any(not e for e in ends):
        raise BriefError(f"{where}: empty endpoint in {s!r}")
    label = unquote(label) if label else None
    if label == '*':
        label = None
    edges = []
    for i, m in enumerate(ops):
        src, op, dst = ends[i], m.group(1), ends[i + 1]
        a = dict(attrs)
        if op == '<-':          # canonical form: `a <- b` is `b -> a`; end attrs follow their ends
            src, dst, op = dst, src, '->'
            for sk, dk in (('src', 'dst'), ('src-label', 'dst-label')):
                s_v, d_v = a.pop(sk, None), a.pop(dk, None)
                if d_v:
                    a[sk] = d_v
                if s_v:
                    a[dk] = s_v
        edges.append({'src': src, 'dst': dst, 'op': op, 'label': label, 'attrs': a})
    return edges


def parse_node_line(s, where):
    body, attrs = split_attrs(s, NODE_ATTRS, where)
    if body.startswith('"'):
        m = re.match(r'^("[^"]+")\s*(?::\s*(.*))?$', body)
        if not m:
            raise BriefError(f"{where}: cannot parse node {s!r} - expected `key: Label {{attrs}}`")
        key, label = m.group(1), (m.group(2) or '')
    elif ':' in body:
        key, label = body.split(':', 1)
    else:
        key, label = body, ''
    key, label = key.strip(), label.strip()
    if not key or (not key.startswith('"') and re.search(r'<->|->|<-|--', key)):
        raise BriefError(f"{where}: {s!r} looks like an edge - put it under edges:")
    label = unquote(label) if label else None
    if label == '*':
        label = None
    return key, label, attrs


def parse_focus(value):
    """'a.b, x -> y -> z' -> (['a.b'], [('x','y'), ('y','z')]); 'none' -> ([], [])."""
    nodes, chains = [], []
    v = (value or '').strip()
    if v.lower() in ('', 'none', '-', 'n/a'):
        return nodes, chains
    for item in [x.strip() for x in v.split(',') if x.strip()]:
        parts = [unquote(p) for p in re.split(r'\s*->\s*', item)]
        if len(parts) == 1:
            nodes.append(parts[0])
        else:
            chains.extend(zip(parts, parts[1:]))
    return nodes, chains


def template_types():
    """Every templates/<type>.d2 of the skill is a valid brief type (the themes are not types)."""
    try:
        names = os.listdir(SKILL_TEMPLATES)
    except OSError:
        return set()
    return {f[:-3].lower() for f in names if f.endswith('.d2')} - {'neutral-theme', 'snowflake-brand'}


def parse_brief(path):
    inv = {'path': path, 'type': 'other', 'nodes': {}, 'edges': [], 'meta': {}, 'notes': [],
           'focus_nodes': [], 'focus_edges': [], 'has_focus': False}
    section, request, in_request, quoted, open_q = None, [], False, False, False
    try:
        fh = open(path, encoding='utf-8')
    except OSError as e:
        raise BriefError(f'cannot read brief {path}: {e.strerror}')
    with fh:
        lines = fh.read().splitlines()
    for lineno, raw in enumerate(lines, 1):
        where = f'{path}:{lineno}'
        st = raw.strip()
        m = re.match(r'^#\s*request\s*:\s*(.*)$', st, re.I)
        if m:
            first = m.group(1).strip()
            request, in_request = [first], True
            quoted = first.startswith('"')
            open_q = quoted and first.count('"') % 2 == 1
            continue
        # a quoted request continues on any `#` line until its closing quote; an unquoted one only
        # on indented `#   ...` lines, so a plain comment after the request is not swallowed
        if in_request and st.startswith('#') and (open_q or (not quoted and re.match(r'^#(\s{2,}|\t)', st))):
            txt = st[1:].strip()
            request.append(txt)
            if open_q and txt.count('"') % 2 == 1:
                open_q = False
            continue
        in_request = False
        line = strip_comment(raw)
        if not line.strip():
            continue
        s = line.strip()
        low = s.lower()
        if low.endswith(':') and low[:-1].strip() in SECTIONS:
            section = SECTIONS[low[:-1].strip()]
            continue
        hm = re.match(r'^([A-Za-z][\w-]*)\s*:\s*(.*)$', s)
        if hm and not raw[:1].isspace() and hm.group(1).lower() in HEADER_KEYS:
            k, v = hm.group(1).lower(), hm.group(2).strip()
            if k == 'type':
                t = TYPE_ALIASES.get(v.lower(), v.lower())
                if t not in TYPES and t != 'other' and t not in template_types():
                    inv['notes'].append(f"type '{v}' has no template: pick one with workflows/route.md, or write "
                                        f"`type: other` (checks for known types stay off)")
                inv['type'] = t
            elif k == 'focus':
                inv['has_focus'] = True
                inv['focus_nodes'], inv['focus_edges'] = parse_focus(v)
            inv['meta'][k] = v
            continue
        if section is None:
            if hm:
                raise BriefError(f"{where}: '{hm.group(1)}' is not a header key ({', '.join(HEADER_KEYS[:6])}) - "
                                 f"did you forget the `nodes:` line above it?")
            raise BriefError(f"{where}: {s!r} is outside a nodes:/edges: section")
        if section == 'edges':
            for e in parse_edge_line(s, where):
                e['line'] = lineno
                inv['edges'].append(e)
        else:
            key, label, attrs = parse_node_line(s, where)
            nk = norm_key(key)
            if nk in inv['nodes'] and not inv['nodes'][nk]['attrs'].get('_implied'):
                raise BriefError(f"{where}: node '{key}' is listed twice (keys are case-insensitive)")
            inv['nodes'][nk] = {'key': key, 'label': label, 'attrs': attrs, 'line': lineno}
    if request:
        inv['meta']['request'] = unquote(' '.join(x for x in request if x))
        if open_q:
            inv['notes'].append('the `# request:` quote is never closed: end the request with `"`')
    # containers implied by dotted keys and edge endpoints are expected nodes too
    for e in inv['edges']:
        for end in (e['src'], e['dst']):
            nk = norm_key(end)
            if nk not in inv['nodes'] and inv['type'] not in ('erd', 'class'):
                inv['nodes'][nk] = {'key': end, 'label': None, 'attrs': {'_implied': True}, 'line': e['line']}
    for nk in list(inv['nodes']):
        parts = nk.split('.')
        for i in range(1, len(parts)):
            anc = '.'.join(parts[:i])
            if anc not in inv['nodes']:
                inv['nodes'][anc] = {'key': anc, 'label': None, 'attrs': {'_implied': True, '_ancestor': True},
                                     'line': 0}
    if path.endswith('.brief'):
        missing = [k for k in ('type', 'reader', 'width', 'direction', 'focus') if k not in inv['meta']]
        if missing:
            inv['notes'].append('brief header lacks: ' + ', '.join(missing) + ' (workflows/brief.md)')
        if 'request' not in inv['meta']:
            inv['notes'].append('brief has no `# request:` line - paste the request verbatim so the inventory '
                                'can be checked against it')
    if 'width' in inv['meta'] and not re.match(r'^\d+', inv['meta']['width']):
        inv['notes'].append(f"width '{inv['meta']['width']}' is not a number of px")
    return inv


STOP = {'i', 'a', 'an', 'the', 'ok', 'id', 'ids', 'we', 'our', 'it', 'and', 'or', 'show', 'draw', 'make',
        'diagram', 'readme', 'please', 'highlight', 'include', 'use', 'also', 'then', 'if', 'when', 'for',
        'uml', 'erd', 'er', 'c4', 'sql', 'null', 'not', 'pk', 'fk', 'ci', 'cd', 'ci/cd', 'pr', 'svg', 'png', 'd2',
        'tbd', 'todo', 'etc', 'e.g', 'i.e', 'vs', 'saas', 'paas', 'iaas', 'b2b', 'b2c', 'mvp', 'poc', 'faq'}


def request_terms(text):
    """Proper names and identifiers in the request: acronyms, CamelCase, mid-sentence
    capitals, snake_case / dotted identifiers."""
    terms = []
    for sent in re.split(r'(?<=[.!?;:])\s+|\n', text):
        words = re.findall(r'[A-Za-z][A-Za-z0-9_.+/-]*[A-Za-z0-9+]|[A-Za-z]', sent)
        for i, w in enumerate(words):
            w = w.strip('.')
            if not w or w.lower() in STOP:
                continue
            acronym = re.match(r'^[A-Z][A-Z0-9]+s?$', w)
            camel = re.search(r'[a-z][A-Z]', w)
            ident = re.search(r'[a-z0-9][_.][a-z]', w)
            capital = i > 0 and w[0].isupper()
            if acronym or camel or ident or capital:
                if w not in terms:
                    terms.append(w)
    return terms


def uncovered_request_terms(inv):
    req = inv['meta'].get('request')
    if not req:
        return []
    hay = [inv['meta'].get(k, '') for k in ('out', 'focus', 'reader', 'type', 'title')]
    for k, v in inv['nodes'].items():
        hay += [v['key'], v['label'] or '', str(v['attrs'].get('cols', '')), str(v['attrs'].get('fields', ''))]
    for e in inv['edges']:
        hay += [e['src'], e['dst'], e['label'] or '']
    hay = norm_label(' '.join(hay)).lower()
    return [t for t in request_terms(req) if t.lower() not in hay and t.lower().rstrip('s') not in hay]


# ---------------------------------------------------------------------------
# SVG parsing
# ---------------------------------------------------------------------------

def _text_of(t):
    spans = [''.join(x.itertext()) for x in t if x.tag.split('}')[-1] == 'tspan']
    return (spans if spans else [''.join(t.itertext())])


def _texts(el):
    out = []
    for x in el.iter():
        tag = x.tag.split('}')[-1]
        if tag == 'text':
            out.append(' '.join(_text_of(x)))
        elif tag == 'foreignObject':
            out.append(' '.join(t.strip() for t in x.itertext() if t.strip()))
    return [norm_label(t) for t in out if t is not None]


PATH_TOK_RE = re.compile(r'[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?')
PATH_ARGS = {'m': 2, 'l': 2, 't': 2, 'h': 1, 'v': 1, 'c': 6, 's': 4, 'q': 4, 'a': 7, 'z': 0}


def path_points(d):
    """Absolute points of an SVG path (end and control points). Handles every command, relative
    ones and the one-number H/V that d2 uses for cylinders, queues and pages."""
    toks, pts = PATH_TOK_RE.findall(d or ''), []
    cx = cy = sx = sy = 0.0
    cmd, i = None, 0
    while i < len(toks):
        if toks[i].isalpha():
            cmd, i = toks[i], i + 1
            if cmd in 'Zz':
                cx, cy = sx, sy
            continue
        low = (cmd or 'z').lower()
        n = PATH_ARGS.get(low, 0)
        args = toks[i:i + n]
        if not n or len(args) < n or any(a.isalpha() for a in args):
            break
        v = [float(a) for a in args]
        i += n
        rel = cmd.islower()
        if low == 'h':
            cx = v[0] + (cx if rel else 0)
        elif low == 'v':
            cy = v[0] + (cy if rel else 0)
        elif low == 'a':
            cx, cy = v[5] + (cx if rel else 0), v[6] + (cy if rel else 0)
        else:
            bx, by = (cx, cy) if rel else (0.0, 0.0)
            for k in range(0, n, 2):
                pts.append((v[k] + bx, v[k + 1] + by))
            cx, cy = pts[-1]
            if low == 'm':
                sx, sy = cx, cy
                cmd = 'l' if rel else 'L'      # more pairs after a moveto are linetos
        pts.append((cx, cy))
    return pts


def _bbox_of(el):
    tag = el.tag.split('}')[-1]
    try:
        if tag == 'rect':
            x, y, w, h = (float(el.get(a)) for a in ('x', 'y', 'width', 'height'))
            return (x, y, x + w, y + h)
        if tag in ('ellipse', 'circle'):
            cx, cy = float(el.get('cx')), float(el.get('cy'))
            rx = float(el.get('rx') or el.get('r'))
            ry = float(el.get('ry') or el.get('r'))
            return (cx - rx, cy - ry, cx + rx, cy + ry)
        if tag in ('path', 'polygon'):
            if tag == 'path':
                pts = path_points(el.get('d'))
            else:
                nums = [float(n) for n in NUM_RE.findall(el.get('points') or '')]
                pts = list(zip(nums[0::2], nums[1::2]))
            if pts:
                xs, ys = [p[0] for p in pts], [p[1] for p in pts]
                return (min(xs), min(ys), max(xs), max(ys))
    except (TypeError, ValueError):
        pass
    return None


def classify_marker(marker):
    """Map a d2 <marker> to an arrowhead name (independent of theme and colour)."""
    kids = [k for k in marker if isinstance(k.tag, str)]
    if not kids:
        return 'none'
    el = kids[0]
    tag = el.tag.split('}')[-1]
    hollow = 'fill-N7' in (el.get('class') or '') or (el.get('fill') or '').upper() in ('#FFFFFF', 'WHITE')
    if tag == 'g':
        inner = [k for k in el if isinstance(k.tag, str)]
        if any(k.tag.endswith('polygon') for k in inner):
            return 'cross'
        first = inner[0].tag.split('}')[-1] if inner else ''
        crow = inner[-1].get('d', '') if inner else ''
        many = crow.count('M') >= 3
        required = first == 'path'
        return 'cf-' + ('many' if many else 'one') + ('-required' if required else '')
    if tag == 'circle':
        return 'circle' + ('' if hollow else '-filled')
    if tag == 'polygon':
        pts = NUM_RE.findall(el.get('points', ''))
        n = len(pts) // 2
        if n == 3:
            return 'triangle' + ('-hollow' if hollow else '')
        if n == 4:
            fx = [float(v) for v in pts[0::2]]
            fy = [float(v) for v in pts[1::2]]
            if len(set(round(v) for v in fx)) == 2 and len(set(round(v) for v in fy)) == 2:
                return 'box' + ('' if hollow else '-filled')

            def centred(v):
                v = sorted(v)
                return abs(v[1] - (v[0] + v[3]) / 2) < 1.0 and abs(v[2] - (v[0] + v[3]) / 2) < 1.0
            if centred(fx) or centred(fy):
                mid_x, mid_y = sorted(fx)[1:3], sorted(fy)[1:3]
                if abs(mid_x[0] - mid_x[1]) < 1.0 and abs(mid_y[0] - mid_y[1]) < 1.0:
                    return 'diamond' + ('' if hollow else '-filled')
            return 'arrow'
    return 'unknown'


def parse_svg(path, board=''):
    root = ET.parse(path).getroot()
    markers = {m.get('id'): classify_marker(m) for m in root.iter(NS + 'marker')}
    # the black rects of d2's label masks sit exactly under MAIN edge labels (not arrowhead labels)
    masks = []
    for mk in root.iter(NS + 'mask'):
        for r in mk.iter(NS + 'rect'):
            if (r.get('fill') or '').lower() == 'black':
                b = _bbox_of(r)
                if b:
                    masks.append(b)
    nodes, edges, lifelines, hidden_nodes = {}, [], set(), set()
    order = 0

    def hidden(el):
        return re.search(r'opacity:\s*0(\.0*)?(;|$)', el.get('style') or '') is not None or \
            (el.get('opacity') or '').strip() in ('0', '0.0', '0.000000')

    def walk(el, in_legend):
        nonlocal order
        for ch in el:
            if not isinstance(ch.tag, str):
                continue
            tag = ch.tag.split('}')[-1]
            # d2 >= 0.7 draws the native legend (vars.d2-legend) inside a scaled <g transform>
            legend = in_legend or (tag == 'g' and 'scale(' in (ch.get('transform') or ''))
            toks = (ch.get('class') or '').split()   # BASE64(id) first, then the user's classes
            cls = toks[0] if toks else ''
            if tag == 'g' and cls and B64_RE.match(cls) and cls != 'shape':
                try:
                    ident = html.unescape(base64.b64decode(cls, validate=True).decode('utf-8'))
                except Exception:
                    ident = None
                if ident and not legend and not hidden(ch):
                    order += 1
                    m = EDGE_RE.match(ident)
                    if m:
                        if m.group('dst').strip() == '' and m.group('op') == '--':
                            lifelines.add(m.group('src'))
                        else:
                            record_edge(ident, m, ch, order, toks[1:])
                    else:
                        record_node(ident, ch, order, toks[1:])
                elif ident and not legend and not EDGE_RE.match(ident):
                    hidden_nodes.add(norm_key(ident))     # a hidden helper (grid slot, spacer) still exists
            if tag != 'marker':
                walk(ch, legend)

    def record_node(ident, g, order, classes):
        shape_g = next((k for k in g if k.tag == NS + 'g' and 'shape' in (k.get('class') or '').split()), None)
        bbox, style = None, {}
        if shape_g is not None:
            prim = next((k for k in shape_g if isinstance(k.tag, str)), None)
            if prim is not None:
                bbox = _bbox_of(prim)
                style = {'fill': prim.get('fill'), 'stroke': prim.get('stroke'),
                         'style': prim.get('style') or '', 'shape_tag': prim.tag.split('}')[-1]}
        text_pos, lines = [], []
        for t in g.iter(NS + 'text'):
            parts = _text_of(t)
            lines.append(parts)
            try:
                text_pos.append((norm_label(''.join(t.itertext())), float(t.get('x')), float(t.get('y'))))
            except (TypeError, ValueError):
                pass
        style['text_pos'] = text_pos
        nodes[norm_key(ident)] = {'id': ident, 'texts': _texts(g), 'lines': lines, 'bbox': bbox, 'style': style,
                                  'order': order, 'classes': classes, 'board': board}

    def record_edge(ident, m, g, order, classes):
        scope = m.group('scope') or ''
        pre = (scope + '.') if scope else ''
        src, dst = pre + m.group('src'), pre + m.group('dst')
        # the edge's own path is a DIRECT child; <marker> defs in the same <g> also hold paths
        path = next((p for p in g if p.tag == NS + 'path' and 'connection' in (p.get('class') or '')), None)
        start = end = ms = me = None
        dashed = False
        if path is not None:
            pts = path_points(path.get('d', ''))
            if len(pts) >= 2:
                start, end = pts[0], pts[-1]
            dashed = 'stroke-dasharray' in (path.get('style') or '')
            for attr in ('marker-start', 'marker-end'):
                v = path.get(attr)
                mm = re.search(r'#([^)]+)\)', v or '')
                if mm:
                    if attr == 'marker-start':
                        ms = markers.get(mm.group(1), 'unknown')
                    else:
                        me = markers.get(mm.group(1), 'unknown')
        main, ends, end_pos = [], [], []
        for t in g.iter(NS + 'text'):
            txt = norm_label(' '.join(_text_of(t)))
            try:
                x, y = float(t.get('x')), float(t.get('y'))
                inside = any(b[0] - 2 <= x <= b[2] + 2 and b[1] - 2 <= y <= b[3] + 4 for b in masks)
            except (TypeError, ValueError):
                x = y = None
                inside = True
            (main if inside else ends).append(txt)
            if not inside:
                end_pos.append((txt, x, y))
        if not main and not masks:
            main, ends, end_pos = ends, [], []
        edges.append({'id': ident, 'src': src, 'dst': dst, 'op': m.group('op'), 'idx': int(m.group('idx')),
                      'texts': _texts(g), 'label': ' '.join(x for x in main if x), 'end_labels': ends,
                      'end_pos': end_pos,
                      'start': start, 'end': end, 'marker_start': ms, 'marker_end': me, 'dashed': dashed,
                      'order': order, 'classes': classes, 'board': board})

    walk(root, False)
    return {'nodes': nodes, 'edges': edges, 'lifelines': lifelines, 'hidden_nodes': hidden_nodes,
            'lifelines_norm': {norm_key(x) for x in lifelines}, 'boards': [board]}


def board_name(rel):
    rel = rel[:-4] if rel.endswith('.svg') else rel
    parts = rel.split(os.sep)
    if parts[-1] == 'index':
        parts = parts[:-1]
    return '.'.join(parts)


def load_graph(path):
    """An SVG file, or a d2 multi-board output directory (index.svg + one SVG per board).
    For several boards the graph is their UNION: a node counts once, an edge as often as
    the board that draws it most often."""
    if os.path.isfile(path):
        return parse_svg(path)
    svgs = []
    for d, _, files in os.walk(path):
        for f in files:
            if f.endswith('.svg'):
                svgs.append(os.path.join(d, f))
    if not svgs:
        raise FileNotFoundError(f'no SVG found at {path}')
    svgs.sort(key=lambda p: (os.path.relpath(p, path) != 'index.svg', os.path.relpath(p, path)))
    graphs = [parse_svg(p, board_name(os.path.relpath(p, path))) for p in svgs]
    if len(graphs) == 1:
        return graphs[0]
    nodes, best, lifelines = {}, {}, set()
    for g in graphs:
        for k, n in g['nodes'].items():
            nodes.setdefault(k, n)
        groups = defaultdict(list)
        for e in g['edges']:
            groups[canon_edge(e['src'], e['op'], e['dst'])].append(e)
        for key, grp in groups.items():
            if len(grp) > len(best.get(key, [])):
                best[key] = grp
        lifelines |= g['lifelines']
    edges = sorted((e for grp in best.values() for e in grp), key=lambda e: e['order'])
    return {'nodes': nodes, 'edges': edges, 'lifelines': lifelines,
            'hidden_nodes': set().union(*(g.get('hidden_nodes', set()) for g in graphs)),
            'lifelines_norm': {norm_key(x) for x in lifelines}, 'boards': [g['boards'][0] for g in graphs]}


# ---------------------------------------------------------------------------
# rendering, compile hints, source lint
# ---------------------------------------------------------------------------

HINTS = [
    (r'reserved keywords are prohibited in edges',
     '{tok} is a d2 keyword, which cannot be an edge endpoint (label shape style icon link width height top left '
     'near class direction tooltip ...): rename the key (`left_panel: Left`) and keep the word in the label'),
    (r'non-integer (top|left) ',
     '`top`/`left` are position keywords, not node keys: rename the key (`top_bar: Top`)'),
    (r'non-integer (width|height) ',
     'width/height take a bare integer (`width: 160`), no units'),
    (r'substitutions must begin on \{',
     '`$` starts a ${var} substitution even inside double quotes: use single quotes (\'costs $5\') or `\\$`'),
    (r'edge map keys must be reserved keywords|unexpected text after unquoted string',
     'a label contains `{`, `[` or `]`: wrap the whole label in double quotes ("GET /users/{id}", "retry [n < 3]")'),
    (r'is not a valid config',
     'valid d2-config keys: theme-id dark-theme-id layout-engine pad center sketch theme-overrides '
     'dark-theme-overrides; ELK spacing is a CLI flag that d2check already sets'),
    (r'failed to import',
     '{imp} is not next to the .d2 (imports resolve relative to the importing file): {impfix}'),
    (r'failed to bundle local images',
     'a local icon path does not exist relative to the .d2 file: copy the icon next to it or fix the path '
     '(workflows/icons.md)'),
    (r'failed to bundle remote images',
     'an icon URL does not resolve (404/403/offline): check it with `sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh '
     'verify <prefix:name>` or use a bundled icon from ${CLAUDE_SKILL_DIR}/assets/icons'),
    (r'unknown shape',
     'unknown shape or arrowhead name; shapes: rectangle square page parallelogram document cylinder queue package '
     'step callout stored_data person diamond oval circle hexagon cloud text sql_table class c4-person; '
     'arrowheads: triangle arrow diamond circle box cross cf-one cf-one-required cf-many cf-many-required'),
    (r'to be a valid named color',
     'colours are CSS names or quoted hex ("#1D4ED8"); theme codes (B1, N2) work only inside theme-overrides - '
     'prefer a role class to any colour'),
    (r'invalid style keyword',
     'misspelled style key; valid: fill stroke stroke-width stroke-dash border-radius opacity font-color font-size '
     'bold italic underline shadow 3d multiple double-border text-transform filled animated'),
    (r'(\w[\w-]*) must be style\.',
     'style keys go under `style.` and keywords are lowercase: `style.fill`, not `Style.fill` or bare `fill`'),
    (r'to be a number between',
     'value out of range (see the range in the error): stroke-width is an integer 0-15, opacity 0-1, '
     'font-size 8-100'),
    (r'to be true or false',
     'boolean style: write true or false'),
    (r'can only be applied to',
     '`3d` / `double-border` exist only on the shapes named in the error: drop the style or change the shape'),
    (r'is not a valid theme ID',
     'unknown theme-id: keep the theme file\'s d2-config (neutral-theme uses theme-id 0)'),
    (r'goes from a container to a descendant|only supports constant values for "near"'
     r'|is not bundled and could not be found',
     'this needs the ELK engine (dagre cannot draw it; TALA is not installed): import the theme or set '
     'vars: {d2-config: {layout-engine: elk}}, and never pass -l'),
    (r'near key .* must be',
     '`near` takes top-left top-center top-right center-left center-right bottom-left bottom-center bottom-right'),
    (r'"style" expected to be set to a map|"style" needs a value',
     '`style` alone has no value (`a.style`, `**.style`): write `style.opacity: 0.4` or `style: {...}` - better, '
     'a role class'),
    (r'class "[^"]*,[^"]*" not found',
     'separate classes with `;` inside the brackets: `class: [service; focal]` (base first, modifier last)'),
    (r'could not resolve variable',
     '${name} is not defined: define it under vars, or add the missing theme import'),
    (r'direction must be one of',
     'direction is up, down, right or left'),
    (r'missing value after colon',
     'nothing after a colon: give the value; an unquoted `#` starts a comment, so quote hex colours ("#FFFFFF") '
     'and labels containing `#`'),
    (r'maps must be terminated with \}',
     'unbalanced `{`: often an unquoted `#` that commented out the closing brace, or a label containing `{`'),
    (r'block string must be terminated',
     'close the |md ... | block with a `|` line (or use shape: text with a plain label)'),
]


def hint_lines(text):
    out = []
    for pat, msg in HINTS:
        m = re.search(pat, text)
        if not m:
            continue
        tok = "one of the edge's node keys"
        loc = re.search(r'([^\s:]+\.d2):(\d+):(\d+):[^\n]*' + pat, text)
        if loc and '{tok}' in msg:
            try:
                ln = open(loc.group(1), encoding='utf-8').read().splitlines()[int(loc.group(2)) - 1]
                w = re.match(r'[\w-]+', ln[int(loc.group(3)) - 1:])
                if w:
                    tok = f'`{w.group(0)}` (line {loc.group(2)})'
            except (OSError, IndexError, ValueError):
                pass
        imp = re.search(r'failed to import "([^"]+)"', text)
        name = os.path.basename(imp.group(1)) if imp else 'the imported file'
        impfix = (f'cp ${{CLAUDE_SKILL_DIR}}/templates/{name} <dir>/'
                  if name in ('neutral-theme.d2', 'snowflake-brand.d2') else
                  'copy it there; the skill themes are in ${CLAUDE_SKILL_DIR}/templates/')
        msg = msg.replace('{imp}', f'`{name}`' if imp else name).replace('{impfix}', impfix)
        out.append('hint: ' + msg.replace('{tok}', tok))
    return out


D2_ENV_OVERRIDES = ('D2_LAYOUT', 'D2_THEME', 'D2_DARK_THEME', 'D2_PAD', 'D2_SKETCH', 'D2_CENTER', 'D2_WATCH',
                    'D2_ANIMATE_INTERVAL', 'D2_BUNDLE', 'D2_FORCE_APPENDIX', 'SCALE')


SKILL_TEMPLATES = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates'))


def _d2(d2file, out, layout, target):
    cmd = ['d2', '--scale', '1']
    if target is not None:
        cmd.append('--target=' + target)
    if layout:
        cmd += ['-l', layout]
    env = {k: v for k, v in os.environ.items() if k not in D2_ENV_OVERRIDES}
    try:
        p = subprocess.run(cmd + [d2file, out], capture_output=True, text=True, timeout=300, env=env)
    except FileNotFoundError:
        return 'd2 is not on PATH'
    except subprocess.TimeoutExpired:
        return 'd2 timed out'
    res = out if os.path.isfile(out) else (out[:-4] if os.path.isdir(out[:-4]) else None)
    if p.returncode != 0 or res is None:
        err = '\n'.join(x for x in (p.stderr or p.stdout).strip().splitlines() if not x.startswith('success'))
        return err or 'd2 failed'
    return None


def _with_imports(d2file, tmp, search):
    """A copy of d2file in tmp that sees its own directory (icons, local imports) plus the imports it
    lacks, taken from the first search dir that has them. Returns (copy, [(name, dir)]) or (None, [])."""
    src_dir = os.path.dirname(os.path.abspath(d2file))
    work = os.path.join(tmp, 'src')
    os.makedirs(work)
    for f in os.listdir(src_dir):
        try:
            os.symlink(os.path.join(src_dir, f), os.path.join(work, f))
        except OSError:
            pass
    found = []
    for _, line in _code_lines(d2file):
        for m in IMPORT_RE.finditer(strip_comment(line)):
            cands = import_candidates(unquote(m.group(1)))
            if any(os.path.isabs(c) or os.path.exists(os.path.join(src_dir, c)) for c in cands):
                continue
            hit = next(((c, d) for c in cands for d in search if os.path.isfile(os.path.join(d, c))), None)
            dest = os.path.join(work, hit[0]) if hit else ''
            # never write through a symlinked folder into the user's own directory
            inside = os.path.realpath(os.path.dirname(dest)).startswith(os.path.realpath(work)) if hit else False
            if hit and inside and not os.path.exists(dest):
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy(os.path.join(hit[1], hit[0]), dest)
                found.append(hit)
    if not found:
        return None, []
    copy = os.path.join(work, os.path.basename(d2file))
    if os.path.islink(copy):
        os.unlink(copy)
    shutil.copy(d2file, copy)
    return copy, found


def render(d2file, layout=None, target=None, search=()):
    """Compile with d2 exactly as the file says (no -l/-t). Returns (path, tmpdir, error).
    A copy that lost its imports (D2W/orig.d2) is retried with them taken from `search`, the
    working directory or the skill's templates; a note on stderr says where from."""
    tmp = tempfile.mkdtemp(prefix='semcheck-')
    out = os.path.join(tmp, 'out.svg')
    err = _d2(d2file, out, layout, target)
    if err and 'failed to import' in err and d2file.endswith('.d2'):
        dirs = [d for d in list(search) + [os.getcwd(), SKILL_TEMPLATES] if d]
        copy, found = _with_imports(d2file, tmp, dirs)
        err2 = _d2(copy, out, layout, target) if copy else err
        if copy and 'failed to import' not in (err2 or ''):
            for rel, d in found:
                print(f'# note: {os.path.basename(d2file)} imports {rel}, which is not next to it: used {d}/{rel}',
                      file=sys.stderr)
            # None, or the file's next real error, pointing at the file rather than at the temp copy
            err = err2 and err2.replace(copy, os.path.abspath(d2file)).replace(os.path.relpath(copy), d2file)
    res = out if os.path.isfile(out) else (out[:-4] if os.path.isdir(out[:-4]) else None)
    if err or res is None:
        shutil.rmtree(tmp, ignore_errors=True)
        return None, None, err or 'd2 failed'
    return res, tmp, None


def _code_lines(d2file):
    """(lineno, text) of the source outside |md blocks and \"\"\" block comments."""
    out, in_block, in_doc = [], None, False
    with open(d2file, encoding='utf-8') as fh:
        for n, raw in enumerate(fh, 1):
            line = raw.rstrip('\n')
            if in_doc:
                if line.strip() == '"""':
                    in_doc = False
                continue
            if line.strip() == '"""':
                in_doc = True
                continue
            if in_block:
                if line.strip().startswith(in_block):
                    in_block = None
                continue
            mb = re.search(r':\s*(\|+)[a-z]*\s*$', line)
            if mb:
                in_block = mb.group(1)
                continue
            out.append((n, line))
    return out


IMPORT_RE = re.compile(r'@("[^"]+"|[A-Za-z0-9_./-]+)')


def import_candidates(name):
    """Files an import can name: `@x` is x.d2, `@x.y` (a partial import) is x.y.d2 or x.d2."""
    cands = [name] if name.endswith('.d2') else []
    parts = name.split('.')
    return cands + ['.'.join(parts[:i]) + '.d2' for i in range(len(parts), 0, -1) if '.'.join(parts[:i])]


def _imports(d2file, lines):
    base = os.path.dirname(os.path.abspath(d2file))
    found = []
    for n, line in lines:
        for m in IMPORT_RE.finditer(strip_comment(line)):
            cands = import_candidates(unquote(m.group(1)))
            for c in cands:
                p = os.path.join(base, c)
                if os.path.isfile(p):
                    found.append(p)
                    break
    return found


def pins_engine(d2file, depth=0, seen=None):
    seen = seen if seen is not None else set()
    ap = os.path.abspath(d2file)
    if ap in seen or depth > 4:
        return False
    seen.add(ap)
    try:
        lines = _code_lines(d2file)
    except OSError:
        return False
    if any(re.search(r'\blayout-engine\s*:', strip_comment(line)) for _, line in lines):
        return True
    return any(pins_engine(p, depth + 1, seen) for p in _imports(d2file, lines))


# ---------------------------------------------------------------------------
# source model: which classes a file defines (itself or through imports) and uses
# ---------------------------------------------------------------------------

_WORDCH = re.compile(r'[A-Za-z0-9_]')


class D2Source:
    """Just enough of the d2 grammar to list key paths, `class:` uses and imports: maps, arrays,
    quoted strings (a quote opens one only at the start of a word: `Bob's` is text), ${vars},
    |block| strings and comments. `lines` = [(lineno, text)] from _code_lines()."""

    def __init__(self, lines):
        self.s, self.ln = [], []
        for n, line in lines:
            for ch in line + '\n':
                self.s.append(ch)
                self.ln.append(n)
        self.i = 0
        self.paths = []        # (key path tuple, lineno): every key, with the maps around it
        self.refs = []         # (class name, lineno, info of the map the use sits in)
        self.imports = []      # (spec, key path it lands at, lineno)

    def peek(self, k=0):
        j = self.i + k
        return self.s[j] if j < len(self.s) else ''

    def skip_blank(self):
        while self.peek() in (' ', '\t'):
            self.i += 1

    def read_quoted(self):
        q = self.peek()
        self.i += 1
        while self.peek() not in ('', '\n'):
            ch = self.peek()
            if q == '"' and ch == '\\':
                self.i += 2
                continue
            self.i += 1
            if ch == q:
                if q == "'" and self.peek() == "'":        # '' is a quote inside '...'
                    self.i += 1
                    continue
                return

    def read_token(self, stops):
        """Raw text up to a stop character outside quotes, (), [] and ${}; `#` ends it (comment)."""
        start, depth = self.i, 0
        while True:
            ch = self.peek()
            if ch in ('', '\n') or (ch in stops and depth == 0):
                return ''.join(self.s[start:self.i])
            prev = self.s[self.i - 1] if self.i > start else ' '
            if ch in '"\'' and not _WORDCH.match(prev):
                self.read_quoted()
                continue
            if ch == '$' and self.peek(1) == '{':
                while self.peek() not in ('', '\n', '}'):
                    self.i += 1
                if self.peek() == '}':
                    self.i += 1
                continue
            if ch == '#':
                return ''.join(self.s[start:self.i])
            if ch in '([':
                depth += 1
            elif ch in ')]':
                depth = max(0, depth - 1)
            self.i += 1

    def read_array(self):
        """A `[...]` value, which may span lines (one item per line); comments dropped. Returns
        '[a; b]' with newlines turned into `;`, so a multi-line class list reads like a one-line one."""
        out, depth = [], 0
        while self.peek() != '':
            ch = self.peek()
            if ch in '"\'':
                start = self.i
                self.read_quoted()
                out.append(''.join(self.s[start:self.i]))
                continue
            if ch == '#':
                while self.peek() not in ('', '\n'):
                    self.i += 1
                continue
            self.i += 1
            if ch == '[':
                depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    out.append(ch)
                    break
            out.append(';' if ch == '\n' else ch)
        return ''.join(out)

    def parse(self):
        self.parse_map((), {'shape': None})
        return self

    def parse_map(self, path, info):
        while self.peek() != '':
            ch = self.peek()
            if ch in ' \t\n;':
                self.i += 1
            elif ch == '#':
                while self.peek() not in ('', '\n'):
                    self.i += 1
            elif ch == '}':
                self.i += 1
                return
            else:
                before = self.i
                self.statement(path, info)
                if self.i == before:        # never stall on a stray character
                    self.i += 1

    def statement(self, path, info):
        n = self.ln[self.i]
        key = self.read_token(':{;}').strip()
        segs = tuple(key_segments(key))
        if key.startswith('...@'):
            self.imports.append((key[4:].strip(), path, n))
            return
        if segs:
            self.paths.append((path + segs, n))
        self.skip_blank()
        if self.peek() == ':':
            self.i += 1
            self.skip_blank()
            if self.peek() == '|':
                pipes = ''
                while self.peek() == '|':
                    pipes += '|'
                    self.i += 1
                while self.peek() != '' and ''.join(self.s[self.i:self.i + len(pipes)]) != pipes:
                    self.i += 1
                self.i += len(pipes)
            elif self.peek() == '[':
                self.value(path, key, segs, self.read_array().strip(), n, info)
            elif self.peek() != '{':
                self.value(path, key, segs, self.read_token(';{}').strip(), n, info)
            self.skip_blank()
        if self.peek() == '{':
            self.i += 1
            self.parse_map(path + segs, {'shape': None})

    def value(self, path, key, segs, value, n, info):
        if value.startswith('@'):
            self.imports.append((value[1:].strip(), path + segs, n))
            return
        if not segs:
            return
        if segs == ('shape',):
            info['shape'] = unquote(value).lower()
        if segs[-1] != 'class' or key.startswith(('&', '!&')) or (path[-1:] == ('classes',) and len(segs) == 1):
            return          # not a use: a glob filter (&class), or a class NAMED "class"
        if re.search(r'''(["'])class\1\s*$''', key, re.I):
            return          # a quoted "class" is a name (a table column called class), not the keyword
        names = value[1:-1].split(';') if value.startswith('[') and value.endswith(']') else [value]
        for nm in names:
            nm = unquote(nm.strip())
            if nm and nm.lower() != 'null' and not nm.startswith('$'):     # `class: null` resets
                self.refs.append((nm, n, info))


def key_segments(key):
    """A d2 key -> lowercase dotted segments, split outside quotes and ()/[] (an edge is one segment)."""
    out, cur, q, depth = [], '', None, 0
    for ch in key:
        if q:
            if ch == q:
                q = None
            else:
                cur += ch
            continue
        if ch in '"\'' and (not cur.strip() or cur.endswith('.')):
            q = ch
            continue
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth = max(0, depth - 1)
        if ch == '.' and depth == 0:
            out.append(cur.strip())
            cur = ''
            continue
        cur += ch
    out.append(cur.strip())
    return [p.lower() for p in out if p]


def source_model(d2file, prefix=(), sub=(), depth=0, seen=None):
    """(key paths as the root board sees them, class uses of THIS file, unresolved imports).
    `...@f` lands f's keys at the import's path, `k: @f` under k, `@f.x` only f's subtree x."""
    seen = set() if seen is None else seen
    ap = os.path.abspath(d2file)
    if depth > 6 or (ap, prefix, sub) in seen:
        return [], [], []
    seen.add((ap, prefix, sub))
    src = D2Source(_code_lines(d2file)).parse()
    paths = [prefix + p[len(sub):] for p, _ in src.paths if p[:len(sub)] == sub]
    unresolved, base = [], os.path.dirname(ap)
    for spec, where, n in src.imports:
        if where[:len(sub)] != sub:
            continue
        spec = unquote(spec)
        hit = next(((c, p) for c in import_candidates(spec)
                    for p in [c if os.path.isabs(c) else os.path.join(base, c)] if os.path.isfile(p)), None)
        if not hit:
            unresolved.append((spec, n))
            continue
        rest = '' if spec.endswith('.d2') else spec[len(hit[0]) - 3:].lstrip('.')
        p2, _, u2 = source_model(hit[1], prefix + where[len(sub):], tuple(key_segments(rest)), depth + 1, seen)
        paths += p2
        unresolved += u2
    return paths, (src.refs if depth == 0 else []), unresolved


def defined_classes(paths):
    return {p[j + 1] for p in paths for j in range(len(p) - 1) if p[j] == 'classes'}


# the same role in the other skill theme: a neutral class in a Snowflake file and back
SF_TWIN = {'service': 'sf-node', 'actor': 'sf-node', 'focal': 'sf-primary', 'focal-solid': 'sf-primary',
           'datastore': 'sf-datastore', 'external': 'sf-external', 'muted': 'sf-muted', 'zone': 'sf-container',
           'zone-blue': 'sf-container', 'dep': 'sf-edge', 'flow': 'sf-flow', 'failure': 'sf-failure',
           'state': 'sf-node', 'boundary': 'sf-container', 'zone-green': 'sf-container',
           'zone-amber': 'sf-container', 'zone-violet': 'sf-container', 'secondary': 'sf-edge',
           'async': 'sf-edge', 'ok': 'sf-flow'}
# neutral shape roles the Snowflake theme has no class for: the shape goes on the object, next to an sf-* class
SF_SHAPE = {'decision': 'shape: diamond', 'terminal': 'style.border-radius: 99', 'dot': 'shape: circle; width: 20; '
            'height: 20', 'note': 'shape: page', 'queue': 'shape: queue', 'caption': 'shape: text'}
NEUTRAL_TWIN = {'sf-node': 'service', 'sf-primary': 'focal', 'sf-datastore': 'datastore', 'sf-external': 'external',
                'sf-muted': 'muted', 'sf-container': 'zone', 'sf-edge': 'dep', 'sf-flow': 'flow',
                'sf-failure': 'failure'}


_THEME_CLASSES = {}


def theme_classes(theme):
    """The classes a skill theme (templates/<theme>.d2) defines; empty if it is not installed."""
    if theme not in _THEME_CLASSES:
        path = os.path.join(SKILL_TEMPLATES, theme + '.d2')
        try:
            _THEME_CLASSES[theme] = defined_classes(source_model(path)[0]) if os.path.isfile(path) else set()
        except (OSError, UnicodeDecodeError, RecursionError):
            _THEME_CLASSES[theme] = set()
    return _THEME_CLASSES[theme]


def near_class(word, known):
    """A defined class one typo away (two for names over 5 characters), or None."""
    cands = [c for c in known if looks_like_typo(word, c)]
    return min(cands, key=lambda c: edit_distance(word, c)) if cands else None


def class_findings(d2file, notes=None):
    """S-src-class: a class used here that neither this file nor its imports define. d2 ignores
    it silently: the object keeps the default look (a misspelled `datastor` stays a box)."""
    try:
        paths, refs, unresolved = source_model(d2file)
    except (OSError, UnicodeDecodeError, RecursionError):
        return []
    if unresolved:          # the render fails on a missing import; say why classes went unchecked
        if notes is not None and refs:
            notes.append(f"classes not checked: the import `{unresolved[0][0]}` (line {unresolved[0][1]}) is not "
                         f"next to {os.path.basename(d2file)}")
        return []
    if not refs:
        return []
    known = defined_classes(paths)
    unknown, out = defaultdict(list), []
    for name, n, info in refs:
        if name.lower() in known:
            continue
        if info.get('shape') in ('sql_table', 'class'):     # a column or member NAMED class
            out.append((n, 'error', 'S-src-class', f"inside a {info['shape']} `class:` applies a class, so the row "
                        f"vanishes: quote the name, \"class\": {name}", {'classes': [name]}))
        else:
            unknown[name].append((n, info))
    if unknown and not known:
        n = min(n for uses in unknown.values() for n, _ in uses)
        names = sorted(unknown)
        theme = 'snowflake-brand' if all(x.lower().startswith('sf-') for x in names) else 'neutral-theme'
        what = f"class {names[0]} is used but nothing defines it" if len(names) == 1 else \
            f"classes {', '.join(names[:4])} are used but nothing defines them"
        return out + [(n, 'error', 'S-src-class', f"{what}: put `...@{theme}` on line 1 and copy the theme next "
                       f"to the file", {'classes': names})]
    sf_file = any(c.startswith('sf-') for c in known)
    for name, uses in sorted(unknown.items(), key=lambda kv: kv[1][0][0]):
        n, info = uses[0]
        also = f" (also line {', '.join(str(u[0]) for u in uses[1:3])})" if len(uses) > 1 else ''
        low = name.lower()
        parts = [p.strip() for p in low.split(',')]
        if low in SF_TWIN and sf_file and SF_TWIN[low] in known:
            fix = f"'{name}' is a neutral-theme class; this file uses snowflake-brand: write {SF_TWIN[low]}"
        elif not sf_file and low in NEUTRAL_TWIN and NEUTRAL_TWIN[low] in known:
            fix = f"'{name}' is a snowflake-brand class; this file uses neutral-theme: write {NEUTRAL_TWIN[low]}"
        elif len(parts) > 1 and all(p in known for p in parts):
            fix = f"'{name}' is one name, not a list: separate classes with `;`: class: [{'; '.join(parts)}]"
        else:
            # a skill theme's class in a file that does not import that theme (it has under half its classes)
            theme = next((t for t in ('neutral-theme', 'snowflake-brand') if low in theme_classes(t)
                          and 2 * len(theme_classes(t) & known) < len(theme_classes(t))), None)
            near = near_class(low, known)
            if theme == 'neutral-theme' and sf_file:    # never mix the two themes: say how the brand draws it
                if low in SF_SHAPE:
                    fix = f"'{name}' is a neutral-theme class with no snowflake-brand twin: keep an sf-* class and " \
                          f"set the shape on the object, {SF_SHAPE[low]} (brand-snowflake.md section 3)"
                else:
                    fix = f"'{name}' is a neutral-theme class with no snowflake-brand twin: drop it; the brand " \
                          f"has no outcome colours, so name the outcome in the label (brand-snowflake.md section 3)"
            elif theme == 'snowflake-brand' and not sf_file and known & theme_classes('neutral-theme'):
                fix = f"'{name}' is a snowflake-brand class with no neutral-theme twin: use a role class of this " \
                      f"file's theme (design-system.md)"
            elif theme:
                fix = f"'{name}' is a {theme} class, and nothing here imports that theme: put `...@{theme}` on line 1"
            elif near:
                fix = f"class '{name}' is defined neither here nor in the imports, so d2 ignores it: " \
                      f"did you mean '{near}'?"
            else:
                fix = f"class '{name}' is defined neither here nor in the imports, so d2 ignores it: use one the " \
                      f"theme defines ({'brand-snowflake' if sf_file else 'design-system'}.md)"
        out.append((n, 'error', 'S-src-class', fix + also, {'classes': [name]}))
    return out


ICON_RE = re.compile(r'\bicon\s*:\s*("([^"]+)"|\'([^\']+)\'|([^\s;{}]+))')
KNOWN_FAMILIES = ('lucide', 'logos', 'k8s', 'tabler', 'mdi', 'simple-icons', 'devicon', 'carbon', 'ph',
                  'material-symbols', 'fa', 'fa6-solid', 'heroicons', 'aws', 'gcp', 'azure', 'terrastruct')


def icon_family(ref, base):
    m = re.match(r'https?://api\.iconify\.design/([a-z0-9-]+)[:/]', ref)
    if m:
        return m.group(1)
    if re.match(r'https?://icons\.terrastruct\.com/', ref):
        return 'terrastruct'
    if re.match(r'https?://', ref):
        for fam in KNOWN_FAMILIES:
            if re.search(r'[/=_-]' + re.escape(fam) + r'([/_.-]|$)', ref):
                return fam
        return None
    name = os.path.basename(ref).lower()
    m = re.match(r'^(' + '|'.join(re.escape(f) for f in KNOWN_FAMILIES) + r')[-_:]', name)
    if m:
        return m.group(1)
    try:
        with open(os.path.join(base, ref), encoding='utf-8', errors='replace') as fh:
            svg = fh.read(4000)
    except OSError:
        return None
    if 'class="lucide' in svg or ('viewBox="0 0 24 24"' in svg and 'stroke-linecap="round"' in svg):
        return 'lucide'
    if '326ce5' in svg.lower():
        return 'k8s'
    return None


def lint_source(d2file, typ, notes=None):
    """Slips that compile fine but change what the diagram says; plus two policy checks."""
    out = []
    lines = _code_lines(d2file)
    base = os.path.dirname(os.path.abspath(d2file))
    icons = defaultdict(list)
    sequence_root = False
    for n, line in lines:
        if re.match(r'^shape\s*:\s*sequence_diagram\b', line.strip()) and not line[:1].isspace():
            sequence_root = True
        q, hash_at, semi_at, colon_at, depth = None, None, [], None, 0
        for i, ch in enumerate(line):
            if q:
                if ch == q and line[i - 1] != '\\':
                    q = None
                continue
            if ch in '"\'':
                q = ch
            elif ch == '#':
                hash_at = i
                break
            elif ch in '[]':
                depth += 1 if ch == '[' else -1
            elif ch == ';' and depth <= 0:          # `[a; b]` is a list, not two statements
                semi_at.append(i)
            elif ch == ':' and colon_at is None:
                colon_at = i
        if hash_at is not None:
            before, after = line[:hash_at], line[hash_at + 1:]
            val = before[colon_at + 1:].strip() if colon_at is not None else ''
            glued = before.strip() and not before.endswith((' ', '\t'))      # `C#`, `port#5432`
            if glued:
                out.append((n, 'error', 'S-src-hash',
                            f'quote the value: an unquoted `#` starts a comment, so it is cut to '
                            f'{(val or before.strip())[:40]!r}'))
            elif colon_at is not None and val and not val.endswith(('{', '}', '"', "'")) \
                    and after[:1] not in ('', ' ', '\t', '#'):
                out.append((n, 'warn', 'S-src-hash',
                            f'`#{(after.split() or [""])[0][:20]}` is a comment, so the value is {val[:40]!r}: quote '
                            f'the whole value if it should show'))
        if colon_at is not None and semi_at and '{' not in line[:colon_at]:
            seg = line[colon_at + 1:semi_at[0]]
            nxt = line[semi_at[0] + 1:hash_at if hash_at is not None else None].strip()
            is_edge = any(op in line[:colon_at] for op in ('->', '<-', '--'))
            bare = nxt and ':' not in nxt and '{' not in nxt and '->' not in nxt
            if seg.strip() and '{' not in seg and (is_edge or bare):
                out.append((n, 'error', 'S-src-semicolon',
                            f'quote the label: an unquoted `;` ends the statement, so the label is {seg.strip()[:30]!r}'
                            + (f' and {nxt[:30]!r} becomes a new node' if bare else '')))
        code = strip_comment(line)
        for m in ICON_RE.finditer(code):
            ref = m.group(2) or m.group(3) or m.group(4)
            fam = icon_family(ref, base)
            if fam:
                icons[fam].append((n, ref))
    if len(icons) > 1:
        desc = '; '.join(f"{fam}: line {', '.join(str(n) for n, _ in refs[:3])}" for fam, refs in sorted(icons.items()))
        out.append((min(n for refs in icons.values() for n, _ in refs), 'error', 'S-src-icon-family',
                    f'use one icon family: {desc} (lucide by default, k8s for Kubernetes, logos only for products)'))
    if not sequence_root and typ != 'sequence' and not pins_engine(d2file):
        out.append((1, 'error', 'S-src-cli-engine',
                    'no layout engine pinned, so dagre draws curved edges: put `...@neutral-theme` on line 1 '
                    '(or set vars.d2-config.layout-engine: elk)'))
    return out + class_findings(d2file, notes)


# ---------------------------------------------------------------------------
# diff
# ---------------------------------------------------------------------------

class Report:
    def __init__(self):
        self.items = []

    def add(self, level, code, msg, objs=(), box=None):
        it = {'severity': level, 'code': code, 'message': msg, 'objects': list(objs),
              'anchor': RECIPES + code.lower()}
        if box:
            it['box'] = [round(v, 1) for v in box]
        self.items.append(it)

    def count(self, level):
        return sum(1 for i in self.items if i['severity'] == level)


def label_ok(expected, texts):
    if expected is None:
        return True, ''
    exp = norm_label(expected)
    if exp == '' and all(t == '' for t in texts):
        return True, ''
    joined = ' '.join(t for t in texts if t)
    cands = texts + [joined]
    if exp in cands or exp.upper() in cands:      # zone classes render titles upper-case
        return True, ''
    if exp.lower() in [c.lower() for c in cands]:
        return True, 'case differs'
    return False, joined


def canon_edge(src, op, dst):
    if op == '<-':
        return (norm_key(dst), norm_key(src)), 'directed'
    if op == '->':
        return (norm_key(src), norm_key(dst)), 'directed'
    a, b = sorted([norm_key(src), norm_key(dst)])
    return (a, b), ('bidirectional' if op == '<->' else 'undirected')


def end_labels_by_end(c):
    """An edge's arrowhead labels by the path end they sit at: 'first' = the key written first in
    its d2 id (where the path starts and marker-start sits), 'second' = the other key."""
    out = {'first': [], 'second': []}
    for txt, x, y in c.get('end_pos', []):
        if x is None or not c.get('start') or not c.get('end'):
            continue
        d0 = (x - c['start'][0]) ** 2 + (y - c['start'][1]) ** 2
        d1 = (x - c['end'][0]) ** 2 + (y - c['end'][1]) ** 2
        out['first' if d0 <= d1 else 'second'].append(txt)
    return out


def edge_label_cands(c):
    """What a brief label may match: the main label, any single text, or main + arrowhead labels."""
    ends = ' '.join(x for x in c['end_labels'] if x)
    return [c['label']] + c['texts'] + ([f"{c['label']} {ends}", f"{ends} {c['label']}"] if ends else [])


def diff(inv, g, rep):
    typ = inv['type']
    inv_nodes = inv['nodes']
    comp_nodes = dict(g['nodes'])

    # sequence diagrams: unlisted children of ACTORS are spans (activations) or notes
    span_map = {}
    if typ == 'sequence':
        actors = {k for k in comp_nodes if '.' not in k and k in g['lifelines_norm']
                  and not inv_nodes.get(k, {}).get('attrs', {}).get('group')}
        for k in comp_nodes:
            if '.' in k and k.split('.')[0] in actors and k not in inv_nodes:
                span_map[k] = k.split('.')[0]
    collapse_cols = typ in ('erd', 'class')     # column-level ends collapse to the table in d2 ids

    def comp_end(k):
        k = norm_key(k)
        return span_map.get(k, k)

    def inv_end(k):
        k = norm_key(k)
        if collapse_cols and k not in comp_nodes and '.' in k:
            return k.split('.')[0]
        return k

    def box(k):
        n = comp_nodes.get(k)
        return n['bbox'] if n else None

    def where(n):
        return f" on board '{n['board']}'" if n.get('board') else ''

    # --- nodes
    expected = dict(inv_nodes)
    if collapse_cols:
        expected = {k: v for k, v in expected.items() if '.' not in k or k in comp_nodes}
    hidden_nodes = g.get('hidden_nodes', set())

    def helper(k):
        # a grid slot hidden with style.opacity: 0 is not drawn, but the drawn nodes inside it prove it
        # exists: excused when the brief only implies it (a dotted key) or the drawing hides it; a
        # container with nothing drawn inside, or a hidden leaf, is still missing
        return any(c.startswith(k + '.') for c in comp_nodes) and (
            expected[k]['attrs'].get('_ancestor') or k in hidden_nodes)
    missing = [k for k in expected if k not in comp_nodes and not helper(k)]
    extra = [k for k in comp_nodes if k not in expected and k not in span_map]
    for k in missing:
        leaf = leaf_of(k).lower()
        elsewhere = [e for e in extra if leaf_of(e).lower() == leaf]
        want = inv_nodes[k]
        if elsewhere:
            for e in elsewhere:
                rep.add('error', 'S-wrong-parent',
                        f"'{want['key']}' is drawn as '{comp_nodes[e]['id']}': use the full path - a bare key inside "
                        f"`{parent_of(comp_nodes[e]['id']) or 'a container'} {{ }}` creates a new node there",
                        [e], box(e))
                extra.remove(e)
        else:
            if want['attrs'].get('_ancestor') and any(m.startswith(k + '.') for m in missing):
                continue    # only implied by a dotted key: the listed node inside it is reported
            near = [c for c in comp_nodes if c not in expected and looks_like_typo(leaf_of(c), leaf)]
            hint = f"; the diagram has similar key(s): {', '.join(comp_nodes[c]['id'] for c in near)}" if near else ''
            what = f" ({want['label']})" if want['label'] else ''
            rep.add('error', 'S-missing-node',
                    f"'{want['key']}'{what} is in the brief but not drawn{hint}", [want['key']])
    for k in extra:
        n = comp_nodes[k]
        near = [inv_nodes[c]['key'] for c in expected if looks_like_typo(leaf_of(c), leaf_of(k))]
        twin = [inv_nodes[c]['key'] for c in expected if c != k and leaf_of(c).lower() == leaf_of(k).lower()]
        if twin:
            why = f": a second copy of '{twin[0]}' - use the full path (a bare key inside a container makes a new node)"
        elif near:
            why = f": a typo of '{near[0]}'? (an unknown key in an edge silently creates a node)"
        elif not n['style'].get('shape_tag') and any(n['texts']):
            why = f": a title or caption? List it in the brief as `{n['id']}: <text> {{note}}`"
        else:
            why = ' but not in the brief: remove it, or add it to the brief ({inferred} if the user did not ask)'
        text = ' / '.join(t for t in n['texts'] if t)
        rep.add('error', 'S-extra-node', f"'{n['id']}'" + (f" ({text[:40]})" if text else '') + f" is drawn{where(n)}"
                + why, [n['id']], n['bbox'])

    for k, v in expected.items():
        if k in comp_nodes and v['label'] is not None:
            ok, got = label_ok(v['label'], comp_nodes[k]['texts'])
            if not ok:
                rep.add('error', 'S-node-label', f"'{v['key']}': the brief says {v['label']!r}, the diagram shows "
                        f"{got!r}", [comp_nodes[k]['id']], box(k))
            elif got:
                rep.add('warn', 'S-node-label-case', f"'{v['key']}': label case differs from the brief "
                        f"({v['label']!r})", [comp_nodes[k]['id']], box(k))

    # --- edges
    comp_edges = defaultdict(list)
    for e in g['edges']:
        comp_edges[canon_edge(comp_end(e['src']), e['op'], comp_end(e['dst']))].append(e)
    inv_edges = defaultdict(list)
    for e in inv['edges']:
        inv_edges[canon_edge(inv_end(e['src']), e['op'], inv_end(e['dst']))].append(e)

    matched = set()
    missing_edges = []
    for (key, kind), want in inv_edges.items():
        have = comp_edges.get((key, kind), [])
        wanted = sum(int(w['attrs'].get('count', 1)) for w in want)
        desc = f"{want[0]['src']} {want[0]['op']} {want[0]['dst']}"
        if not have:
            rev = comp_edges.get(((key[1], key[0]), kind)) if kind == 'directed' else None
            other = [(k1, k2) for (k1, k2) in comp_edges if k1 in (key, (key[1], key[0])) and k2 != kind]
            if rev:
                rep.add('error', 'S-reversed-edge', f"'{desc}' is drawn reversed: swap its ends (or write "
                        f"`{want[0]['dst']} <- {want[0]['src']}` to keep the layout rank)", [rev[0]['id']])
                matched.add(((key[1], key[0]), kind))
            elif other:
                got = comp_edges[other[0]]
                ops = {'directed': '->', 'bidirectional': '<->', 'undirected': '--'}
                hint = ''
                if any(want[0]['attrs'].get(x) for x in ('src', 'dst')):
                    hint = ' and set both arrowheads (a head shows only on an end with an arrow)'
                rep.add('error', 'S-edge-kind', f"'{desc}' is drawn with `{ops[other[0][1]]}`: write `{ops[kind]}`"
                        f"{hint}", [got[0]['id']])
                matched.add(other[0])
            else:
                missing_edges.append({'w': want[0], 'key': key, 'kind': kind, 'desc': desc})
            continue
        matched.add((key, kind))
        pool, not_drawn = list(have), []
        labelled = [w for w in want if w['label'] is not None]
        for w in labelled:
            hit = next((c for c in pool if label_ok(w['label'], edge_label_cands(c))[0]), None)
            if hit:
                pool.remove(hit)
                w['_match'] = hit
        for w in labelled:
            if '_match' in w:
                continue
            if pool:
                c = pool.pop(0)
                rep.add('error', 'S-edge-label', f"'{w['src']} {w['op']} {w['dst']}': the brief says "
                        f"{w['label']!r}, the diagram shows {(c['label'] or ' / '.join(t for t in c['texts'] if t))!r}",
                        [c['id']])
                w['_match'] = c
            else:
                not_drawn.append(w['label'])
        for w in want:
            if w['label'] is None and '_match' not in w and pool:
                w['_match'] = pool.pop(0)
        if len(have) > wanted:
            rep.add('error', 'S-duplicate-edge', f"'{desc}' is drawn {len(have)}x, the brief has {wanted}: every "
                    f"repeated edge statement adds a parallel edge - write it once", [h['id'] for h in have])
        elif len(have) < wanted:
            what = f"; not drawn: {', '.join(repr(x) for x in not_drawn)}" if not_drawn else ''
            rep.add('error', 'S-missing-edge', f"'{desc}': the brief has {wanted}, the diagram draws "
                    f"{len(have)}{what}", [h['id'] for h in have])
        for w in want:
            c = w.get('_match')
            if not c:
                continue
            a = w['attrs']
            if a.get('return') and typ == 'sequence' and not c['dashed']:
                rep.add('error', 'S-seq-return', f"return '{w['src']} -> {w['dst']}' is solid: returns are "
                        f"dashed (class: secondary + style.stroke-dash: 3)", [c['id']])
            elif a.get('dashed') and not c['dashed']:
                rep.add('error', 'S-edge-style', f"'{w['src']} -> {w['dst']}' should be dashed (async, optional "
                        f"or return) but is solid: use the async class or style.stroke-dash", [c['id']])
            if a.get('solid') and c['dashed']:
                rep.add('error', 'S-edge-style', f"'{w['src']} -> {w['dst']}' should be solid but is dashed",
                        [c['id']])
            for side in ('src', 'dst'):
                want_head = a.get(side)
                if not want_head:
                    continue
                if want_head not in HEADS:
                    rep.add('error', 'S-arrowhead', f"'{w['src']} {w['op']} {w['dst']}': unknown arrowhead "
                            f"{want_head!r} in the brief (use {', '.join(HEADS)})", [c['id']])
                    continue
                # marker-start sits on the end written FIRST in the d2 id, marker-end on the second
                if comp_end(c['src']) == inv_end(w['src']):
                    s_mark, d_mark = c['marker_start'], c['marker_end']
                else:
                    s_mark, d_mark = c['marker_end'], c['marker_start']
                got = (s_mark if side == 'src' else d_mark) or 'none'
                if got == want_head:
                    continue
                end = w['src'] if side == 'src' else w['dst']
                tip = ''
                if got == 'none' and c['op'] in ('--', '->'):
                    tip = ': use `<->` and set both arrowheads (a head shows only on an end with an arrow)'
                elif re.sub(r'-(filled|hollow)$', '', want_head) == re.sub(r'-(filled|hollow)$', '', got):
                    tip = ': set `style.filled` on that arrowhead'
                if want_head.startswith('cf-'):
                    rep.add('error', 'S-erd-cardinality',
                            f"'{w['src']} {w['op']} {w['dst']}': the {end} end should be {want_head} "
                            f"({CARD.get(want_head)}) but shows {got}" + (f" ({CARD[got]})" if got in CARD else '')
                            + tip, [c['id']])
                else:
                    rep.add('error', 'S-arrowhead', f"'{w['src']} {w['op']} {w['dst']}': the {end} end should be "
                            f"{want_head} but shows {got}{tip}", [c['id']])

        for w in want:
            c = w.get('_match')
            if not c or not any(w['attrs'].get(x) for x in ('src-label', 'dst-label')):
                continue
            by_end = end_labels_by_end(c)
            src_first = comp_end(c['src']) == inv_end(w['src'])      # is the brief's src written first in d2?
            for side in ('src', 'dst'):
                want_lab = w['attrs'].get(side + '-label')
                if not want_lab or want_lab is True:
                    continue
                at = by_end['first' if (side == 'src') == src_first else 'second']
                other = by_end['second' if (side == 'src') == src_first else 'first']
                if norm_label(str(want_lab)).lower() in [x.lower() for x in at]:
                    continue
                end = w['src'] if side == 'src' else w['dst']
                tip = (': it sits at the other end - swap source-arrowhead.label and target-arrowhead.label'
                       if norm_label(str(want_lab)).lower() in [x.lower() for x in other] else
                       ': set it as that end\'s arrowhead label')
                rep.add('error', 'S-edge-label', f"'{w['src']} {w['op']} {w['dst']}': the {end} end should read "
                        f"{want_lab!r} but shows {' / '.join(at) or 'nothing'}{tip}", [c['id']])

    extra_edges = [(key, kind, c) for (key, kind), have in comp_edges.items() if (key, kind) not in matched
                   for c in have]
    children = defaultdict(set)
    for k in comp_nodes:
        if k not in span_map:
            children[parent_of(k).lower()].add(k)

    def is_group(k):        # in a sequence diagram an actor's notes and spans do not make it a group
        return bool(children.get(k)) and not (typ == 'sequence' and k in g['lifelines_norm'])

    # one edge to/from a container may stand for edges to EVERY child of it (the fan-out recipe)
    for key, kind, c in list(extra_edges):
        if kind != 'directed':
            continue
        s, d = key
        for side, cont, other in ((1, d, s), (0, s, d)):
            kids = children.get(cont)
            if not kids:
                continue
            cand = [m for m in missing_edges if m['kind'] == kind and m['key'][1 - side] == other
                    and m['key'][side] in kids]
            if len(cand) >= 2 and {m['key'][side] for m in cand} == kids:
                for m in cand:
                    missing_edges.remove(m)
                extra_edges.remove((key, kind, c))
                break
    used = []
    for m in list(missing_edges):
        s, d = m['key']
        scope_s, scope_d = [s] + ancestors(s), [d] + ancestors(d)
        cand = [(k, kd, c) for (k, kd, c) in extra_edges if kd == m['kind'] and k[0] in scope_s and k[1] in scope_d]
        if cand:
            k, kd, c = cand[0]
            ends = [(i, x) for i, (x, want_x) in enumerate(((k[0], s), (k[1], d))) if x != want_x]
            where_ = (f"between containers {ends[0][1]!r} and {ends[1][1]!r}" if len(ends) == 2 else
                      f"{'starting' if ends[0][0] == 0 else 'ending'} at container {ends[0][1]!r}")
            rep.add('error', 'S-misrouted-edge', f"'{m['desc']}' is drawn {where_}: connect the nodes by full path "
                    f"(a container edge meets the container's middle)", [c['id']])
            if (k, kd, c) not in used:
                used.append((k, kd, c))
            missing_edges.remove(m)
    for x in used:
        extra_edges.remove(x)
    for m in missing_edges:
        key = m['key']
        cand = [(k, kd, c) for (k, kd, c) in extra_edges if (k[0] == key[0]) != (k[1] == key[1])]
        if cand:
            k, kd, c = cand[0]
            wrong_end, right_end = (k[1], key[1]) if k[0] == key[0] else (k[0], key[0])
            verb = 'ends' if k[0] == key[0] else 'starts'
            rep.add('error', 'S-misrouted-edge', f"'{m['desc']}' {verb} at '{wrong_end}' instead of "
                    f"'{right_end}': fix the spelling or full path of that end", [c['id']])
            extra_edges.remove((k, kd, c))
        else:
            rep.add('error', 'S-missing-edge', f"'{m['desc']}' is in the brief but not drawn"
                    + (f" (label {m['w']['label']!r})" if m['w']['label'] else ''), [])
    for k, kd, c in extra_edges:
        lab = f" ({c['label'][:40]})" if c['label'] else ''
        rep.add('error', 'S-extra-edge', f"'{c['src']} {c['op']} {c['dst']}'{lab} is drawn{where(c)} but not in the "
                f"brief: remove it, or add it to the brief", [c['id']])

    # --- sequence: time order, group membership, actor order
    if typ == 'sequence':
        seq = [w for w in inv['edges'] if w.get('_match') and w['_match'].get('start')]
        for i in range(1, len(seq)):
            if seq[i]['_match']['start'][1] < seq[i - 1]['_match']['start'][1] - 0.5:
                rep.add('error', 'S-seq-order', f"'{seq[i]['src']} -> {seq[i]['dst']}' ({seq[i]['label']}) is drawn "
                        f"above '{seq[i - 1]['src']} -> {seq[i - 1]['dst']}': declare messages in time order",
                        [seq[i]['_match']['id']])
                break
        for w in seq:
            grp = w['attrs'].get('in')
            if not grp:
                continue
            gn = comp_nodes.get(norm_key(grp))
            if not gn or not gn['bbox']:
                rep.add('error', 'S-seq-group', f"group '{grp}' of message '{w['src']} -> {w['dst']}' is not drawn")
                continue
            y = w['_match']['start'][1]
            if not (gn['bbox'][1] <= y <= gn['bbox'][3]):
                rep.add('error', 'S-seq-group', f"message '{w['src']} -> {w['dst']}' ({w['label']}) is outside "
                        f"group '{grp}': declare it inside the group block", [w['_match']['id']], gn['bbox'])
        for k, v in inv_nodes.items():
            if v['attrs'].get('group') and k in g['lifelines_norm']:
                rep.add('error', 'S-seq-group-actor', f"group '{v['key']}' became an ACTOR: every key inside a group "
                        f"must be an actor declared before it", [v['key']], box(k))
        want_actors = [k for k, v in inv_nodes.items() if '.' not in k and not v['attrs'].get('group')
                       and not v['attrs'].get('_implied') and not v['attrs'].get('note')]
        have_x = {k: comp_nodes[k]['bbox'][0] for k in want_actors if k in comp_nodes and comp_nodes[k]['bbox']}
        order = [k for k in want_actors if k in have_x]
        drawn = sorted(order, key=lambda k: have_x[k])
        if order != drawn:
            seen_as = f" (drawn: {', '.join(inv_nodes[k]['key'] for k in drawn)})"
            rep.add('warn', 'S-seq-actor-order', 'actors are not left to right in brief order' +
                    (seen_as if len(seen_as) < 60 else '') + ': declare all actors first, in reading order, '
                    'before any message', order)

    # --- flowcharts, swimlanes and state machines: start, reachability, ends, decisions
    if typ in ('flowchart', 'state', 'swimlane'):
        adj = defaultdict(set)
        for e in g['edges']:
            s, d = norm_key(e['src']), norm_key(e['dst'])
            if e['op'] == '<-':
                s, d = d, s
            adj[s].add(d)
            if e['op'] in ('<->', '--'):
                adj[d].add(s)
        members = {k: [o for o in comp_nodes if o.startswith(k + '.')] for k in comp_nodes if children.get(k)}

        def exits(n):       # a member also leaves through its containers' edges ("any failure in X")
            res = set(adj.get(n, ()))
            for anc in ancestors(n):
                res |= adj.get(anc, set())
            return res
        starts = [k for k, v in inv_nodes.items() if v['attrs'].get('start')]
        ends = {k for k, v in inv_nodes.items() if v['attrs'].get('end')}
        if typ == 'state' and len(starts) != 1:
            rep.add('error', 'S-state-start', f'a state machine needs exactly one initial state marked {{start}} '
                    f'in the brief (found {len(starts)})')
        if starts:
            seen = set()
            for st in starts:
                seen |= {st, *members.get(st, [])}
            dq = deque(seen)
            while dq:
                for nx in exits(dq.popleft()):
                    for y in [nx] + members.get(nx, []):     # entering a container enters its members
                        if y not in seen:
                            seen.add(y)
                            dq.append(y)
            leaves = [k for k in comp_nodes if not children.get(k)]
            for k in leaves:
                if k not in seen and not inv_nodes.get(k, {}).get('attrs', {}).get('note'):
                    rep.add('error', 'S-unreachable', f"'{comp_nodes[k]['id']}' cannot be reached from the start "
                            f"({', '.join(starts)})", [comp_nodes[k]['id']], box(k))
        for k in ends:
            if adj.get(k):
                rep.add('error', 'S-end-has-exit', f"end node '{inv_nodes[k]['key']}' has outgoing edges "
                        f"(to {', '.join(sorted(adj[k]))})", [inv_nodes[k]['key']], box(k))
        for k, v in inv_nodes.items():
            if k in ends or v['attrs'].get('note') or v['attrs'].get('_implied'):
                continue
            if any(o.startswith(k + '.') for o in inv_nodes):
                continue
            if not exits(k) and typ in ('flowchart', 'swimlane'):
                rep.add('warn', 'S-dead-end', f"'{v['key']}' has no outgoing edge and is not marked {{end}}",
                        [v['key']], box(k))
            if v['attrs'].get('decision'):
                outs = [e for e in g['edges'] if norm_key(e['src']) == k and e['op'] == '->']
                if len(outs) < 2:
                    rep.add('error', 'S-decision', f"decision '{v['key']}' has {len(outs)} outgoing edge(s); a "
                            f"decision needs 2 or more", [v['key']], box(k))
                unl = [e['id'] for e in outs if not (e['label'] or any(e['texts']))]
                if unl:
                    rep.add('error', 'S-decision', f"decision '{v['key']}': label every branch (Yes / No, or the "
                            f"condition); unlabelled: {len(unl)}", unl, box(k))
        for k in starts:
            n = comp_nodes.get(k)
            if typ == 'state' and n:
                if any(n['texts']):
                    rep.add('warn', 'S-state-start', f"initial state '{n['id']}' shows text {n['texts']}: draw it "
                            f"as a bare dot (class: dot, label: \"\")", [n['id']], n['bbox'])
                elif n['style'].get('shape_tag') not in ('ellipse', 'circle'):
                    rep.add('warn', 'S-state-start', f"initial state '{n['id']}' is not a dot: use class: dot",
                            [n['id']], n['bbox'])

    # --- columns / fields named in the brief must be present
    for k, v in inv_nodes.items():
        cols = v['attrs'].get('cols') or v['attrs'].get('fields')
        if cols and cols is not True and k in comp_nodes:
            have = {t.lower() for t in comp_nodes[k]['texts']}
            for col in re.split(r'[\s|]+', cols):
                if col and col.lower() not in have:
                    rep.add('error', 'S-missing-column', f"'{v['key']}' lacks column/field '{col}'",
                            [comp_nodes[k]['id']], box(k))

    # --- ERD: a column-level relationship must touch its column ROW; both ends need crow's feet
    if typ == 'erd':
        for w in inv['edges']:
            c = w.get('_match')
            if not c or not c.get('start'):
                continue
            for end_key in (w['src'], w['dst']):
                parts = split_key(end_key)
                if len(parts) < 2:
                    continue
                tbl, col = norm_key(parts[0]), parts[-1].lower()
                n = comp_nodes.get(tbl)
                if not n or not n['bbox']:
                    continue
                rows = [y for t, x, y in n['style'].get('text_pos', []) if t.lower() == col]
                if not rows:
                    continue
                row_y = rows[0] - 5          # the text baseline sits about 5px below the row centre
                x0, y0, x1, y1 = n['bbox']
                pts = [p for p in (c['start'], c['end']) if x0 - 25 <= p[0] <= x1 + 25 and y0 - 25 <= p[1] <= y1 + 25]
                if pts and all(abs(p[1] - row_y) > 14 for p in pts):
                    rep.add('warn', 'S-erd-anchor', f"'{w['src']} <-> {w['dst']}' misses row '{parts[0]}.{parts[-1]}': "
                            f"render with ELK, which anchors at the column row (edge y={pts[0][1]:.0f}, row "
                            f"y={row_y:.0f})", [c['id']], n['bbox'])
        for e in g['edges']:
            heads = [e['marker_start'], e['marker_end']]
            if not all(h and h.startswith('cf-') for h in heads):
                rep.add('warn', 'S-erd-cardinality', f"'{e['src']} {e['op']} {e['dst']}' needs crow's feet on both "
                        f"ends (has {heads[0] or 'none'} .. {heads[1] or 'none'}): write `fk <-> pk` with cf-* on both",
                        [e['id']])

    # --- focus: the brief's focus must carry a focal class; nothing else may compete with it
    focus_keys = {norm_key(k) for k in inv['focus_nodes']}
    sf = any(c.startswith('sf-') for n in comp_nodes.values() for c in n['classes'])
    for fk in inv['focus_nodes']:
        k = norm_key(fk)
        if k not in inv_nodes:
            rep.add('error', 'S-emphasis', f"focus '{fk}' is not a node key in the brief", [fk])
            continue
        n = comp_nodes.get(k)
        if n and is_group(k):
            if sf:
                rep.add('error', 'S-emphasis', f"focus '{n['id']}' is a group, and Snowflake has no focus group: "
                        f"make the node inside it that matters most the focus (sf-primary)", [n['id']], n['bbox'])
            elif 'zone-blue' not in n['classes']:
                rep.add('error', 'S-emphasis', f"focus '{n['id']}' is a container: give it class: zone-blue (the "
                        f"blue group), or make the node inside it that matters most the focus", [n['id']], n['bbox'])
            elif overridden_by(n['classes'], ('zone-blue',)):
                rep.add('error', 'S-emphasis', last_class_msg(n, ('zone-blue',)), [n['id']], n['bbox'])
        elif n and not set(n['classes']) & set(FOCAL_NODE):
            rep.add('error', 'S-emphasis', f"focus '{n['id']}' is not styled focal: add class: " +
                    ('sf-primary' if sf else 'focal (focal-solid on a busy canvas)'), [n['id']], n['bbox'])
        elif n and overridden_by(n['classes'], FOCAL_NODE):
            rep.add('error', 'S-emphasis', last_class_msg(n, FOCAL_NODE), [n['id']], n['bbox'])
    for a, b in inv['focus_edges']:
        key, kind = canon_edge(inv_end(a), '->', inv_end(b))
        have = comp_edges.get((key, kind)) or comp_edges.get(((key[1], key[0]), kind))
        if not have:
            if not any(canon_edge(inv_end(e['src']), e['op'], inv_end(e['dst']))[0] in (key, (key[1], key[0]))
                       for e in inv['edges']):
                rep.add('error', 'S-emphasis', f"focus path step '{a} -> {b}' is not an edge in the brief")
            continue
        if not any(set(c['classes']) & set(FOCAL_EDGE) for c in have):
            rep.add('error', 'S-emphasis', f"main-path edge '{a} -> {b}' is not styled as the main path: add "
                    f"class: {'sf-flow' if sf else 'flow'}", [c['id'] for c in have])
        elif all(overridden_by(c['classes'], FOCAL_EDGE) for c in have if set(c['classes']) & set(FOCAL_EDGE)):
            c = next(c for c in have if set(c['classes']) & set(FOCAL_EDGE))
            rep.add('error', 'S-emphasis', f"main-path edge '{a} -> {b}': " + last_class_msg(c, FOCAL_EDGE, edge=True),
                    [c['id']])
    if inv['has_focus']:
        for k, n in comp_nodes.items():
            if k not in focus_keys and set(n['classes']) & {'focal', 'focal-solid'} \
                    and not overridden_by(n['classes'], ('focal', 'focal-solid')):
                rep.add('warn', 'S-emphasis', f"'{n['id']}' is styled focal but is not the brief's focus: use "
                        f"service (one focus per diagram)", [n['id']], n['bbox'])
    emph = [k for k, v in inv_nodes.items() if v['attrs'].get('emphasis')]
    if emph:
        def sig(n):
            st = n['style']
            return (st.get('fill'), st.get('stroke'), re.sub(r'\s', '', st.get('style', '')))
        others = [sig(comp_nodes[k]) for k in comp_nodes if k not in emph and comp_nodes[k]['style'].get('fill')
                  and not children.get(k)]
        if others:
            common = Counter(others).most_common(1)[0][0]
            for k in emph:
                if k in comp_nodes and sig(comp_nodes[k]) == common:
                    rep.add('error', 'S-emphasis', f"'{comp_nodes[k]['id']}' should stand out but is styled like "
                            f"every other node: add class: focal", [comp_nodes[k]['id']], box(k))

    # --- two different nodes showing the same text read as ONE thing
    by_label = defaultdict(list)
    for k, n in comp_nodes.items():
        if k in span_map or is_group(k):
            continue
        t = next((x for x in n['texts'] if x), '')
        if t:
            by_label[t.lower()].append(n['id'])
    for t, ids in by_label.items():
        if len(ids) > 1:
            keys = [norm_key(i) for i in ids]
            if typ == 'compare' and all('.' in k for k in keys) and len({k.split('.', 1)[1] for k in keys}) == 1 \
                    and len({k.split('.', 1)[0] for k in keys}) == len(keys):
                continue    # compare: the same part drawn once in each panel (before.web, after.web)
            rep.add('warn', 'S-duplicate-label', f"{len(ids)} different nodes read {t!r} ({', '.join(ids)}): merge "
                    f"them or make the labels distinct", ids)

    # --- inferred items must be disclosed in the report
    inferred = [v['key'] for v in inv_nodes.values() if v['attrs'].get('inferred')] + \
               [f"{e['src']} {e['op']} {e['dst']}" + (f" ({e['label']})" if e['label'] else '')
                for e in inv['edges'] if e['attrs'].get('inferred')]
    if inferred:
        rep.add('info', 'S-inferred', 'not stated by the user - list under Assumed: in the report: '
                + ', '.join(inferred), [])


# ---------------------------------------------------------------------------
# read-back: explain, dump, compare
# ---------------------------------------------------------------------------

def display_name(g, k):
    n = g['nodes'].get(norm_key(k))
    t = [x for x in (n['texts'] if n else []) if x]
    if not t and g['lifelines'] and parent_of(k):      # unnamed sequence span = activation of its actor
        return display_name(g, parent_of(k)) + ' (active)'
    return t[0] if t else leaf_of(k)


def rows(card, table):
    return f"{card} {table} row" + ('s' if card.endswith('many') else '')


def explain(g):
    """The compiled diagram as plain sentences - what a reader will understand."""
    nodes = g['nodes']
    name = lambda k: display_name(g, k)
    kids = defaultdict(list)
    for k, n in sorted(nodes.items(), key=lambda kv: kv[1]['order']):
        kids[parent_of(n['id']).lower()].append(n)

    def tag(n):
        c = set(n['classes'])
        t = [x for x, cl in (('focus', FOCAL_NODE), ('external', ('external', 'sf-external')),
                             ('muted', ('muted', 'sf-muted'))) if c & set(cl)]
        return f" [{', '.join(t)}]" if t else ''
    lines = ['TOP    ' + ', '.join(name(c['id']) + tag(c) for c in kids.get('', []))]
    for par, ch in kids.items():
        if par:
            lines.append(f"GROUP  {name(par)} contains: " + ', '.join(name(c['id']) + tag(c) for c in ch))
    seq = bool(g['lifelines'])
    for e in sorted(g['edges'], key=lambda e: (e['start'][1] if e['start'] else 0) if seq else e['order']):
        s, d = name(e['src']), name(e['dst'])
        ms, me = e['marker_start'], e['marker_end']
        if e['op'] == '<-':
            s, d, ms, me = d, s, me, ms
        op = '->' if e['op'] == '<-' else e['op']
        extra = ''
        if ms in CARD and me in CARD:
            extra = (f"  [cardinality: one {d} row has {rows(CARD[ms], s)}; one {s} row has {rows(CARD[me], d)}]")
        elif me == 'triangle-hollow':
            extra = f'  [realization: {s} implements {d}]' if e['dashed'] else f'  [inheritance: {s} is a {d}]'
        elif me == 'diamond-filled':
            extra = f'  [composition: {d} owns {s}]'
        elif me == 'diamond':
            extra = f'  [aggregation: {d} has {s}]'
        elif (ms not in (None, 'triangle', 'arrow')) or (me not in (None, 'triangle', 'arrow')):
            extra = f"  [{ms or '-'} .. {me or '-'}]"
        by_end = end_labels_by_end(e)
        for which, key in (('first', e['src']), ('second', e['dst'])):
            if by_end[which]:
                extra += f"  [{name(key)} end: {' '.join(by_end[which])}]"
        if e['end_labels'] and not (by_end['first'] or by_end['second']):
            extra += f"  [end labels: {' .. '.join(e['end_labels'])}]"
        style = ' (dashed)' if e['dashed'] else ''
        if set(e['classes']) & set(FOCAL_EDGE):
            style += ' (main path)'
        lines.append(f"EDGE   {s} {op} {d}" + (f"  : {e['label']}" if e['label'] else '') + style + extra)
    return '\n'.join(lines)


def _brief_quote(s):
    return f'"{s}"' if re.search(r'[#{}:;,]|^\s|\s$', s) else s


def source_case(text, lab):
    """Zone and boundary titles reach the SVG upper-cased (text-transform): take the source's spelling."""
    plain = lab.replace('\\n', '\n')         # upper() turns the escape backslash-n into backslash-N
    if not text or plain != plain.upper() or plain == plain.lower():
        return lab
    pat = r'\\n'.join(re.escape(p) for p in lab.split('\\n'))
    # the label follows a colon (`services: Services`); a bare match could be the lowercase KEY
    m = re.search(r':[ \t]*["\']?(' + pat + r')(?![\w-])', text, re.I) or re.search('(' + pat + ')', text, re.I)
    return m.group(1) if m else lab


def dump(g, src=None):
    """The drawn graph as a brief skeleton: start an EDIT from it, never a new diagram."""
    seq = bool(g['lifelines'])
    text = open(src, encoding='utf-8').read() if src and src.endswith('.d2') else ''
    classes = {c for n in g['nodes'].values() for c in n['classes']}
    typ = 'sequence' if seq else 'erd' if 'sql_table' in text else 'class' if re.search(r'shape\s*:\s*class\b', text) \
        else 'state' if 'dot' in classes else 'flowchart' if 'decision' in classes else 'architecture'
    if len(g.get('boards', [])) > 1 and re.search(r'^\s*steps\s*:', text, re.M):
        typ = 'steps'
    dm = re.search(r'^direction\s*:\s*(\w+)', text, re.M)
    focus = [n['id'] for n in g['nodes'].values() if set(n['classes']) & set(FOCAL_NODE)]
    out = [f'# request: "<paste the user\'s request, plus the requested change>"',
           f'type: {typ}', 'reader: <who reads it, where>', 'width: 800',
           f'direction: {dm.group(1) if dm else "down"}', f"focus: {', '.join(focus) or 'none'}", 'out: <left out>',
           'nodes:']
    span = set()
    if seq:
        span = {k for k in g['nodes'] if '.' in k and k.split('.')[0] in g['lifelines_norm']}
    # flowchart / state markers, read from the role classes: dot = initial state, terminal = start or end
    ins, outs = defaultdict(int), defaultdict(int)
    for e in g['edges']:
        s, d = (e['dst'], e['src']) if e['op'] == '<-' else (e['src'], e['dst'])
        outs[norm_key(s)] += 1
        ins[norm_key(d)] += 1
    parents = {parent_of(k) for k in g['nodes']}

    def exits(k):
        return outs[k] or any(outs[a] for a in ancestors(k))
    for k, n in sorted(g['nodes'].items(), key=lambda kv: kv[1]['order']):
        if k in span:
            continue
        lab = '\\n'.join(n['lines'][0]) if n['lines'] and n['lines'][0] else ''
        lab = source_case(text, lab)
        attrs = []
        cl = set(n['classes'])
        if seq and '.' not in k and k not in g['lifelines_norm']:
            attrs.append('group')
        if typ in ('flowchart', 'state', 'swimlane') and k not in parents:
            if 'dot' in cl or ('terminal' in cl and not ins[k] and exits(k)):
                attrs.append('start')
            elif 'terminal' in cl and not exits(k):
                attrs.append('end')
            if 'decision' in cl:
                attrs.append('decision')
        if 'note' in cl:
            attrs.append('note')
        shown = _brief_quote(lab) if lab else ('""' if 'start' in attrs else '*')
        out.append(f"  {n['id']}: {shown}" + (f" {{{', '.join(attrs)}}}" if attrs else ''))
    out.append('edges:')

    def canon(e):       # (src, op, dst, src head, dst head, src labels, dst labels), `a <- b` as `b -> a`
        by_end = end_labels_by_end(e)
        if e['op'] == '<-':
            return e['dst'], '->', e['src'], e['marker_end'], e['marker_start'], by_end['second'], by_end['first']
        return e['src'], e['op'], e['dst'], e['marker_start'], e['marker_end'], by_end['first'], by_end['second']
    plain = ('triangle', 'arrow')       # d2's and the themes' default heads say nothing: not listed
    for e in g['edges']:
        s, op, d, ms, me, sl, dl = canon(e)
        if seq:
            s = s.split('.')[0] if norm_key(s) in span else s
            d = d.split('.')[0] if norm_key(d) in span else d
        attrs = ['dashed'] if e['dashed'] else []
        if op == '<->' or (ms and ms != 'none'):
            attrs.append(f'src: {ms or "none"}')
        if op == '<->' or (me and me not in plain):
            attrs.append(f'dst: {me or "none"}')
        for side, labs in (('src', sl), ('dst', dl)):
            if labs:
                attrs.append(f"{side}-label: {_brief_quote(' '.join(labs))}")
        lab = e['label']
        out.append(f"  {s} {op} {d}" + (f": {_brief_quote(lab)}" if lab else '') +
                   (f" {{{', '.join(attrs)}}}" if attrs else ''))
    return '\n'.join(out)


def graph_facts(g):
    """Order-independent facts about a compiled graph, for before/after comparison."""
    facts = set()
    for k, n in g['nodes'].items():
        facts.add(('node', k, next((x for x in n['texts'] if x), '')))
    cnt = Counter()
    for e in g['edges']:
        key, kind = canon_edge(e['src'], e['op'], e['dst'])
        lab = ' / '.join(t for t in e['texts'] if t)
        base = ('edge', key[0], {'directed': '->', 'bidirectional': '<->', 'undirected': '--'}[kind], key[1], lab,
                e['marker_start'] or '-', e['marker_end'] or '-', 'dashed' if e['dashed'] else 'solid')
        cnt[base] += 1
        facts.add(base + (cnt[base],))
    return facts


def compare(ga, gb):
    a, b = graph_facts(ga), graph_facts(gb)
    removed, added = sorted(a - b), sorted(b - a)

    def fmt(f):
        if f[0] == 'node':
            return f"node {f[1]} {f[2]!r}"
        s = f"edge {f[1]} {f[2]} {f[3]}" + (f" : {f[4]!r}" if f[4] else '')
        if f[5] != '-' or f[6] not in ('-', 'triangle'):
            s += f" [{f[5]} .. {f[6]}]"
        return s + (' dashed' if f[7] == 'dashed' else '') + (f" (#{f[8]})" if f[8] > 1 else '')
    lines = ['- ' + fmt(f) for f in removed] + ['+ ' + fmt(f) for f in added]
    lines.append(f"-- {len(removed)} removed, {len(added)} added" +
                 (' (semantically identical)' if not (removed or added) else ''))
    return '\n'.join(lines), 0 if not (removed or added) else 1


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def add_lint(rep, lint, d2file, g=None):
    """Source-lint tuples (line, level, code, message[, extra]) -> findings; an S-src-class finding
    names (and boxes, for the annotated PNG) the drawn objects that carry the unknown class."""
    for item in lint:
        n, lvl, code, msg = item[:4]
        extra = item[4] if len(item) > 4 else {}
        objs, box = [], None
        if g and extra.get('classes'):
            want = {c.lower() for c in extra['classes']}
            hits = [o for o in list(g['nodes'].values()) + g['edges'] if want & {c.lower() for c in o['classes']}]
            objs = [o['id'] for o in hits]
            box = next((o['bbox'] for o in hits if o.get('bbox')), None)
        rep.add(lvl, code, f'{os.path.basename(d2file)}:{n}: {msg}', objs, box)


NO_D2 = ('d2 is not on PATH, so nothing can be compiled - install it: curl -fsSL https://d2lang.com/install.sh | '
         f'sh -s -- ; then check the whole setup: sh {os.path.join(os.path.dirname(os.path.abspath(__file__)), "doctor.sh")}')


def graph_for(path, layout, target, tmps, search=()):
    """Parse a .d2 (compiled here) or an SVG / board directory. Returns (graph, error)."""
    if path.endswith('.d2') and not shutil.which('d2'):
        return None, NO_D2
    if path.endswith('.d2'):
        res, tmp, err = render(path, layout, target, search)
        if err:
            return None, err
        tmps.append(tmp)
        path = res
    try:
        return load_graph(path), None
    except (OSError, ET.ParseError) as e:
        return None, f'cannot read {path}: {e}'


def main(argv):
    import argparse
    ap = argparse.ArgumentParser(prog='semcheck.py', description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter, usage=argparse.SUPPRESS)
    ap.add_argument('brief', nargs='?', help='the .brief (or .inv) file')
    ap.add_argument('diagram', nargs='?', help='IN.d2, or a rendered SVG / board directory')
    ap.add_argument('--svg', help='already-rendered SVG (or multi-board directory) of DIAGRAM: no second render')
    ap.add_argument('--target', default=None, help="one board only ('' = root, e.g. layers.x)")
    ap.add_argument('--layout', help=argparse.SUPPRESS)       # tests only: skills never pass -l
    ap.add_argument('--json', action='store_true', help='machine-readable report (what d2check reads)')
    ap.add_argument('--explain', action='store_true', help='the drawn diagram as plain sentences')
    ap.add_argument('--dump', action='store_true', help='the drawn graph as a brief skeleton, for edits')
    ap.add_argument('--compare', metavar='OLD', help='meaning-level diff of OLD against DIAGRAM')
    ap.add_argument('--hint', metavar='ERROR_TEXT', help="fix line(s) for a d2 compile error ('-' reads stdin)")
    ap.add_argument('--field', metavar='KEY', help='print one header value of BRIEF (type, width, ...)')
    ap.add_argument('--lint', metavar='IN.d2', help='source slips only (quoting, classes, icons, engine): no brief')
    a = ap.parse_args(argv)

    def not_text(path):
        """A .d2 or brief that is not UTF-8 text (a binary, an AppleDouble ._ file) is named, not a traceback."""
        try:
            with open(path, encoding='utf-8') as fh:
                fh.read()
        except UnicodeDecodeError:
            print(f'semcheck: {path} is not UTF-8 text')
            return True
        except OSError:
            pass
        return False

    if a.lint:
        # source slips only (quoting, classes, icons, engine): no brief, no render; --svg adds boxes
        if not os.path.isfile(a.lint):
            print(f'semcheck: no such file: {a.lint}')
            return 2
        if not_text(a.lint):
            return 2
        tmps = []
        try:
            g = None
            if a.svg:
                g, err = graph_for(a.svg, None, a.target, tmps)
                if err:
                    print(f'semcheck: {err}')
                    return 2
            rep, notes = Report(), []
            add_lint(rep, lint_source(a.lint, 'other', notes), a.lint, g)
        finally:
            for t in tmps:
                shutil.rmtree(t, ignore_errors=True)
        n_err, n_warn = rep.count('error'), rep.count('warn')
        if a.json:
            print(json.dumps({'tool': 'semcheck', 'mode': 'lint', 'diagram': a.lint, 'errors': n_err,
                              'warnings': n_warn, 'findings': rep.items, 'notes': notes}, indent=1))
        else:
            print(f'semcheck --lint {a.lint}')
            for it in rep.items:
                print(f"  {it['severity'].upper():5} {it['code']:26} {it['message']} -> {it['anchor']}")
            for nt in notes:
                print(f'  note: {nt}')
            print(f"  verdict: {'FAIL' if n_err else 'PASS'} ({n_err} error(s), {n_warn} warning(s))")
        return 1 if n_err else 0

    if a.hint is not None:
        text = sys.stdin.read() if a.hint == '-' else a.hint
        lines = hint_lines(text)
        print('\n'.join(lines) if lines else 'hint: no known pattern - fix the line:col d2 names; the compile-error '
                                             'table is in workflows/review-and-fix.md')
        return 0 if lines else 1
    if a.field:
        if not a.brief:
            ap.error('--field KEY BRIEF')
        try:
            inv = parse_brief(a.brief)
        except BriefError as e:
            print(f'semcheck: {e}', file=sys.stderr)
            return 2
        v = inv['type'] if a.field.lower() == 'type' and 'type' in inv['meta'] else inv['meta'].get(a.field.lower())
        if v is None:
            return 1
        print(re.match(r'\d+', v).group(0) if a.field.lower() == 'width' and re.match(r'\d+', v) else v)
        return 0

    # a missing input is named as such, not as a compile error of a file d2 could not open
    for path in (a.compare, a.svg, a.diagram, a.brief):
        if path and not os.path.exists(path):
            print(f'semcheck: no such file: {path}')
            return 2
        if path and os.path.isfile(path) and not path.endswith('.svg') and not_text(path):
            return 2
    tmps = []
    try:
        if a.compare or a.explain or a.dump:
            target = a.diagram or a.brief
            if not target:
                ap.error('a diagram is required')
            if a.compare:
                # the original is usually a copy in D2W: its imports live next to the new version
                ga, err = graph_for(a.compare, a.layout, a.target, tmps, [os.path.dirname(os.path.abspath(target))])
                gb, err2 = (graph_for(target, a.layout, a.target, tmps, [os.path.dirname(os.path.abspath(a.compare))])
                            if not err else (None, None))
                if (err or err2) == NO_D2:
                    print(f'semcheck: {NO_D2}')
                    return 2
                if err or err2:
                    print(f"semcheck: cannot compile {a.compare if err else target}: {err or err2}")
                    for h in hint_lines(err or err2):
                        print('  ' + h)
                    return 2
                text, code = compare(ga, gb)
                print(text)
                return code
            g, err = graph_for(a.svg or target, a.layout, a.target, tmps)
            if err:
                print(f'semcheck: {err}' if err == NO_D2 else f'semcheck: cannot compile {target}: {err}')
                for h in hint_lines(err):
                    print('  ' + h)
                return 2
            print(explain(g) if a.explain else dump(g, target))
            return 0

        if not (a.brief and a.diagram):
            ap.error('usage: semcheck.py BRIEF IN.d2 [--svg OUT.svg]   (see --help)')
        try:
            inv = parse_brief(a.brief)
        except BriefError as e:
            print(f'semcheck: brief problem: {e}')
            return 2
        lint, lint_notes = [], []
        if a.diagram.endswith('.d2'):
            if not os.path.isfile(a.diagram):
                print(f'semcheck: no such file: {a.diagram}')
                return 2
            lint = lint_source(a.diagram, inv['type'], lint_notes)
        g, err = graph_for(a.svg or a.diagram, a.layout, a.target, tmps)
        if err:
            print(f'semcheck: {err}' if err == NO_D2 else
                  f"semcheck: {a.diagram} does not compile (`d2 validate` can pass while this fails): {err}")
            for h in hint_lines(err):
                print('  ' + h)
            return 2
        rep = Report()
        add_lint(rep, lint, a.diagram, g)
        diff(inv, g, rep)
        notes = list(inv['notes']) + lint_notes
        # these two travel as INFO findings so they reach the d2check summary, not only this listing
        miss = uncovered_request_terms(inv)
        if miss:
            rep.add('info', 'S-missing-node', 'the request names ' + ', '.join(repr(t) for t in miss[:8]) +
                    ' but no brief label, key or out: entry mentions it - add it to the brief, or list it under out:')
        if a.brief.endswith('.brief') and not inv['has_focus']:
            rep.add('info', 'S-emphasis', 'the brief has no focus: line, so the focus is not checked '
                    '(workflows/brief.md section 3)')
        order = {'error': 0, 'warn': 1, 'info': 2}
        rep.items.sort(key=lambda i: order[i['severity']])
        n_err, n_warn = rep.count('error'), rep.count('warn')
        if a.json:
            print(json.dumps({'tool': 'semcheck', 'brief': a.brief, 'diagram': a.diagram, 'type': inv['type'],
                              'boards': g['boards'], 'errors': n_err, 'warnings': n_warn, 'findings': rep.items,
                              'notes': notes, 'meta': inv['meta']}, indent=1))
        else:
            n_nodes = sum(1 for v in inv['nodes'].values() if not v['attrs'].get('_implied'))
            print(f"semcheck {a.brief} vs {a.diagram}" + (f" (svg {a.svg})" if a.svg else ''))
            print(f"  brief: {inv['type']}, {n_nodes} nodes + {len(inv['edges'])} edges, focus "
                  f"{inv['meta'].get('focus', '-')}; drawn: {len(g['nodes'])} nodes, {len(g['edges'])} edges"
                  + (f" on {len(g['boards'])} boards" if len(g['boards']) > 1 else ''))
            for it in rep.items:
                print(f"  {it['severity'].upper():5} {it['code']:26} {it['message']} -> {it['anchor']}")
            for nt in notes:
                print(f'  note: {nt}')
            verdict = 'FAIL' if n_err else ('PASS-with-warnings' if n_warn else 'PASS')
            print(f"  verdict: {verdict} ({n_err} error(s), {n_warn} warning(s))")
        return 1 if n_err else 0
    finally:
        for t in tmps:
            shutil.rmtree(t, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
