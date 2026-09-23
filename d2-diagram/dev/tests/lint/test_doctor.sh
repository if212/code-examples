#!/bin/sh
# shellcheck disable=SC2015  # 'check && ok || bad' is intended
# test_doctor.sh - scripts/doctor.sh against simulated machines: the real one, then PATH, NODE_PATH,
# PLAYWRIGHT_BROWSERS_PATH and D2CHECK_PLAYWRIGHT stripped to take away one dependency at a time;
# also d2check's pointers to doctor.sh and the usage exit code of every script.
# usage: sh dev/tests/lint/test_doctor.sh      needs d2, python3, node + Playwright (the full machine)
# exit: 0 all passed, 1 a check failed
set -u
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
SKILL=$(CDPATH='' cd -- "$HERE/../../.." && pwd)
DOC="$SKILL/scripts/doctor.sh"
T=${TMPDIR:-/tmp}/d2doctor-tests
rm -rf "$T" && mkdir -p "$T/empty" "$T/home"
export D2_WORK="$T/work"
pass=0 fail=0
ok() { pass=$((pass + 1)); printf 'ok    %s\n' "$1"; }
bad() { fail=$((fail + 1)); printf 'FAIL  %s\n' "$1"; [ -z "${2:-}" ] || printf '%s\n' "$2" | head -30 | sed 's/^/      /'; }
has() { printf '%s\n' "$1" | grep -q -- "$2"; }
# a PATH holding only the named tools (plus the basics every script needs)
mkbin() {
  d="$T/bin-$1"; shift
  rm -rf "$d" && mkdir -p "$d"
  for t in sh dash sed awk grep cksum basename dirname mkdir mktemp mv cp rm find sort wc tr head tail cut cat chmod ls \
    env uname du timeout sleep date printf test "$@"; do
    p=$(command -v "$t" 2> /dev/null) && [ -n "$p" ] && [ "${p#/}" != "$p" ] && ln -sf "$p" "$d/$t"
  done
  printf '%s' "$d"
}
# 1. the real machine: ready, exit 0 -------------------------------------------------------------------
o=$(sh "$DOC" 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" '^verdict: READY' && has "$o" 'PASS  d2 ' && has "$o" 'PASS  raster ' && ! has "$o" 'FAIL' &&
  ok "full machine: READY, exit 0" || bad "full machine (exit $rc)" "$o"
o=$(sh "$DOC" --json --offline 2>&1); rc=$?
v=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["verdict"], d["exit"], len(d["checks"]))' 2>&1)
[ "$rc" = 0 ] && [ "$v" = "ready 0 13" ] && ok "--json: valid JSON, verdict ready, 13 checks" || bad "--json ($v)" "$o"

