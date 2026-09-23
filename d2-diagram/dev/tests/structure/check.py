#!/usr/bin/env python3
"""Structure check of the d2-diagram skill: the package holds together as shipped.

usage: python3 dev/tests/structure/check.py [--skill DIR] [-v]     (wrapper: sh check.sh)

  (a) SKILL.md frontmatter parses (PyYAML, else a regex fallback); name, description,
      a quoted string argument-hint and allowed-tools are present
  (b) every path and link in SKILL.md, README.md, dev/README.md, workflows/, playbooks/ and
      reference/ exists (placeholders like <type> match any file), every #anchor into a .md
      file names a real heading, and every `x.md section N` / `rule N` (or a file's own
      `section N`) names a numbered heading there; files outside dev/ never link into dev/
      (the zip has no dev/), and only README.md may name dev/ paths, as text
  (c) every runtime file (outside dev/) is reachable from SKILL.md through references
  (d) every code d2lint.py and semcheck.py can emit has a `### <CODE>` heading in
      workflows/review-and-fix.md, and every code heading is a code the scripts emit
  (e) ASCII tripwire: .md .d2 .sh .py .cjs .brief files outside dev/, and dev's own docs
  (f) SKILL.md is at most 170 lines and 9 KB
  (g) no file names a path deleted in the rewrite (PLAN section 3), and none of them exists
  (h) no __pycache__, .pyc, .DS_Store, __MACOSX or editor leftovers outside dev/
  (i) every class used in templates/ and in ```d2 blocks of the docs is defined by a theme
      or by the same file (class lists `[a; b]` included)
  (j) scripts parse (sh -n, python compile without writing bytecode) and carry a shebang
  (k) the commands SKILL.md and workflows/ tell the agent to run are covered by allowed-tools
  (l) templates are `d2 fmt` clean; workflows/route.md routes to every template (a cell in a
      `Template` column of its tables, or the file name), and every Template / Playbook cell
      names a file that exists
  (m) the post step is wired: scripts/svgpost.py exists, SKILL.md names it, d2check.sh calls it,
      and `python3 ${CLAUDE_SKILL_DIR}/scripts/svgpost.py` matches an allowed-tools pattern
  (n) no escape hatch: workflows/, reference/ and playbooks/ never call a finding "the honest
      shape" or say a layout change cannot fix it (a warning ships only when its recipe failed)
  (o) the recipe lookup reads whole recipes: the `-A N` grep context that SKILL.md and
      workflows/review-and-fix.md give is the same and covers the longest `### ` section
exit: 0 all checks pass (warnings allowed) | 1 a check failed | 2 usage error
"""
import argparse
import fnmatch
import glob
import os
import re
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
TOPS = ('workflows', 'playbooks', 'reference', 'templates', 'scripts', 'assets', 'dev')
TEXT_EXT = ('.md', '.d2', '.sh', '.py', '.cjs', '.brief', '.txt', '.json')
# PLAN section 3: paths removed by the rewrite (none may exist or be named again)
DELETED = """REVIEW.md output-contract.md checklists/preflight.md checklists/delivery.md
checklists/quality-gate.md examples/brand/snowflake-sample.d2
examples/composition/layers-scenarios-steps-linking.d2 examples/core/shapes-connections-containers.d2
examples/customization/themes-styles-positions-fonts.d2 examples/exports/ascii-safe.d2
examples/icons/remote-local-shape-image.d2 examples/imports/model-view-patterns.d2
examples/in-depth/vars-globs-overrides-legend.d2 examples/layouts/dagre-elk-tala.d2
examples/minimal/hello-world.d2 00-index.md 01-introduction.md 02-install-run-watch.md
03-core-basics.md 04-special-objects.md 05-customization.md 06-layouts.md 07-in-depth.md
08-composition.md 09-imports-patterns.md 10-extensions-ecosystem.md 11-api-cli-studio.md
12-exports.md 13-faq-troubleshooting.md 14-cheat-sheet-and-contributing.md 15-icon-library.md
16-snowflake-brand.md from-requirements.md edit-existing.md refactor-large.md
diagnose-and-recover.md watch-mode-loop.md export-publish.md icon-resolution.md sql-erd.d2
class-uml.d2 layers-scenarios-steps.d2 imported-template.d2 scripts/__pycache__""".split()
THEMES = ('neutral-theme.d2', 'snowflake-brand.d2')
CODE_RE = re.compile(r'["\']([EWIS]-[a-z0-9]+(?:-[a-z0-9]+)*)["\']')
PATH_RE = re.compile(r'(?:\$\{CLAUDE_SKILL_DIR\}/)?(?<![/\w.$-])((?:' + '|'.join(TOPS) +
                     r')/[A-Za-z0-9_.<>*{},/-]*[A-Za-z0-9_>*}/])')
MDNAME_RE = re.compile(r'(?<![/\w.<-])([A-Za-z0-9_-]+\.md)\b')
CODESPAN_RE = re.compile(r'`[^`]*`')
LINK_RE = re.compile(r'\[[^\]]*\]\(([^)\s]+)\)')
ANCHOR_RE = re.compile(r'\b([A-Za-z0-9_./-]+\.md)#([a-z0-9-]+)')


