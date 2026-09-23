# Icons: when, which family, verified names

Steps and commands: `${CLAUDE_SKILL_DIR}/workflows/icons.md` (`icon.sh` below
is `sh ${CLAUDE_SKILL_DIR}/scripts/icon.sh`). Every name below returned HTTP
200 and is a current name, not an alias. Sizes: ELK, 16 px labels, d2 v0.7.1.

| Not here | Home |
|---|---|
| container title + icon combinations, leaf heights, icon-left card | `${CLAUDE_SKILL_DIR}/reference/layout.md` sections 5-6 |
| role classes, legends | `${CLAUDE_SKILL_DIR}/reference/design-system.md` |
| Snowflake colors | `${CLAUDE_SKILL_DIR}/reference/brand-snowflake.md` |
| `E-icon-collision`, `S-src-icon-family` | `${CLAUDE_SKILL_DIR}/workflows/review-and-fix.md` |

## 1. When to use icons

- Optional. Add an icon only where it makes a node's kind faster to
  recognize; the label still names the thing and its technology
  (`"Orders DB\nPostgres"`). An icon that needs a legend entry is the
  wrong icon (`d2-legend` draws icons about 12 px wide anyway).
- Yes: architecture, deployment, Kubernetes, pipeline and CI/CD diagrams.
  No: sequence, ERD, UML class, state and C4 diagrams, flowchart decisions.
- Shape first: a datastore is a cylinder and a queue or stream a queue
  shape, without an icon. Leaf icons go on rectangles only: even on ELK a
  2-line label overlaps the icon on diamonds, clouds, ovals and hexagons
  and touches it on cylinders, documents and packages.
- Budget: one icon per node at most; every peer of a role gets one or none
  does; about 10 per diagram; a container icon only on the outermost
  boundary. An icon makes a 1-line rectangle grow from 66 to 118 px tall
  (2 lines: 82 to 166 px); section 5 has a compact card.

## 2. One family per diagram

| Family | Use | Color |
|---|---|---|
| `lucide` (default) | generic concepts (section 6) | pinned to the theme's icon accent (section 3) |
| `k8s` | Kubernetes diagrams: every Kubernetes resource (section 7) | keep: blue badge, white glyph |
| `logos`, or one cloud set (`gcp`, Terrastruct) | only when every icon node is a named product (section 8) | keep the brand colors |

- A concept outside the chosen family gets no icon; its label carries it.
  In a k8s diagram the database is `"Orders DB\nPostgres"` with no logo.
- k8s icons are pre-colored notation, not brand logos: never recolor them,
  and do not put lucide icons beside them.
- semcheck reports a second family as `S-src-icon-family`.

## 3. Color

- Lucide draws with `currentColor`, which an embedded icon cannot inherit:
  unpinned, it renders black. `icon.sh get` pins it (default `475569`).
- One accent for every lucide icon, the imported theme's: `475569`
  (`ink-600`) in `neutral-theme.d2`, `11567F` (Mid-Blue) in `snowflake-brand.d2`.
- The accent reaches 6.9:1 or more on white and on 50-100 tints but fails
  3:1 on a solid fill (`475569` on `2563EB`: 1.5:1). There, use the node's
  text color (`icon.sh get --color FFFFFF lucide:server icons/server-light.svg`)
  or no icon.
- In an Iconify URL the color is `?color=%23475569`. A raw `#` starts a d2
  comment (a one-line map fails to compile, a multi-line one renders black);
  quoted, it becomes a URL fragment (black again).
- `logos`, `k8s`, `gcp` and Terrastruct icons keep their colors (`?color`
  has no effect on the Iconify ones).

## 4. Sources

| Source | Ref | Contents |
|---|---|---|
| Iconify `lucide` | `lucide:<name>` | 1853 line icons (ISC): the default family |
| Iconify `k8s` | `k8s:<name>` | the 38 official Kubernetes icons (Apache-2.0) |
| Iconify `logos` | `logos:<name>` | 1935 brand logos (CC0), 62 of them AWS services (`aws-*`) |
| Iconify `gcp` | `gcp:<name>` | 214 Google Cloud product icons |
| icons.terrastruct.com | https URL | AWS (778), Azure (262) and GCP (109) stencils: `search <word> tt`. Iconify has no Azure set. |
| unpkg `lucide-static` | automatic | lucide fallback when api.iconify.design is unreachable or rate limited |
| bundled pack | `${CLAUDE_SKILL_DIR}/assets/icons/` | 40 lucide icons in `475569` for offline use (section 9) |

URL form: `https://api.iconify.design/<prefix>/<name>.svg`, plus
`?color=%23<hex>` for lucide. Products with no icon in any source
(Fivetran, Snowpipe): a plain labeled node.

## 5. Placement

Geometry lives in layout.md: container title + icon combinations (section
5), leaf heights by shape and engine, and the icon-left card (section 6).
Icon recipes (ELK, 16 px labels):

