#!/usr/bin/env python3
"""Regression tests for scripts/semcheck.py (python3 stdlib + d2 on PATH).

    python3 dev/tests/semantic/run_tests.py [-k SUBSTRING] [-v]

Every case compiles with d2, so cases run in parallel. NEUTRAL_THEME=/path overrides the
theme used for the brief.md worked example (default: templates/neutral-theme.d2).
Exit 0 = all pass.
"""
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CHECK = os.path.join(SKILL, 'scripts', 'semcheck.py')
CASES = os.path.join(HERE, 'cases')
BRIEF_MD = os.path.join(SKILL, 'workflows', 'brief.md')
THEME = os.environ.get('NEUTRAL_THEME') or os.path.join(SKILL, 'templates', 'neutral-theme.d2')

# PLAN.md 5.1 semcheck codes, plus S-arrowhead (round-1 `arrowhead`, carried over with the S- prefix)
CONTRACT = set('''S-missing-node S-extra-node S-wrong-parent S-missing-edge S-extra-edge S-misrouted-edge
S-reversed-edge S-edge-kind S-duplicate-edge S-node-label S-node-label-case S-edge-label S-edge-style
S-duplicate-label S-missing-column S-erd-anchor S-erd-cardinality S-seq-order S-seq-return S-seq-group
S-seq-group-actor S-seq-actor-order S-state-start S-unreachable S-end-has-exit S-decision S-dead-end
S-emphasis S-inferred S-src-hash S-src-semicolon S-src-icon-family S-src-cli-engine S-arrowhead'''.split())

# (brief, diagram, exact set of error+warning codes)
CODESETS = [
    # round-1 corpus: correct diagrams are clean ...
    ('arch.inv', 'arch_good.d2', set()),
    ('seq.inv', 'seq_good.d2', set()),
    ('erd.inv', 'erd_good.d2', set()),
    ('state.inv', 'state_good.d2', set()),
    ('flow.inv', 'flow_good.d2', set()),
    ('c4.inv', 'c4_good.d2', set()),
    # ... and every injected defect is reported
    ('arch.inv', 'arch_bad.d2', {'S-src-semicolon', 'S-src-hash', 'S-src-cli-engine', 'S-extra-node',
                                 'S-node-label', 'S-duplicate-edge', 'S-edge-style', 'S-reversed-edge',
                                 'S-edge-label', 'S-misrouted-edge', 'S-extra-edge', 'S-emphasis'}),
    ('seq.inv', 'seq_bad.d2', {'S-extra-node', 'S-node-label', 'S-missing-edge', 'S-seq-return', 'S-extra-edge',
                               'S-seq-order', 'S-seq-group-actor', 'S-seq-actor-order'}),
    ('erd.inv', 'erd_bad.d2', {'S-edge-kind', 'S-missing-column', 'S-erd-cardinality'}),
    ('state.inv', 'state_bad.d2', {'S-node-label', 'S-edge-label', 'S-missing-edge', 'S-extra-edge',
                                   'S-unreachable', 'S-end-has-exit', 'S-state-start', 'S-src-cli-engine'}),
    ('flow.inv', 'flow_bad.d2', {'S-extra-node', 'S-edge-label', 'S-missing-edge', 'S-extra-edge', 'S-decision',
                                 'S-dead-end', 'S-src-cli-engine'}),
    # an edge into a container enters all its members; a container's edges leave from them (parallel blocks)
    ('flow_parallel.brief', 'flow_parallel.d2', set()),
    ('flow_orphan.brief', 'flow_orphan.d2', {'S-unreachable', 'S-dead-end'}),
    ('dup.inv', 'dup.d2', {'S-duplicate-label'}),
    ('parent.brief', 'parent_bad.d2', {'S-wrong-parent', 'S-misrouted-edge'}),
    # round 2: brief header + focus
    ('focus.brief', 'focus_good.d2', set()),
    ('focus.brief', 'focus_bad.d2', {'S-emphasis'}),
    ('focus_zone.brief', 'focus_zone_good.d2', set()),      # a container focus is a zone-blue group
    ('focus_zone.brief', 'focus_zone_bad.d2', {'S-emphasis'}),
    # the last class wins in d2: [focal; service] renders a plain service box, [flow; dep] a grey edge
    ('focus.brief', 'focus_order_bad.d2', {'S-emphasis'}),
    ('focus_zone.brief', 'focus_zone_order_bad.d2', {'S-emphasis'}),
    ('focus_zone.brief', 'sf_group_focus.d2', {'S-emphasis'}),       # Snowflake has no focus group
    ('misroute_src.brief', 'misroute_src.d2', {'S-misrouted-edge'}),
    # source lints
    ('icons.brief', 'icons_mixed.d2', {'S-src-icon-family'}),
    ('icons.brief', 'icons_one.d2', set()),
    ('engine.brief', 'engine_none.d2', {'S-src-cli-engine'}),
    ('engine.brief', 'engine_import.d2', set()),
    # container edges: a stand-in for node edges is an error, a full fan-out merge is accepted
    ('grid.brief', 'grid_bad.d2', {'S-misrouted-edge'}),
    ('grid.brief', 'grid_good.d2', set()),
    ('fanout.brief', 'fanout_merged.d2', set()),
    ('fanout_partial.brief', 'fanout_partial.d2', {'S-misrouted-edge'}),
    # multi-board: the brief is the union of all boards
    ('steps.brief', 'steps_good.d2', set()),
    ('steps.brief', 'steps_bad.d2', {'S-extra-node', 'S-misrouted-edge'}),
    # notation
    ('seq_group.inv', 'seq_group_bad.d2', {'S-seq-group'}),
    ('uml.brief', 'uml_good.d2', set()),
    ('uml.brief', 'uml_bad.d2', {'S-arrowhead'}),
    ('erd_nullable.brief', 'erd_nullable.d2', set()),
    ('erd_nullable.brief', 'erd_nullable_bad.d2', {'S-erd-cardinality'}),
    # invisible helpers and the native legend are not part of the graph
    ('legend.brief', 'legend.d2', set()),
    ('terms.brief', 'terms.d2', set()),
    # brief parsing: an arrow inside a label, and arrows without spaces
    ('arrow_label.brief', 'arrow_label.d2', set()),
    ('nospace.brief', 'arrow_label.d2', {'S-edge-label'}),
]