class Report:
    def __init__(self, verbose):
        self.verbose, self.failed, self.warned = verbose, [], []

    def check(self, tag, title, errors, warnings=(), note=''):
        status = 'FAIL' if errors else ('WARN' if warnings else 'PASS')
        print('%-4s (%s) %s%s' % (status, tag, title, (' - ' + note) if note else ''))
        for e in errors[:40]:
            print('       ' + e)
        if len(errors) > 40:
            print('       ... %d more' % (len(errors) - 40))
        for w in (warnings if (self.verbose or not errors) else [])[:20]:
            print('       warn: ' + w)
        if errors:
            self.failed.append(tag)
        if warnings:
            self.warned.append(tag)


def read(path):
    with open(path, encoding='utf-8', errors='replace') as fh:
        return fh.read()


def slug(heading):
    """GitHub's heading anchor: lower-case, drop punctuation except - and _, spaces to -."""
    h = re.sub(r'`', '', heading.strip().lower())
    h = re.sub(r'[^\w\- ]', '', h)
    return h.replace(' ', '-')


def headings(path):
    out, fence = set(), False
    for line in read(path).splitlines():
        if re.match(r'^\s*(```|~~~)', line):
            fence = not fence
        elif not fence and re.match(r'^#{1,6} ', line):
            out.add(slug(re.sub(r'^#{1,6} ', '', line)))
    return out


def runtime_files(skill):
    out = []
    for root, dirs, files in os.walk(skill):
        rel = os.path.relpath(root, skill)
        if rel == 'dev' or rel.startswith('dev' + os.sep) or '/.git' in root or rel.startswith('.git'):
            dirs[:] = []
            continue
        for f in files:
            out.append(os.path.normpath(os.path.join(rel, f)))
    return sorted(out)


def all_files(skill):
    out = []
    for root, dirs, files in os.walk(skill):
        dirs[:] = [d for d in dirs if d not in ('.git', 'dist')]
        for f in files:
            out.append(os.path.relpath(os.path.join(root, f), skill))
    return sorted(out)


def expand(pattern):
    """a/{b,c}/<x>.md -> glob patterns"""
    m = re.search(r'\{([^{}]*)\}', pattern)
    if m:
        return [p for alt in m.group(1).split(',') for p in expand(pattern[:m.start()] + alt + pattern[m.end():])]
    return [re.sub(r'<[^<>]*>', '*', pattern)]


def resolve(skill, token):
    """existing files/dirs (relative to the skill) a path token names; [] if none"""
    tok = token.rstrip('.,;:)')
    hits = []
    for pat in expand(tok):
        full = os.path.join(skill, pat)
        if any(c in pat for c in '*?['):
            hits += [os.path.relpath(p, skill) for p in glob.glob(full)]
        elif os.path.exists(full):
            hits.append(os.path.normpath(pat))
    return hits


def doc_files(skill):
    out = ['SKILL.md', 'README.md', 'dev/README.md']
    for d in ('workflows', 'playbooks', 'reference'):
        out += sorted(os.path.relpath(p, skill) for p in glob.glob(os.path.join(skill, d, '*.md')))
    return [f for f in out if os.path.isfile(os.path.join(skill, f))]


def strip_fences(text):
    """(line number, line, in-code-block, block language) for every line"""
    out, lang = [], None
    for n, line in enumerate(text.splitlines(), 1):
        m = re.match(r'^\s*(```|~~~)\s*([\w-]*)', line)
        if m:
            lang = None if lang is not None else (m.group(2) or 'text')
            out.append((n, line, True, lang))
            continue
        out.append((n, line, lang is not None, lang))
    return out


# ---------------------------------------------------------------------------------------------------
def check_a(skill, rep):
    errs, warns = [], []
    text = read(os.path.join(skill, 'SKILL.md'))
    m = re.match(r'^---\n(.*?)\n---\n', text, re.S)
    if not m:
        rep.check('a', 'SKILL.md frontmatter', ['no --- frontmatter block at the top of SKILL.md'])
        return {}
    raw = m.group(1)
    data, how = {}, 'regex'
    try:
        import yaml  # optional
        data = yaml.safe_load(raw) or {}
        how = 'yaml'
    except ImportError:
        for line in raw.splitlines():
            km = re.match(r'^([A-Za-z-]+):\s*(.*)$', line)
            if km:
                v = km.group(2)
                data[km.group(1)] = v[1:-1] if len(v) > 1 and v[0] == v[-1] and v[0] in '"\'' else v
    except Exception as e:  # yaml.YAMLError
        errs.append('frontmatter does not parse as YAML: %s' % str(e).splitlines()[0])
    if data.get('name') != 'd2-diagram':
        errs.append('name is %r, want d2-diagram' % data.get('name'))
    desc = data.get('description')
    if not isinstance(desc, str) or not desc.strip():
        errs.append('description missing')
    elif len(desc) > 1024:
        errs.append('description is %d characters (max 1024)' % len(desc))
    ah = data.get('argument-hint')
    if not isinstance(ah, str):
        errs.append('argument-hint is a %s, not a string: quote it' % type(ah).__name__)
    if not re.search(r'^argument-hint:\s*"', raw, re.M):
        errs.append('argument-hint must be written as a quoted string')
    if not isinstance(data.get('allowed-tools'), str) or not data.get('allowed-tools'):
        errs.append('allowed-tools missing')
    if '\t' in raw:
        errs.append('tab in the frontmatter')
    rep.check('a', 'frontmatter parses; argument-hint is a string', errs, warns, 'parsed with ' + how)
    return data


