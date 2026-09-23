# Architecture playbook: systems, C4, LLM apps

Use for "what are the parts and how do they talk" (architecture), C4 context
and container views, and LLM apps. Templates: `${CLAUDE_SKILL_DIR}/templates/architecture.d2`,
`${CLAUDE_SKILL_DIR}/templates/context.d2`, `${CLAUDE_SKILL_DIR}/templates/c4.d2`,
`${CLAUDE_SKILL_DIR}/templates/llm-app.d2`. Where each part runs (deployment,
Kubernetes), networks and threat models: `${CLAUDE_SKILL_DIR}/playbooks/infrastructure.md`.
Roles: `${CLAUDE_SKILL_DIR}/reference/design-system.md`; layout:
`${CLAUDE_SKILL_DIR}/reference/layout.md`; icons: `${CLAUDE_SKILL_DIR}/workflows/icons.md`.

## 1. Skeleton for an 800px column

`direction: down`, one zone per tier, one row per zone. The architecture
template is 807px wide (13.9px text at 800); `direction: right` made it
1495px (7.5px text, E-small-text).

| Row | Holds | Classes |
|---|---|---|
| 1 | clients or people, the main-path one declared first | `actor` |
| 2 | the entry point (gateway, load balancer), as wide as the tier it feeds | `service` |
| 3 | a zone of services, the focus among them | `zone`, `service`, `[service; focal]` |
| 4 | a zone of stores and queues beside a zone of third parties | `datastore`, `queue`, `[service; external]` |

A row holds 4 services at `width: 140`; a fifth made it 930px (12px text)
and put 4 gateway edges into one zone (rule 3). Past that, split the diagram.

## 2. Notation checklist

- [ ] Every node and zone has a role class. Only the brief's focus is `focal`;
      the request path to it is `flow`, other calls `dep`, events `async`.
- [ ] Technology in the label: `"Orders DB\nPostgres"`, `"API gateway\nKong"`.
      Icons only decorate, one family per diagram (`k8s` for Kubernetes:
      `${CLAUDE_SKILL_DIR}/reference/icons.md` section 7).
- [ ] Third parties: one plain `zone` of `[service; external]` nodes, never
      dashed nodes inside a dashed `boundary`.
- [ ] What the request did not name: `{inferred}` in the brief, `[service; muted]`.
- [ ] Edge labels say what flows or the protocol (`REST`, `:5432`), 3+
      characters, every edge of a kind or none.

## 3. Rules

**1. Order the upper tier; the lower tier follows.** Children keep their
declaration order: put each service above the store or external it calls
(swapping two services: 0 -> 1 crossing). Root zones are placed by their
edges; swapping their declarations moved nothing.

**2. An async consumer that lives with the services stays in their row:
`consumer <- broker`.** Written `broker -> consumer`, the edge detoured around
the whole diagram (W-long-edge, 1633px) and crossed a gateway edge.

```d2
# cwd: ../templates
...@neutral-theme
services: Services {
  class: zone
  orders: Orders {class: [service; focal]}
  notify: Notifications {class: service}
}
data: Data {
  class: zone
  events: "Events\nKafka" {class: queue}
}
services.orders -> data.events: {class: async}
services.notify <- data.events: {class: async}
```

**3. Four or more edges from one node into one zone: one edge to the zone.**
Five edges stair-stepped, widened the gateway to 200px and raised W-fanout;
one labelled edge was clean; semcheck accepts it when the brief lists each child's edge.

```d2
# cwd: ../templates
...@neutral-theme
gateway: API gateway {class: service}
services: Services {
  class: zone
  auth: Auth {class: service}
  cart: Cart {class: service}
  orders: Orders {class: [service; focal]}
  payments: Payments {class: service}
}
gateway -> services: routes /auth /cart /orders /pay {class: flow}
```

