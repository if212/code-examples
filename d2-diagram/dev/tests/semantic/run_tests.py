#!/usr/bin/env python3
"""Regression tests for scripts/semcheck.py (python3 stdlib + d2 on PATH).

    python3 dev/tests/semantic/run_tests.py [-k SUBSTRING] [-v]

Cases run in parallel. Every .d2 that a codeset or dump case needs is rendered ONCE first and
checked through `--svg` (as d2check does); runs, hints and the compile paths still render in
semcheck itself. NEUTRAL_THEME=/path overrides the theme used for the brief.md worked example
(default: templates/neutral-theme.d2). Exit 0 = all pass.
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
# and S-src-class (round 3, backlog B1: a class nothing defines)
CONTRACT = set('''S-missing-node S-extra-node S-wrong-parent S-missing-edge S-extra-edge S-misrouted-edge
S-reversed-edge S-edge-kind S-duplicate-edge S-node-label S-node-label-case S-edge-label S-edge-style
S-duplicate-label S-missing-column S-erd-anchor S-erd-cardinality S-seq-order S-seq-return S-seq-group
S-seq-group-actor S-seq-actor-order S-state-start S-unreachable S-end-has-exit S-decision S-dead-end
S-emphasis S-inferred S-src-hash S-src-semicolon S-src-icon-family S-src-cli-engine S-arrowhead
S-src-class'''.split())

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
    # S-src-class: a class that neither the file nor its imports define is silently ignored by d2
    ('cls.brief', 'cls_typo.d2', {'S-src-class'}),
    ('cls.brief', 'cls_none.d2', {'S-src-class'}),
    ('cls.brief', 'cls_import.d2', set()),      # classes via a nested import and `classes: {...@f}`
    ('cls.brief', 'cls_sf.d2', {'S-src-class'}),
    ('cls_column.brief', 'cls_column.d2', {'S-src-class'}),
    ('cls_column.brief', 'cls_column_quoted.d2', set()),     # the fix: a quoted "class" is a column name
    # invisible balancing children (opacity 0, by class or inline) are not part of the graph (B21)
    ('ghost.brief', 'ghost.d2', set()),
    # a note under a sequence actor does not make the actor a group (B28)
    ('seq_note.brief', 'seq_note.d2', set()),
    # edge name plus arrowhead labels: src-label / dst-label, or "name label" in one (B28)
    ('uml_ends.brief', 'uml_ends.d2', set()),
    ('uml_ends_bad.brief', 'uml_ends.d2', {'S-edge-label'}),
    # verifier round: a class list across lines is a list, not a class named '['; a cylinder participant
    # (drawn with one-number V commands) keeps its real x, so declared order stays in order
    ('cls.brief', 'cls_multiline.d2', set()),
    ('seq_cyl.inv', 'seq_cyl.d2', set()),
    # integration: a hidden grid slot is proven by the node drawn inside it; an empty slot or a hidden
    # listed node is still missing; compare panels repeat parts; swimlanes get the flowchart checks
    ('slot.brief', 'slot_good.d2', set()),
    ('slot.brief', 'slot_empty.d2', {'S-missing-node'}),
    ('slot.brief', 'slot_leaf.d2', {'S-missing-node'}),
    ('cmp.brief', 'cmp_twins.d2', set()),
    ('cmp_arch.brief', 'cmp_twins.d2', {'S-duplicate-label'}),
    ('swim.brief', 'swim_good.d2', set()),
    ('swim.brief', 'swim_bad.d2', {'S-decision', 'S-edge-label'}),
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
    ('brief header: catalog aliases (gantt = roadmap)', ['--field', 'type', 'alias_catalog.brief'], 0, ['roadmap'],
     []),
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
    ('brief: key=value attributes are exit 2 with the colon form', ['bad_eq.brief', 'engine_import.d2'], 2,
     ['write attributes as `{key: value}` with a colon, not `=`: {shape: cylinder}'], []),
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
    ('class typo: did you mean', ['cls.brief', 'cls_typo.d2'], 1,
     ["cls_typo.d2:3: class 'datastor' is defined neither here nor in the imports", "did you mean 'datastore'?",
      "did you mean 'service'?"], []),
    ('class of the other theme: its twin', ['cls.brief', 'cls_sf.d2'], 1,
     ["'datastore' is a neutral-theme class; this file uses snowflake-brand: write sf-datastore", 'write sf-flow'],
     []),
    ('class with no theme: one finding names the import', ['cls.brief', 'cls_none.d2'], 1,
     ['classes datastore, dep, service are used but nothing defines them', '...@neutral-theme'], []),
    ('class: a sql_table column named class', ['cls_column.brief', 'cls_column.d2'], 1,
     ['quote the name, "class": text'], ['nothing defines them']),
    ('--lint: source slips without a brief', ['--lint', 'cls_typo.d2'], 1,
     ['S-src-class', 'verdict: FAIL (2 error(s), 0 warning(s))'], []),
    ('--lint: comments, labels, md blocks, filters and null are not class uses', ['--lint', 'cls_tricky.d2'], 0,
     ['verdict: PASS (0 error(s)'], ['S-src-class']),
    ('--lint: a missing file is exit 2', ['--lint', 'no_such.d2'], 2, ['no such file'], []),
    ('--lint: a Snowflake class in a neutral file names its twin', ['--lint', 'cls_neutral_sf.d2'], 1,
     ["'sf-primary' is a snowflake-brand class; this file uses neutral-theme: write focal", 'write flow'], []),
    ('explain: realization, and arrowhead labels at their end', ['--explain', 'uml_ends.d2'], 0,
     ['realization: Card implements Method', 'LineItem end: 1..*', 'Method end: 0..1'], ['[- .. arrow]']),
    ('end label at the wrong end names the swap', ['uml_ends_bad.brief', 'uml_ends.d2'], 1,
     ["the Order end should read '1..*' but shows nothing: it sits at the other end"], []),
    ('brief: a type without a template points to route.md', ['nosuchtype.brief', 'arrow_label.d2'], 0,
     ["type 'swimlane-matrix' has no template: pick one with workflows/route.md"], []),
    ('--lint: a multi-line class list is read as a list', ['--lint', 'cls_multiline.d2'], 0,
     ['verdict: PASS (0 error(s)'], ['S-src-class']),
    ('--lint: Snowflake classes with no theme name the Snowflake import', ['--lint', 'cls_sf_none.d2'], 1,
     ['classes sf-datastore, sf-flow, sf-node are used but nothing defines them', '`...@snowflake-brand`'],
     ['@neutral-theme']),
    ('--lint: a theme class without the theme import names the import', ['--lint', 'cls_noimport.d2'], 1,
     ["'service' is a neutral-theme class, and nothing here imports that theme: put `...@neutral-theme`"],
     ["did you mean 'dep'"]),
    ('--lint: a comma-separated class name asks for ;', ['--lint', 'cls_comma.d2'], 1,
     ["'service, focal' is one name, not a list: separate classes with `;`: class: [service; focal]"], []),
    ('--lint: an import that is not there is a note, not a pass in silence', ['--lint', 'cls_unresolved.d2'], 1,
     ['note: classes not checked: the import `not-here-theme` (line 1) is not next to cls_unresolved.d2'], []),
    ('missing input is named, not compiled', ['--explain', 'no_such.d2'], 2, ['semcheck: no such file: no_such.d2'],
     ['failed to compile']),
    ('compare: missing new version is named', ['--compare', 'arch_good.d2', 'no_such.d2'], 2,
     ['semcheck: no such file: no_such.d2'], ['failed to compile']),
    ('dump: a steps file is type steps', ['--dump', 'steps_good.d2'], 0, ['type: steps'], []),
    ('dump: an upper-cased zone title takes the label case, not the key', ['--dump', 'dump_zone.d2'], 0,
     ['services: Services'], ['services: services', 'SERVICES']),
    ('dump: a two-line zone title keeps the source case of both lines', ['--dump', 'dump_zone2.d2'], 0,
     ['pub: Public 1a\\n10.0.1.0/24'], ['PUBLIC 1A']),
    ('--lint: a neutral shape role in a Snowflake file names the shape, not the neutral import',
     ['--lint', 'cls_sf_shape.d2'], 1,
     ["'decision' is a neutral-theme class with no snowflake-brand twin", 'shape: diamond',
      "'success' is a neutral-theme class with no snowflake-brand twin: drop it"], ['@neutral-theme']),
    ('--lint: a Snowflake-only class in a neutral file asks for a role class, not the Snowflake import',
     ['--lint', 'cls_neutral_accent.d2'], 1,
     ["'sf-accent-orange' is a snowflake-brand class with no neutral-theme twin"], ['@snowflake-brand']),
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
         'state_dump.d2', 'focus_zone_good.d2', 'uml_ends.d2', 'ghost.d2', 'seq_note.d2', 'dump_zone.d2']

MSG_MAX = 170       # d2lint --compact (the d2check listing) cuts each finding at 170 characters
D2_ENV = ('D2_LAYOUT', 'D2_THEME', 'D2_DARK_THEME', 'D2_PAD', 'D2_SKETCH', 'D2_CENTER', 'D2_WATCH', 'SCALE')
TEMPLATES = os.path.join(SKILL, 'templates')
RENDERED = {}       # d2 file -> (svg path or None, stderr): filled once, before the cases run


def run(argv, cwd=CASES, stdin=None):
    p = subprocess.run([sys.executable, CHECK] + argv, cwd=cwd, capture_output=True, text=True, input=stdin)
    return p.returncode, p.stdout + p.stderr


def render(d2file, tmp):
    out = os.path.join(tmp, os.path.basename(d2file)[:-3] + '.svg')
    env = {k: v for k, v in os.environ.items() if k not in D2_ENV}
    p = subprocess.run(['d2', '--scale', '1', d2file, out], cwd=CASES, capture_output=True, text=True, env=env)
    # d2 leaves an SVG behind even when bundling an icon fails: only exit 0 counts
    res = out if os.path.isfile(out) else out[:-4] if os.path.isdir(out[:-4]) else None
    return (res if p.returncode == 0 else None), p.stderr


def cached(d2file):
    """The one render of d2file shared by every case (made in main() before the cases run)."""
    return RENDERED.get(d2file) or (None, 'not pre-rendered')


def t_codeset(case):
    brief, d2, want = case
    svg, err = cached(d2)
    if not svg:
        return False, 'render failed: ' + err[-200:], set()
    code, out = run(['--json', brief, d2, '--svg', svg])
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
        res, err = cached(d2file)
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
    res, err = cached('focus_good.d2')
    if not res:
        return False, 'render failed: ' + err[-200:], set()
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


def t_nod2(_):
    env = dict(os.environ, PATH='/nonexistent')
    p = subprocess.run([sys.executable, CHECK, 'focus.brief', 'focus_good.d2'], cwd=CASES, capture_output=True,
                       text=True, env=env, timeout=60)
    out = p.stdout + p.stderr
    ok = p.returncode == 2 and 'd2 is not on PATH' in out and 'doctor.sh' in out and 'does not compile' not in out
    return ok, f'exit {p.returncode}: {out.strip()[:100]}', set()


def t_lint_box(_):
    svg, err = cached('cls_typo.d2')
    if not svg:
        return False, 'render failed: ' + err[-200:], set()
    code, out = run(['--lint', 'cls_typo.d2', '--svg', svg, '--json'])
    try:
        items = json.loads(out)['findings']
    except ValueError:
        return False, f'no JSON (exit {code}): {out[-300:]}', set()
    hit = next((i for i in items if "'datastor'" in i['message']), None)
    ok = code == 1 and hit is not None and hit.get('objects') == ['db'] and len(hit.get('box', [])) == 4
    return ok, f"exit {code}, objects {hit and hit.get('objects')}, box {hit and hit.get('box')}", \
        {i['code'] for i in items}


def t_lint_box_cylinder(_):
    svg, err = cached('cls_cyl.d2')
    if not svg:
        return False, 'render failed: ' + err[-200:], set()
    code, out = run(['--lint', 'cls_cyl.d2', '--svg', svg, '--json'])
    try:
        items = json.loads(out)['findings']
    except ValueError:
        return False, f'no JSON (exit {code}): {out[-300:]}', set()
    m = re.search(r'viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"', open(svg, encoding='utf-8').read())
    w, h = (float(m.group(1)), float(m.group(2))) if m else (0, 0)
    hit = next((i for i in items if "'focl'" in i['message']), None)
    b = (hit or {}).get('box') or []
    ok = code == 1 and hit is not None and hit.get('objects') == ['db'] and len(b) == 4 and \
        0 <= b[0] < b[2] <= w and 0 <= b[1] < b[3] <= h and "did you mean 'focal'?" in hit['message']
    return ok, f"exit {code}, box {b} in {w:.0f}x{h:.0f}", {i['code'] for i in items}


def t_templates(_):
    names = sorted(f for f in os.listdir(TEMPLATES) if f.endswith('.d2'))
    bad = []
    for f in names:
        code, out = run(['--lint', os.path.join(TEMPLATES, f)])
        if code != 0:
            bad.append(f"{f}: {out.strip().splitlines()[1:2]}")
    return not bad, f'{len(names)} templates lint clean' if not bad else '; '.join(bad), set()


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
            ('env', None, t_env), ('nod2', None, t_nod2), ('lintbox', None, t_lint_box), ('lintcyl', None, t_lint_box_cylinder),
            ('templates', None, t_templates)]

    def label(kind, c):
        if kind == 'codeset':
            return f'{c[1]} vs {c[0]}'
        if kind == 'run':
            return c[0]
        if kind in ('hint', 'dump'):
            return f'{kind} {c[0] if kind == "hint" else c}'
        return {'example': 'brief.md worked example == brief_example.* and checks clean',
                'speed': 'runtime with --svg', 'static': 'every emitted code is S- and in the contract',
                'env': 'D2_* environment overrides are ignored',
                'nod2': 'd2 missing from PATH is named as such, with the install and doctor.sh',
                'lintbox': '--lint --svg boxes the object that carries an unknown class',
                'lintcyl': '--lint --svg boxes a cylinder inside the canvas (path with V commands)',
                'templates': 'every shipped template passes --lint (no unknown class, engine pinned)'}[kind]
    jobs = [j for j in jobs if k in label(j[0], j[1])]
    t0 = time.time()
    need = sorted({c[1] for kind, c, _ in jobs if kind == 'codeset'} | {c for kind, c, _ in jobs if kind == 'dump'}
                  | ({'focus_good.d2'} if any(kind == 'speed' for kind, _, _ in jobs) else set())
                  | ({'cls_typo.d2'} if any(kind == 'lintbox' for kind, _, _ in jobs) else set())
                  | ({'cls_cyl.d2'} if any(kind == 'lintcyl' for kind, _, _ in jobs) else set()))
    tmp = tempfile.mkdtemp(prefix='semtests-')

    def prerender(d2file):          # one folder per file: board directories never collide
        out_dir = os.path.join(tmp, d2file[:-3])
        os.makedirs(out_dir)
        return render(d2file, out_dir)
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(2, os.cpu_count() or 2)) as ex:
            RENDERED.update(zip(need, ex.map(prerender, need)))
            futs = [(kind, c, ex.submit(fn, c)) for kind, c, fn in jobs]
            results = [(kind, c) + f.result() for kind, c, f in futs]
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
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