def check_b(skill, rep):
    errs = []
    anchors_cache = {}
    has_dev = os.path.isdir(os.path.join(skill, 'dev'))
    for rel in doc_files(skill):
        path = os.path.join(skill, rel)
        base = os.path.dirname(rel)
        shipped = not rel.startswith('dev/')  # the zip holds every file outside dev/, and no dev/
        for n, line, code, lang in strip_fences(read(path)):
            if code and lang not in ('sh', 'text', 'bash'):
                continue  # d2 blocks and brief examples hold example names, not repo paths
            reported = set()
            for target in LINK_RE.findall(CODESPAN_RE.sub('', line)):
                if re.match(r'^[a-z]+:', target) or target.startswith('#'):
                    continue
                file_part, _, anchor = target.partition('#')
                full = os.path.normpath(os.path.join(base, file_part))
                if shipped and (full == 'dev' or full.startswith('dev' + os.sep)):
                    errs.append('%s:%d: links into dev/, which the zip leaves out (name it as text): %s'
                                % (rel, n, target))
                    reported.add(os.path.normpath(file_part))
                elif not os.path.exists(os.path.join(skill, full)):
                    errs.append('%s:%d: link to a missing path: %s' % (rel, n, target))
                    reported.add(os.path.normpath(file_part))
                elif anchor and full.endswith('.md'):
                    hs = anchors_cache.setdefault(full, headings(os.path.join(skill, full)))
                    if anchor not in hs:
                        errs.append('%s:%d: no heading for #%s in %s' % (rel, n, anchor, full))
            for tok in PATH_RE.findall(line):
                if os.path.normpath(tok) in reported:
                    continue
                if tok.startswith('dev/dist/'):
                    continue  # build output: it exists only after dev/package.sh has run
                if shipped and tok.startswith('dev/'):
                    if rel != 'README.md':  # what the agent reads must not point at unshipped files
                        errs.append('%s:%d: names %s, but dev/ is not in the zip' % (rel, n, tok))
                        continue
                    if not has_dev:
                        continue  # the unpacked zip: README names source-tree files as text
                if not resolve(skill, tok):
                    errs.append('%s:%d: path does not exist: %s' % (rel, n, tok))
            for f, anchor in ANCHOR_RE.findall(line):
                target = f if '/' in f else None
                if not target:
                    continue
                target = re.sub(r'^\$\{CLAUDE_SKILL_DIR\}/', '', target)
                if anchor in ('code',) or not os.path.isfile(os.path.join(skill, target)):
                    continue
                hs = anchors_cache.setdefault(target, headings(os.path.join(skill, target)))
                if anchor not in hs:
                    errs.append('%s:%d: no heading for %s#%s' % (rel, n, target, anchor))
    # bare file names like `layout.md` must exist somewhere in the package
    names = {os.path.basename(f) for f in all_files(skill)}
    for rel in doc_files(skill):
        for n, line, code, lang in strip_fences(read(os.path.join(skill, rel))):
            if code and lang not in ('sh', 'text', 'bash'):
                continue
            for name in MDNAME_RE.findall(line):
                if '<' in name or name in names:
                    continue
                errs.append('%s:%d: names %s, which is not in the package' % (rel, n, name))
    # anchors the scripts print must exist too (d2check's fallback hint)
    rf = 'workflows/review-and-fix.md'
    if os.path.isfile(os.path.join(skill, rf)):
        hs = anchors_cache.setdefault(rf, headings(os.path.join(skill, rf)))
        for rel in ('scripts/d2check.sh', 'scripts/semcheck.py'):
            p = os.path.join(skill, rel)
            if os.path.isfile(p) and '#compile-and-command-errors' in read(p) and 'compile-and-command-errors' not in hs:
                errs.append('%s: links %s#compile-and-command-errors, which has no heading' % (rel, rf))
    for rel in ('scripts/d2check.sh', 'scripts/semcheck.py', 'scripts/d2lint.py'):
        p = os.path.join(skill, rel)
        if not os.path.isfile(p):
            continue
        for f, anchor in set(ANCHOR_RE.findall(read(p))):
            if anchor == 'code' or not os.path.isfile(os.path.join(skill, f)):
                continue
            if anchor not in anchors_cache.setdefault(f, headings(os.path.join(skill, f))):
                errs.append('%s: prints %s#%s, which has no heading' % (rel, f, anchor))
    errs += section_refs(skill)
    rep.check('b', 'every referenced path, anchor, section and rule exists', sorted(set(errs)))


