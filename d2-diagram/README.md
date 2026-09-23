# d2-diagram: polished technical diagrams from a sentence

A skill for Claude (Claude Code and other Agent Skills hosts) that turns a request
such as "draw our checkout architecture for the README, highlight the orders
service" into a finished diagram: an SVG that reads well at the size it will be
shown, plus the D2 source to change it later.

Claude does not just write D2 and hope. For every diagram it:

1. writes a short **brief**: who reads it, where (README column, slide), the one
   thing to highlight, and every box and arrow the request implies;
2. starts from a **template** matched to the request (architecture, sequence,
   ERD, state machine, ...) and a **design system** (role classes, one accent
   colour, bundled fonts);
3. renders with **d2check**, which lints the geometry (text too small at the
   target width, edges through boxes, labels on bends, crossings), compares the
   drawing with the brief (missing, reversed or misrouted arrows, a lost
   highlight), and rasterizes the exact SVG it ships so Claude can look at it;
4. fixes what the checks and its own eyes find, using a catalog of proven
   recipes, and reports honestly how the result was verified.

**Before and after.** Plain D2 output dropped into an 800px README column is
typically lavender boxes, 28px container titles with arrows running through
them, grey italic edge labels and curved splines, and, when the canvas is wider
than the column, text shrunk to 7-9px. Through this skill the same content comes
out as a light, calm card: slate boxes with one blue focus path, small
uppercase group titles tucked in the corner, upright 14px edge labels, straight
orthogonal arrows, and a layout sized for the column, so the smallest text
stays at 12px or more and the height within 1.6x the width.

## What is in the box

