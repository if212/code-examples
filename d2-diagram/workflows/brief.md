# Brief: decide, then list, before any D2

Write `D2W/<name>.brief` first (`D2W = ${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>/`),
shaped like section 7: the request verbatim (quoted, running on over `#` lines),
six decisions, then every node and edge the request implies, from the request,
not from D2. d2check runs `semcheck.py` against it on every render: typos, lost
labels, reversed or misrouted edges and a missing focus fail instead of shipping.

## 1. type: what does the reader ask?

| The reader asks | type | Open |
|---|---|---|
| What are the parts and how do they talk? | architecture | playbooks/architecture.md |
| Where does each part run (cloud, cluster, pod)? | deployment | playbooks/architecture.md |
| What is the system context or container view? | c4 | playbooks/architecture.md |
| How does data move through stages? | pipeline | playbooks/pipeline.md |
| Who calls whom, in what order? | sequence | playbooks/sequence.md |
| Which tables exist and how do they join? | erd | playbooks/erd.md |
| Which types exist and how do they relate? | class | playbooks/erd.md |
| What happens next, on which condition? (process, CI/CD) | flowchart | playbooks/flowchart.md |
| Which states can X be in, and what moves it? | state | playbooks/state.md |
| How does the picture change, step by step? | steps | templates/steps.d2 |

Start from `templates/<type>.d2` (none fits: `type: other`, the closest one). Two
rows fit: two diagrams; ask which (section 4), or draw one and offer the other.

## 2. reader, width, direction

| Where it is read | width | direction |
|---|---|---|
| README, wiki, docs page, PR (default) | 800 | down |
| Slide | 1600 | right, up to about 5 ranks |
| The user names a size | that size | down unless much wider than deep |
| ERD or UML class, any medium | as above | right (parents on the left) |
| Sequence, any medium | as above | none: actors run left to right |

d2check holds the render to this width: text displays at 12px or more, height
within 1.6x the width. Measured sizes: reference/layout.md sections 2 and 9.

## 3. focus: exactly one

- A node key: what the request highlights, else the new or changed part, the
  document's subject, or the failure point. It gets `focal` LAST (the last class
  wins): `[service; focal]`; `focal-solid` on a busy canvas, `sf-primary` for Snowflake.
- A path (a flow, a lifecycle): a chain, `focus: submit -> review -> merge`;
  those edges get `class: flow`. A whole group: its key, with `class: zone-blue`
  (Snowflake has no focus group: focus the node inside it that matters most).
- `none` only for a reference diagram where nothing outranks the rest.

## 4. out, and ask or assume

`out:` lists what you leave out on purpose, so the report can say it. Past about
15 nodes on one board, split into `steps` boards or a second diagram.

| Ask one short question when | Otherwise assume, and list under `Assumed:` |
|---|---|
| two types fit equally ("show the checkout": architecture or sequence?) | reader, width, direction |
| the scope is open ("the whole platform") or tops 15 nodes | grouping, edge labels, protocols |
| the request names one thing two ways, or contradicts itself | the focus, when one part is obviously central |

## 5. The inventory

1. Coverage: every noun the user names is a node; every verb between two of
   them is an edge. Walk the request sentence by sentence.
2. Keys are short, lowercase, stable (`orders`, `aws.db`), never a D2 keyword
   (reference/syntax.md section 16); the D2 uses the same keys. The dotted key
   is the grouping (`aws.db` sits in `aws`): one principle (trust boundary,
   deployment unit, owner or stage), 2 levels at most, no one-child groups.
3. A label is the rendered text, in the user's words; `\n` breaks it at about 22
   characters. Name the technology in the label (`Orders DB\nPostgres`), not an icon.
4. Nothing invented silently: whatever the request does not state gets
   `{inferred}`; semcheck lists it, and the report's `Assumed:` line says it.
5. One arrow convention per diagram: who calls whom, or where data goes.
   `<->` only for a truly two-way exchange. Label every edge of a kind or
   none, with 3 or more characters. Quote a label containing `#`.

| Attribute | On | semcheck checks |
|---|---|---|
| `inferred` | node, edge | listed for the report (info) |
| `start`, `end` | node | flowchart, state: all reachable from the start; nothing leaves an end |
| `decision` | node | 2 or more outgoing edges, every one labelled |
| `note` | node | a title or note: exempt from reachability |
| `group` | node | sequence: a frame (`alt`, `loop`), not an actor |
| `cols: a b`, `fields: a b` | node | erd, class: those columns or fields exist |
| `external`, `shape: x` | node | not checked: notes for drafting |
| `dashed`, `solid` | edge | stroke style (async, optional) |
| `return` | edge | sequence: the reply is dashed |
| `in: g` | edge | sequence: drawn inside group `g` |
| `src: h`, `dst: h` | edge | head at that end: `triangle(-hollow)`, `arrow`, `diamond(-filled)`, `circle`, `box`, `cross`, `cf-one(-required)`, `cf-many(-required)`, `none` |
| `count: N` | edge | exactly N parallel edges |