SEC_RE = re.compile(r'(?P<doc>(?:\$\{CLAUDE_SKILL_DIR\}/)?[\w/-]*[\w-]+\.md)`?[):,]*\s+(?:\w+\s+){0,6}?'
                    r'(?P<kind>sections?|rules?)\s+(?P<nums>\d+(?:\s*(?:-|,|and|to)\s*\d+)*)')
OWN_RE = re.compile(r'(?<![\w.])(?P<kind>[Ss]ections?|rules?)\s+(?P<nums>\d+(?:\s*(?:-|,|and)\s*\d+)*)')


def outline(path):
    """numbers of a doc's sections (`## N.`) and rules (`### N.` or `**N.`), fences skipped"""
    secs, rules, fence = set(), set(), False
    for line in read(path).splitlines():
        if line.startswith('```'):
            fence = not fence
            continue
        m = re.match(r'^(#{2,6})\s+(\d+)\.', line) if not fence else None
        if m:
            (secs if len(m.group(1)) == 2 else rules).add(int(m.group(2)))
        b = re.match(r'^\*\*(\d+)\.', line) if not fence else None
        if b:
            rules.add(int(b.group(1)))
    return secs, rules


def section_refs(skill):
    """`playbooks/change.md section 3`, `rule 8`, `(section 7)`: the numbered heading must exist. Prose is
    read by paragraph, so a reference that wraps a line is still seen; d2 files: their comments."""
    def nums_of(t):
        out = []
        for part in t.replace('and', ',').replace('to', '-').split(','):
            part = part.strip()
            if '-' in part:
                a, b = part.split('-', 1)
                out += list(range(int(a), int(b) + 1))
            elif part:
                out.append(int(part))
        return out

    def locate(cur, ref):
        ref = ref.replace('${CLAUDE_SKILL_DIR}/', '').strip('`')
        for cand in (ref, os.path.normpath(os.path.join(os.path.dirname(cur), ref))):
            if os.path.isfile(os.path.join(skill, cand)):
                return cand
        if '/' not in ref:
            for d in (os.path.dirname(cur), 'reference', 'workflows', 'playbooks', ''):
                if os.path.isfile(os.path.join(skill, d, ref)):
                    return os.path.join(d, ref) if d else ref
        return None

    errs, cache = [], {}
    files = [f for f in all_files(skill) if f.endswith(('.md', '.d2')) and not f.startswith('dev/')]
    for rel in sorted(files):
        text = read(os.path.join(skill, rel))
        if rel.endswith('.d2'):
            paras = [(n, l) for n, l in enumerate(text.splitlines(), 1) if l.lstrip().startswith('#')]
        else:
            paras, buf, start, fence = [], [], 1, False
            for n, line in enumerate(text.splitlines() + [''], 1):
                if line.startswith('```') or not line.strip():
                    if buf:
                        paras.append((start, ' '.join(buf)))
                        buf = []
                    fence = fence != line.startswith('```')
                    continue
                if fence:
                    continue
                if not buf:
                    start = n
                buf.append(line.strip())
        own = cache.setdefault(rel, outline(os.path.join(skill, rel)))
        for n, para in paras:
            spans = []
            for m in SEC_RE.finditer(para):
                spans.append((m.start('kind'), m.end('nums')))
                doc = locate(rel, m.group('doc'))
                if not doc:
                    continue        # a missing file is reported by the path check above
                o = cache.setdefault(doc, outline(os.path.join(skill, doc)))
                have = o[1] if m.group('kind').startswith('rule') else o[0]
                for k in nums_of(m.group('nums')):
                    if k not in have:
                        errs.append('%s:%d: %s has no %s %d ("%s")' % (rel, n, doc, m.group('kind').rstrip('s'), k,
                                                                       m.group(0)[:60]))
            for m in OWN_RE.finditer(para):
                if any(a <= m.start('kind') < b for a, b in spans):
                    continue
                have = own[1] if m.group('kind').lower().startswith('rule') else own[0]
                for k in nums_of(m.group('nums')):
                    if k not in have:
                        errs.append('%s:%d: no %s %d in this file ("...%s")' % (
                            rel, n, m.group('kind').lower().rstrip('s'), k, para[max(0, m.start() - 40):m.end()]))
    return errs


def refs_in(skill, rel, text):
    """files a text file references: markdown links, skill paths, and names of sibling files"""
    found = set()
    base = os.path.dirname(rel)
    for target in LINK_RE.findall(CODESPAN_RE.sub('', text)):
        if re.match(r'^[a-z]+:', target) or target.startswith('#'):
            continue
        full = os.path.normpath(os.path.join(base, target.partition('#')[0]))
        found.add(full)
    for tok in PATH_RE.findall(text):
        found.update(resolve(skill, tok))
    return found


