#!/bin/sh
# verify_icons.sh - every icon the docs name must exist (HTTP 200).
#
# usage: sh verify_icons.sh [-v] [--list] [FILE.md ...]
#   default files: reference/icons.md and workflows/icons.md of this skill
#
# Refs found:
#   prefix:name tokens with an Iconify prefix (lucide:server, logos:kafka-icon,
#     k8s:pod), anywhere: prose, tables, code
#   https URLs of .svg icons (api.iconify.design, icons.terrastruct.com, ...)
#   bare `name` in a table column whose header names one family
#     ("Primary (lucide)"); in a table with one family header, every column
# A ref followed by "does not exist", "(404)", "-> 404" or "404s" documents a
# missing icon: it must return 404. Aliases and deprecated (hidden) Iconify
# names pass with a WARN (prefer the canonical name).
# --list prints the refs without fetching; -v prints every result.
# Exit: 0 all ok | 1 a ref failed, or no refs found | 2 usage
#       3 some refs unverified: host unreachable, blocked or rate limited
# A known icon is fetched first: when it does not load (offline, a proxy's
# 403, a 429), the Iconify refs are reported unverified without fetching.
# Env: ICONIFY_API (default https://api.iconify.design)

usage() {
  sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

PYTHONDONTWRITEBYTECODE=1  # no __pycache__ in the skill's scripts/ (B57)
export PYTHONDONTWRITEBYTECODE
VERBOSE=
LIST=
CONFLICTS=
while [ $# -gt 0 ]; do
  case "$1" in
    -v) VERBOSE=1 ;;
    --list) LIST=1 ;;
    -h | --help) usage ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
  shift
