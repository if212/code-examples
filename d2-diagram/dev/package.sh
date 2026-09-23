#!/bin/sh
# package.sh - build dev/dist/d2-diagram.zip: the skill exactly as users install it.
#
# usage: sh dev/package.sh [--out FILE.zip] [--no-verify] [--list]
#   --out FILE.zip  where to write the zip (default: dev/dist/d2-diagram.zip)
#   --no-verify     skip the structure check that runs first (dev/tests/structure/check.sh)
#   --list          print every entry of the finished zip with its mode
#   -h, --help      this text
# The zip holds one folder, d2-diagram/, with the whole skill except dev/, VCS files,
# __pycache__, *.pyc, .DS_Store, __MACOSX, *.zip and editor leftovers. scripts/*.sh and scripts/*.py
# are stored as -rwxr-xr-x, everything else -rw-r--r--, folders drwxr-xr-x. Entries are sorted;
# with SOURCE_DATE_EPOCH set they are also dated from it, so two builds are byte-identical.
# After writing, the zip is read back and verified (root folder, no dev/, no junk, exec bits);
# unless --no-verify, its unpacked copy must pass the structure check too.
# Install it (delete an older copy first): unzip dev/dist/d2-diagram.zip -d ~/.claude/skills/
# exit: 0 built and verified | 1 structure check or verification failed | 2 usage error
set -u
PYTHONDONTWRITEBYTECODE=1  # no __pycache__ in the skill's scripts/ (B57)
export PYTHONDONTWRITEBYTECODE
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(dirname -- "$HERE")
out="$HERE/dist/d2-diagram.zip" verify=1 list=0
while [ $# -gt 0 ]; do
  case $1 in
    --out) [ $# -ge 2 ] || { echo "package.sh: --out needs a file name" >&2; exit 2; }; out=$2; shift 2 ;;
    --out=*) out=${1#*=}; shift ;;
    --no-verify) verify=0; shift ;;
    --list) list=1; shift ;;
    -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
    *) echo "package.sh: unknown argument '$1' (see --help)" >&2; exit 2 ;;
  esac
done
case $out in *.zip) ;; *) echo "package.sh: --out must end in .zip: $out" >&2; exit 2 ;; esac
case ${SOURCE_DATE_EPOCH:-0} in
  *[!0-9]*) echo "package.sh: SOURCE_DATE_EPOCH must be seconds since 1970, not '$SOURCE_DATE_EPOCH'" >&2; exit 2 ;;
esac
command -v python3 > /dev/null 2>&1 || { echo "package.sh: python3 is not on PATH" >&2; exit 2; }

if [ "$verify" = 1 ]; then
  echo "== structure check"
  if ! sh "$HERE/tests/structure/check.sh"; then
    echo "package.sh: the structure check failed; fix it, or build anyway with --no-verify" >&2
    exit 1
  fi
fi

echo "== building $out"
mkdir -p "$(dirname -- "$out")" || exit 1
PYTHONDONTWRITEBYTECODE=1 python3 - "$SKILL" "$out" "$list" << 'PY' || exit 1
import hashlib, os, re, shlex, stat, sys, time, zipfile
skill, out, want_list = sys.argv[1], os.path.abspath(sys.argv[2]), sys.argv[3] == '1'
ROOT = 'd2-diagram/'
SKIP_DIRS = {'dev', '.git', '.github', '__pycache__', '__MACOSX', '.idea', '.vscode', 'node_modules'}
SKIP_FILE = re.compile(r'(\.pyc|\.pyo|~|\.swp|\.swo|\.orig|\.rej|\.bak|\.tmp|\.zip)$|^(\.DS_Store|Thumbs\.db|\._.*)$')
epoch = os.environ.get('SOURCE_DATE_EPOCH')
fixed = time.gmtime(max(int(epoch), 315532800))[:6] if epoch else None

entries, problems = [], []
for root, dirs, files in os.walk(skill):
    rel = os.path.relpath(root, skill)
    dirs[:] = sorted(d for d in dirs if not (rel == '.' and d == 'dev') and d not in SKIP_DIRS)
    for d in dirs:
        entries.append((os.path.normpath(os.path.join(rel, d)), True))
    for f in sorted(files):
        if SKIP_FILE.search(f):
            continue
        p = os.path.join(root, f)
        if os.path.islink(p):
            problems.append('symlink in the package: ' + os.path.relpath(p, skill))
            continue
        entries.append((os.path.normpath(os.path.join(rel, f)), False))
if problems:
    sys.exit('package.sh: ' + '; '.join(problems))
entries.sort()
if not any(e == ('SKILL.md', False) for e in entries):
    sys.exit('package.sh: no SKILL.md at ' + skill)

