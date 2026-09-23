# Workflow: Icon Resolution

Run this BEFORE writing any `icon:` line into a `.d2`. Icon references are never written from memory - every name comes from a rung below.

## Resolution ladder (stop at the first rung that succeeds)

1. **Decision table** - `reference/15-icon-library.md` section "Concept -> icon". Covers the most common architecture concepts with pre-verified names. Found it -> go to rung 5.
2. **Bundled offline pack** - `ls <skill-dir>/assets/icons/`: 16 pre-colored Lucide SVGs, zero network. Use the local path in `icon:`.
3. **Search by concept** - `scripts/icon.sh search "<concept words>"` (Iconify index across `lucide,logos`; pass a third arg to widen prefixes). Results are real names from the live index, not guesses. Pick the best semantic match.
4. **Verify** - mandatory for ANY name not from rungs 1-2: `scripts/icon.sh verify <prefix:name>` must print `200`.
5. **Color rule** - monotone (lucide): pin the accent (`?color=%2311567F` under the Snowflake theme, or `icon.sh get <ref> 11567F <out.svg>`). Brand logos: keep original colors (`icon.sh get <ref> - <out.svg>`).
6. **Embed** - write the `icon:` line: URL form for networked renders, fetched local file for offline-required outputs. Local paths committed to a repo MUST be relative to the `.d2` file (`./icons/lock.svg`), never absolute - absolute paths silently break for teammates and CI.
7. **Post-render check** - the Visual Verification Loop's icon items (no empty boxes, consistent accent, zero emoji) close the loop. An empty box = a verification failure that escaped; treat per the failure ladder.

## Failure ladder

- Search returns nothing usable -> broaden keywords once; then fall back to the nearest decision-table concept.
- Verify != 200 -> the name does not ship. Return to rung 3.
- Network unavailable (corp proxy blocks `api.iconify.design`) -> rungs 1-2 only. Lucide names can alternatively be verified against `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<name>.svg` or `https://unpkg.com/lucide-static/icons/<name>.svg`. If a concept has no offline match, use a styled shape/class with a text label. NEVER an emoji.
- Icon renders as an empty box in the PNG -> re-run from rung 3.

## Permissions note

`icon.sh` shells out to curl; without an allow rule the first call prompts. To pre-approve, add a permission rule for the script's absolute path, e.g. `Bash(/Users/<you>/.claude/skills/d2-diagram/scripts/icon.sh *)`.
