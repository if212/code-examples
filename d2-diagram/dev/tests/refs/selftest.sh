#!/bin/sh
# selftest.sh - regression test for check_snippets.sh and verify_icons.sh
# against the cases in fixtures/. usage: sh selftest.sh    Exit: 0 pass | 1 fail
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE" || exit 1
fail=0
pass() { echo "PASS $1"; }
bad() { echo "FAIL $1"; fail=1; }

before=$(find fixtures | LC_ALL=C sort)
for j in 4 1; do
  out=$(sh check_snippets.sh -v -j "$j" fixtures/snippets.md)
  rc=$?
  got=$(printf '%s\n' "$out" | awk '{print $1, $2, $3}' | LC_ALL=C sort)
  if [ "$rc" = 1 ] && [ "$got" = "$(cat fixtures/snippets.expected)" ]; then
    pass "check_snippets -j $j: every case as expected, exit 1"
  else
    bad "check_snippets -j $j (exit $rc):"
    printf '%s\n' "$got" | diff fixtures/snippets.expected - | sed 's/^/  /'
  fi
done
if sh check_snippets.sh fixtures/clean.md > /dev/null; then
  pass "check_snippets: clean doc exits 0"
else
  bad "check_snippets: clean doc does not exit 0"
fi
sh check_snippets.sh > /dev/null 2>&1
if [ $? = 2 ]; then
  pass "check_snippets: no file -> exit 2"
else
  bad "check_snippets: no file should exit 2"
fi
if [ "$before" = "$(find fixtures | LC_ALL=C sort)" ]; then
  pass "check_snippets: nothing written next to the docs"
else
  bad "check_snippets wrote into fixtures/"
fi

got=$(sh verify_icons.sh --list fixtures/icons.md | tr '\t' ' ' | LC_ALL=C sort)
if [ "$got" = "$(cat fixtures/icons.expected)" ]; then
  pass "verify_icons --list: refs extracted as expected"
else
  bad "verify_icons --list:"
  printf '%s\n' "$got" | diff fixtures/icons.expected - | sed 's/^/  /'
fi
out=$(sh verify_icons.sh fixtures/icons.md)
rc=$?
case "$rc" in
  0)
    if printf '%s\n' "$out" | grep -q '^WARN lucide:alert-triangle .*prefer lucide:triangle-alert'; then
      pass "verify_icons: fixture refs all ok, alias warned"
    else
      bad "verify_icons: alias warning missing"
    fi
    ;;
  3) echo "SKIP verify_icons network check: offline or rate limited" ;;
  *) bad "verify_icons on the fixture exited $rc:"; printf '%s\n' "$out" | sed 's/^/  /' ;;
esac
# an unusable API (down, a proxy's 403, a 429) must give "unverified" fast,
# not 14 FAILs or minutes of retries
tmp=$(mktemp -d "${TMPDIR:-/tmp}/selftest.XXXXXX") || exit 1
grep -v 'https://' fixtures/icons.md > "$tmp/tok.md"
t0=$(date +%s)
out=$(ICONIFY_API=http://127.0.0.1:9 sh verify_icons.sh "$tmp/tok.md")
rc=$?
secs=$(($(date +%s) - t0))
rm -rf "$tmp"
if [ "$rc" = 3 ] && [ "$secs" -lt 30 ] && printf '%s\n' "$out" | grep -q '^UNVERIFIED 14 Iconify refs'; then
  pass "verify_icons: API unreachable -> 14 refs unverified, exit 3, ${secs}s"
else
  bad "verify_icons with the API unreachable: exit $rc after ${secs}s:"
  printf '%s\n' "$out" | sed 's/^/  /'
fi
exit "$fail"