def check_c(skill, rep):
    runtime = runtime_files(skill)
    rset = set(runtime)
    by_base = {}
    for f in runtime:
        by_base.setdefault(os.path.basename(f), []).append(f)
        stem = os.path.splitext(os.path.basename(f))[0]
        if f.startswith('scripts/'):
            by_base.setdefault(stem, []).append(f)
    seen, todo = set(), ['SKILL.md']
    while todo:
        rel = todo.pop()
        if rel in seen:
            continue
        seen.add(rel)
        path = os.path.join(skill, rel)
        if not os.path.isfile(path) or not rel.endswith(TEXT_EXT):
            continue
        text = read(path)
        hits = set()
        for ref in refs_in(skill, rel, text):
            full = os.path.join(skill, ref)
            if os.path.isdir(full):
                hits.update(f for f in runtime if f.startswith(ref.rstrip('/') + '/'))
            elif ref in rset:
                hits.add(ref)
        # bare names: a sibling file, or a unique name anywhere in the package
        for word in set(re.findall(r'[A-Za-z0-9_.-]+', text)):
            for f in by_base.get(word, []):
                if os.path.dirname(f) == os.path.dirname(rel) or len(by_base[word]) == 1:
                    hits.add(f)
        # a template's `...@neutral-theme` import
        for imp in re.findall(r'\.\.\.@([A-Za-z0-9_.-]+)', text):
            cand = os.path.normpath(os.path.join(os.path.dirname(rel), imp + '.d2'))
            if cand in rset:
                hits.add(cand)
        todo.extend(sorted(hits - seen))
    unreachable = [f for f in runtime if f not in seen]
    rep.check('c', 'every runtime file is reachable from SKILL.md',
              ['not reachable: ' + f for f in unreachable], note='%d runtime files' % len(runtime))


def emitted_codes(skill):
    codes = set()
    for rel in ('scripts/d2lint.py', 'scripts/semcheck.py'):
        p = os.path.join(skill, rel)
        if os.path.isfile(p):
            codes.update(CODE_RE.findall(read(p)))
    return codes


def check_d(skill, rep):
    rf = os.path.join(skill, 'workflows/review-and-fix.md')
    codes = emitted_codes(skill)
    if not os.path.isfile(rf):
        rep.check('d', 'a recipe heading for every finding code', ['workflows/review-and-fix.md is missing'])
        return
    heads = set(re.findall(r'^### ([EWIS]-[a-z0-9-]+)\s*$', read(rf), re.M))
    errs = ['no `### %s` heading' % c for c in sorted(codes - heads)]
    warns = ['heading `### %s` names a code no script emits' % c for c in sorted(heads - codes)]
    lint = len([c for c in codes if not c.startswith('S-')])
    rep.check('d', 'a recipe heading for every finding code', errs, warns,
              '%d codes (%d d2lint, %d semcheck), %d headings' % (len(codes), lint, len(codes) - lint, len(heads)))


def check_e(skill, rep):
    errs = []
    files = [f for f in runtime_files(skill) if f.endswith(('.md', '.d2', '.sh', '.py', '.cjs', '.brief'))]
    files += [f for f in ('dev/README.md', 'dev/CHANGELOG.md') if os.path.isfile(os.path.join(skill, f))]
    for rel in files:
        with open(os.path.join(skill, rel), 'rb') as fh:
            for n, line in enumerate(fh.read().split(b'\n'), 1):
                bad = [b for b in line if b < 32 or b > 126]
                if bad:
                    errs.append('%s:%d: %s' % (rel, n, 'tab' if bad[0] == 9 else 'byte 0x%02X' % bad[0]))
    rep.check('e', 'ASCII tripwire (no tabs, no non-ASCII)', errs, note='%d files' % len(files))


def check_f(skill, rep):
    raw = open(os.path.join(skill, 'SKILL.md'), 'rb').read()
    lines, size = raw.count(b'\n'), len(raw)
    errs = []
    if lines > 170:
        errs.append('SKILL.md has %d lines (max 170)' % lines)
    if size > 9 * 1024:
        errs.append('SKILL.md is %d bytes (max %d)' % (size, 9 * 1024))
    rep.check('f', 'SKILL.md size', errs, note='%d lines, %d bytes' % (lines, size))


def check_g(skill, rep):
    errs = []
    for p in DELETED:
        hits = glob.glob(os.path.join(skill, '**', p), recursive=True) + glob.glob(os.path.join(skill, p))
        for h in sorted(set(hits)):
            errs.append('still present: ' + os.path.relpath(h, skill))
    skip = ('dev/CHANGELOG.md', 'dev/tests/structure/')
    for rel in all_files(skill):
        if rel.startswith(skip) or not rel.endswith(TEXT_EXT) or '/dist/' in rel:
            continue
        text = read(os.path.join(skill, rel))
        for p in DELETED:
            if re.search(r'(?<![\w-])' + re.escape(p) + r'(?![\w-])', text):
                errs.append('%s names deleted path %s' % (rel, p))
    rep.check('g', 'no deleted path exists or is referenced', sorted(set(errs)),
              note='dev/CHANGELOG.md may name them as history')


