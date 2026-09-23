#!/bin/sh
# check.sh - structure check of the d2-diagram skill (frontmatter, links and paths, reachability,
# a recipe heading per finding code, ASCII, size budgets, deleted paths, packaging hygiene,
# class lists, script syntax, allowed-tools coverage, templates, the svgpost wiring, no escape-hatch
# wording in the recipes, the recipe grep context, no way to write bytecode into the skill).
# usage: sh dev/tests/structure/check.sh [-v] [--skill DIR]
# needs python3 (d2 for the template fmt check); the checks are listed in check.py's header.
# exit: 0 all checks pass (warnings allowed) | 1 a check failed | 2 usage error
HERE=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
command -v python3 > /dev/null 2>&1 || { echo "check.sh: python3 is not on PATH" >&2; exit 2; }
PYTHONDONTWRITEBYTECODE=1 exec python3 "$HERE/check.py" "$@"
