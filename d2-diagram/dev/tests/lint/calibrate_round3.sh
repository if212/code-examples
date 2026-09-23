#!/bin/sh
# calibrate_round3.sh - the lint against the round-3 deliverables: every blind spot the round-3 judges
# measured (spine drift, tier doglegs, ragged operands, labels on lifelines, towers, voids, half-empty
# zones) must now be reported, the false error must not be, and svgpost must clear what it promises to
# fix (labels on bends and lifelines, on a copy). One row per deliverable (FIXPLAN section 3, FX1).
# usage: sh dev/tests/lint/calibrate_round3.sh DIR
#   DIR/<id>/ holds the deliverable <name>.svg and <name>.d2, and d2work/<name>/<name>.brief with the
#   round-3 lint report <name>.lint.json beside it (the layout of the round-3 evaluation folder)
# exit: 0 every row holds | 1 a row fails or a deliverable is missing | 64 usage
set -u
PYTHONDONTWRITEBYTECODE=1  # no __pycache__ in the skill's scripts/ (B57)
export PYTHONDONTWRITEBYTECODE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
case ${1:-} in
  -h | --help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  '') echo "usage: sh $0 DIR   (the round-3 deliverables: DIR/<id>/*.svg)" >&2; exit 64 ;;
esac
[ -d "$1" ] || { echo "calibrate_round3.sh: no such folder: $1" >&2; exit 64; }
T=${TMPDIR:-/tmp}/calibrate-round3
rm -rf "$T" && mkdir -p "$T"
PYTHONDONTWRITEBYTECODE=1 python3 - "$1" "$SKILL" "$T" << 'EOF'
import glob, json, os, re, shutil, subprocess, sys
DIR, SKILL, T = sys.argv[1:4]
SCRIPTS = os.path.join(SKILL, "scripts")

# (id, must report, must not report); a must entry is CODE, CODE xN, CODE~text (a message holds text) or
# CODE>0post (reported on the deliverable, gone after svgpost on a copy); S- entries run semcheck with the brief
ROWS = [
    ("ecommerce-arch", ["W-dogleg~the lower tier does not line up"], []),
    ("cicd-flow", ["W-dogleg~the main path drifts", "W-tall", "W-aspect", "I-sparse"], []),
    ("saga-sequence", ["W-seq-group-ragged", "W-tall"], []),
    ("oauth-sequence", ["W-label-on-lifeline x4", "W-label-on-lifeline>0post", "W-tall"], ["S-missing-node~code_verifier"]),
    ("k8s-topology", ["W-label-on-bend>0post", "W-tall"], ["E-label-overflow"]),
    ("c4-container", ["W-sibling-size~different widths", "I-sparse", "W-tall", "W-aspect"], []),
    ("snowflake-pipeline", ["I-sparse"], []),
    ("rag-pipeline", ["I-sparse~container '"], []),
    ("order-state", ["W-aspect", "W-label-on-bend>0post"], []),
    ("saas-erd", [], ["E-/W- beyond round 3"]),
]


def lint(svg, column):
    r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "d2lint.py"), "--json", "--column", str(column), svg],
                       capture_output=True, text=True)
    try:
        return json.loads(r.stdout)["findings"]
    except (ValueError, KeyError):
        raise SystemExit("d2lint failed on %s: %s" % (svg, (r.stdout + r.stderr)[-300:]))


def count(findings, code, text=None):
    n = 0
    for f in findings:
        if f["code"] != code or (text and text not in f["message"]):
            continue
        m = re.match(r"\.\.\. and (\d+) more", f["message"])
        n += int(m.group(1)) if m else 1
    return n