def check_h(skill, rep):
    errs, warns = [], []
    bad = re.compile(r'(^|/)(__pycache__|__MACOSX|\.DS_Store)(/|$)|\.pyc$|~$|\.swp$|\.orig$|\.rej$|\.bak$')
    for root, dirs, files in os.walk(skill):
        dirs[:] = [d for d in dirs if d != '.git']
        for name in dirs + files:
            rel = os.path.relpath(os.path.join(root, name), skill)
            if bad.search(rel):
                (warns if rel.startswith('dev/') else errs).append(rel)
    rep.check('h', 'no __pycache__, .pyc, .DS_Store or editor leftovers', sorted(set(errs)), sorted(set(warns)))


def class_block_keys(text):
    """class names defined in `classes: {...}` blocks (single- or multi-line)"""
    names = set()
    for m in re.finditer(r'(^|[\s{;])classes\s*:\s*\{', text):
        i, depth, start = m.end(), 1, m.end()
        while i < len(text) and depth:
            depth += {'{': 1, '}': -1}.get(text[i], 0)
            i += 1
        body = text[start:i - 1]
        d, token = 0, ''
        for ch in body:
            if ch == '{':
                if d == 0:
                    key = re.search(r'([A-Za-z0-9_-]+)\s*:?\s*$', token)
                    if key:
                        names.add(key.group(1))
                d += 1
                token = ''
            elif ch == '}':
                d -= 1
                token = ''
            elif d == 0:
                token = '' if ch in ';\n' else token + ch
    return names


def classes_used(text):
    used = []
    for n, line in enumerate(text.splitlines(), 1):
        code = re.sub(r'(^|\s)#.*$', '', line)
        for m in re.finditer(r'(?:^|[\s{;.])class\s*:\s*(\[[^\]]*\]|[A-Za-z0-9_-]+)', code):
            v = m.group(1)
            for name in (re.split(r'\s*;\s*', v[1:-1]) if v.startswith('[') else [v]):
                if name and name != 'null':
                    used.append((n, name.strip()))
    return used


def check_i(skill, rep):
    errs = []
    theme = set()
    for t in THEMES:
        p = os.path.join(skill, 'templates', t)
        if os.path.isfile(p):
            theme |= class_block_keys(read(p))
    if not theme:
        rep.check('i', 'classes used are defined', ['no theme classes found in templates/'])
        return
    units = []
    for p in sorted(glob.glob(os.path.join(skill, 'templates', '*.d2'))):
        if os.path.basename(p) not in THEMES:
            units.append((os.path.relpath(p, skill), 0, read(p)))
    for rel in doc_files(skill):
        block, start, lang = [], 0, None
        for n, line, code, lg in strip_fences(read(os.path.join(skill, rel))):
            if code and lg in ('d2', 'd2-bad') and not re.match(r'^\s*(```|~~~)', line):
                block.append(line)
                lang = lg
                start = start or n
            elif block:
                if lang == 'd2':
                    units.append((rel, start - 1, '\n'.join(block)))
                block, start = [], 0
    n_used = 0
    for rel, off, text in units:
        local = class_block_keys(text)
        for n, name in classes_used(text):
            n_used += 1
            if name not in theme and name not in local:
                errs.append('%s:%d: class %s is not defined by a theme or the file' % (rel, off + n, name))
    rep.check('i', 'every class used is defined (class lists parsed)', errs,
              note='%d uses in %d files/snippets, %d theme classes' % (n_used, len(units), len(theme)))


def check_j(skill, rep):
    errs, warns = [], []
    for p in sorted(glob.glob(os.path.join(skill, 'scripts', '*'))):
        rel = os.path.relpath(p, skill)
        if os.path.isdir(p):
            continue
        text = read(p)
        if p.endswith('.sh'):
            r = subprocess.run(['sh', '-n', p], capture_output=True, text=True)
            if r.returncode:
                errs.append('%s: sh -n: %s' % (rel, r.stderr.strip().splitlines()[0] if r.stderr else 'failed'))
        elif p.endswith('.py'):
            try:
                compile(text, p, 'exec')
            except SyntaxError as e:
                errs.append('%s:%s: %s' % (rel, e.lineno, e.msg))
        elif p.endswith('.cjs'):
            if subprocess.run(['sh', '-c', 'command -v node'], capture_output=True).returncode == 0:
                r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
                if r.returncode:
                    errs.append('%s: node --check failed' % rel)
            continue
        if p.endswith(('.sh', '.py')) and not text.startswith('#!'):
            errs.append('%s: no shebang line' % rel)
        if p.endswith('.sh') and not os.access(p, os.X_OK):
            warns.append('%s: no exec bit in the tree (dev/package.sh sets it; docs call it with sh)' % rel)
    rep.check('j', 'scripts parse and carry a shebang', errs, warns)


def allowed_patterns(front):
    tools = front.get('allowed-tools') or ''
    pats = re.findall(r'Bash\(([^)]*)\)', tools)
    return [p.replace('${CLAUDE_SKILL_DIR}', '${CLAUDE_SKILL_DIR}') for p in pats]