| Part | What it gives you |
|---|---|
| Templates | 23 finished starting diagrams, one per question a reader asks ([the catalog](#templates)); [workflows/route.md](workflows/route.md) routes a request to one |
| Design system | [templates/neutral-theme.d2](templates/neutral-theme.d2): role classes (`service`, `datastore`, `focal`, `zone`, `flow`, ...), light-only, contrast-checked; plus a Snowflake brand theme |
| Playbooks | Nine sets of per-type rules that make the difference: [playbooks/](playbooks/) |
| d2check | One command: format, ASCII check, render, lint, semantic check, faithful PNGs, a clear summary with exit codes |
| Recipes | [workflows/review-and-fix.md](workflows/review-and-fix.md): one proven fix for every finding code, plus d2's compile errors |
| Icons | A resolver backed by 250 verified icon names ([workflows/icons.md](workflows/icons.md)) and an offline pack of 40 Lucide icons |
| Fonts | IBM Plex Sans and Geist Mono (Lato for Snowflake), embedded in every SVG |
| Export | PNG and PDF made from the reviewed SVG; animated SVG and ASCII with the same flags; GIF and PPTX through d2's own exporter, which needs a one-time driver install ([reference/export.md](reference/export.md)) |

## Prerequisites

| Tool | Needed for | Required |
|---|---|---|
| d2 0.7.1 or newer | rendering | yes |
| python3 3.8 or newer (standard library only) | lint, semantic check, rasterizer driver | yes; without it d2check renders but cannot review |
| node 18+ with Playwright and its Chromium, or any Chrome/Chromium | the faithful review (Claude looks at exactly what ships), PNG and PDF export | strongly recommended; without it reviews are "NOT visually reviewed" |
| rsvg-convert | an approximate fallback rasterizer (substitute fonts) | optional |
| curl | fetching and verifying icons; the offline pack works without it | optional |

Install commands:

| | macOS (Homebrew) | Debian / Ubuntu | Fedora |
|---|---|---|---|
| d2 | `brew install d2` | `curl -fsSL https://d2lang.com/install.sh \| sh -s -- --method standalone --prefix "$HOME/.local"` | same as Debian |
| python3 | `brew install python` | `sudo apt install python3` | `sudo dnf install python3` |
| node | `brew install node` | `sudo apt install nodejs npm` (Debian 12+, Ubuntu 24.04+ ship node 18+) | `sudo dnf install nodejs npm` |
| Playwright + Chromium | `npm i -g playwright && npx playwright install chromium` | same; missing system libraries: `sudo npx playwright install-deps chromium` | same |
| rsvg-convert | `brew install librsvg` | `sudo apt install librsvg2-bin` | `sudo dnf install librsvg2-tools` |
| curl | preinstalled (or `brew install curl`) | `sudo apt install curl` | `sudo dnf install curl` |

- d2 has no apt package. The command above puts it in `~/.local/bin`: make
  sure that is on your `PATH`. `go install oss.terrastruct.com/d2@latest` also
  works.
- With a system node (apt, dnf), `npm i -g` needs sudo. No sudo at all: once
  the skill is installed (next section), `sh scripts/doctor.sh --install`, run
  from the skill folder, installs d2 into `~/.local` and Playwright with its
  Chromium into your user directories. It prints every command before it runs
  it (`--install --dry-run` only prints them).
- Already have Chrome, Chromium or Edge? You can skip node and Playwright: it
  is found on `PATH` or in `/Applications`; anywhere else, export `CHROME_PATH`
  (the binary) in your shell profile before you start Claude.
- Windows: use WSL. The scripts are POSIX `sh`.

## Install the skill

Pick one:

```sh
# personal: every project on this machine
mkdir -p ~/.claude/skills && cp -R d2-diagram ~/.claude/skills/

# one project: commit it with the repo
mkdir -p .claude/skills && cp -R d2-diagram .claude/skills/

# from the packaged zip (its root folder is d2-diagram/)
unzip d2-diagram.zip -d ~/.claude/skills/
```

Upgrading, including from the earlier d2-diagram skill: delete the old folder
first (`rm -rf ~/.claude/skills/d2-diagram`). Copying over it keeps files the
new version removed, and `unzip` stops to ask about every file it would
replace.

The zip is built from the source repository with `sh dev/package.sh`; the
maintainer guide is `dev/README.md` there (`dev/` is not in the zip).

## Check the setup

```sh
sh ~/.claude/skills/d2-diagram/scripts/doctor.sh
```

It checks d2 (with a real test render), python3, node, Playwright, a
launchable Chromium, a faithful end-to-end PNG, rsvg-convert, curl, the bundled
fonts, the icon API and the work directory, and prints the fix for every gap:

```
  PASS  d2          v0.7.1 at /usr/local/bin/d2
  PASS  fonts       bundled fonts present (IBM Plex Sans, Geist Mono, Lato; 1352 KB)
  PASS  render      a test diagram renders with ELK and the bundled fonts
  ...
  PASS  chromium    Chromium 141.0.7390.37 (installed by Playwright)
  ...
  PASS  raster      faithful PNG of the test diagram via playwright
  ...
verdict: READY - d2check renders and gives a faithful visual review (exit 0)
```

Exit 0 is READY, 3 is DEGRADED (renders, but no faithful review: install
Chromium), 1 means d2 itself is missing or broken. `--json` gives a
machine-readable result, `--offline` skips the network check.

## Quick start (one minute)

**Ask Claude.** In Claude Code, describe the diagram, or call the skill
directly:

```
/d2-diagram Architecture of our checkout for the README: web and mobile apps
call an API gateway that routes to orders, payments and catalog; orders write
to Postgres and publish events to Kafka. Highlight orders.
```

Claude writes the brief, copies the matching template and the theme next to
your file, renders and inspects it, fixes what it finds, and delivers
`<name>.svg` with `<name>.d2` and `neutral-theme.d2` beside it, followed by a
short report: what it drew, how it was verified (`Reviewed: faithful
(playwright)`), what it assumed and anything left open. To change an existing
diagram, point it at the file: `/d2-diagram docs/checkout.d2 make payments
async`.

**Or run the loop yourself** on a template:

```sh
SK=~/.claude/skills/d2-diagram
mkdir -p /tmp/demo && cp "$SK"/templates/neutral-theme.d2 "$SK"/templates/architecture.d2 /tmp/demo/
sh "$SK"/scripts/d2check.sh /tmp/demo/architecture.d2
```

```
fonts: default (assets/fonts/ibm-plex-sans)
render: ok /tmp/demo/architecture.svg (elk)
semantic: source checks only - no brief (write /tmp/d2work/architecture/architecture.brief, format: workflows/brief.md)
display: 800x886 at column 800 (scale 0.99), min text 13.8px
lint: 0 error(s), 0 warning(s)
reviewed: faithful (playwright)
READ: /tmp/d2work/architecture/architecture.col.png /tmp/d2work/architecture/architecture.2x.png
re-render: d2 $(sh /home/me/.claude/skills/d2-diagram/scripts/font-flags.sh default) --scale 1 --elk-nodeNodeBetweenLayers 40 --elk-edgeNodeBetweenLayers 20 --elk-padding '[top=50,left=50,bottom=30,right=50]' /tmp/demo/architecture.d2 /tmp/demo/architecture.svg
result: exit 0 - clean: read the PNGs and walk the rubric before delivering
```

(Under a skill path with spaces, `re-render:` spells out each font path.)
Without a brief, d2check still runs the source checks (a misspelled class, an
unpinned layout engine, mixed icon families). The SVG lands next to the source; review PNGs and other working files go to
`${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>/`, never next to your files. Useful
options: `--column 1600` (slides), `--brief FILE` (semantic check),
`--check-fmt`, `--strict`, `--json`; `sh "$SK"/scripts/d2check.sh --help`
lists them all.

| d2check exit | Meaning |
|---|---|
| 0 | clean; warnings, if any, are listed with their recipe |
| 1 | the file does not format or compile: d2's error plus a `hint:` line |
| 2 | errors to fix (E- geometry, S- meaning) or non-ASCII labels |
| 3 | rendered, but no faithful rasterizer: run doctor.sh |

## Templates

Every template is a finished diagram that renders clean through d2check at an
800px column; Claude copies the one that answers the reader's question and
swaps in your content. [workflows/route.md](workflows/route.md) does the
routing, from the question a request asks rather than the word it uses (a
"flowchart of how our services talk" is an architecture diagram).

| Template | The question it answers | Example request |
|---|---|---|
| `architecture.d2` | What are the parts, and which talks to which at runtime? | "Architecture of our checkout for the README; highlight the orders service." |
| `context.d2` | Who uses this system, and what does it depend on? | "C4 context diagram of the billing system for new joiners." |
| `c4.d2` | Which deployable containers make up one system, with which tech? | "C4 container view of the booking service, with the tech of each part." |
| `llm-app.d2` | Which parts does a request to the model touch? | "Our RAG chatbot: the Slack bot, the agent, Claude, its tools and the vector store." |
| `deployment.d2` | Where does each part run, and how many copies? | "Kubernetes view of the shop: namespaces, replicas, the RDS database." |
| `network.d2` | What can reach what, through which gateway or rule? | "Our prod VPC: two AZs, public and private subnets, ALB, NAT, RDS." |
| `threat-model.d2` | Where does sensitive data cross a trust boundary, and what crosses? | "Data-flow diagram of card data through checkout for the PCI review." |
| `pipeline.d2` | Where does data come from, what happens at each stage, where does it land? | "Our ELT: Fivetran into raw, dbt staging and marts, Looker on top." |
| `depgraph.d2` | What depends on what, and where are the cycles? | "Graph of which of our Go modules import which, cycles in red." |
| `tree.d2` | How does the whole break down, one parent each? | "Org chart of the data department: the head, three leads, their teams." |
| `stack.d2` | What sits on top of what? | "Our platform as layers, from the web UI down to storage." |
| `sequence.d2` | Who calls whom, in what order, and what comes back? | "Sequence diagram of the OAuth login with PKCE." |
| `walkthrough.d2` | Which path does ONE request take through the parts, in order? | "Number the hops of one upload, from the browser through the CDN to S3." |
| `erd.d2` | Which tables exist, and how do their keys join? | "ERD of the orders schema with the foreign keys." |
| `class.d2` | Which types exist, and how do they inherit or compose? | "UML class diagram of the notification senders and their interface." |
| `flowchart.d2` | What happens next, and under which condition? | "Our release process from merge to production, with the approval gate." |
| `swimlane.d2` | Who does each step, and where does work change hands? | "Expense approval: employee, manager and finance, who does what." |
| `state.d2` | Which states can one thing be in, and what moves it? | "State machine of a subscription: trial, active, past due, cancelled." |
| `compare.d2` | What changes between A and B? | "Before and after we put a cache in front of the pricing service." |
| `steps.d2` | How does the picture change from one step to the next? | "One slide per step of a blue-green deployment." |
| `timeline.d2` | What happened when, in what order? | "Timeline for the postmortem: 09:02 deploy, 09:05 alerts, 09:31 rollback." |
| `roadmap.d2` | What ships when, per stream? | "Roadmap slide: these items per quarter for the web and data teams." |
| `gitflow.d2` | Which branch is cut from where, and where does it merge back? | "Our branching model: main, develop, release and hotfix branches." |

Past a template's budget (about 15 boxes at 800px), Claude splits the
picture into an overview and a detail, or into step boards. Two questions in
one request become two diagrams.

## Fonts and themes

- d2check embeds the bundled fonts in every SVG, so readers never depend on
  installed fonts. Default: IBM Plex Sans with Geist Mono for code. A file that
  imports `snowflake-brand` gets Lato. `D2_FONT_FAMILY=geist` gives a softer
  look, `D2_FONT_FAMILY=d2-default` d2's own fonts. Details:
  [assets/fonts/README.md](assets/fonts/README.md).
- Edge labels are upright on purpose: they read better at column size, and d2
  measures them with the face it draws.
- The neutral theme is light-only: the SVG carries its own white canvas and
  shows as a light card on dark pages. It sets the ELK layout and a 24px pad,
  so the command line never needs `-l`, `-t` or `--pad`. Roles, colours and the
  type scale: [reference/design-system.md](reference/design-system.md). Snowflake
  brand: [reference/brand-snowflake.md](reference/brand-snowflake.md).

## Troubleshooting

Run the commands below from the skill folder (`cd ~/.claude/skills/d2-diagram`).

| Symptom | Fix |
|---|---|
| `reviewed: NOT visually reviewed`, exit 3, or doctor says DEGRADED | No usable Chromium. `npx playwright install chromium`, or export `CHROME_PATH=/path/to/chrome` before starting Claude, or `sh scripts/doctor.sh --install`. |
| `reviewed: approximate (rsvg)` | Only rsvg-convert worked: fonts are substituted, so label fit is not verified. Install Chromium as above. |
| `fonts: d2 default (...)` in d2check's output | A bundled font file is missing: reinstall the skill (the `assets/fonts` folder is part of it). |
| `failed to install Playwright: could not install driver` (404) | That is d2's own PNG/PDF export, whose driver download host is gone on every platform. The skill never uses it: PNG and PDF come from `scripts/d2raster.py` and `scripts/raster.cjs`. For d2's PPTX/GIF see [reference/export.md](reference/export.md) section 7. |
| `npx playwright install chromium` fails behind a proxy or offline | Use a system Chrome/Chromium via `CHROME_PATH`, or install the browser where it can download and set `PLAYWRIGHT_BROWSERS_PATH`. |
| Icons: `icon.sh` exits 3, or a render says `failed to bundle remote images` | No network or rate limited: `icon.sh get` falls back to unpkg, then to the offline pack in `assets/icons/`. Use local icon files; d2 embeds them. |
| `d2 is not on PATH` | Install d2 (above), or `sh scripts/doctor.sh --install`. |
| A raw `d2` command never returns | `D2_WATCH` is set in your shell, or `-w` was passed. d2check ignores d2's environment variables; watch mode: [reference/export.md](reference/export.md) section 9. |
| Claude asks permission for many commands | The skill pre-approves d2, its own scripts and `cp`/`mkdir`/`ls`; anything else asks once. |

## For maintainers

Layout, tests, packaging, adding a template, a lint code or a recipe, the
release checklist and the known d2 0.7.1 quirks: `dev/README.md` in the source
repository. `dev/` is not part of the packaged skill.

## License

- The skill's own files (docs, templates, scripts): MIT.
- Fonts in `assets/fonts/`: SIL Open Font License 1.1, each with its `OFL.txt`.
  "Plex" and "Lato" are Reserved Font Names: ship those files unmodified. SVGs
  that embed them are documents, which the OFL does not restrict.
- Icons in `assets/icons/`: Lucide, ISC License (`assets/icons/LICENSE`).
  Icons you fetch with `icon.sh` keep the license of their Iconify set.