# (name, argv, expected exit, substrings that must appear, substrings that must not)
RUNS = [
    ('dagre ERD anchors at the table centre', ['--layout', 'dagre', 'erd.inv', 'erd_good.d2'], 0,
     ['S-erd-anchor'], []),
    ('compile error: exit 2 with a hint', ['arch.inv', 'compile_bad.d2'], 2,
     ['reserved keywords', 'hint: `left` (line 4) is a d2 keyword'], []),
    ('compare: refactor shows exactly one change', ['--compare', 'arch_good.d2', 'arch_refactor.d2'], 1,
     ["+ edge aws.kafka -> aws.billing : 'consumes'", '-- 1 removed, 1 added'], []),
    ('compare: identical', ['--compare', 'arch_good.d2', 'arch_good.d2'], 0, ['semantically identical'], []),
    ('explain: cardinality in words', ['--explain', 'erd_good.d2'], 0,
     ['one customers row has zero or many orders rows', 'one orders row has exactly one customers row'], []),
    ('explain: nullable FK reads zero or one', ['--explain', 'erd_nullable.d2'], 0,
     ['one tasks row has zero or one users row'], []),
    ('explain: UML relations in words', ['--explain', 'uml_good.d2'], 0,
     ['inheritance: Dog is a Animal', 'composition: Car owns Wheel', 'aggregation: Fleet has Car'], []),
    ('explain: focus and main path are named', ['--explain', 'focus_good.d2'], 0,
     ['Order service [focus]', '(main path)'], []),
    ('brief header: --field width', ['--field', 'width', 'focus.brief'], 0, ['800'], []),
    ('brief header: --field focus', ['--field', 'focus', 'focus.brief'], 0,
     ['api.orders, web -> api.gw -> api.orders'], []),
    ('brief header: --field type normalises aliases', ['--field', 'type', 'alias.brief'], 0, ['flowchart'], []),
    ('brief header: request continues on indented # lines only', ['--json', 'reqcont.brief', 'engine_import.d2'], 0,
     ['"request": "Alpha calls Beta over gRPC; Beta answers."'], ['arrows = request direction"']),
    ('brief header: missing field exits 1', ['--field', 'reader', 'engine.brief'], 1, [], []),
    ('brief header: parsed into JSON meta', ['--json', 'focus.brief', 'focus_good.d2'], 0,
     ['"request": "Show how the web app reaches the order service through the API gateway; orders are saved in '
      'Postgres. Highlight the order service."', '"reader": "team wiki page"', '"direction": "down"',
      '"out": "auth, monitoring"'], []),
    ('brief header: missing keys are named', ['engine.brief', 'engine_import.d2'], 0,
     ['brief header lacks: reader, width, direction, focus', 'no `# request:` line'], []),
    ('brief: unknown attribute is exit 2 with a suggestion', ['bad_attr.brief', 'engine_import.d2'], 2,
     ["unknown attribute 'dahsed' (did you mean 'dashed'?)"], []),
    ('brief: bad edge operator is exit 2', ['bad_edge.brief', 'engine_import.d2'], 2, ["cannot parse edge 'a => b'"],
     []),
    ('brief: node line before nodes: is exit 2', ['bad_section.brief', 'engine_import.d2'], 2,
     ['did you forget the `nodes:` line'], []),
    ('inferred items are listed for the report', ['focus.brief', 'focus_good.d2'], 0,
     ['INFO  S-inferred', 'web -> api.gw (HTTPS)'], []),
    ('request terms missing from the brief are named', ['terms.brief', 'terms.d2'], 0, ["INFO  S-missing-node", "names 'Redis'"],
     ["'Stripe'"]),
    ('every finding ends with its recipe anchor', ['focus.brief', 'focus_bad.d2'], 1,
     ['-> workflows/review-and-fix.md#s-emphasis'], []),
    ('focus: missing focal class is named', ['focus.brief', 'focus_bad.d2'], 1,
     ["focus 'api.orders' is not styled focal", "main-path edge 'api.gw -> api.orders' is not styled as the main "
      "path", "'api.gw' is styled focal but is not the brief's focus"], []),
    ('misroute names the container', ['grid.brief', 'grid_bad.d2'], 1, ["between containers 'ingest' and 'sf'"], []),
    ('container focus asks for zone-blue', ['focus_zone.brief', 'focus_zone_bad.d2'], 1,
     ["focus 'sf' is a container: give it class: zone-blue"], []),
    ('multi-board finding names its board', ['steps.brief', 'steps_bad.d2'], 1, ["on board 's2'"], []),
    ('nullable FK drawn exactly-one is caught', ['erd_nullable.brief', 'erd_nullable_bad.d2'], 1,
     ['should be cf-one (zero or one) but shows cf-one-required (exactly one)'], []),
    ('hint: unknown text exits 1', ['--hint', 'no such error'], 1, ['hint: no known pattern'], []),
    ('brief: D2 styling in attributes is exit 2', ['d2style.brief', 'arrow_label.d2'], 2,
     ["unknown attribute 'style.stroke-dash'", 'classes and styles go in the .d2'], []),
    ('extra title node asks for {note}', ['arrow_label.brief', 'titled.d2'], 1,
     ['a title or caption? List it in the brief as `title: <text> {note}`'], []),
    ('focus: a class after focal overrides it', ['focus.brief', 'focus_order_bad.d2'], 1,
     ["focus 'api.orders': 'service' comes after 'focal' and overrides it", 'write class: [service; focal]',
      "'dep' comes after 'flow'"], []),
    ('container focus: zone-blue must come last', ['focus_zone.brief', 'focus_zone_order_bad.d2'], 1,
     ["'zone' comes after 'zone-blue'", 'write class: [zone; zone-blue]'], []),
    ('Snowflake group focus asks for sf-primary inside it', ['focus_zone.brief', 'sf_group_focus.d2'], 1,
     ['Snowflake has no focus group', '(sf-primary)'], ['zone-blue']),
    ('brief header: a quoted request continues on plain # lines', ['--json', 'reqquote.brief', 'engine_import.d2'], 0,
     ['"request": "Alpha calls Beta over gRPC; Beta answers once."'], ['arrows = request direction']),
    ('brief header: an unclosed request quote is a note', ['requnclosed.brief', 'engine_import.d2'], 0,
     ['quote is never closed'], []),
    ('compare: a D2W copy borrows the imports of the new version', ['--compare', 'd2w/orig.d2', 'focus_good.d2'], 0,
     ['semantically identical', '# note: orig.d2 imports mini-theme.d2'], []),
    ('dump: a D2W copy compiles with the imports of the cwd', ['--dump', 'd2w/orig.d2'], 0,
     ['api.orders: Order service', '# note: orig.d2 imports mini-theme.d2'], []),
    ('dump: a D2W copy with a borrowed import shows its next real error', ['--dump', 'd2w/bad_orig.d2'], 2,
     ['reserved keywords are prohibited in edges', 'hint: `left` (line 2) is a d2 keyword'], ['semcheck-']),
    ('request terms: product descriptors like SaaS are not nodes', ['saas.brief', 'engine_import.d2'], 0, [],
     ["'SaaS'"]),
    ('dump: state markers, source-case titles, no default heads', ['--dump', 'state_dump.d2'], 0,
     ['start: "" {start}', 'live: Live {end}', 'failed: Failed {end}', 'active: In progress'],
     ['IN PROGRESS', '{dst: arrow}']),
    ('misroute from the wrong source says starts at', ['misroute_src.brief', 'misroute_src.d2'], 1,
     ["'aws.billing -> stripe' starts at 'aws.orders' instead of 'aws.billing'"], []),
]

