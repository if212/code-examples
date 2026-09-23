#!/bin/sh
# icon.sh - find, check, fetch and recolor icons for D2 diagrams.
# Run as: sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh <command> [args]
#
#   search <words> [prefixes] [max]   live names, best match first (max 30):
#       exact name, all words, lucide, then the prefix order
#       prefixes: lucide,logos,k8s (default), any Iconify list, all, or tt
#       (tt = icons.terrastruct.com AWS/Azure/GCP stencils, printed as URLs)
#   verify <ref>...                   '<status> <ref> [note]' per ref;
#                                     exit 0 only if every status is 200
#   get [--color <hex|->] <ref>... <dir>  download into dir: lucide:x -> x.svg,
#       k8s:x -> k8s-x.svg, a terrastruct URL -> terrastruct-<name>.svg;
#       a failed ref is reported and skipped, the others are still fetched
#   get [--color <hex|->] <ref> <out.svg> one icon to a file
#   get <ref> <hex|-> <out.svg>       the same, color as 2nd argument
#       color: default 475569, pins a one-color icon; '-' keeps the
#       original colors (logos, k8s)
#   tint <hex> <dir> [srcdir]         copy the offline pack (or srcdir/*.svg)
#                                     recolored; logos and k8s files skipped
#
# ref: prefix:name (lucide:database, logos:kafka-icon, k8s:pod) or https URL.
# hex: 6 digits, no '#' (an unquoted # starts a shell comment).
# api.iconify.design unreachable or rate limited: lucide refs fall back to
# unpkg lucide-static (verify, get), then get copies the bundled pack.
# exit codes (shared by every script of the skill):
#   0 ok | 1 not found, no results | 3 network down, rate limited (429) or no curl | 64 usage
# Env ICONIFY_API, LUCIDE_STATIC, TERRASTRUCT override the hosts.
#
# examples:
#   sh icon.sh search "shopping cart"     -> lucide:shopping-cart first
#   sh icon.sh verify lucide:lock k8s:pod
#   sh icon.sh get lucide:lock lucide:mail icons/
#   sh icon.sh tint 11567F icons

API=${ICONIFY_API:-https://api.iconify.design}
LUCIDE_STATIC=${LUCIDE_STATIC:-https://unpkg.com/lucide-static/icons}
TT=${TERRASTRUCT:-https://icons.terrastruct.com}
DEFAULT_HEX=475569
HERE=$(cd "$(dirname "$0")" && pwd)
PACK="$HERE/../assets/icons"

die() {
  code=$1
  shift
  printf '%s\n' "$*" >&2
  exit "$code"
}
usage() { # $1 = exit code: 0 for --help (stdout), 64 for a usage error (stderr, after $2)
  if [ "${1:-64}" = 0 ]; then
    sed -n '2,/^$/p' "$0" | sed -e '/^$/d' -e 's/^# \{0,1\}//'
  else
    printf 'icon.sh: %s - the commands:\n' "${2:-usage error}" >&2
    sed -n '2,/^$/p' "$0" | sed -e '/^$/d' -e 's/^# \{0,1\}//' >&2
  fi
  exit "${1:-64}"
}
# http <url> [outfile]: prints the 3-digit status; 000 = host unreachable.
# Iconify answers bursts with 429: back off and retry (2+4+8 s).
http() {
  for pause in 2 4 8 0; do
    c=$(curl -s -L --connect-timeout 8 --max-time 60 -o "${2:-/dev/null}" \
      -w '%{http_code}' "$1" 2> /dev/null)
    if [ "$c" != 429 ] || [ "$pause" = 0 ]; then break; fi
    sleep "$pause"
  done
  printf '%s' "${c:-000}"
}

check_ref() {
  case "$1" in
    https://* | http://*) return 0 ;;
    *[!a-z0-9:-]* | :* | *: | *:*:*) ;;
    *:*) return 0 ;;
  esac
  die 64 "bad ref '$1': use prefix:name in lowercase (lucide:database) or an https URL"
}

is_hex() {
  case "${1#\#}" in
    [0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]) return 0 ;;
  esac
  return 1
}

recolor() { # $1 = hex, $2 = one-color SVG file -> stdout
  sed -e "s/currentColor/#$1/g" \
    -e "s/fill=\"#[0-9A-Fa-f]\{3,8\}\"/fill=\"#$1\"/g" \
    -e "s/stroke=\"#[0-9A-Fa-f]\{3,8\}\"/stroke=\"#$1\"/g" "$2"
}