bad = 0
for rid, must, must_not in ROWS:
    d = os.path.join(DIR, rid)
    svgs = sorted(glob.glob(os.path.join(d, "*.svg")))
    briefs = sorted(glob.glob(os.path.join(d, "d2work", "*", "*.brief")))
    if not svgs:
        print("FAIL  %-19s no deliverable SVG in %s" % (rid, d))
        bad += 1
        continue
    svg = svgs[0]
    name = os.path.basename(svg)[:-4]
    src = os.path.join(d, name + ".d2")
    brief = briefs[0] if briefs else None
    column = 800
    if brief:
        m = re.search(r"^width:\s*(\d+)", open(brief, encoding="utf-8").read(), re.M)
        column = int(m.group(1)) if m else 800
    F = lint(svg, column)
    # svgpost on a copy, with the brand the source imports (as d2check detects it)
    post_dir = os.path.join(T, rid)
    os.makedirs(post_dir, exist_ok=True)
    psvg = os.path.join(post_dir, name + ".svg")
    shutil.copy(svg, psvg)
    brand = "neutral"
    if os.path.exists(src) and re.search(r"@[^;\n]*snowflake-brand", re.sub(r"#[^\n]*", "", open(src, encoding="utf-8").read())):
        brand = "snowflake"
    r = subprocess.run([sys.executable, os.path.join(SCRIPTS, "svgpost.py"), "--brand", brand, "--column", str(column), psvg],
                       capture_output=True, text=True)
    P = lint(psvg, column) if r.returncode == 0 else []
    post_line = (r.stdout.strip() or r.stderr.strip())[:120]
    sem = None
    problems, seen = [], []
    for want in must:
        if ">0post" in want:
            code = want.split(">")[0]
            a, b = count(F, code), count(P, code)
            seen.append("%s %d->%d post" % (code, a, b))
            if not (a >= 1 and b == 0):
                problems.append("%s x%d, x%d after svgpost (want >=1 then 0)" % (code, a, b))
            continue
        code, _, text = want.partition("~")
        code, _, n = code.partition(" x")
        c = count(F, code.strip(), text or None)
        seen.append(want if c else "no " + want)
        if (int(n) and c != int(n)) if n else c < 1:
            problems.append("%s: %d reported" % (want, c))
    for no in must_not:
        if no.startswith("E-/W- beyond"):
            old = os.path.join(os.path.dirname(brief), name + ".lint.json") if brief else ""
            try:
                prev = {f["code"] for f in json.load(open(old, encoding="utf-8"))["findings"]}
            except (OSError, ValueError, KeyError):
                problems.append("no round-3 lint report at %s" % old)
                continue
            now = {f["code"] for f in F if f["code"][:2] in ("E-", "W-")}
            extra = sorted(now - prev)
            seen.append("E-/W- %s (round 3: %s)" % (",".join(sorted(now)) or "none",
                                                  ",".join(sorted(c for c in prev if c[:2] in ("E-", "W-"))) or "none"))
            if extra:
                problems.append("new E-/W- codes: " + ", ".join(extra))
            continue
        code, _, text = no.partition("~")
        if code.startswith("S-"):
            if sem is None:
                if not (brief and os.path.exists(src)):
                    problems.append("%s: no brief or source to check" % no)
                    continue
                r2 = subprocess.run([sys.executable, os.path.join(SCRIPTS, "semcheck.py"), "--json", brief, src, "--svg", svg],
                                    capture_output=True, text=True, cwd=d)
                try:
                    sem = json.loads(r2.stdout)["findings"]
                except (ValueError, KeyError):
                    problems.append("semcheck failed: " + (r2.stdout + r2.stderr)[-200:])
                    continue
            c = count(sem, code, text or None)
        else:
            c = count(F, code, text or None)
        seen.append(("no " if not c else "") + no)
        if c:
            problems.append("%s reported x%d" % (no, c))
    codes = sorted({f["code"] for f in F})
    print("%-5s %-19s %s" % ("FAIL" if problems else "ok", rid, "; ".join(seen)))
    print("      lint: %s | %s" % (" ".join(codes) or "clean", post_line))
    for p in problems:
        print("      -> " + p)
    bad += bool(problems)
print("\n%d of %d rows hold" % (len(ROWS) - bad, len(ROWS)))
sys.exit(1 if bad else 0)
EOF
