# Icon Library and Images

D2 fetches `icon:` URLs at compile time and base64-embeds them into the SVG, so output artifacts are self-contained. Compiling with remote icons needs network; viewing the result does not.

## Icon sources, in order of preference

| Need | Source | Pattern |
|---|---|---|
| Generic concepts (db, queue, user, ...) | Lucide via Iconify API | `https://api.iconify.design/lucide/<name>.svg?color=%2311567F` |
| Brand / tech logos | Iconify `logos` set | `https://api.iconify.design/logos/<name>.svg` |
| Cloud provider stencils | Terrastruct hosted | browse `https://icons.terrastruct.com` |
| Offline / proxy-blocked env | bundled pack | `assets/icons/<name>.svg` in this skill's directory (16 pre-colored Lucide icons; see SKILL.md for resolved path) |

## Color rule (critical)

Monotone icons (Lucide) use `stroke="currentColor"`, which does NOT inherit when embedded as an image - it renders black. Always pin a color via `?color=%23RRGGBB` on the Iconify URL, and use ONE accent color for all concept icons in a diagram - under the Snowflake brand theme that accent is Mid-Blue #11567F (see reference/16-snowflake-brand.md). Brand logos keep their original colors; no color param.

## Verified names (checked against live packages, 2026-07)

Lucide (kebab-case) - safe: `database`, `server`, `cloud`, `cpu`, `hard-drive`, `users`, `user`, `file-text`, `globe`, `lock`, `key`, `shield-check`, `workflow`, `message-square`, `table`, `zap`, `webhook`, `git-branch`, `layers`, `box`, `container`, `terminal`, `activity`, `gauge`, `refresh-cw`, `search`, `filter`, `send`, `inbox`.
Gotcha: `api` does NOT exist - use `webhook`, `plug`, or `cable`.

`logos` set - safe: `aws`, `aws-lambda`, `aws-s3`, `aws-ec2`, `aws-rds`, `aws-dynamodb`, `snowflake-icon`, `docker-icon`, `kubernetes`, `postgresql`, `mysql`, `redis`, `mongodb`, `kafka-icon`, `python`, `typescript-icon`, `react`, `nodejs-icon`, `go`, `rust`, `java`, `github-icon`, `gitlab`, `git-icon`, `terraform-icon`, `grafana`, `prometheus`, `elasticsearch`, `nginx`, `airflow-icon`, `apache-spark`, `pandas-icon`, `jupyter`, `openai-icon`, `anthropic-icon`, `claude-icon`, `google-cloud`, `microsoft-azure`, `vercel-icon`, `cloudflare-icon`, `stripe`, `slack-icon`, `notion-icon`, `supabase-icon`, `datadog`, `dbt-icon`, `tableau-icon`.
Gotchas: `apache-kafka` x -> `kafka-icon`; `apache-airflow-icon` x -> `airflow-icon`; `snowflake` is the wordmark, `snowflake-icon` is the logomark - prefer `-icon` variants inside nodes.

## Verification protocol

Any name not in the lists above: verify BEFORE writing it into `.d2`:

```sh
curl -fsS -o /dev/null -w '%{http_code}\n' 'https://api.iconify.design/logos/<name>.svg'
```

Expect `200` - `scripts/icon.sh verify <prefix:name>` wraps the same check. If the corporate proxy blocks `api.iconify.design`, fall back to the bundled `assets/icons/` pack or a local icon directory.

## Usage

```d2
db: Orders DB {
  icon: https://api.iconify.design/lucide/database.svg?color=%2311567F
}

sf: Snowflake {
  shape: image
  icon: https://api.iconify.design/logos/snowflake-icon.svg
}
```

- Any URL can be used as `icon`; local file paths work with CLI renders.
- Container icons auto-place top-left. A leaf-node icon sits near the top of the node with the label above it; a one-line label clears it, but a multi-line label can overlap it (see "Leaf-node icon + multi-line label" below).
- Use `shape: image` for standalone logo nodes (icon only, no box).

## Leaf-node icon + multi-line label: reserve height

An embedded leaf-node icon is a fixed square (~64px) placed near the top of the
node. A one-line label clears it, but a **two-line label (or a larger
`font-size`) drops into the icon and overlaps it**, because D2 sizes the node to
the label and does not grow it to fit the icon. Give the icon node an explicit
`height` so the label is pushed clear:

- ~`height: 185` clears a 2-line label at `font-size: 18`; scale up with the
  font (about +6px of height per +1px of font). Verify from the rendered SVG
  rather than guessing (the Degraded-mode geometric check in `SKILL.md`).
- The icon stays a fixed 64px near the top, so extra height becomes empty space
  **below** it - use the smallest height that opens a clear gap.

## Legends

Build legends inside the diagram, as nodes that reuse the exact classes and icons of the elements they explain - never as emoji or plain-text keys outside the SVG. This keeps the legend visually truthful (it shows the real styling) and self-contained in the artifact:

```d2
legend: Legend {
  near: bottom-right
  gate: "human gate (agent prepares, you approve)" {
    class: sf-node
    icon: https://api.iconify.design/lucide/lock.svg?color=%2311567F
  }
}
```

Offline: `assets/icons/lock.svg` from the bundled pack works identically.

Note: `class: sf-node` comes from the Snowflake theme; D2 silently ignores unknown classes, so without the theme import the legend renders unstyled rather than erroring.

## Concept -> icon decision table (all names verified against the live package)

Architecture-diagram concepts, the fast path - covers ~80% of needs with zero network:

| Concept | Primary (lucide) | Alternatives |
|---|---|---|
| Database / persistence | `database` | `hard-drive` |
| Cache | `zap` | `database-zap` |
| Compute / service | `server` | `cpu` |
| Cloud / external service | `cloud` | `globe` |
| User / client | `user` | `users` |
| Message / queue | `message-square` | `layers`, `list-ordered` |
| API / interface | `webhook` | `plug` (`api` does NOT exist) |
| Gateway / routing | `router` | `network` |
| Auth / approval gate | `lock` | `shield-check`, `key` |
| Scheduled job | `clock` | `calendar`, `timer` |
| Monitoring / observability | `activity` | `gauge`, `eye` |
| Logs | `file-text` | `scroll-text` |
| Search / query | `search` | `filter` |
| Configuration | `settings` | `sliders-horizontal` |
| CI / release | `git-branch` | `package`, `rocket` |
| Alerting | `bell` | `triangle-alert` |
| AI / model | `brain` | `bot`, `sparkles` |
| ETL / transform | `shuffle` | `repeat`, `workflow` |
| Bidirectional sync | `arrow-right-left` | `repeat` |
| Containerization | `container` | `box`; brand: `logos:docker-icon`, `logos:kubernetes` |
| Success / failure state | `circle-check` | `circle-x` |
| Terminal / CLI | `terminal` | - |

## Search (when a concept is not in the table)

```sh
scripts/icon.sh search "message queue"        # -> lines of prefix:name, from the live Iconify index
scripts/icon.sh search "warehouse" logos      # widen/narrow prefixes with the 3rd arg
scripts/icon.sh verify lucide:lock            # -> 200 means usable
scripts/icon.sh get lucide:lock 11567F l.svg  # fetch + pin color; use '-' to keep original
```

Raw endpoint behind `search`: `https://api.iconify.design/search?query=<q>&prefixes=lucide,logos&limit=32`. Search results are real names from the index - they replace guessing, but any name taken from outside the table/pack still gets `verify` before shipping. If `api.iconify.design` is unreachable, lucide names can be verified against `https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/<name>.svg` or `https://unpkg.com/lucide-static/icons/<name>.svg`.