# ---------------------------------------------------------------- search
iconify_query() { # $1 = words joined by +, $2 = prefixes or all
  if [ "$2" = all ]; then
    u="$API/search?query=$1&limit=999"
  else
    u="$API/search?query=$1&prefixes=$2&limit=200"
  fi
  qf=$(mktemp) || return 3
  c=$(http "$u" "$qf")
  if [ "$c" != 200 ]; then
    rm -f "$qf"
    [ "$c" = 429 ] && return 4
    return 3
  fi
  sed -n 's/.*"icons":\[\([^]]*\)\].*/\1/p' "$qf" | tr ',' '\n' | tr -d '"' | grep ':'
  rm -f "$qf"
  return 0
}

search_tt() { # $@ = words, ANDed over the icons.terrastruct.com file list
  cache="${TMPDIR:-/tmp}/d2-icon-cache"
  idx="$cache/terrastruct.txt"
  if [ ! -s "$idx" ]; then
    mkdir -p "$cache" || return 3
    curl -fsSL --connect-timeout 8 --max-time 180 "$TT/" 2> /dev/null |
      grep -oE '(aws|azure|gcp|dev|essentials|infra|tech|social)%2F[^" <>]*\.svg' |
      sort -u > "$idx.part"
    if [ ! -s "$idx.part" ]; then
      rm -f "$idx.part"
      return 3
    fi
    mv "$idx.part" "$idx"
  fi
  res=$(cat "$idx")
  for w in "$@"; do res=$(printf '%s\n' "$res" | grep -i -- "$w"); done
  printf '%s\n' "$res" | sed -e '/^$/d' -e "s|^|$TT/|"
}

cmd_search() {
  [ -n "$1" ] || usage 64 "search needs one or more words, e.g. search cart"
  words=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' ' ')
  pfx=$(printf '%s' "${2:-lucide,logos,k8s}" | tr -d ' ')
  max=${3:-30}
  case "$max" in '' | *[!0-9]*) die 64 "max must be a number, e.g. search cart lucide 10" ;; esac
  # shellcheck disable=SC2086 # split the words on purpose
  set -- $words
  [ $# -gt 0 ] || usage 64 "search needs letters or digits, e.g. search cart"
  if [ "$pfx" = tt ] || [ "$pfx" = terrastruct ]; then
    out=$(search_tt "$@") || die 3 "icons.terrastruct.com unreachable"
  else
    tmp=$(mktemp) || exit 1
    # group 0 = the whole phrase (Iconify ANDs its words), 1..n = one word each
    phrase=$(printf '%s' "$*" | tr ' ' '+')
    res=$(iconify_query "$phrase" "$pfx")
    case $? in
      0) ;;
      4)
        rm -f "$tmp"
        die 3 "api.iconify.design rate limited (429): retry in a minute"
        ;;
      *)
        rm -f "$tmp"
        die 3 "api.iconify.design unreachable: take names from reference/icons.md; get falls back to unpkg, then the bundled pack"
        ;;
    esac
    printf '%s\n' "$res" | sed -e '/^$/d' -e 's/^/0 /' > "$tmp"
    if [ $# -gt 1 ]; then
      g=0
      for w in "$@"; do
        g=$((g + 1))
        res=$(iconify_query "$w" "$pfx") &&
          printf '%s\n' "$res" | sed -e '/^$/d' -e "s/^/$g /" >> "$tmp"
      done
    fi
    # rank: exact name, all words matched, lucide, prefix order, word count
    exact=$(printf '%s' "$*" | tr ' ' '-')
    out=$(awk -v pl="$pfx" -v ex="$exact" '
      BEGIN { n = split(pl, P, ","); for (i = 1; i <= n; i++) R[P[i]] = i; R["lucide"] = 0 }
      { g = $1; nm = $2
        if (!(nm in F)) { F[nm] = NR; O[++c] = nm }
        if (g == 0) A[nm] = 1
        else if (!((nm, g) in S)) { S[nm, g] = 1; W[nm]++ } }
      END { for (i = 1; i <= c; i++) { nm = O[i]; split(nm, p, ":")
              r = (p[1] in R) ? R[p[1]] : 99
              printf "%d %d %02d %03d %07d %s\n", (p[2] == ex) ? 0 : 1, (nm in A) ? 0 : 1,
                r, 99 - W[nm], F[nm], nm } }
    ' "$tmp" | sort | cut -d' ' -f6)
    rm -f "$tmp"
  fi
  if [ -z "$out" ]; then
    case "$pfx" in
      all | tt | terrastruct) die 1 "no results - try a single, more generic keyword" ;;
    esac
    die 1 "no results - try a single, more generic keyword, or every set: search <word> all"
  fi
  total=$(printf '%s\n' "$out" | wc -l | tr -d ' ')
  printf '%s\n' "$out" | head -n "$max"
  [ "$total" -le "$max" ] ||
    printf '(%s more; use fewer words or narrower prefixes)\n' "$((total - max))" >&2
  return 0
}

