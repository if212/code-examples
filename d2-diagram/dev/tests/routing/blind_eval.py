#!/usr/bin/env python3
"""Blind routing eval for workflows/route.md (dev only, not packaged).

A fresh `claude -p` session - no tools, no skills, no CLAUDE.md, an empty working dir - gets
ONLY the routing document and numbered requests, and answers template + call for each. The
answers are scored against each case's expected template (or a pre-registered alternate)
and call. Protocol and data sets: README.md next to this file.

usage: python3 blind_eval.py CASES.json ROUTE.md [options]
  --per-request   one fresh session per request (default: one session for all requests)
  --jobs N        parallel sessions in --per-request mode (default 6)
  --out DIR       results dir (default: a new temp dir; its path is printed)
  --gate T,C      exit 1 unless at least T templates and C calls are right (e.g. 27,25)
  --model M       model for the sessions (default: the CLI default)
  --answers F     score saved answers (a JSON list of {id, template, call}) instead of
                  calling claude: re-scoring, or answers from a subagent given prompt.txt
exit: 0 scored (and the gate met), 1 gate missed, 2 usage or CLI error
"""
import argparse
import concurrent.futures as cf
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

PROMPT = """You are the routing step of a diagram skill. Apply the routing document below to each
request. For each request answer the template name exactly as written in the Template
column (or EDIT or OUT), and the call: GO (draw now), ASK (one question first), SPLIT
(several diagrams; give the template of the FIRST one) or OUT/EDIT. Assume there is no
repository or conversation context beyond the request text.

Return ONLY a JSON array of objects {{"id": ..., "template": ..., "call": ...}}, no prose.

=== ROUTING DOCUMENT ===
{route}
=== REQUESTS ===
{reqs}
"""


def die(msg, code=2):
    print('blind_eval: ' + msg, file=sys.stderr)
    sys.exit(code)


def isolation_flags():
    """Flags that keep the session blind, when this CLI knows them."""
    try:
        h = subprocess.run(['claude', '--help'], capture_output=True, text=True, timeout=60).stdout
    except (OSError, subprocess.TimeoutExpired) as e:
        die('the claude CLI is not usable (%s): give prompt.txt to a fresh subagent and '
            'score its reply with --answers' % e)
    flags = ['--tools', '', '--no-session-persistence', '--output-format', 'text']
    for f in ('--safe-mode', '--disable-slash-commands'):
        if f in h:
            flags.append(f)
    return flags


def parse_answers(txt):
    m = re.search(r'\[.*\]', txt, re.S)
    if m:
        try:
            return {str(a.get('id')): a for a in json.loads(m.group(0)) if isinstance(a, dict)}
        except ValueError:
            pass
    ans = {}
    for obj in re.findall(r'\{[^{}]*\}', txt):
        try:
            a = json.loads(obj)
        except ValueError:
            continue
        if isinstance(a, dict) and 'id' in a:
            ans[str(a['id'])] = a
    return ans


def ask(prompt, flags, model, cwd, timeout):
    cmd = ['claude', '-p', prompt] + flags + (['--model', model] if model else [])
    last = ''
    for _ in range(2):  # one retry: a CLI hiccup is not a routing miss
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd)
            last = r.stdout + ('\n[stderr] ' + r.stderr if r.stderr.strip() else '')
            if r.returncode == 0 and parse_answers(r.stdout):
                return r.stdout
        except subprocess.TimeoutExpired:
            last = '[timeout after %ss]' % timeout
    return last


