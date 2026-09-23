# Brief: decide, then list, before any D2

Write `D2W/<name>.brief` (`D2W = ${D2_WORK:-${TMPDIR:-/tmp}/d2work}/<name>/`) before
any D2, like section 7: the request verbatim, six decisions, every node and edge
the request implies. d2check checks each render against it: typos, lost labels,
reversed or misrouted edges, and an invented or missing focus fail instead of
shipping.

## 1. type: what does the reader ask?

Choose the template with `workflows/route.md` (more types than below); its
name is the `type:`. A notation with no row: the closest template, said under
`Assumed:` (route.md step 1). Two rows fit: route.md, "Assume, ask, split".

| The reader asks | type | Playbook |
|---|---|---|
| What are the parts and how do they talk? | architecture | playbooks/architecture.md |
| Where does each part run (cloud, cluster, pod)? | deployment | playbooks/infrastructure.md |
| Who uses the system, and what does it depend on? (C4 context) | context | playbooks/architecture.md |
| Which containers make up the system? (C4 container) | c4 | playbooks/architecture.md |
| How does data move through stages? | pipeline | playbooks/pipeline.md |
| Who calls whom, in what order? | sequence | playbooks/sequence.md |
| Which tables exist and how do they join? | erd | playbooks/erd.md |
| Which types exist and how do they relate? | class | playbooks/erd.md |
| What happens next, on which condition? (process, CI/CD) | flowchart | playbooks/flowchart.md |
| Which states can X be in, and what moves it? | state | playbooks/state.md |
| How does the picture change, step by step? | steps | playbooks/change.md |
| What do these lines do / what does it reach / what changed / which code runs where? | code-annotated, code-calls, code-compare, code-walkthrough | playbooks/code.md |

## 2. reader, width, direction

| Where it is read | width | direction |
|---|---|---|
| README, wiki, docs page, PR (default) | 800 | down |
| Slide | 1600 | right, up to about 5 ranks |
| Both ("for a slide/doc") | 800, drawn landscape: content aspect 1.3-2.0 and at most ~930px wide, so it fills a slide and keeps 12px text in the doc; a graph that cannot go landscape gets the doc layout. Say which under `Assumed:` | right when it fits |
| The user names a size | that size | down unless much wider than deep |
| ERD / UML class, any medium | as above | ERD right (parents left); class down (parents on top) |
| Sequence, any medium | as above | none: actors run left to right |
| A serpentine grid | as above | `direction: down  # serpentine rows` (each row sets its own) |

d2check holds the render to this width: text 12px or more, height at most
1.25x a doc column (1000px at 800; aim for 900) or 0.55x a slide. The
compaction recipe of each type: reference/layout.md section 9.

## 3. focus: none, unless the request asks

Emphasis is earned: a reader must be able to say why the blue thing is blue.
`focus: none` is the default. Any other focus ends with a comment that quotes
the request words asking for it, `focus: aws.worker  # "Highlight the worker"`.
A node and a path: comma-separated, one quote each, `focus: gate, placed ->
checks -> gate  # "Highlight the go/no-go decision"; "If all checks pass"`.
semcheck fails (S-emphasis) a focus whose quote is not in `# request:`, a focal
node or `flow` edge outside the focus, and a focal node inside `zone-blue`.
A document the user hands over as the request (a handoff, an issue, a goal doc
they point at) is asked too: under `# request:`, quote the passage you draw
from verbatim, after its name, one `# source:` per passage (it continues like
the request): `# source: the handoff, "Goal": "Draw the NEW flow ..."`. A
focus may quote it; semcheck reads both.

| The request says | focus |
|---|---|
| "highlight X", "focus on X", "the new X", "how X works" | X's key |
| a lifecycle or process written as a chain ("pending -> paid -> shipped") | the chain: `focus: start -> pending -> paid -> shipped -> delivered  # "pending -> paid -> shipped -> delivered"` |
| a story told from one participant ("the Order service creates an order, asks Payment ..., then asks Inventory ...") | that participant: `focus: order  # "the Order service creates an order"` |
| a protocol that names its artifact ("including the code_verifier/code_challenge") | the messages carrying it, `flow` on them: `focus: spa -> auth  # "including the code_verifier/code_challenge"` |
| a C4 context view | the one system in scope, which the request names |
| a C4 container view | `none`: the system is the boundary; a container only when named ("Focus on the API") |
| Snowflake brand, no emphasis asked | ONE `sf-primary` node: `focus: sf.marts  # brand` |
| none of these ("Architecture of an e-commerce platform ... web and mobile clients ...") | `none`, even when one part has the most edges |

- A focal node takes `focal` LAST (the last class wins): `[service; focal]`;
  `focal-solid` on a busy canvas, `sf-primary` for Snowflake. A sequence
  diagram focuses a participant, `[actor; focal]`, or its messages (`flow`).
- `flow` marks ONE path the request describes: a happy path, a lifecycle, an
  arrow chain it writes, one data chain. Two described paths (offline and
  online, two clients): no `flow`. A path that forks into peers the request
  lists together stops at the fork; co-equal sources merging into a hub: it
  starts at the hub.
