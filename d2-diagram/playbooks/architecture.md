# Architecture playbook: systems, C4, LLM apps

Use for "what are the parts and how do they talk" (architecture), C4 context
and container views, and LLM apps. Templates: `${CLAUDE_SKILL_DIR}/templates/architecture.d2`,
`${CLAUDE_SKILL_DIR}/templates/context.d2`, `${CLAUDE_SKILL_DIR}/templates/c4.d2`,
`${CLAUDE_SKILL_DIR}/templates/llm-app.d2`. Where each part runs (deployment,
Kubernetes), networks and threat models: `${CLAUDE_SKILL_DIR}/playbooks/infrastructure.md`.
Roles and keys: `${CLAUDE_SKILL_DIR}/reference/design-system.md`; layout:
`${CLAUDE_SKILL_DIR}/reference/layout.md`; icons: `${CLAUDE_SKILL_DIR}/workflows/icons.md`.

## 1. Skeleton for an 800px column

`direction: down`, one zone per tier, one row per zone: the template is 770x843
at scale 1.00, key included; `direction: right` drew one 1495px wide (7.5px text).

| Row | Holds | Classes |
|---|---|---|
| 1 | clients or people | `actor` (`compact` when one line) |
| 2 | the entry point, as wide as the services it routes to; a broker beside it | `service`, `queue` |
| 3 | a zone of services, in the order of the tier below them | `zone`, `service` |
| 4 | ONE zone of stores and third parties, each under its caller | `datastore`, `[service; external]` |

A row holds 4 services at `width: 140`; a fifth made it 930px (12px text)
and put 4 gateway edges into one zone (rule 3). Past that, split the diagram.

## 2. Notation checklist

- [ ] Emphasis is earned (`${CLAUDE_SKILL_DIR}/workflows/brief.md` section 3):
      `focus: none` unless the request names a subject ("Highlight Orders"
      grounds the node `focal`, not a path); `flow` only on a path the request
      describes; peers it lists together share one node and one edge class;
      `zone-blue` only for a focused group, never around a focal node.
- [ ] Technology as a second line with `tech` (`"API gateway\nKong"`, 14px
      slate); a technology the request does not give is left out, never guessed.
- [ ] Third parties are `[service; external]` at the ends of the lower zone.
- [ ] Every edge of a kind carries the request's verb (`REST`, `publishes`,
      `consumes`, `charges`, `sends email`); d2check moves a label off a bend.
- [ ] A key when a colour, dash or weight means something: one entry per
      encoding, in the request's words ("call", "event", "third party").
- [ ] What the request did not name: `{inferred}` in the brief, `muted`.

## 3. Rules

**1. The lower tier lines up under its callers.** One width class for both
tiers (140); lower nodes in their callers' order, callers with no lower
partner at the row end; a store two callers use spans both (2 x 140 + 20 =
300); ONE lower zone for stores and third parties, as wide as the upper zone.
The template: every lower node centred under its caller, 0 doglegs; the
round-3 lower tier in its own order drew 5 Z-shaped edges (W-dogleg).

**2. Async edges carry the verb, and the node written first ranks higher.**
The template's broker sits in the top row, written first on both edges
(`events <- services.orders: publishes`, `events -> services.notify: consumes`).
A consumer the gateway also calls: that broker crosses the gateway's edge
(W-edge-crossing), so it goes in the lower zone between producer and consumer,
`consumer <- broker` (`broker -> consumer` loops around the zone), each
service spanning its store and half the broker: 696x810, all edges straight.

```d2
# cwd: ../templates
...@neutral-theme
direction: down
services: Services {
  class: zone
  orders: Orders {class: [service; compact]}
  notify: Notifications {class: [service; compact]}
}
data: Data {
  class: zone
  events: "Order events\nKafka" {class: [queue; tech]}
}
services.orders -> data.events: publishes {class: async}
services.notify <- data.events: consumes {class: async}
```

**3. Four or more edges from one node into one zone: one edge to the zone.**
Five edges stair-stepped, widened the gateway to 200px and raised W-fanout;
one labelled edge was clean; semcheck accepts it when the brief lists each child's edge.

