# Bundled fonts

d2 embeds the fonts it renders with into every SVG (a per-diagram subset), so the
output never depends on fonts installed on the reader's machine. d2 accepts fonts
only as CLI flags (`--font-*`, or the matching `D2_FONT_*` variables); a `.d2`
file cannot choose them. d2check takes its flags from `scripts/font-flags.sh`, and
the flags are also on the `re-render:` line d2check prints. Never pass `--font-*`
by hand.

| Family | Sans | Mono | Used when |
|---|---|---|---|
| `default` | IBM Plex Sans | Geist Mono | every diagram, unless a row below applies |
| `brand-snowflake` | Lato | Geist Mono | the file or one of its imports references `snowflake-brand` |
| `geist` | Geist | Geist Mono | opt-in: `D2_FONT_FAMILY=geist` (a softer, rounder look) |
| `d2-default` | Source Sans Pro (built into d2) | Source Code Pro (built into d2) | opt-in: `D2_FONT_FAMILY=d2-default` |

`D2_FONT_FAMILY` overrides d2check's automatic choice. The script on its own:

```sh
sh ${CLAUDE_SKILL_DIR}/scripts/font-flags.sh [family]   # one --font-<role>=<abs path> per line
sh ${CLAUDE_SKILL_DIR}/scripts/font-flags.sh --list     # family names
```

With no argument it uses `$D2_FONT_FAMILY`, else `default`. `d2-default` prints
nothing. An unknown family (exit 64) or a missing file (exit 1) prints a message
on stderr and no flags; d2check then falls back to d2's built-in fonts, and
`sh ${CLAUDE_SKILL_DIR}/scripts/doctor.sh` reports the missing file.

## Roles

| d2 flag | Draws | `default` | `brand-snowflake` | `geist` |
|---|---|---|---|---|
| `--font-bold` | node labels, container titles | IBMPlexSans-Bold | Lato-Bold | Geist-Bold |
| `--font-regular` | `bold: false` labels, sql_table, sequence actors, `shape: text` | IBMPlexSans-Regular | Lato-Regular | Geist-Regular |
| `--font-italic` | edge labels, sequence messages, `italic: true` | IBMPlexSans-Regular | Lato-Regular | Geist-Regular |
| `--font-semibold` | markdown headings and bold (markdown labels only) | IBMPlexSans-SemiBold | Lato-Bold | Geist-Bold |
| `--font-mono` | code blocks, `shape: class`, `style.font: mono` | GeistMono-Regular | same | same |
| `--font-mono-bold` | code keywords, mono node labels | GeistMono-Bold | same | same |
| `--font-mono-italic` | mono edge labels | GeistMono-Regular | same | same |
| `--font-mono-semibold` | nothing in d2 0.7.1 | GeistMono-Bold | same | same |

## Upright edge labels

Every family passes its Regular file as `--font-italic` and `--font-mono-italic`.

- Legibility: at doc-column size, italic strokes blur, and edge labels are often
  code-like (`POST /orders`, `user_id`). Upright text reads as literal text.
  Both judge reports that compared the two modes chose upright for every font.
- Geometry: d2 0.7.1 measures an edge label with the italic face, even when its
  class sets `italic: false`. With a real italic file, the label is drawn wider
  than the space d2 measured, and the edge line runs into the text (Lato: 8-10px
  of overlap). With Regular in both roles, every label has a clear gap.
- Side effect: `italic: true` captions and markdown `*emphasis*` also render
  upright. Mark emphasis with color, size or weight instead. No italic files
  are shipped.

## Why these faces

A blind bake-off compared 9 sans faces on architecture, flowchart, ERD and
sequence diagrams, and 4 mono faces on the ERD.

- **IBM Plex Sans**: ranked first by all three judges. It is the only candidate
  that keeps `I l 1` distinct (serifed I, tailed l, 1 with a base), draws `0`
  narrower than `O`, and has top bold-to-regular contrast, so node labels stand
  clearly above edge labels.
- **Geist Mono**: the top-ranked mono. It has a slashed zero, a tall
  x-height and a firm bold for SQL keywords.
- **Geist**: the runner-up sans, with the most polished, even texture. It
  separates look-alike characters less clearly (plain I, 1 without a base), and
  layouts come out about 3% wider.
- **Lato**: for the Snowflake brand only. Its bold is light, which ranked it low
  as a general default.

## Files

| Dir | Files | Version | Source |
|---|---|---|---|
| `ibm-plex-sans/` | `IBMPlexSans-{Regular,SemiBold,Bold}.ttf`, `OFL.txt` | 3.005 | https://github.com/IBM/plex/releases/download/%40ibm%2Fplex-sans%401.1.0/ibm-plex-sans.zip (`fonts/complete/ttf/`) |
| `geist-mono/` | `GeistMono-{Regular,Bold}.ttf`, `OFL.txt` | 1.700 | https://github.com/vercel/geist-font/releases/download/1.8.0/geist-font-1.8.0.zip (`fonts/GeistMono/ttf/`) |
| `geist/` | `Geist-{Regular,Bold}.ttf`, `OFL.txt` | 1.800 | same zip (`fonts/Geist/ttf/`) |
| `lato/` | `Lato-{Regular,Bold}.ttf`, `OFL.txt` | 1.104 | the Google Fonts family download (https://fonts.google.com/download/list?family=Lato lists the fonts.gstatic.com files) |

The four directories hold 1.32 MB in total (limit: 1.5 MB). Every TTF is an unmodified
official static build; each was checked by sha256 against a fresh download.

- **Lato version.** Google Fonts distributes Lato 1.104 ("Western+Polish",
  275 glyphs, about 75 KB per face). The 2.015 release adds Cyrillic, Greek
  and IPA and weighs 656 KB per face; labels are ASCII, so 1.104 draws every
  character they can hold. ASCII advance widths differ from 2.015 by less
  than 1% over a typical label.

- **License.** All four families use the SIL Open Font License 1.1. Each
  directory has a verbatim copy of its license; IBM Plex's copyright line
  contains a UTF-8 (c) sign.
- **Reserved names.** "Plex" and "Lato" are Reserved Font Names. Never subset,
  convert or edit those files in place; a modified copy must be renamed.
- **Output.** SVGs made with these fonts are documents, which the OFL does not
  cover.

## Changing a family

- Use official static TTFs. A variable TTF loads, but d2 drops its variation
  data and renders every role at the default weight.
- Add `<slug>/` with Regular and Bold files plus the license, add one `case`
  line to `scripts/font-flags.sh`, then render with d2check and read the column
  PNG.
- d2 measures text with the same TTF it embeds, so boxes fit any face. It does
  drop kerning and OpenType features, which means alternate glyphs (such as a
  slashed zero in a sans) cannot be switched on.
- Keep d2check's `text-rendering:geometricPrecision` post-process. Without it,
  Chromium rounds glyph advances, and a 31-character mono line overflows its
  code box.