# d2 files that fail to compile -> text that --hint must print for d2's real error message
HINTS = [
    ('hint_reserved.d2', '`left` (line 3) is a d2 keyword'),         # reserved key in an edge
    ('hint_dollar.d2', 'use single quotes'),                         # $ in a label
    ('hint_brace.d2', 'wrap the whole label in double quotes'),      # { in a label
    ('hint_cfgkey.d2', 'valid d2-config keys'),                      # unknown d2-config key
    ('hint_import.d2', '`nosuch-theme.d2` is not next to the .d2'),  # missing import
    ('hint_import_sf.d2', 'cp ${CLAUDE_SKILL_DIR}/templates/snowflake-brand.d2'),
    ('hint_icon.d2', 'local icon path does not exist'),              # missing local icon
    ('hint_dagre.d2', 'needs the ELK engine'),
    ('hint_color.d2', 'theme codes (B1, N2) work only inside theme-overrides'),
    ('hint_stroke.d2', 'stroke-width is an integer 0-15'),
    ('hint_shape.d2', 'unknown shape or arrowhead name'),
    ('hint_hashfill.d2', 'quote hex colours'),
    ('hint_top.d2', '`top`/`left` are position keywords'),
    ('hint_width.d2', 'take a bare integer'),
    ('hint_stylekey.d2', 'misspelled style key'),
    ('hint_bare.d2', 'style keys go under `style.`'),
    ('hint_cap.d2', 'style keys go under `style.`'),
    ('hint_bool.d2', 'write true or false'),
    ('hint_3d.d2', 'exist only on the shapes named in the error'),
    ('hint_theme.d2', 'unknown theme-id'),
    ('hint_near.d2', '`near` takes top-left'),
    ('hint_glob.d2', '`style` alone has no value'),
    ('hint_var.d2', 'is not defined: define it under vars'),
    ('hint_dir.d2', 'direction is up, down, right or left'),
    ('hint_unbal.d2', 'unbalanced `{`'),
    ('hint_block.d2', 'close the |md'),
    ('hint_classcomma.d2', 'separate classes with `;`'),
    ('hint_emptyval.d2', 'nothing after a colon'),
]