done
ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
[ $# -gt 0 ] || set -- "$ROOT/reference/icons.md" "$ROOT/workflows/icons.md"
for f in "$@"; do
  [ -f "$f" ] || { echo "verify_icons: $f: no such file" >&2; exit 2; }
done
command -v python3 > /dev/null 2>&1 || { echo "verify_icons: needs python3" >&2; exit 2; }
[ -n "$LIST" ] || command -v curl > /dev/null 2>&1 || { echo "verify_icons: needs curl" >&2; exit 2; }
API=${ICONIFY_API:-https://api.iconify.design}
export API

T=$(mktemp -d "${TMPDIR:-/tmp}/verify_icons.XXXXXX") || exit 2
trap 'rm -rf "$T"' EXIT
trap 'exit 2' INT TERM

# known Iconify prefixes: a built-in list, plus the live collection list
if [ -z "$LIST" ]; then
  curl -fsS --connect-timeout 8 --max-time 30 "$API/collections" > "$T/collections.json" 2> /dev/null ||
    : > "$T/collections.json"
else
  : > "$T/collections.json"
fi

# ---- extract: "ref<TAB>expected status<TAB>file:line", first occurrence
python3 - "$T/collections.json" "$@" > "$T/refs" << 'PY' || exit 2
import json, re, sys
known = set("lucide logos k8s gcp tabler mdi simple-icons devicon devicon-plain carbon ph "
            "material-symbols skill-icons vscode-icons fluent heroicons octicon codicon".split())
try:
    known |= set(json.load(open(sys.argv[1])).keys())
except Exception:
    pass
NAME = r"[a-z0-9]+(?:-[a-z0-9]+)*"
TOKEN = re.compile(r"(?<![A-Za-z0-9_./:-])(" + NAME + r"):(" + NAME + r")(?![A-Za-z0-9_:/-])")
URL = re.compile(r"https?://[^\s)`\"'<>|{};]+")
MISSING = re.compile(r"^`?\s*\)?\s*(does not exist|doesn'?t exist|->\s*404|\(404\)|404s\b|returns 404|: 404)", re.I)
FAMILY = re.compile(r"\b(lucide|logos|k8s)\b", re.I)
refs = {}

def add(ref, rest, loc):
    want = "404" if MISSING.match(rest) else "200"
    if ref not in refs:
        refs[ref] = (want, loc)
    elif refs[ref][0] != want:
        with open(sys.argv[1] + ".conflicts", "a") as c:
            c.write("FAIL %s: %s says it exists, %s says it is missing\n" % (ref, refs[ref][1], loc))

def cells(row):
    row = row.strip()
    row = row[1:] if row.startswith("|") else row
    row = row[:-1] if row.endswith("|") and not row.endswith("\\|") else row
    return re.split(r"(?<!\\)\|", row)

for path in sys.argv[2:]:
    lines = open(path, encoding="utf-8").read().split("\n")
    fence, colfam, tablefam = None, None, None
    for i, line in enumerate(lines):
        loc = "%s:%d" % (path, i + 1)
        m = re.match(r"^\s*(`{3,}|~{3,})", line)
        if m:
            f = m.group(1)
            if fence is None:
                fence = f
            elif f[0] == fence[0] and len(f) >= len(fence) and not line.strip()[len(f):].strip():
                fence = None
            continue
        for t in TOKEN.finditer(line):
            if t.group(1) in known:
                add(t.group(1) + ":" + t.group(2), line[t.end():], loc)
        for u in URL.finditer(line):
            url = u.group(0).rstrip(".,;:")
            if re.search(r"\.svg(\?|$)", url) and not re.search(r"[<>{}$]", url):
                add(url, line[u.end():], loc)
        if fence is not None or not line.lstrip().startswith("|"):
            colfam = tablefam = None
            continue
        if colfam is None:  # header row: needs a separator row below it
            nxt = lines[i + 1] if i + 1 < len(lines) else ""
            if re.match(r"^\s*\|?\s*:?-{3,}", nxt):
                fams = [FAMILY.findall(c) for c in cells(line)]
                colfam = [f[0].lower() if len(set(x.lower() for x in f)) == 1 else None for f in fams]
                allf = set(x.lower() for f in fams for x in f)
                tablefam = allf.pop() if len(allf) == 1 else None
            continue
        if re.match(r"^\s*\|?\s*:?-{3,}", line):
            continue
        for j, c in enumerate(cells(line)):
            fam = (colfam[j] if j < len(colfam) else None) or tablefam
            if not fam:
                continue
            for b in re.finditer(r"`(" + NAME + r")`", c):
                rest = c[b.end():]
                add(fam + ":" + b.group(1), rest, loc)
for ref, (want, loc) in refs.items():
    print("%s\t%s\t%s" % (ref, want, loc))
PY
if [ -s "$T/collections.json.conflicts" ]; then
  cat "$T/collections.json.conflicts"
  CONFLICTS=1
fi
if [ ! -s "$T/refs" ]; then
  echo "verify_icons: no icon refs found in: $*"
  exit 1
fi
if [ -n "$LIST" ]; then
  cat "$T/refs"
  [ -z "$CONFLICTS" ]
  exit
fi

# ---- probe: a known icon must load, else skip the Iconify refs (seconds,
# not the half hour that 256 refs x retries would take)
probe=
for i in 1 2; do
  probe=$(curl -s -L --connect-timeout 8 --max-time 30 -o /dev/null -w "%{http_code}" "$API/lucide/server.svg" 2> /dev/null)
  [ "$probe" = 200 ] && break
  [ "$i" = 2 ] || sleep 3
done
[ "$probe" = 200 ] || : > "$T/apidown"
export T

# ---- fetch every ref, 2 at a time: Iconify answers bursts with 429 and a
# Retry-After of minutes. Retry 429 and 5xx with a growing pause (another
# edge node often answers), unreachable once. A ref still limited (or down)
# after its retries sets a flag: later refs then try once (or not at all).
# Output "status<TAB>ref"; "skip" = not fetched.
# shellcheck disable=SC2016 # the script expands in the inner sh
cut -f1 "$T/refs" | xargs -n 1 -P 2 sh -c '
  case "$1" in
    http*) u=$1 ;;
    *) u="$API/${1%%:*}/${1#*:}.svg"
       [ -f "$T/apidown" ] && { printf "skip\t%s\n" "$1"; exit 0; } ;;
  esac
  [ -f "$T/down" ] && { printf "000\t%s\n" "$1"; exit 0; }
  tries="1 2 4 8 0"
  [ -f "$T/limited" ] && tries=0
  down=0
  for pause in $tries; do
    c=$(curl -s -L --connect-timeout 8 --max-time 60 -o /dev/null -w "%{http_code}" "$u" 2> /dev/null)
    case "$c" in
      000 | "") down=$((down + 1)); [ "$down" -lt 2 ] || { : > "$T/down"; break; }; sleep 1 ;;
      429 | 5??) [ "$pause" = 0 ] || sleep "$pause" ;;
      *) break ;;
    esac
  done
  [ "$c" != 429 ] || : > "$T/limited"
  printf "%s\t%s\n" "${c:-000}" "$1"' _ > "$T/codes"