| Need | Write | Result |
|---|---|---|
| compact card, icon above the label | `icon.near: top-center; label.near: bottom-center; height: 64` | d2 adds the label height to the 64: 90/106/122 px for 1/2/3 label lines (default placement: 118/166/214), 45-61 px icon, no overlap at auto width or 140-260 |
| the same card as a direct grid child | the same without `height` | 92/124/156 px. A set height is kept exactly: 96 or more for 2 lines, 112 or more for 3 |
| bare logo, no box | not `shape: image` | 128 px without a size; with a size d2lint reports `E-label-overflow` (the label sits outside the box) and ELK attaches edges beside the label. Use the card |
| container icon | title `label.near: top-left`, `icon.near: top-right` | layout.md section 5 |

Card height follows the label's line count: give peers the same line count.
No `width` in the class: a fixed width does not grow for a long label.

```d2
# cwd: ../assets
vars: {d2-config: {layout-engine: elk; pad: 24}}
classes: {icon-top: {height: 64; icon.near: top-center; label.near: bottom-center}}
# with the theme imported: class: [service; icon-top]
web: Web app {class: icon-top; icon: ./icons/app-window.svg}
mail: "Email\nSendGrid" {class: icon-top; icon: ./icons/mail.svg}
pay: "Payments\nStripe" {class: icon-top; icon: ./icons/credit-card.svg}
web -> mail
web -> pay
```

## 6. Concepts -> lucide names

Take the first name. The others are for when two concepts in one diagram
would otherwise share an icon: one icon, one meaning per diagram.

| Concept | Icon (lucide) | Also (lucide) |
|---|---|---|
| **architecture** | | |
| service, app server | `server` | `server-cog` `cpu` |
| component, module | `box` | `boxes` `package` |
| container (runtime) | `container` | `box` |
| serverless function | `square-function` | `zap` |
| API, endpoint | `braces` | `code-xml` `plug` |
| API gateway | `router` | `door-open` `network` |
| load balancer | `split` | `network` |
| DNS | `signpost` | `globe` |
| internet, public web | `globe` | `cloud` |
| external service (on a rectangle) | `cloud` | `globe` |
| cache (on a rectangle) | `database-zap` | `memory-stick` `zap` |
| object storage, bucket | `archive` | `hard-drive` `folder-open` |
| file, document | `file-text` | `folder` |
| scheduler, cron | `calendar-clock` | `clock` `timer` |
| background worker | `cog` | `server-cog` |
| webhook, callback | `webhook` | `send` |
| event, message | `message-square` | `send` `radio` |
| logs | `scroll-text` | `logs` `file-text` |
| monitoring, health | `activity` | `gauge` |
| metrics | `chart-line` | `gauge` |
| tracing | `route` | `waypoints` |
| alerting, on-call | `bell-ring` | `siren` `triangle-alert` |
| configuration | `settings` | `sliders-horizontal` `file-cog` |
| feature flag | `flag` | `toggle-right` |
| user (on a rectangle) | `user` | `circle-user` |
| team | `users` | `users-round` |
| admin, operator | `user-cog` | `shield-user` |
| search | `search` | `text-search` |
| terminal, CLI | `terminal` | `square-terminal` |
| **web, product** | | |
| CDN, edge | `earth` | `globe` |
| browser, web app | `app-window` | `panels-top-left` `monitor` |
| mobile app | `smartphone` | `tablet-smartphone` |
| email | `mail` | `send` `mails` |
| notification, push | `bell` | `bell-ring` `message-square` |
| chat | `messages-square` | `message-square-text` |
| payment | `credit-card` | `wallet` `banknote` |
| cart, checkout | `shopping-cart` | `shopping-bag` |
| order, invoice | `receipt` | `clipboard-list` |
| catalog, product | `tags` | `store` `book-open` |
| login, session | `log-in` | `cookie` |
| analytics | `chart-column` | `chart-pie` `chart-line` |
| **CI/CD** | | |
| repository | `folder-git-2` | `git-branch` |
| branch, commit | `git-branch` | `git-commit-horizontal` |
| pull request | `git-pull-request` | `git-merge` |
| lint, static analysis | `search-code` | `spell-check` `scan-search` |
| test | `flask-conical` | `test-tube` `list-checks` |
| build | `hammer` | `cog` |
| artifact, image | `package` | `boxes` `archive` |
| security scan | `shield-check` | `scan-search` `bug` |
| deploy | `rocket` | `cloud-upload` `upload` |
| canary | `bird` | `split` `percent` |
| approval gate | `user-check` | `stamp` `badge-check` |
| rollback | `undo-2` | `rotate-ccw` `rotate-ccw-clock` |
| release | `tag` | `milestone` `package-check` |
| pipeline | `workflow` | `git-merge` |
| **data, AI** | | |
| warehouse (on a rectangle) | `warehouse` | `database` |
| data lake | `waves-horizontal` | `droplets` |
| stream, event log (on a rectangle) | `audio-waveform` | `radio` |
| pub/sub topic (on a rectangle) | `radio` | `rss` |
| ETL, transform | `shuffle` | `blend` `arrow-right-left` |
| ingestion, connector | `import` | `plug` `cable` |
| orchestration | `workflow` | `calendar-clock` |
| table, dataset | `table` | `sheet` `table-2` |
| dashboard, BI | `layout-dashboard` | `chart-column` `chart-pie` |
| report | `file-chart-column` | `file-text` |
| ML model | `brain` | `brain-circuit` |
| notebook | `notebook-pen` | `book-open` |
| LLM, AI agent | `bot` | `sparkles` |
| **security** | | |
| authentication | `lock` | `log-in` `key-round` |
| identity provider, SSO | `id-card` | `fingerprint-pattern` `user-lock` |
| authorization, policy | `shield-check` | `scale` `file-lock` |
| secret, key, KMS | `key-round` | `lock-keyhole` `vault` |
| encryption, TLS | `lock-keyhole` | `shield-lock` |
| certificate | `file-badge` | `badge-check` `award` |
| firewall, WAF | `brick-wall-shield` | `brick-wall` `shield` |
| audit log | `file-clock` | `clipboard-list` |
| vulnerability scan | `scan-search` | `bug` |
| threat, incident | `shield-alert` | `siren` `triangle-alert` |