# correct diagrams whose --dump must round-trip to a clean check
DUMPS = ['arch_good.d2', 'seq_good.d2', 'erd_good.d2', 'state_good.d2', 'flow_good.d2', 'c4_good.d2',
         'focus_good.d2', 'steps_good.d2', 'uml_good.d2', 'grid_good.d2', 'legend.d2', 'backedge.d2',
         'state_dump.d2', 'focus_zone_good.d2']

MSG_MAX = 170       # d2lint --compact (the d2check listing) cuts each finding at 170 characters


def run(argv, cwd=CASES, stdin=None):
    p = subprocess.run([sys.executable, CHECK] + argv, cwd=cwd, capture_output=True, text=True, input=stdin)
    return p.returncode, p.stdout + p.stderr


def render(d2file, tmp):
    out = os.path.join(tmp, os.path.basename(d2file)[:-3] + '.svg')
    p = subprocess.run(['d2', '--scale', '1', d2file, out], cwd=CASES, capture_output=True, text=True)
    # d2 leaves an SVG behind even when bundling an icon fails: only exit 0 counts
    res = out if os.path.isfile(out) else out[:-4] if os.path.isdir(out[:-4]) else None
    return (res if p.returncode == 0 else None), p.stderr


def t_codeset(case):
    brief, d2, want = case
    code, out = run(['--json', brief, d2])
    try:
        findings = json.loads(out)['findings']
    except ValueError:
        return False, f'no JSON (exit {code}): {out[-400:]}', set()
    got = {i['code'] for i in findings if i['severity'] in ('error', 'warn')}
    want_exit = 1 if any(i['severity'] == 'error' for i in findings) else 0
    long_msgs = [f"{i['code']} ({len(i['message'])} chars)" for i in findings if len(i['message']) > MSG_MAX]
    ok = got == want and code == want_exit and not long_msgs
    detail = 'codes: ' + (', '.join(sorted(got)) or '-') if got == want else \
        f'missing={sorted(want - got)} unexpected={sorted(got - want)}'
    if got == want and code != want_exit:
        detail += f' (exit {code}, expected {want_exit})'
    if long_msgs:
        detail += f'; cut by d2check at {MSG_MAX}: {long_msgs}'
    return ok, detail, {i['code'] for i in findings}