def check_k(skill, rep, front):
    pats = allowed_patterns(front)
    errs, warns = [], []
    starts = ('sh ', 'python3 ', 'node ', 'd2 ', 'cp ', 'mkdir ', 'ls ', 'chmod ', 'nohup ', 'kill ',
              'find ', 'npm ', 'npx ', 'curl ', 'unset ', 'rm ', 'mv ', 'cat ', 'env ')
    files = ['SKILL.md'] + sorted(os.path.relpath(p, skill) for p in glob.glob(os.path.join(skill, 'workflows', '*.md')))
    files += sorted(os.path.relpath(p, skill) for p in glob.glob(os.path.join(skill, 'reference', '*.md')))
    files += sorted(os.path.relpath(p, skill) for p in glob.glob(os.path.join(skill, 'playbooks', '*.md')))
    for rel in files:
        flow = rel == 'SKILL.md' or rel.startswith('workflows/')
        cmds = []
        for n, line, code, lang in strip_fences(read(os.path.join(skill, rel))):
            if code and lang in ('sh', 'bash') and not re.match(r'^\s*(```|~~~)', line):
                cmds.append((n, line.split(' #')[0].strip()))
            elif not code:
                cmds += [(n, c) for c in re.findall(r'`([^`]+)`', line) if c.startswith(starts)]
        for n, cmd in cmds:
            for seg in re.split(r'\s*(?:&&|\|\||;|\|)\s*', cmd):
                seg = seg.strip().lstrip('(').strip()
                if not seg or not seg.startswith(starts) or seg.startswith(('cat ', 'env ')):
                    continue
                if not any(fnmatch.fnmatchcase(seg, p) for p in pats):
                    (errs if flow else warns).append('%s:%d: not pre-approved: %s' % (rel, n, seg[:90]))
    rep.check('k', 'allowed-tools covers the commands the flow runs', sorted(set(errs)), sorted(set(warns)),
              '%d Bash patterns; reference/ and playbooks/ gaps are warnings' % len(pats))


def check_m(skill, rep, front):
    errs = []
    post = os.path.join(skill, 'scripts', 'svgpost.py')
    if not os.path.isfile(post):
        errs.append('scripts/svgpost.py is missing (d2check\'s post step)')
    else:
        if not read(post).startswith('#!'):
            errs.append('scripts/svgpost.py has no shebang line')
        if 'svgpost.py' not in read(os.path.join(skill, 'SKILL.md')):
            errs.append('SKILL.md does not name svgpost.py (Where things live)')
        chk = os.path.join(skill, 'scripts', 'd2check.sh')
        if os.path.isfile(chk) and 'svgpost.py' not in read(chk):
            errs.append('scripts/d2check.sh never calls svgpost.py')
        call = 'python3 ${CLAUDE_SKILL_DIR}/scripts/svgpost.py --help'
        if not any(fnmatch.fnmatchcase(call, p) for p in allowed_patterns(front)):
            errs.append('allowed-tools has no pattern for: ' + call)
    rep.check('m', 'the post step (svgpost.py) is shipped, named, called and pre-approved', errs)


HATCH_RE = re.compile(r'honest\s+shape|no\s+layout\s+change\s+(fixes|removes|clears)|list\s+it\s+under\s+Open', re.I)


def check_n(skill, rep):
    errs = []
    for d in ('workflows', 'reference', 'playbooks'):
        for p in sorted(glob.glob(os.path.join(skill, d, '*.md'))):
            rel = os.path.relpath(p, skill)
            # read by paragraph, so a phrase that wraps a line is still seen
            text = re.sub(r'\s+', ' ', read(p))
            lines = read(p).splitlines()
            for m in HATCH_RE.finditer(text):
                words = m.group(0).split()[0]
                n = next((i for i, l in enumerate(lines, 1) if words.lower() in l.lower()), 0)
                errs.append('%s:%d: escape hatch "%s": a warning ships only when its recipe was tried and failed'
                            % (rel, n, m.group(0)))
    rep.check('n', 'no escape-hatch wording in the recipes and playbooks', errs)


def check_o(skill, rep):
    errs, found = [], {}
    rf = os.path.join(skill, 'workflows', 'review-and-fix.md')
    for rel, pat in (('SKILL.md', r'`\^### <CODE>` with `-A (\d+)`'), ('workflows/review-and-fix.md', r'`-A (\d+)`')):
        path = os.path.join(skill, rel)
        m = re.search(pat, read(path)) if os.path.isfile(path) else None
        if m:
            found[rel] = int(m.group(1))
        else:
            errs.append('%s gives no `-A N` context for the recipe lookup' % rel)
    if len(set(found.values())) > 1:
        errs.append('the grep context differs: %s' % ', '.join('%s -A %d' % kv for kv in sorted(found.items())))
    longest, name = 0, ''
    if os.path.isfile(rf):
        cur, body = None, []
        for n, line, code, _ in strip_fences(read(rf)) + [(0, '## end', False, None)]:
            if not code and re.match(r'^#{2,3} ', line):
                if cur is not None:
                    while body and not body[-1].strip():
                        body.pop()
                    if len(body) > longest:
                        longest, name = len(body), cur
                cur = line[4:].strip() if line.startswith('### ') else None
                body = []
            elif cur is not None:
                body.append(line)
    if found and longest > min(found.values()):
        errs.append('`-A %d` cuts the longest recipe, `### %s` (%d lines): raise N in SKILL.md and '
                    'review-and-fix.md, or shorten the recipe' % (min(found.values()), name, longest))
    rep.check('o', 'the recipe grep context covers every recipe - -A %s, longest `### %s` %d lines'
              % ('/'.join(str(v) for v in sorted(set(found.values()))) or '?', name, longest), errs)