**4. Short zone titles.** An edge into a zone's first child enters 50px plus
half its width from the zone's left edge (116px in the deployment template):
a 15-character title was struck (E-edge-through-label), 12 characters were not.

**5. Leave short jogging edges bare.** A label sits at its edge's midpoint,
which a jog can put on the bend: `SQL` and `charges` on the store and
third-party edges hit the bends (3 W-label-on-bend); `REST` on long runs did not.

**6. Even rows.** One `width` for a whole tier (`width: 140` fits label lines
of ~13 characters: wrap longer ones, no lint flags a line touching both
borders): the service zone then spans the zones below. Zones side by side:
give the shorter the taller one's `height`, or they end 68px apart.

**7. Draw the entry point as wide as the tier it feeds** (`width: 560`,
`direction: down` only): ELK centres it on its flow target, so a 142px
gateway left a 274px empty corner (I-sparse).

**8. Events: producers, topics and consumers as three zones down.** Topics
are `queue`s in a `zone-violet` (no `width` on a queue), consumers a `zone`
titled at the bottom (`label.near: bottom-left`: every edge enters from above);
edges `async` and unlabelled; topics and consumers in producer order. 3 + 3 +
4 nodes: 766x604, 15px; two consumers of the same two topics cost one crossing.

## 4. C4

- The neutral theme, never theme 303: it drew person and text labels white on
  white (1.00:1, E-contrast). One C4 level per diagram.
- People are `shape: c4-person` with `class: actor`; elements are labelled
  `"Name\n[Container: Tech]\nDescription"`; external systems are
  `[service; external]`, outside the boundary.
- Relationships are two short lines, `"Calls\n[JSON/HTTPS]"`: two one-line
  labels side by side overlapped (E-label-overlap).
- The boundary title goes in a bottom corner no edge leaves through (here
  `label.near: bottom-right`): top-left was struck by the person's edge.
- The container that calls an external system sits in the last row: from the
  API's middle row the edge ran past the database (W-long-edge, 485px).
- A hub called by two containers gets a `width` spanning both, so both edges
  drop in straight (else W-label-on-bend on the jogging one).
- The template uses 1226 of the 1280px height budget (one more label line:
  1242px): add containers beside the existing ones, not in a new row.
- Context (level 1, `${CLAUDE_SKILL_DIR}/templates/context.d2`): the system is
  ONE `[service; focal]` box, people above and the systems it calls below, so
  every arrow points down; systems that call it join the top row (4 above and
  4 below: 852px, 13px text; a 5th in one row: 1057px, 10.5px). Its `width`
  reaches past the first and last system below (700 for 4; 480 jogged two).
- `c4-person` sizes itself by its label (192 vs 155px wide): one class,
  `person: {shape: c4-person; width: 176; height: 160}`, evens them.
- More than 4 systems below: one box per kind,
  `"Payments\n[Software System]\nStripe, PayPal"` (zones of two: 7-11px text).

## 5. LLM apps: agents, RAG, copilots, MCP

`${CLAUDE_SKILL_DIR}/templates/llm-app.d2`: the user on top; the app that
orchestrates every call is the focus and as wide as the row it calls (580px:
four straight edges; at its natural width 3 labels sat on bends); below it
the model, tools (a `zone` holding a one-column grid, `grid-rows` = the tool
count: 5 under 3 folded into 2 columns, 11.3px), memory and the retriever;
the vector index at the bottom, where the query and the nightly indexing meet.

- Every online call is ONE `<->` edge, `"request / answer"` (`"prompt /
  reply"`, `"query / chunks"`): two opposite edges drew twice the lines and
  widened the canvas by 28px. The offline upsert is `->`.
- The app runs the tools: edges to tools start at the app, never the model.
  The model is `[service; external]` unless self-hosted: `"LLM\nClaude API"`.
- MCP: the host (Claude Desktop, an IDE) is the hub, each MCP server a zone of
  its tools, the store behind a tool below it (410x811px, clean).