def t_run(case):
    name, argv, want_code, needles, forbidden = case
    code, out = run(argv)
    miss = [n for n in needles if n not in out]
    bad = [n for n in forbidden if n in out]
    ok = code == want_code and not miss and not bad
    return ok, f'exit {code}' + (f' missing {miss}' if miss else '') + (f' forbidden {bad}' if bad else '') + \
        ('' if ok else '\n      ' + out.strip().replace('\n', '\n      ')[:1500]), set()


def t_hint(case):
    d2file, needle = case
    with tempfile.TemporaryDirectory() as tmp:
        res, err = render(d2file, tmp)
    if res:
        return False, 'expected a compile error but d2 rendered it', set()
    code, out = run(['--hint', '-'], stdin=err)
    ok = code == 0 and needle in out
    return ok, (out.strip().splitlines() or ['-'])[0][:110] if ok else f'exit {code}: {out.strip()[:300]}', set()


def t_dump(d2file):
    with tempfile.TemporaryDirectory() as tmp:
        res, err = render(d2file, tmp)
        if not res:
            return False, 'render failed: ' + err[-200:], set()
        code, text = run(['--dump', d2file, '--svg', res])
        if code:
            return False, f'dump exit {code}: {text[-300:]}', set()
        bp = os.path.join(tmp, 'dumped.brief')
        open(bp, 'w').write(text)
        code, out = run(['--json', bp, d2file, '--svg', res])
    try:
        d = json.loads(out)
    except ValueError:
        return False, f'no JSON (exit {code}): {out[-300:]}', set()
    errs = [f"{i['code']}: {i['message'][:90]}" for i in d['findings'] if i['severity'] in ('error', 'warn')]
    return code == 0 and not errs, f"{len(text.splitlines())}-line brief, exit {code}" + (f' {errs}' if errs else ''), \
        {i['code'] for i in d['findings']}


def fenced(md, lang, after_heading):
    """First ```lang block after a heading that contains after_heading."""
    m = re.search(r'^#+ .*' + re.escape(after_heading) + r'.*$', md, re.M | re.I)
    if not m:
        return None
    b = re.search(r'^```' + re.escape(lang) + r'[ \t]*\n(.*?)^```[ \t]*$', md[m.end():], re.M | re.S)
    return b.group(1) if b else None


def t_brief_example(_):
    if not os.path.isfile(BRIEF_MD):
        return False, f'{BRIEF_MD} missing', set()
    md = open(BRIEF_MD, encoding='utf-8').read()
    brief_md, d2_md = fenced(md, 'brief', 'Worked example'), fenced(md, 'd2', 'Worked example')
    bpath, dpath = os.path.join(HERE, 'brief_example.brief'), os.path.join(HERE, 'brief_example.d2')
    if brief_md is None or d2_md is None:
        return False, 'brief.md has no ```brief and ```d2 block under a "Worked example" heading', set()
    if brief_md.strip() != open(bpath).read().strip() or d2_md.strip() != open(dpath).read().strip():
        return False, 'brief.md worked example and dev/tests/semantic/brief_example.{brief,d2} differ', set()
    if not os.path.isfile(THEME):
        return False, f'theme not found at {THEME} (set NEUTRAL_THEME=/path/to/neutral-theme.d2)', set()
    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(dpath, tmp)
        shutil.copy(THEME, os.path.join(tmp, 'neutral-theme.d2'))
        code, out = run(['--json', bpath, os.path.join(tmp, 'brief_example.d2')], cwd=HERE)
    try:
        d = json.loads(out)
    except ValueError:
        return False, f'exit {code}: {out[-400:]}', set()
    bad = [f"{i['code']}: {i['message'][:100]}" for i in d['findings'] if i['severity'] in ('error', 'warn')]
    ok = code == 0 and not bad and not d['notes']
    return ok, f"exit {code}, {d['errors']} errors, {d['warnings']} warnings, notes {d['notes']}" + \
        (f' {bad}' if bad else ''), {i['code'] for i in d['findings']}