- Peers (same parent, same base role, listed together: "web and mobile
  clients") share one node class and one edge class. Never one blue peer.
- A focused group: its key, `class: zone-blue`, and no focal node inside it.
  Snowflake has no focus group: focus the node inside it that matters most.

## 4. out, and ask or assume

`out:` lists what you leave out on purpose; the report's `Left out:` line
repeats it. Past about 15 nodes on one board, and when to ask one short
question or split: route.md, "Assume, ask, split" (its one home). Everything
else you decide (reader, width, direction, grouping, labels, protocols) goes
under `Assumed:`.

## 5. The inventory

1. Coverage: every noun the user names is a node; every verb between two of
   them is an edge. Walk the request sentence by sentence.
2. Keys are short, lowercase, stable (`orders`, `aws.db`), never a D2 keyword
   (reference/syntax.md section 16); the D2 uses the same keys. The dotted key
   is the grouping (`aws.db` sits in `aws`): the groups the request names
   (its stages, zones, owners, trust boundaries), never rows invented for the
   layout; 2 levels at most (deployment: 3, cloud > cluster > namespace), no
   one-child groups.
3. A label is the rendered text: the user's words, plain English ASCII;
   product and tech names stay as written. `\n` breaks a label at about 22
   characters. Name the technology in the label (`Orders DB\nPostgres`).
4. Nothing invented silently: whatever the request does not state gets
   `{inferred}`, a label or title you chose included; semcheck lists it, and
   the report's `Assumed:` line says it.
5. One arrow convention per diagram: who calls whom, or where data goes.
   `<->` only for a truly two-way exchange. Label every edge of a kind or
   none; no 1-2 character labels except words (`no`, `ok`); quote `#` and `;`.

Attributes go in ONE block at the end of the line, comma-separated:
`notify: Reporter notified {end, inferred}` (semcheck stops at two blocks:
`two attribute blocks - write one`).

| Attribute | On | semcheck checks |
|---|---|---|
| `inferred` | node, edge | listed for the report (info) |
| `start`, `end`, `decision` | node | flowchart, state: all reachable from the start, nothing leaves an end; a decision has 2+ exits, all labelled (in a failure scope, the scope's one failure edge counts) |
| `note`, `group` | node | a title or note, exempt from reachability; sequence: a frame (`alt`, `loop`), not an actor |
| `cols: a b`, `fields: a b` | node | erd, class: those columns or fields exist |
| `external`, `shape: x` | node | not checked: notes for drafting |
| `code` | node | a code block: label `*`, not compared; cite the source in a `# path:lines` comment |
| `dashed`, `solid`, `return`, `in: g` | edge | stroke style (async, optional); sequence: a return is dashed, `in` = drawn inside group `g` |
| `src: h`, `dst: h` | edge | head at that end: `triangle(-hollow)`, `arrow`, `diamond(-filled)`, `circle`, `box`, `cross`, `cf-one(-required)`, `cf-many(-required)`, `none` |
| `src-label: t`, `dst-label: t`; `count: N` | edge | arrowhead label at that end (UML multiplicity, ERD role); exactly N parallel edges |

`src` is the key written first, as in d2 (`a <- b`: `a`). A label of `*`, or
none, is not checked; `""` must render empty. Sequence: messages in time order
(`messages:` works too), no spans, a note only if asked for (`api.idem: ...
{note}`). ERD: `customers.id <-> orders.customer_id {src: cf-one-required, dst:
cf-many}`; UML: `Order <- LineItem: contains {src: diamond-filled, dst-label:
1..*}` (playbooks/erd.md). One D2 edge into a container passes only when the
brief sends one to each child (fan-out).

Multi-board (layers, steps): list every node and edge of all boards. Node
labels, classes and the focus are checked on the base board (`index.svg`), so
the focus is focal there. A node whose text changes per step (a status note)
takes the label `*`: `status: * {note}`.

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
| `focal` on the busiest node, no request word for it | an emphasis the reader cannot explain | S-emphasis |
| `flow` and `async` edges, no key | line styles nobody can decode | S-key |
| `{class: datastor}` (typo), or a class the theme lacks | the default box, no cylinder | S-src-class |
| `direction: right` inside a plain container | nothing: ELK ignores it | S-src-direction |
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
focus: aws.worker     # "Highlight the worker"
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
vars: {
  d2-legend: {
    a: {style.opacity: 0}
    b: {style.opacity: 0}
    a -> b: request or write, synchronous {class: dep}
    a -> b: event, asynchronous (S3 notification) {class: async}
  }
}
classes: {row: {width: 180; height: 110}}

web: Web app {class: actor; width: 380}
aws: AWS {
  class: zone
  api: Upload API {class: [service; row]}
  s3: "Images bucket\nS3" {class: [datastore; row]}
  db: "Upload records\nDynamoDB" {class: [datastore; row]}
  worker: "Thumbnail worker\nLambda" {class: [service; row; focal]}
}

web -> aws.api: gets presigned URL {class: dep}
web -> aws.s3: uploads image {class: dep}
aws.api -> aws.db: records upload {class: dep}
aws.s3 -> aws.worker: S3 event {class: async}
aws.worker -> aws.s3: writes 3 thumbnails {class: dep}
```

Same keys as the brief. Classes go role first, then `row` (one size for boxes and cylinders
that share a rank, else W-sibling-size), then `focal`, on the quoted focus alone. The web app
spans the two nodes it calls (2 x 180 + 20), so both edges drop straight. The key names both
line styles. Result: 555 x 706 px, text 14px, key below. d2check exits 0 with
`S-inferred: aws` (`Assumed: all in AWS`); `Left out: image serving, auth, retries`.

## 8. Commands

d2check runs the check when `D2W/<name>.brief` exists or `--brief` is given, else `--lint` only.
By hand (exit 0 ok, 1 S- errors, 2 brief or compile problem):

```sh
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py D2W/<name>.brief <target>.d2
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --lint <target>.d2     # source slips only, no brief
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --explain <target>.d2  # in words, cardinality too
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --dump D2W/orig.d2     # EDITS only: brief skeleton
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --compare D2W/orig.d2 <target>.d2
python3 ${CLAUDE_SKILL_DIR}/scripts/semcheck.py --sync-labels D2W/<name>.brief <target>.d2  # reworded in the .d2
```