def check_l(skill, rep):
    errs, warns = [], []
    tpls = sorted(p for p in glob.glob(os.path.join(skill, 'templates', '*.d2')))
    have_d2 = subprocess.run(['sh', '-c', 'command -v d2'], capture_output=True).returncode == 0
    if not have_d2:
        warns.append('d2 not on PATH: fmt check skipped')
    else:
        env = {k: v for k, v in os.environ.items() if not re.match(r'^(D2_|SCALE$)', k)}
        for p in tpls:
            r = subprocess.run(['d2', 'fmt', '--check', p], capture_output=True, text=True, env=env)
            if r.returncode:
                errs.append('%s is not d2 fmt clean' % os.path.relpath(p, skill))
    route = os.path.join(skill, 'workflows', 'route.md')
    if os.path.isfile(route):
        text = read(route)
        cells = route_table(text)
        routed = {v for col, v, n in cells if col == 'template'}
        for p in tpls:
            name = os.path.basename(p)
            if name in THEMES or name[:-3] in routed:
                continue
            if not re.search(r'(?<![\w-])' + re.escape(name) + r'(?![\w-])', text):
                errs.append('workflows/route.md routes no request to templates/%s (no Template cell `%s`, no '
                            'file name)' % (name, name[:-3]))
        missing = {}
        for col, v, n in cells:
            where = 'playbooks/%s.md' % v if col == 'playbook' else 'templates/%s.d2' % v
            if not os.path.isfile(os.path.join(skill, where)):
                missing.setdefault(where, []).append(str(n))
        for where, lines in sorted(missing.items()):
            errs.append('workflows/route.md routes to %s, which does not exist (line %s)' % (where, ', '.join(lines)))
    else:
        errs.append('workflows/route.md is missing (the router SKILL.md step 1 opens)')
    rep.check('l', 'templates fmt-clean and routed', errs, warns, '%d templates' % len(tpls))


def route_table(text):
    """(column, value, line) for every cell under a `Template` or `Playbook` header in route.md's tables;
    a cell may hold `name`, `name.d2`, `templates/name.d2` or `playbooks/name.md`, several split by , or +"""
    out, cols = [], {}
    for n, line in enumerate(text.splitlines(), 1):
        if not line.startswith('|'):
            cols = {}
            continue
        row = [c.strip() for c in line.strip().strip('|').split('|')]
        if not cols:
            cols = {i: h.lower() for i, h in enumerate(row) if h.lower() in ('template', 'templates', 'playbook')}
            continue
        if all(re.match(r'^:?-+:?$', c) for c in row if c):
            continue
        for i, col in cols.items():
            if i >= len(row):
                continue
            for v in re.split(r'\s*[,+]\s*', row[i].replace('`', '')):
                v = re.sub(r'^(templates|playbooks)/', '', v.strip())
                v = re.sub(r'\.(d2|md)$', '', v)
                if re.match(r'^[a-z0-9][a-z0-9-]*$', v):
                    out.append(('playbook' if col == 'playbook' else 'template', v, n))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--skill', default=os.path.normpath(os.path.join(HERE, '..', '..', '..')))
    ap.add_argument('-v', '--verbose', action='store_true', help='print warnings of failed checks too')
    a = ap.parse_args()
    skill = os.path.abspath(a.skill)
    if not os.path.isfile(os.path.join(skill, 'SKILL.md')):
        print('check: no SKILL.md in %s' % skill, file=sys.stderr)
        return 2
    rep = Report(a.verbose)
    print('structure check of %s' % skill)
    front = check_a(skill, rep)
    check_b(skill, rep)
    check_c(skill, rep)
    check_d(skill, rep)
    check_e(skill, rep)
    check_f(skill, rep)
    check_g(skill, rep)
    check_h(skill, rep)
    check_i(skill, rep)
    check_j(skill, rep)
    check_k(skill, rep, front)
    check_l(skill, rep)
    check_m(skill, rep, front)
    check_n(skill, rep)
    check_o(skill, rep)
    n = 15
    print('structure: %d/%d checks pass%s%s' % (
        n - len(rep.failed), n, (', failed: ' + ' '.join(rep.failed)) if rep.failed else '',
        (', warnings: ' + ' '.join(rep.warned)) if rep.warned else ''))
    return 1 if rep.failed else 0


if __name__ == '__main__':
    sys.exit(main())
