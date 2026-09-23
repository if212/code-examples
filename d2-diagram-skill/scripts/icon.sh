#!/bin/sh
# icon.sh - search / verify / get icons for the d2-diagram skill.
# Zero dependencies beyond curl + grep/sed. All output is plain text.
#
# Usage:
#   icon.sh search <keywords> [prefixes]     # default prefixes: lucide,logos
#   icon.sh verify <prefix:name | url>       # prints HTTP status; 200 = usable
#   icon.sh get <prefix:name | url> <hex|-> <out.svg>
#       hex like 11567F pins monotone color (- = keep original, e.g. brand logos)
#
# Examples:
#   icon.sh search "message queue"           -> lucide:mail-open, lucide:inbox, ...
#   icon.sh verify lucide:lock               -> 200
#   icon.sh get lucide:lock 11567F lock.svg  -> colored SVG written

API="https://api.iconify.design"

url_for() {
  case "$1" in
    http*) printf '%s' "$1" ;;
    *:*)   printf '%s/%s/%s.svg' "$API" "${1%%:*}" "${1#*:}" ;;
    *)     echo "expected prefix:name or URL, got: $1" >&2; exit 2 ;;
  esac
}

case "$1" in
  search)
    q=$(printf '%s' "$2" | tr ' ' '+')
    p="${3:-lucide,logos}"
    curl -fsS "$API/search?query=$q&prefixes=$p&limit=32" \
      | grep -oE '"[a-z0-9-]+:[a-z0-9-]+"' | tr -d '"' | sort -u
    ;;
  verify)
    curl -fsS -o /dev/null -w '%{http_code}\n' "$(url_for "$2")"
    ;;
  get)
    u=$(url_for "$2"); hex="$3"; out="$4"
    [ -n "$out" ] || { echo "usage: icon.sh get <ref> <hex|-> <out.svg>" >&2; exit 2; }
    case "$hex" in
      -|[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]|[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]) : ;;
      *) echo "hex must be RGB, RRGGBB, or '-' (keep original), got: $hex" >&2; exit 2 ;;
    esac
    case "$u" in
      "$API"/*) [ "$hex" != "-" ] && u="$u?color=%23$hex" ;;
    esac
    tmp=$(mktemp) || exit 1
    curl -fsS "$u" -o "$tmp" || { rm -f "$tmp"; echo "fetch failed: $u" >&2; exit 1; }
    # Non-Iconify sources (e.g. raw lucide) ship currentColor; pin it here.
    if [ "$hex" != "-" ]; then sed -i.bak "s/currentColor/#$hex/g" "$tmp" && rm -f "$tmp.bak"; fi
    mv "$tmp" "$out" && echo "wrote $out"
    ;;
  *)
    sed -n '2,15p' "$0"; exit 2
    ;;
esac