def mode_of(rel, is_dir):
    if is_dir:
        return 0o755
    return 0o755 if re.match(r'^scripts/[^/]+\.(sh|py)$', rel) else 0o644

def info(name, rel_src, is_dir):
    src = os.path.join(skill, rel_src) if rel_src else skill
    date = fixed or time.localtime(max(os.stat(src).st_mtime, 315532800))[:6]
    zi = zipfile.ZipInfo(name, date_time=date)
    zi.create_system = 3      # unix: unzip -Z then shows the permissions
    kind = stat.S_IFDIR if is_dir else stat.S_IFREG
    zi.external_attr = (kind | mode_of(rel_src, is_dir)) << 16
    if is_dir:
        zi.external_attr |= 0x10  # MS-DOS directory flag
    zi.compress_type = zipfile.ZIP_STORED if is_dir else zipfile.ZIP_DEFLATED
    return zi

tmp = out + '.tmp'
with zipfile.ZipFile(tmp, 'w') as z:
    z.writestr(info(ROOT, '', True), b'')
    for rel, is_dir in entries:
        if is_dir:
            z.writestr(info(ROOT + rel + '/', rel, True), b'')
        else:
            with open(os.path.join(skill, rel), 'rb') as fh:
                z.writestr(info(ROOT + rel, rel, False), fh.read(), compress_type=zipfile.ZIP_DEFLATED,
                           compresslevel=9)
os.replace(tmp, out)

# read it back and verify what users will get
errs = []
with zipfile.ZipFile(out) as z:
    names = z.namelist()
    infos = z.infolist()
    if names[0] != ROOT:
        errs.append('first entry is %r, not %r' % (names[0], ROOT))
    for n in names:
        if not n.startswith(ROOT):
            errs.append('entry outside %s: %s' % (ROOT, n))
        if re.search(r'(^|/)(dev|__MACOSX|__pycache__)(/|$)|\.pyc$|(^|/)\.DS_Store$', n[len(ROOT):]):
            errs.append('junk or dev entry: ' + n)
    sh = [i for i in infos if re.match(r'^d2-diagram/scripts/[^/]+\.(sh|py)$', i.filename)]
    if not sh:
        errs.append('no scripts/*.sh in the zip')
    for i in sh:
        if (i.external_attr >> 16) & 0o777 != 0o755:
            errs.append('%s is not -rwxr-xr-x' % i.filename)
    for need in ('SKILL.md', 'README.md', 'scripts/d2check.sh', 'scripts/svgpost.py', 'scripts/d2lint.py',
                 'scripts/semcheck.py', 'templates/neutral-theme.d2', 'templates/snowflake-brand.d2'):
        if ROOT + need not in names:
            errs.append('missing ' + need)
    bad = z.testzip()
    if bad:
        errs.append('corrupt entry: ' + bad)
    files = [i for i in infos if not i.filename.endswith('/')]
    size = os.path.getsize(out)
    raw = sum(i.file_size for i in files)
    if want_list:
        for i in infos:
            print('%s %8d  %s' % (stat.filemode(i.external_attr >> 16), i.file_size, i.filename))
if errs:
    print('package.sh: verification FAILED:', file=sys.stderr)
    for e in errs:
        print('  ' + e, file=sys.stderr)
    sys.exit(1)
digest = hashlib.sha256(open(out, 'rb').read()).hexdigest()
print('zip:      %s' % out)
print('contents: %d files in %s (%d KB unpacked, %d KB zipped)' % (len(files), ROOT, raw // 1024, size // 1024))
print('checked:  root %s, no dev/ or junk, %d scripts/*.sh and *.py at -rwxr-xr-x' % (ROOT, len(sh)))
print('sha256:   %s' % digest)
print('install:  rm -rf ~/.claude/skills/d2-diagram && unzip %s -d ~/.claude/skills/' % shlex.quote(out))
PY

if [ "$verify" = 1 ]; then
  echo "== structure check of the unpacked zip"
  tmp=$(mktemp -d "${TMPDIR:-/tmp}/d2-package.XXXXXX") || exit 1
  # unpack as unzip would, modes included
  if python3 -c 'import os, sys, zipfile
z = zipfile.ZipFile(sys.argv[1])
for i in z.infolist():
    os.chmod(z.extract(i, sys.argv[2]), (i.external_attr >> 16) & 0o777 or 0o644)' "$out" "$tmp" &&
    sh "$HERE/tests/structure/check.sh" --skill "$tmp/d2-diagram" > "$tmp/check.log" 2>&1; then
    tail -n 1 "$tmp/check.log"
    rm -rf "$tmp"
  else
    cat "$tmp/check.log" 2> /dev/null
    rm -rf "$tmp"
    echo "package.sh: the unpacked zip fails the structure check (a doc points at something the zip leaves out?)" >&2
    exit 1
  fi
fi