def t_speed(_):
    with tempfile.TemporaryDirectory() as tmp:
        res, err = render('focus_good.d2', tmp)
        best = 9.0
        for _ in range(3):
            t0 = time.time()
            code, out = run(['focus.brief', 'focus_good.d2', '--svg', res])
            best = min(best, time.time() - t0)
    return code == 0 and best < 1.0, f'{best:.2f}s per check with --svg (limit 1.0s)', set()


def t_env(_):
    env = dict(os.environ, D2_WATCH='1', D2_LAYOUT='dagre')
    try:
        p = subprocess.run([sys.executable, CHECK, 'focus.brief', 'focus_good.d2'], cwd=CASES, capture_output=True,
                           text=True, env=env, timeout=90)
    except subprocess.TimeoutExpired:
        return False, 'hung with D2_WATCH set', set()
    return p.returncode == 0, f'exit {p.returncode} with D2_WATCH=1 D2_LAYOUT=dagre in the environment', set()


def t_static(_):
    src = open(CHECK, encoding='utf-8').read()
    emitted = set(re.findall(r"rep\.add\('(?:error|warn|info)', '([^']+)'", src))
    emitted |= set(re.findall(r"'(?:error|warn|info)', '(S-[a-z-]+)'", src))
    stray = set(re.findall(r"\bS-[a-z][a-z-]*[a-z]", src)) - CONTRACT
    bad = sorted(c for c in emitted if not c.startswith('S-') or c not in CONTRACT)
    ok = emitted and not bad and not stray
    return ok, f'{len(emitted)} codes in the source, all S- and in the contract' if ok else \
        f'not in contract: {bad}; stray S- tokens: {sorted(stray)}', set()


def main():
    args = sys.argv[1:]
    k = args[args.index('-k') + 1] if '-k' in args else ''
    verbose = '-v' in args
    jobs = [('codeset', c, t_codeset) for c in CODESETS] + [('run', c, t_run) for c in RUNS] + \
           [('hint', c, t_hint) for c in HINTS] + [('dump', c, t_dump) for c in DUMPS] + \
           [('example', None, t_brief_example), ('speed', None, t_speed), ('static', None, t_static),
            ('env', None, t_env)]

    def label(kind, c):
        if kind == 'codeset':
            return f'{c[1]} vs {c[0]}'
        if kind == 'run':
            return c[0]
        if kind in ('hint', 'dump'):
            return f'{kind} {c[0] if kind == "hint" else c}'
        return {'example': 'brief.md worked example == brief_example.* and checks clean',
                'speed': 'runtime with --svg', 'static': 'every emitted code is S- and in the contract',
                'env': 'D2_* environment overrides are ignored'}[kind]
    jobs = [j for j in jobs if k in label(j[0], j[1])]
    t0 = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(2, os.cpu_count() or 2)) as ex:
        futs = [(kind, c, ex.submit(fn, c)) for kind, c, fn in jobs]
        results = [(kind, c) + f.result() for kind, c, f in futs]
    fails, seen = 0, set()
    for kind, c, ok, detail, codes in results:
        seen |= codes
        fails += not ok
        if verbose or not ok or kind in ('example', 'speed', 'static', 'env'):
            print(('PASS' if ok else 'FAIL'), f'{label(kind, c)}: {detail}')
        else:
            print('PASS', label(kind, c))
    off = sorted(c for c in seen if c not in CONTRACT)
    if off:
        fails += 1
        print('FAIL codes emitted during the run that are not in the contract:', off)
    print(f'{len(results)} tests, {fails} failure(s), {time.time() - t0:.1f}s')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