A label of `*`, or none, is not checked; `""` must render empty. Sequence:
messages in time order (`messages:` works too), no spans or actor notes. ERD,
UML class: column to column, `orders.customer_id <-> customers.id: placed by
{src: cf-many, dst: cf-one-required}` (playbooks/erd.md). Multi-board: all
boards. One D2 edge into a container passes only when the brief sends one to
each child (the fan-out recipe); else it is `S-misrouted-edge`.

## 6. Slips that compile, render and pass `d2 validate`

| Slip | What d2 draws | Code |
|---|---|---|
| `users -> aws.gatway` (typo) | a new node `gatway` | S-extra-node, S-misrouted-edge |
| `vpc: {orders -> db}` with `db` meant at the root | a second node `vpc.db` | S-wrong-parent |
| `billing -> stripe: charge #443` | label `charge` | S-src-hash, S-edge-label |
| `c -> d: read; write` | label `read` and a node `write` | S-src-semicolon |
| the same edge written twice | two parallel edges | S-duplicate-edge |
| a source arrowhead on `->` or `--` | no head at that end | S-edge-kind, S-erd-cardinality |
| a new key inside a sequence group | the group becomes an actor | S-seq-group-actor |
| `ingest -> sf` standing for `ingest.pipe -> sf.raw` | an arrow to the container's middle | S-misrouted-edge |
| `{class: [focal; service]}` on the focus | a plain box: `service` wins | S-emphasis |
| no theme import and no `layout-engine` | dagre: every edge curved | S-src-cli-engine |

Recipes: `workflows/review-and-fix.md#<code>`. An INFO `S-missing-node` names a
request term no label, key or `out:` entry covers: add it, or put it in `out:`.

## 7. Worked example

```brief
# request: "Media service README: the web app gets a presigned URL from the
#  Upload API, which records the upload in DynamoDB, and uploads the image to
#  S3. Each new object fires an S3 event that triggers the thumbnail worker
#  (Lambda); it writes three thumbnail sizes back to S3. Highlight the worker."
type: architecture    # parts and how they talk
reader: GitHub README, engineers new to the service
width: 800            # README column
direction: down       # 3 ranks: narrow, near square
focus: aws.worker     # "highlight the worker"
out: image serving, auth, retries   # readers may expect them; not asked for
nodes:
  web: Web app
  aws: AWS {inferred}   # assumed: the Upload API runs in AWS too
  aws.api: Upload API
  aws.s3: Images bucket\nS3 {shape: cylinder}
  aws.db: Upload records\nDynamoDB {shape: cylinder}
  aws.worker: Thumbnail worker\nLambda
edges:
  web -> aws.api: gets presigned URL
  web -> aws.s3: uploads image
  aws.api -> aws.db: records upload
  aws.s3 -> aws.worker: S3 event {dashed}
  aws.worker -> aws.s3: writes 3 thumbnails
```
```d2
# cwd: ../templates
...@neutral-theme
direction: down

web: Web app {class: actor}
aws: AWS {
  class: zone
  api: Upload API {class: service}
  s3: "Images bucket\nS3" {class: datastore}
  db: "Upload records\nDynamoDB" {class: datastore}
  worker: "Thumbnail worker\nLambda" {class: [service; focal]}
}

web -> aws.api: gets presigned URL {class: dep}
web -> aws.s3: uploads image {class: dep}
aws.api -> aws.db: records upload {class: dep}
aws.s3 -> aws.worker: S3 event {class: async}
aws.worker -> aws.s3: writes 3 thumbnails {class: dep}
```

Same keys as the brief, nodes inside their group, role classes only, `focal`
last and on the focus alone: about 540 x 690 px, two balanced columns, text 14px.
d2check exits 0 with `S-inferred: aws` and one W- kept (a label just under a
corner, reads fine): `Assumed: all in AWS`, `Open: W-label-on-bend (reads fine)`.

## 8. Commands

d2check runs the check whenever `D2W/<name>.brief` exists or `--brief` is given.
By hand (exit 0 ok, 1 S- errors, 2 brief or compile problem):

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py D2W/<name>.brief <target>.d2
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --explain <target>.d2  # in words, cardinality too
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --dump D2W/orig.d2     # EDITS only: brief skeleton
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --compare D2W/orig.d2 <target>.d2
```
