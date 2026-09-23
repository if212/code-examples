#!/bin/sh
# font-flags.sh - print the d2 --font-* flags of one bundled font family, one flag per line.
# d2check.sh calls it for every render; call it yourself only to render with raw d2.
#
# usage: sh font-flags.sh [FAMILY]   FAMILY defaults to $D2_FONT_FAMILY, else "default"
#        sh font-flags.sh --list     print the family names
#
#   default          IBM Plex Sans + Geist Mono (winner of the blind font bake-off)
#   geist            Geist + Geist Mono (softer, rounder alternative)
#   brand-snowflake  Lato + Geist Mono (used for files that import snowflake-brand)
#   d2-default       prints nothing: d2's built-in Source Sans Pro + Source Code Pro
#
# Every family passes its Regular face as --font-italic and --font-mono-italic, so edge
# labels render upright and d2 measures them with the face it draws (assets/fonts/README.md).
# Paths are absolute, resolved from this script's own location, so any cwd works.
# exit codes (shared by every script of the skill):
#   0 flags printed (nothing for d2-default) | 1 a font file is missing | 64 unknown family
# examples:
#   d2 $(sh font-flags.sh) in.d2 out.svg              (word splitting: a skill path without spaces)
#   D2_FONT_FAMILY=geist sh d2check.sh in.d2          (d2check picks the family itself)
set -u

here=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd) || exit 1
fonts="$(dirname -- "$here")/assets/fonts"

[ $# -le 1 ] || { printf 'font-flags: one FAMILY at most, got: %s - usage: sh font-flags.sh [FAMILY]\n' "$*" >&2; exit 64; }
fam=${1:-${D2_FONT_FAMILY:-default}}
case $fam in
  -h | --help) awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit 0 ;;
  --list) printf '%s\n' default geist brand-snowflake d2-default; exit 0 ;;
  default) sans=ibm-plex-sans/IBMPlexSans semi=SemiBold ;;
  geist) sans=geist/Geist semi=Bold ;;
  brand-snowflake) sans=lato/Lato semi=Bold ;;
  d2-default) exit 0 ;;
  *)
    printf 'font-flags: unknown family "%s" - use one of: default geist brand-snowflake d2-default\n' \
      "$fam" >&2
    exit 64 ;;
esac
mono=geist-mono/GeistMono

# role -> file; semibold is used only by markdown labels, mono-semibold by nothing in d2 0.7.1
set -- regular "$sans-Regular.ttf" italic "$sans-Regular.ttf" \
  bold "$sans-Bold.ttf" semibold "$sans-$semi.ttf" \
  mono "$mono-Regular.ttf" mono-italic "$mono-Regular.ttf" \
  mono-bold "$mono-Bold.ttf" mono-semibold "$mono-Bold.ttf"
out=""
while [ $# -ge 2 ]; do
  if [ ! -f "$fonts/$2" ]; then
    printf 'font-flags: missing %s (family %s) - reinstall the skill; check: sh %s/doctor.sh\n' \
      "$fonts/$2" "$fam" "$here" >&2
    exit 1
  fi
  out="$out--font-$1=$fonts/$2
"
  shift 2
done
printf '%s' "$out"