# ---- alias / deprecated names: one Iconify JSON request per prefix
awk -F'\t' '$2 == 200 && $1 !~ /^http/ { sub(/:.*/, "", $1); print $1 }' "$T/refs" | sort -u |
while read -r p; do
  names=$(awk -F'\t' -v p="$p" '$2 == 200 && index($1, p ":") == 1 { print substr($1, length(p) + 2) }' "$T/refs" |
    sort -u | paste -sd, -)
  curl -fsS --connect-timeout 8 --max-time 60 "$API/$p.json?icons=$names" > "$T/meta.$p.json" 2> /dev/null ||
    rm -f "$T/meta.$p.json"
done

python3 - "$T" "$VERBOSE" "$#" "$CONFLICTS" "$API" "${probe:-000}" << 'PY'
import glob, json, os, sys
T, verbose, nfiles, conflicts, api, probe = sys.argv[1:7]
refs = {}
for l in open(os.path.join(T, "refs")):
    ref, want, loc = l.rstrip("\n").split("\t")
    refs[ref] = (want, loc)
codes = dict(reversed(l.rstrip("\n").split("\t")) for l in open(os.path.join(T, "codes")) if "\t" in l)
warn = {}
for f in glob.glob(os.path.join(T, "meta.*.json")):
    try:
        d = json.load(open(f))
    except Exception:
        continue
    p = d.get("prefix", "")
    for n, a in (d.get("aliases") or {}).items():
        warn[p + ":" + n] = "alias: prefer %s:%s" % (p, a.get("parent", "?"))
    for n, a in (d.get("icons") or {}).items():
        if a.get("hidden"):
            warn[p + ":" + n] = "deprecated (hidden in Iconify): search for the current name"
ok = missing_ok = failed = offline = limited = 0
skipped = sum(1 for r in refs if codes.get(r) == "skip")
if skipped:
    offline += skipped
    print("UNVERIFIED %d Iconify refs: %s/lucide/server.svg answered %s (offline, blocked by a proxy, "
          "or rate limited); rerun later" % (skipped, api, probe))
for ref in sorted(refs):
    want, loc = refs[ref]
    got = codes.get(ref, "000")
    if got == "skip":
        continue
    if got == "000":
        offline += 1
        print("OFFLINE %s (%s): host unreachable" % (ref, loc))
    elif got == "429":
        limited += 1
        print("RATE-LIMITED %s (%s): not verified, rerun in a few minutes" % (ref, loc))
    elif got != want:
        failed += 1
        why = "documented as missing, but it exists" if want == "404" else "not usable"
        print("FAIL %s %s (%s): %s" % (got, ref, loc, why))
    else:
        if want == "404":
            missing_ok += 1
        else:
            ok += 1
        if ref in warn:
            print("WARN %s (%s): %s" % (ref, loc, warn[ref]))
        elif verbose:
            print("%s %s (%s)%s" % (got, ref, loc, "  documented as missing" if want == "404" else ""))
print("icons: %d refs in %s file(s): %d ok, %d documented-missing ok, %d warnings, %d FAILED, "
      "%d unverified (offline or rate limited)"
      % (len(refs), nfiles, ok, missing_ok, sum(1 for r in refs if r in warn), failed, offline + limited))
sys.exit(1 if failed or conflicts else 3 if offline or limited else 0)
PY