# ---------------------------------------------------------------- verify
cmd_verify() {
  [ $# -gt 0 ] || usage 64 "verify needs refs, e.g. verify lucide:lock"
  rc=0 fellback=
  for ref in "$@"; do
    check_ref "$ref"
    note=
    case "$ref" in
      http*) code=$(http "$ref") ;;
      *)
        p=${ref%%:*} n=${ref#*:}
        code=$(http "$API/$p/$n.svg")
        if [ "$code" = 200 ]; then
          meta=$(curl -fsS --max-time 30 "$API/$p.json?icons=$n" 2> /dev/null)
          parent=$(printf '%s' "$meta" | sed -n 's/.*"parent":"\([a-z0-9-]*\)".*/\1/p')
          if [ -n "$parent" ]; then
            note="(alias: prefer $p:$parent)"
          else
            case "$meta" in *'"hidden":true'*) note="(deprecated: search for the current name)" ;; esac
          fi
        elif [ "$p" = lucide ] && { [ "$code" = 000 ] || [ "$code" = 429 ]; }; then
          c2=$(http "$LUCIDE_STATIC/$n.svg")
          if [ "$c2" != 000 ]; then
            code=$c2
            note="(checked on unpkg lucide-static)"
            fellback=1
          fi
        fi
        ;;
    esac
    [ "$code" = 000 ] && note="(host unreachable)"
    [ "$code" = 429 ] && note="(rate limited: retry in a minute)"
    echo "$code $ref${note:+ $note}"
    case "$code" in
      200) ;;
      000 | 429) [ "$rc" = 1 ] || rc=3 ;;
      *) rc=1 ;;
    esac
  done
  [ -z "$fellback" ] ||
    echo "api.iconify.design unreachable or rate limited: Iconify URLs will not render here; make local copies with get" >&2
  return "$rc"
}

# ---------------------------------------------------------------- get
# fetch_one <ref> <hex|-> <out.svg> <1 if color explicit>
# returns 0 written | 1 not found | 3 network down or 429 (message on stderr)
fetch_one() {
  ref=$1 hex=${2#\#} out=$3
  tmp=$(mktemp) || return 1
  pin='' p='' n='' why=''
  case "$ref" in
    http*)
      src=$ref
      pin=1
      ;;
    *)
      p=${ref%%:*} n=${ref#*:}
      src="$API/$p/$n.svg"
      [ "$hex" = - ] || src="$src?color=%23$hex"
      ;;
  esac
  code=$(http "$src" "$tmp")
  if [ "$p" = lucide ] && { [ "$code" = 000 ] || [ "$code" = 429 ]; }; then
    why=unreachable
    [ "$code" = 000 ] || why="rate limited (429)"
    src="$LUCIDE_STATIC/$n.svg"
    pin=1
    code=$(http "$src" "$tmp")
    if [ "$code" = 200 ]; then
      echo "api.iconify.design $why: $ref fetched from unpkg lucide-static" >&2
    elif { [ "$code" = 000 ] || [ "$code" = 429 ]; } && [ -f "$PACK/$n.svg" ]; then
      h=$hex
      [ "$h" != - ] || h=$DEFAULT_HEX
      recolor "$h" "$PACK/$n.svg" > "$tmp" && code=200 pin=
      echo "offline: $ref copied from the bundled pack" >&2
    fi
  fi
  if [ "$code" != 200 ]; then
    rm -f "$tmp"
    case "$code" in
      000 | 429)
        [ "$code" = 000 ] && m="host unreachable" || m="rate limited (429): retry in a minute"
        [ -z "$why" ] || m="$m (not in the bundled pack)"
        echo "$ref: $m" >&2
        return 3
        ;;
    esac
    echo "$code $ref: not fetched (check the name with verify)" >&2
    return 1
  fi
  if ! grep -q '<svg' "$tmp"; then
    rm -f "$tmp"
    echo "$ref: response is not an SVG" >&2
    return 1
  fi
  if [ "$hex" != - ]; then
    # non-Iconify sources ship currentColor, which d2 renders black: pin it
    if [ -n "$pin" ]; then
      sed "s/currentColor/#$hex/g" "$tmp" > "$tmp.x" && mv "$tmp.x" "$tmp"
    fi
    if [ -n "$4" ] && ! grep -qi "#$hex" "$tmp"; then
      echo "note: $ref has fixed colors (logo or k8s icon): color not applied" >&2
    fi
  fi
  if ! { mkdir -p "$(dirname "$out")" && cat "$tmp" > "$out"; }; then
    rm -f "$tmp"
    echo "$ref: cannot write $out" >&2
    return 1
  fi
  rm -f "$tmp"
  echo "wrote $out"
}