# 2. no d2: cannot render, exit 1, the three install commands ------------------------------------------
b=$(mkbin nod2 python3 node npm curl)
o=$(PATH="$b" sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'FAIL  d2 ' && has "$o" '^verdict: CANNOT RENDER' && has "$o" 'brew install d2' &&
  has "$o" 'install.sh | sh -s -- --method standalone --prefix' && has "$o" 'go install oss.terrastruct.com/d2@latest' &&
  ok "no d2: FAIL d2, exit 1, brew/script/go commands" || bad "no d2 (exit $rc)" "$o"
o=$(PATH="$b" sh "$DOC" --offline --install --dry-run 2>&1); rc=$?
has "$o" "install: would run: sh -c 'curl -fsSL https://d2lang.com/install.sh" && [ "$rc" = 1 ] &&
  ok "--install --dry-run prints the d2 install, runs nothing" || bad "--install --dry-run (exit $rc)" "$o"
# d2check without d2 points at doctor.sh
cp "$HERE/cases/ok_flowchart.d2" "$T/flow.d2"
o=$(PATH="$b" sh "$SKILL/scripts/d2check.sh" "$T/flow.d2" 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'd2 is not on PATH' && has "$o" 'install.sh' && has "$o" 'doctor.sh' &&
  ok "d2check without d2: exit 1, install command + doctor.sh" || bad "d2check without d2 (exit $rc)" "$o"

# 3. no python3: degraded, exit 3 ------------------------------------------------------------------------
b=$(mkbin nopy d2 node npm curl rsvg-convert)
o=$(PATH="$b" sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'FAIL  python3 ' && has "$o" '^verdict: DEGRADED' && has "$o" 'sudo apt install python3' &&
  has "$o" 'brew install python' && ok "no python3: FAIL python3, DEGRADED, exit 3" || bad "no python3 (exit $rc)" "$o"

# 4. no node, no browser binary, no rsvg: nothing can rasterize ------------------------------------------
b=$(mkbin nonode d2 python3 curl)
o=$(PATH="$b" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'WARN  node ' && has "$o" 'FAIL  raster ' && has "$o" 'INFO  chrome ' &&
  has "$o" 'brew install node' && has "$o" 'sudo apt install nodejs npm' &&
  ok "no node/Chromium/rsvg: FAIL raster, DEGRADED, exit 3" || bad "no node (exit $rc)" "$o"
# the same machine through d2check: NOT visually reviewed, pointing at doctor.sh
o=$(PATH="$b" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$SKILL/scripts/d2check.sh" "$T/flow.d2" 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" '^reviewed: NOT visually reviewed' && has "$o" '^result: exit 3.*doctor.sh' &&
  ok "d2check with no rasterizer: exit 3, result line names doctor.sh" || bad "d2check degraded (exit $rc)" "$o"
# rsvg-convert only: approximate
b=$(mkbin rsvgonly d2 python3 curl rsvg-convert)
o=$(PATH="$b" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'WARN  raster  *only rsvg-convert worked' && has "$o" 'PASS  rsvg ' &&
  ok "rsvg-convert only: WARN raster (approximate), exit 3" || bad "rsvg only (exit $rc)" "$o"

# 5. node without the playwright module; no Chromium anywhere ----------------------------------------------
b=$(mkbin nopw d2 python3 node npm curl)
o=$(PATH="$b" NODE_PATH="" D2CHECK_PLAYWRIGHT="$T/empty/none" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" \
  sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'WARN  playwright ' && has "$o" 'npm i -g playwright && npx playwright install chromium' &&
  has "$o" 'doctor.sh --install' && ok "no playwright module: WARN playwright, npm command, exit 3" || bad "no playwright (exit $rc)" "$o"
o=$(PATH="$b" NODE_PATH="" D2CHECK_PLAYWRIGHT="$T/empty/none" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" \
  XDG_DATA_HOME="$T/xdg" sh "$DOC" --offline --install --dry-run 2>&1); rc=$?
has "$o" "install: would run: npm install --prefix $T/xdg/d2-diagram/node" && has "$o" 'would run: node .*cli.js install --only-shell chromium' &&
  [ ! -d "$T/xdg" ] && ok "--install --dry-run: npm into ~/.local/share/d2-diagram/node, then chromium; nothing written" ||
  bad "playwright dry-run install (exit $rc)" "$o"

# 6. playwright present, but no Chromium it can launch -----------------------------------------------------
b=$(mkbin nochromium d2 python3 node npm curl)
o=$(PATH="$b" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 3 ] && has "$o" 'PASS  playwright ' && has "$o" 'WARN  chromium  *Playwright cannot launch' &&
  has "$o" 'playwright/cli.js install chromium' && has "$o" 'install-deps' &&
  ok "no Chromium: WARN chromium, this Playwright's install + install-deps commands, exit 3" || bad "no chromium (exit $rc)" "$o"

# 7. a Chrome binary alone is enough (the no-node route) ---------------------------------------------------
chrome=""
for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome; do [ -x "$c" ] && chrome=$c; done
if [ -n "$chrome" ]; then
  b=$(mkbin chromeonly d2 python3 curl)
  o=$(PATH="$b" CHROME_PATH="$chrome" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$DOC" --offline 2>&1); rc=$?
  [ "$rc" = 0 ] && has "$o" 'PASS  raster  *faithful PNG of the test diagram via chrome' &&
    ok "Chrome binary without node: faithful via chrome, exit 0" || bad "chrome only (exit $rc)" "$o"
else
  printf 'skip  chrome-only machine (no Chromium binary under /opt/pw-browsers)\n'
fi

# 8. unwritable work dir, hostile environment, usage -------------------------------------------------------
o=$(D2_WORK=/proc/d2work-test sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'FAIL  workdir ' && has "$o" 'export D2_WORK=' && ok "unwritable work dir: FAIL workdir, exit 1" ||
  bad "unwritable work dir (exit $rc)" "$o"
s=$(date +%s)
o=$(D2_WATCH=true D2_LAYOUT=dagre timeout 120 sh "$DOC" --offline 2>&1); rc=$?
[ "$rc" = 0 ] && [ $(($(date +%s) - s)) -lt 60 ] && ok "D2_WATCH=true in the environment: no hang, exit 0" || bad "D2_WATCH (exit $rc)" "$o"
sh "$DOC" --bogus > /dev/null 2>&1; rc=$?
[ "$rc" = 64 ] && ok "doctor.sh --bogus: exit 64" || bad "doctor.sh --bogus exit $rc"
sh "$DOC" --dry-run > /dev/null 2>&1; rc=$?
[ "$rc" = 64 ] && ok "doctor.sh --dry-run without --install: exit 64" || bad "--dry-run alone exit $rc"

# 9. --json stays valid JSON when a tool prints colour codes, tabs, CR, quotes or backslashes -----------
mkdir -p "$T/fakefail" && cat > "$T/fakefail/d2" << 'EOF'
#!/bin/sh
case "$1" in --version) echo v0.7.1; exit 0 ;; esac
printf '\033[0;31merr:\033[0m failed to "load"\tplugin\r at C:\\x\n' >&2
exit 1
EOF
chmod +x "$T/fakefail/d2"
o=$(PATH="$T/fakefail:$PATH" sh "$DOC" --offline --json 2>&1); rc=$?
v=$(printf '%s' "$o" | python3 -c 'import json,sys; d=json.load(sys.stdin); r=[c for c in d["checks"] if c["check"]=="render"][0]; print(d["verdict"], r["status"], "\033" in r["detail"], "load" in r["detail"])' 2>&1)
[ "$rc" = 1 ] && [ "$v" = "cannot-render FAIL False True" ] && ok "--json: control characters stripped, still valid JSON" || bad "--json with control characters ($v)" "$o"

# 10. --install tries the next method when one fails, and trusts only a d2 that appears -------------------
b=$(mkbin fallback python3 node npm)
cat > "$b/curl" << 'EOF'
#!/bin/sh
echo 'curl: (22) The requested URL returned error: 403' >&2
exit 22
EOF
cat > "$b/go" << EOF
#!/bin/sh
case "\$1" in
  env) echo "$T/gopath" ;;
  install) mkdir -p "$T/gopath/bin" && printf '#!/bin/sh\nexec %s "\$@"\n' "$(command -v d2)" > "$T/gopath/bin/d2" && chmod +x "$T/gopath/bin/d2" ;;
esac
EOF
chmod +x "$b/curl" "$b/go"
o=$(PATH="$b" HOME="$T/home" sh "$DOC" --offline --install --dry-run 2>&1)
has "$o" "would run: sh -c 'curl" && has "$o" 'would run if that fails: go install oss.terrastruct.com/d2@latest' &&
  ok "--install --dry-run: the whole fallback chain (install script, then go)" || bad "dry-run fallback chain" "$o"
o=$(PATH="$b" HOME="$T/home" sh "$DOC" --offline --install 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" 'install: that exited 0, but no d2 appeared' && has "$o" 'install: running: go install' &&
  has "$o" "d2 is in $T/gopath/bin, which is not on your PATH" && has "$o" '^verdict: READY' &&
  ok "--install: failed download noticed, go fallback installs d2, PATH hint, READY" || bad "install fallback (exit $rc)" "$o"
rm -rf "$T/gopath"
b=$(mkbin nogo python3 node npm)
cp "$T/bin-fallback/curl" "$b/curl"
o=$(PATH="$b" HOME="$T/home" sh "$DOC" --offline --install 2>&1); rc=$?
[ "$rc" = 1 ] && has "$o" 'd2 could not be installed: every method above failed' && ! has "$o" 'nothing to install' &&
  ok "--install: a failed install is reported as failed, exit 1" || bad "failed install report (exit $rc)" "$o"

# 11. browser advice that works today; the current Playwright layout; a skill path with spaces ------------
o=$(PATH="$(mkbin nobrowser d2 python3 curl)" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$DOC" --offline 2>&1)
! has "$o" 'cask chromium' && has "$o" 'brew install --cask google-chrome' && ! has "$o" ' --install   installs' &&
  ok "no node, no browser: google-chrome cask (chromium cask is disabled), no useless --install hint" || bad "browser advice" "$o"
if grep -qiE '^(ID|ID_LIKE)=.*ubuntu' /etc/os-release 2> /dev/null; then
  ! has "$o" 'sudo apt install chromium' && has "$o" "Ubuntu's chromium is a snap" &&
    ok "Ubuntu: no 'apt install chromium' (no install candidate)" || bad "Ubuntu browser advice" "$o"
fi
if [ -n "$chrome" ]; then
  mkdir -p "$T/pwnew/chromium_headless_shell-9999/chrome-headless-shell-linux64"
  ln -sf "$chrome" "$T/pwnew/chromium_headless_shell-9999/chrome-headless-shell-linux64/chrome-headless-shell"
  b=$(mkbin chromeonly d2 python3 curl)
  o=$(PATH="$b" PLAYWRIGHT_BROWSERS_PATH="$T/pwnew" HOME="$T/home" sh "$DOC" --offline 2>&1); rc=$?
  [ "$rc" = 0 ] && has "$o" 'PASS  chrome .*chrome-headless-shell' && has "$o" 'PASS  raster  *faithful PNG .*via chrome' &&
    has "$o" 'INFO  node ' && ok "Playwright 1.57+ headless shell found by the chrome route; node then optional (INFO)" ||
    bad "new headless-shell layout (exit $rc)" "$o"
fi
mkdir -p "$T/sk dir/d2-diagram" && cp -R "$SKILL/scripts" "$SKILL/assets" "$T/sk dir/d2-diagram/"
o=$(D2CHECK_PLAYWRIGHT="$T/empty/none" PLAYWRIGHT_BROWSERS_PATH="$T/empty" HOME="$T/home" sh "$T/sk dir/d2-diagram/scripts/doctor.sh" --offline 2>&1)
has "$o" "sh '$T/sk dir/d2-diagram/scripts/doctor.sh' --install" && ok "skill under a path with spaces: the --install hint is quoted" ||
  bad "quoted doctor path" "$o"

# 12. every script: -h prints usage + exit codes + examples (exit 0); a bad option exits 64 ----------------
for s in d2check.sh doctor.sh font-flags.sh icon.sh; do
  o=$(sh "$SKILL/scripts/$s" --help 2>&1); rc=$?
  [ "$rc" = 0 ] && has "$o" 'exit' && has "$o" '64' && has "$o" 'example' && ok "$s --help" || bad "$s --help (exit $rc)" "$o"
done
for s in d2lint.py d2raster.py pngstats.py contrast.py semcheck.py; do
  [ "$s" = semcheck.py ] && continue  # another package's script
  o=$(python3 "$SKILL/scripts/$s" --help 2>&1); rc=$?
  [ "$rc" = 0 ] && has "$o" 'exit' && has "$o" '64' && has "$o" 'example' && ok "$s --help" || bad "$s --help (exit $rc)" "$o"
done
o=$(node "$SKILL/scripts/raster.cjs" --help 2>&1); rc=$?
[ "$rc" = 0 ] && has "$o" '64' && has "$o" 'example' && ok "raster.cjs --help" || bad "raster.cjs --help (exit $rc)" "$o"
for c in "sh $SKILL/scripts/d2check.sh --bogus x.d2" "sh $SKILL/scripts/font-flags.sh no-such-family" \
  "sh $SKILL/scripts/icon.sh bogus" "python3 $SKILL/scripts/d2lint.py --bogus x.svg" \
  "python3 $SKILL/scripts/d2raster.py --bogus" "python3 $SKILL/scripts/pngstats.py" \
  "python3 $SKILL/scripts/contrast.py --check" "node $SKILL/scripts/raster.cjs"; do
  $c > /dev/null 2>&1; rc=$?
  [ "$rc" = 64 ] && ok "usage error exits 64: ${c#* "$SKILL"/scripts/}" || bad "usage error exit $rc: $c"
done

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" = 0 ]