**4. Short zone titles.** An edge into a zone's first child enters 50px plus
half its width from the zone's left edge (116px in the deployment template):
a 15-character title was struck (E-edge-through-label), 12 characters were not.

**5. Widen only the fan-out node.** The entry point spans the services it
routes to (`width: 400` for three): its edges drop straight; a 142px
gateway left a 274px empty corner (I-sparse). A node in a chain (a CDN
before the gateway) keeps its natural width.

**6. Zones side by side: equal node heights, never a container `height`.**
A box beside a cylinder is 11px shorter (96 beside 107): its sides end on
the walls. A zone `height: 234` meant to match its neighbour missed by 20px.

**7. Event topologies: producers, topics, consumers as three zones down.**
Topics are `queue`s in a `zone-violet` (a key line names it), consumers a
`zone` titled `bottom-left` (every edge enters from above); edges `async`,
one verb for all left to the key ("event"). 3 + 3 + 4 nodes: 766x604, 15px.

## 4. C4

- The neutral theme, never theme 303 (person and text labels white on white,
  1.00:1, E-contrast). One C4 level per diagram.
- It names itself: `title: "Container diagram: <system>" {class: title}` and
  a key of container, external system, database, relationship (semcheck
  S-key). All relationships share one class; the protocol says async.
- The system under review is the `boundary`, not a focal node. Its title is
  one line, `style.text-transform: none` ("[Software System]" as on the
  externals), `label.near: bottom-left` when no edge leaves the bottom, else
  `top-left` over the lifted store, declared first (no edge enters its column).
  A container is `focal` only when the request names it ("Focus on the API").
- Elements `"Name\n[Container: Tech]"` with `tech`, one size per kind (the
  template's `box` and `person` classes); a third line only when the request
  says what it does (+42px a row). No technology given: "[Container]", Assumed.
- Relationships `"Verb [protocol]"` on one line: columns 170px apart keep
  them clear. A hub called by 2+ containers spans them (the API: 420px).
- No rank under the boundary but the externals (a plain stack: 595x1246 with
  a 216px void). The hub's store joins its callers' row, `db <- api` (boxes 96
  tall beside it); externals the hub calls sit in one row under the boundary
  in its edge order, the hub spanning all columns above (banking view: 760x865
  with title and key, edges straight; lifted above: 460px, 2 bends). A
  worker's external lifts with it (`shop.worker <- shop.api`, `stripe <-
  shop.worker`: the template, 640x860). A person using two containers stays
  narrow, centred over them (a 400px c4-person: 176px head).
- Context (level 1, `${CLAUDE_SKILL_DIR}/templates/context.d2`): the system in
  scope is ONE box, `focal` when the request names it, as wide as the row
  below (700 for 4 systems; at 480 two labels collided); people above, the
  systems it calls below (4 a row, more as one box per kind), callers of it in
  the people's row. Title "System context: <system>"; key: system in scope,
  external system, one line per edge class.

## 5. LLM apps: agents, RAG, copilots, MCP

`${CLAUDE_SKILL_DIR}/templates/llm-app.d2` (776x818): the user, the model and
the history above the hub, each written `callee <-> app` (one flipped: history
below the hub, scale 0.90); the hub as wide as its callees (480); retrieval and
tools below; the vector index a floor as wide as its two writers (680).

- Every online call is ONE `<->` edge, `"request / answer"`, all in one class
  unless the request describes one path; the key shows "call and answer" as
  `a <-> b`. The offline upsert is `->`, `async` ("nightly batch").
- The indexing source and job sit at the root, never in a zone: a "Nightly
  indexing" zone left a 303px hole (I-sparse). With 2-3 callees the same
  holds (500x696, 14px); give the leaves one height class.
- Tools: a zone holding a one-row grid, gaps 12 (a grid's gaps are its
  padding; a column of three: +120px and a 192px hole). The app runs the
  tools, never the model; the model is `external` unless self-hosted.
- RAG with an embedding step: ONE embedding-model node that both the indexing
  job and the question use (documents and questions need the same model).
  How a question travels step by step: `playbooks/pipeline.md` rule 9.
- MCP: the host (Claude Desktop, an IDE) is the hub, each MCP server a zone of
  its tools, the store behind a tool below it (410x811px, clean).
