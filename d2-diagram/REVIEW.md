# Package Review - d2-diagram skill (final delivery)

Date: 2026-07-30 - Method: structured four-lens review (flow design / D2 correctness / security & portability / docs consistency). Every check below marked "verified" was actually executed in a Linux container against d2 v0.7.1 - not asserted from reading.

## Mechanically verified

- 17/17 shipped `.d2` files pass `d2 validate` (the brand example validated with its theme copied beside it, per its own instructions).
- Emoji tripwire `\p{Extended_Pictographic}` (ripgrep 14.1.0): catches emoji glyphs; zero hits on clean labels; **zero false positives on CJK-only labels**.
- `scripts/icon.sh`: shellcheck 0.9.0 clean (before and after the hex guard). `verify` returns 200 for real names and 404 for the classic non-existent `lucide:api`. `get` downloads and pins color; `currentColor` count is 0 afterward.
- Remote `icon:` URLs are fetched at compile time and base64-embedded into the SVG - outputs are self-contained.
- Undefined classes: D2 **silently ignores** them (validate passes, render succeeds unstyled). Encoded as a visual-loop check.
- Icon decision table: all 50 names re-verified against the live lucide package at build time; `logos` names verified against `@iconify-json/logos`.

## Findings and resolutions

| # | Severity | Finding | Resolution |
|---|---|---|---|
| F1 | High | Mandatory Flow enumerated six render commands inline; agents produced unrequested artifacts (`.txt` observed in the field) | Render step rewritten: SVG is the default deliverable; other formats only on explicit request via `workflows/export-publish.md`; "never emit unrequested artifacts" made a rule |
| F2 | High | Emoji ban was instruction-only; emoji reached rendered output and shredded ascii alignment | Mechanical tripwire added to the validate step (Grep `\p{Extended_Pictographic}`), tested including the CJK negative case |
| F3 | Medium | ascii `txt` output misaligns with wide glyphs (emoji/CJK) | Warning + mandatory user notice in `export-publish.md`; `examples/exports/ascii-safe.d2` cited |
| F4 | Medium | Unknown classes silently no-op - diagrams render "unstyled" with no error signal | New visual-loop check: unstyled render => missing theme import |
| F5 | Low | `icon.sh` interpolated unvalidated hex into `sed` | Input guard (RGB / RRGGBB / `-`); shellcheck re-run clean |
| F6 | Low | Icon verification docs predated `icon.sh` | Cross-reference added in `reference/15-icon-library.md` |
| F7 | Low | Legend snippet used `sf-node` without noting the theme dependency | Note added, including the silent-ignore behavior |
| F8 | Info | Delivery/quality gates lacked an unrequested-artifacts clause | Lines added to `checklists/delivery.md` and `checklists/quality-gate.md` |

## Known limitations (stated honestly)

- The Iconify `/search` endpoint could not be exercised from the build container (egress allowlist); its parsing logic was tested against canned response JSON. First live use is self-verifying, and the failure ladder in `workflows/icon-resolution.md` covers outages.
- PNG rendering downloads a headless Chromium (~140 MB) on first run - warm up outside agent loops: `echo 'a -> b' | d2 - /tmp/warmup.png`.
- TALA layout engine (closed-source) not installed or tested.
- This review was a single-reviewer structured pass, not an independent multi-agent evaluation. Recommended next step on the target machine: `skill-creator` benchmark A/B (with vs. without this skill; and current vs. any future edits).

## Post-delivery field findings (round 2)

From the first real run on a corp devbox (no Chromium, no rasterizer) and a scope decision:

| # | Severity | Finding | Resolution |
|---|---|---|---|
| F9 | Medium | Icon on the `sf-primary` fill used Mid-Blue: 3.33:1 there vs 7.89:1 on white nodes; white would fail at 2.37:1 | Theme rule: Midnight copies (8.87:1) on primary fills, or omit the icon |
| F10 | Medium | Absolute local icon paths written into a committed `.d2` | Icon workflow rung 6 now mandates paths relative to the `.d2` |
| F11 | Medium | No-PNG environment had no protocol; the agent substituted greps and over-claimed quality | Degraded-mode protocol: mechanical SVG checks + mandatory "mechanically verified only" wording; environment fixes listed |
| F12 | Low | Emoji tripwire had no fallback when the Grep tool is absent; the naive perl fallback tested inverted (byte mode) | Fixed with -CSD, then superseded entirely by F14 |
| F13 | Info | Unrequested ascii txt regenerated during a redo | Export scope note: regeneration does not inherit prior export lists |
| F14 | Scope | Skill narrowed to English-only deliverables | Tripwire upgraded to strict ASCII (`LC_ALL=C grep '[^ -~]'`, portable to every grep); CJK accommodations removed; every `.md`/`.d2` translated/normalized to pure ASCII; the package now passes its own tripwire |

## Post-delivery field findings (round 3)

| # | Severity | Finding | Resolution |
|---|---|---|---|
| F15 | Medium | The visual loop hard-wired inspection to d2's bundled Chromium; on a linux-arm64 devbox that download 404s, leaving no sanctioned way to close the loop | Chromium-free inspection route documented and tested (d2 -> svg, then rsvg-convert 2.58 or cairosvg -> png -> Read); ARM field note added |
| F16 | Info | Field agent verified topology via an ascii render in degraded mode - a sound technique the protocol had not sanctioned | Adopted as an official degraded-mode topology check (internal working file; export gating unchanged) |