`lucide:api` does not exist (404): an API is `braces`.

## 7. Kubernetes (k8s family)

All 38 icons of the set; refs are `k8s:<name>`. The cluster itself is a
titled container without an icon.

| Resource | Icon (k8s) | Resource | Icon (k8s) |
|---|---|---|---|
| namespace | `namespace` | ingress | `ingress` |
| service | `service` | endpoints | `endpoints` |
| deployment | `deployment` | replica set | `replicaset` |
| pod | `pod` | stateful set | `statefulset` |
| daemon set | `daemonset` | job, cron job | `job` `cronjob` |
| autoscaler (HPA) | `horizontalpodautoscaler` | config map | `configmap` |
| secret | `secret` | volume claim (PVC) | `persistentvolumeclaim` |
| volume | `persistentvolume` `volume` | storage class | `storageclass` |
| node | `worker-node` | kubelet, kube-proxy | `kubelet` `kube-proxy` |
| control plane | `api-server` `etcd-cluster` `scheduler` | controllers | `controller-manager` `cloud-controller-manager` |
| network policy | `networkpolicy` | pod security policy | `podsecuritypolicy` |
| service account | `serviceaccount` | role, binding | `role` `rolebinding` |
| cluster role, binding | `clusterrole` `clusterrolebinding` | quota, limits | `resourcequota` `limitrange` |
| user, group | `user` `group` | custom resource | `customresourcedefinition` |

## 8. Named products (logos family)

Inside nodes prefer an `-icon` variant (the logomark) where one exists:
`logos:snowflake` is the wordmark, `logos:snowflake-icon` the mark.

| Area | Names (logos) |
|---|---|
| cloud | `aws` `aws-lambda` `aws-s3` `aws-ec2` `aws-rds` `aws-dynamodb` `aws-sqs` `aws-sns` `aws-api-gateway` `aws-cloudfront` `aws-eks` `google-cloud` `microsoft-azure` `cloudflare-icon` `vercel-icon` |
| data | `snowflake-icon` `kafka-icon` `postgresql` `mysql` `mongodb-icon` `redis` `elasticsearch` `airflow-icon` `dbt-icon` `apache-spark` `databricks-icon` `tableau-icon` `looker-icon` `microsoft-power-bi` `jupyter` |
| dev, CI | `github-icon` `gitlab` `github-actions` `jenkins` `circleci` `argo-icon` `docker-icon` `kubernetes` `helm` `terraform-icon` `grafana` `prometheus` `datadog` `nginx` |
| SaaS, AI | `stripe` `slack-icon` `sendgrid-icon` `twilio-icon` `notion-icon` `supabase-icon` `openai-icon` `anthropic-icon` `claude-icon` |
| languages | `python` `typescript-icon` `nodejs-icon` `go` `rust` `java` `react` |

- `logos:apache-kafka` does not exist (404): Kafka is `logos:kafka-icon`.
- `logos:apache-airflow-icon` does not exist (404): Airflow is `logos:airflow-icon`.
- `logos:google-bigquery` does not exist (404) and logos has no BigQuery:
  no icon in a logos diagram (`gcp:bigquery` is the gcp family).

## 9. Offline pack

`${CLAUDE_SKILL_DIR}/assets/icons/`: 40 lucide icons (lucide-static 1.47.0,
ISC, `LICENSE` beside them), stroke `475569`. When api.iconify.design and
unpkg both fail, `icon.sh get` copies these names from the pack,
recolored; `icon.sh tint <hex> <dir>` copies the whole pack.

| Covers | Pack icons (lucide) |
|---|---|
| architecture | `server` `cpu` `database` `hard-drive` `cloud` `globe` `earth` `router` `split` `braces` `webhook` `zap` `workflow` `table` `file-text` `message-square` |
| people, web | `user` `users` `user-check` `app-window` `smartphone` `mail` `bell` `credit-card` `shopping-cart` `search` |
| operations, security | `activity` `settings` `calendar-clock` `lock` `key-round` `shield-check` |
| CI/CD, data, AI | `git-branch` `flask-conical` `hammer` `package` `rocket` `undo-2` `layout-dashboard` `brain` |