def main():
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument('cases')
    ap.add_argument('route')
    ap.add_argument('--per-request', action='store_true')
    ap.add_argument('--jobs', type=int, default=6)
    ap.add_argument('--out')
    ap.add_argument('--gate')
    ap.add_argument('--model')
    ap.add_argument('--answers')
    ap.add_argument('-h', '--help', action='store_true')
    if any(a in ('-h', '--help') for a in sys.argv[1:]):
        print(__doc__.strip())
        return 0
    a = ap.parse_args()
    try:
        cases = json.load(open(a.cases))
        route = open(a.route).read()
    except (OSError, ValueError) as e:
        die('cannot read input: %s' % e)
    gate = None
    if a.gate:
        try:
            gate = tuple(int(x) for x in a.gate.split(','))
            assert len(gate) == 2
        except (ValueError, AssertionError):
            die('--gate wants T,C (templates,calls), e.g. --gate 27,25')
    out = a.out or tempfile.mkdtemp(prefix='route-eval.')
    os.makedirs(os.path.join(out, 'raw'), exist_ok=True)
    name = os.path.splitext(os.path.basename(a.cases))[0]
    mode = 'answers' if a.answers else ('per-request' if a.per_request else 'one-session')
    reqs = '\n'.join('%s: %s' % (c['id'], c['request']) for c in cases)
    open(os.path.join(out, 'prompt.txt'), 'w').write(PROMPT.format(route=route, reqs=reqs))

    if a.answers:
        ans = parse_answers(open(a.answers).read())
    else:
        if not shutil.which('claude'):
            die('no claude CLI on PATH: give %s to a fresh subagent, save its reply, then '
                're-run with --answers <reply>' % os.path.join(out, 'prompt.txt'))
        flags = isolation_flags()
        blank = tempfile.mkdtemp(prefix='route-blank.')  # no CLAUDE.md, no repo around it
        if a.per_request:
            def one(c):
                p = PROMPT.format(route=route, reqs='%s: %s' % (c['id'], c['request']))
                return c['id'], ask(p, flags, a.model, blank, 300)
            with cf.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as ex:
                raws = dict(ex.map(one, cases))
            ans = {}
            for cid, txt in raws.items():
                open(os.path.join(out, 'raw', '%s.txt' % cid), 'w').write(txt)
                got = parse_answers(txt)
                if cid in got:
                    ans[cid] = got[cid]
                elif len(got) == 1:  # the id was echoed differently
                    ans[cid] = list(got.values())[0]
        else:
            txt = ask(PROMPT.format(route=route, reqs=reqs), flags, a.model, blank, 900)
            open(os.path.join(out, 'raw', 'all.txt'), 'w').write(txt)
            ans = parse_answers(txt)
        shutil.rmtree(blank, ignore_errors=True)

    lines, ok_t, ok_c, rows = [], 0, 0, []
    for c in cases:
        g = ans.get(c['id'], {'template': '?', 'call': '?'})
        t, cl = str(g.get('template', '?')), str(g.get('call', '?')).upper()
        call = c.get('call', 'GO')
        good = t == c['expect'] or t in c.get('alt', [])
        goodc = cl == call or cl in c.get('altcall', []) or (t in ('EDIT', 'OUT') and call in ('EDIT', 'OUT'))
        ok_t += good
        ok_c += goodc
        rows.append({'id': c['id'], 'expect': c['expect'], 'call': call, 'got': t, 'got_call': cl,
                     'template_ok': good, 'call_ok': goodc})
        lines.append('%s %s%s expect %s/%s got %s/%s | %s' % (
            'ok  ' if good else 'MISS', '   ' if goodc else 'c! ', c['id'], c['expect'], call, t, cl,
            c['request'][:70]))
    n = len(cases)
    summary = 'template %d/%d (%d%%), call %d/%d (%d%%)' % (ok_t, n, round(100 * ok_t / n), ok_c, n,
                                                             round(100 * ok_c / n))
    sha = hashlib.sha1(route.encode()).hexdigest()
    head = '%s: %s, route.md sha1 %s' % (name, mode, sha[:12])
    verdict = ''
    if gate:
        passed = ok_t >= gate[0] and ok_c >= gate[1]
        verdict = 'gate %d/%d templates, %d/%d calls: %s' % (gate[0], n, gate[1], n, 'PASS' if passed else 'FAIL')
    report = '\n'.join([head] + lines + [summary] + ([verdict] if verdict else [])) + '\n'
    open(os.path.join(out, name + '.' + mode + '.txt'), 'w').write(report)
    json.dump({'cases': a.cases, 'route_sha1': sha, 'mode': mode, 'templates_ok': ok_t, 'calls_ok': ok_c,
               'n': n, 'gate': gate, 'rows': rows, 'answers': ans},
              open(os.path.join(out, name + '.' + mode + '.json'), 'w'), indent=1)
    sys.stdout.write(report)
    print('results: %s' % out)
    return 1 if gate and not (ok_t >= gate[0] and ok_c >= gate[1]) else 0


if __name__ == '__main__':
    sys.exit(main())