url_name() { # $1 = URL -> file name without .svg (terrastruct-<last segment>)
  b=${1%%\?*}
  b=$(printf '%s\n' "${b##*/}" | sed -e 's/%2[Ff]/\//g' -e 's/.*\///' -e 's/\.[Ss][Vv][Gg]$//' \
    -e 's/%[0-9A-Fa-f][0-9A-Fa-f]/-/g' | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9\n' '-' |
    sed -e 's/^-*//' -e 's/-*$//')
  case "$1" in
    *//icons.terrastruct.com/*) b="terrastruct-${b:-icon}" ;;
  esac
  printf '%s' "${b:-icon}"
}

cmd_get() {
  hex=$DEFAULT_HEX explicit=
  if [ "$1" = --color ]; then
    [ $# -ge 2 ] || usage 64 "get --color needs a value: 6 hex digits or -"
    hex=$2 explicit=1
    shift 2
  elif [ $# -eq 3 ]; then
    case "$2" in
      *:*) ;; # two refs and a dir: handled below
      *)
        hex=$2 explicit=1
        set -- "$1" "$3"
        ;;
    esac
  fi
  [ "$hex" = - ] || is_hex "$hex" || die 64 "bad color '$hex': use 6 hex digits without '#', or '-'"
  [ $# -ge 2 ] || usage 64 "get needs refs and a target: get lucide:lock icons/"
  for dst in "$@"; do :; done # the last argument is the target
  i=0
  for ref in "$@"; do
    i=$((i + 1))
    [ "$i" -lt $# ] || break
    check_ref "$ref"
  done
  case "$dst" in
    *.svg | *.SVG) # a file target takes exactly one ref
      [ $# -eq 2 ] || die 64 "several refs need a directory target: get <ref>... <dir>/"
      fetch_one "$1" "$hex" "$dst" "$explicit"
      return
      ;;
  esac
  rc=0 i=0
  for ref in "$@"; do
    i=$((i + 1))
    [ "$i" -lt $# ] || break
    case "$ref" in
      http*) f=$(url_name "$ref") ;;
      lucide:*) f=${ref#*:} ;;
      *) f="${ref%%:*}-${ref#*:}" ;; # k8s-pod.svg: semcheck sees the family
    esac
    fetch_one "$ref" "$hex" "${dst%/}/$f.svg" "$explicit"
    case $? in
      0) ;;
      1) rc=1 ;;
      *) [ "$rc" = 1 ] || rc=3 ;;
    esac
  done
  return "$rc"
}

# ---------------------------------------------------------------- tint
cmd_tint() {
  if [ $# -lt 2 ] || [ $# -gt 3 ]; then usage 64 "tint needs <hex> <dir> [srcdir]"; fi
  is_hex "$1" || die 64 "bad color '$1': use 6 hex digits without '#'"
  hex=${1#\#} dst=$2 src=${3:-$PACK}
  [ -d "$src" ] || die 1 "no such directory: $src"
  mkdir -p "$dst" || exit 1
  n=0 names=
  for f in "$src"/*.svg; do
    [ -f "$f" ] || continue
    b=$(basename "$f")
    k=$(grep -oE '(fill|stroke)="#[0-9A-Fa-f]{3,8}"' "$f" |
      sed 's/.*"#//; s/"$//' | tr '[:upper:]' '[:lower:]' | sort -u | wc -l | tr -d ' ')
    grep -q currentColor "$f" && k=$((k + 1))
    # one color, drawn as a line icon (stroke) or left as currentColor
    if [ "$k" -ne 1 ] || grep -qE '<style|url\(' "$f" ||
      ! grep -qE 'currentColor|stroke="#' "$f"; then
      echo "skip $b: not a one-color line icon (logo, k8s or styled SVG)" >&2
      continue
    fi
    recolor "$hex" "$f" > "$dst/.$b.tmp" && mv "$dst/.$b.tmp" "$dst/$b" || exit 1
    n=$((n + 1))
    names="$names ${b%.svg}"
  done
  [ "$n" -gt 0 ] || die 1 "no one-color SVG icons in $src"
  echo "wrote $n icons to $dst (#$hex):$names"
}

cmd=$1
[ $# -gt 0 ] && shift
case "$cmd" in
  search | verify | get)
    command -v curl > /dev/null 2>&1 || die 3 "icon.sh $cmd needs curl (macOS: brew install curl; Debian/Ubuntu: sudo apt install curl); offline, 'tint' still copies the bundled pack"
    ;;
esac
case "$cmd" in
  search) cmd_search "$@" ;;
  verify) cmd_verify "$@" ;;
  get) cmd_get "$@" ;;
  tint) cmd_tint "$@" ;;
  -h | --help | help) usage 0 ;;
  '') usage 64 "no command given" ;;
  *) usage 64 "unknown command '$cmd'" ;;
esac
