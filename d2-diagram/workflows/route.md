# Route: request -> template (step 1, before the brief)

Route on the reader's question, not the name typed: "flowchart", "diagram", "UML", "visualize" name
no type (half of GitHub "flowcharts" are architecture). A named notation wins if the content fits. A
signal word inside a request for another type does not pick its row: "full rollout" as a CI/CD step,
a Kubernetes Secret, RAW -> STAGING layers, "swimlanes" of quarters, "flow" of branches.

1. EDIT an existing .d2 ("add X", "too tall", "slide version", "Snowflake colors"): edit flow,
   keep keys. OUT: numbers or trends -> chart; options x criteria (3+ tools scored on cost or
   features, even when a "graphic" is asked) -> markdown table; screens -> mockup; a bare folder
   listing -> text tree. A named notation with no row: the closest template, said under Assumed:
   (UML use case -> context; fishbone -> tree, the effect as root; UML activity -> flowchart, or
   swimlane with partitions; UML component -> architecture). 2. SPLIT or ASK (last section).
   3. FIRST row wins.

| # | The request asks ... (signals) | Template | Playbook |
|---|---|---|---|
| 1 | where sensitive data crosses a trust boundary: threat model, STRIDE, DFD with trust boundaries, attack surface, PII, card data, secrets | threat-model | infrastructure |
| 2 | what changes between two states: before/after, current vs target, as-is/to-be, two designs A vs B side by side, what this PR changes | compare | change |
| 3 | how the picture changes step by step: animate, one board or slide per step, a failover/rollout/election unfolding | steps | change |
| 4 | which path ONE request takes across tiers or hosts, numbered: from the browser/internet to the DB/pods, life of a request, C4 dynamic | walkthrough | change |
| 5 | what happened when: incident timeline, postmortem, history, events with times (ASK for the events unless given) | timeline | change |
| 6 | what ships when, per stream: roadmap, plan, phases, milestones, quarters, cutover, Gantt (ASK for the items unless given) | roadmap | change |
| 7 | which branch merges where: branching model, gitflow, trunk-based, release and hotfix branches | gitflow | change |
| 8 | what depends on what, at build or data level: imports, cycles, module or package graph, lineage, which X feed Y, task DAG, role grants | depgraph | hierarchy |
| 9 | what can reach what: VPC, subnets, CIDR, AZs, NAT, VPN, peering, firewall, security groups, network policies | network | infrastructure |
| 10 | where each part runs, how many copies: Kubernetes, Helm, compose, Terraform infra, ECS/Lambda/EC2, regions, DR, replicas | deployment | infrastructure |
| 11 | who uses one system and what it depends on, systems as single boxes: C4 context, big picture for newcomers or non-engineers | context | architecture |
| 12 | which deployable containers make up one system, with their tech: C4, container diagram | c4 | architecture |
| 13 | who calls whom, in what order, what comes back: sequence diagram, auth/OAuth/SSO/token/webhook/redirect/payment flow, what happens when X clicks, request through middleware, saga, race, parallel calls, how an agent calls tools | sequence | sequence |
| 14 | which states one thing can be in and what moves it: lifecycle, statuses, transitions, circuit breaker | state | state |
| 15 | who does each step and where work changes hands: 2+ named people, roles or teams handing work on (humans, not agents; lanes of quarters or dates are a roadmap); approvals, escalations | swimlane | flowchart |
| 16 | what happens next, under which condition: process, workflow, runbook, triage, decision tree, which X to use, logic of a function, retry/backoff policy, CI/CD, release process, agent loop, user flow | flowchart | flowchart |
| 17 | which parts a request to a model touches: LLM app, agent, chatbot, copilot, text-to-SQL, Cortex, MCP server, tools, retriever, vector store | llm-app | architecture |
| 18 | which types exist and how they inherit or compose: class diagram, interfaces, base classes, class hierarchy, DDD aggregates | class | erd |
| 19 | how a whole breaks down, one parent each: org chart, reporting lines, hierarchy, taxonomy, mind map, containment | tree | hierarchy |
| 20 | which tables exist and how their keys join: ERD, schema, tables, migrations, foreign keys, star schema, data model | erd | erd |
| 21 | where data comes from, what each stage does, where it lands: data flow, ETL/ELT, ingest, streaming, CDC, medallion, warehouse layers, ML training, RAG indexing | pipeline | pipeline |
| 22 | what sits on top of what: layers, layer diagram, tech stack | stack | hierarchy |
| 23 | what the parts are and which talks to which at runtime: architecture, system design, services, sync vs async, who produces or consumes a topic, who owns what, one service's internal components; anything else | architecture | architecture |

Tie-breakers:
- Runtime calls, events (who produces, who consumes), ownership (services by team) -> architecture.
- "Flow": steps and decisions -> flowchart (people hand off -> swimlane); data moving -> pipeline
  (PII or trust zones -> threat-model; a DFD with no trust zone, secret or PII asked -> pipeline);
  a protocol ("auth flow", "payment flow") -> sequence. The word "flowchart" alone never picks
  flowchart: "flowchart of how X connects" is architecture.
- A request's life: network tiers (CDN, LB, pods) -> walkthrough; in-process layers, returns or
  parallel calls -> sequence. Retry, backoff or DLQ policy -> flowchart, even for a webhook.
- LLM or agent: its parts, even written as an arrow chain (event -> bot -> retriever -> model) ->
  llm-app; call order -> sequence; the loop, handoffs between agents and the stop rule ->
  flowchart; a RAG pipeline or indexing -> pipeline. state only if one object has a status field,
  else flowchart (say so under Assumed:).
- One parent each -> tree; several parents, cycles, grants -> depgraph ("dependency tree" is
  depgraph, "class hierarchy" is class). Two states in one image -> compare; 3+ states,
  slides or animation -> steps. Past, exact times -> timeline; future periods -> roadmap.
- "Topology": of a deployment -> deployment, of calls between services -> architecture, of a
  network -> network.

Assume, ask, split. ASSUME by default: draw; read the repo for facts; list the reading in `Assumed:`.
- ASK one question (default inside) only when: the facts are the user's and absent from request,
  conversation and repo (an incident's times and events, roadmap items, owners): ask, never
  invent; a bare topic of one or two words fits 2+ rows ("the checkout", "notifications", "risk
  control": default sequence for a behaviour noun, architecture for a system); a layout-fixing
  notation clashes with the content (default: the notation when it can hold the content, "ERD for
  the microservices": erd, "UML for X": class; else the row the content matches without the
  notation word, "sequence diagram of our architecture": architecture, "of our warehouse":
  pipeline; "flowchart of X" never asks); the scope is unbounded ("everything in src/": default
  an architecture overview).
- SPLIT into 2 (max 3), each routed on its own: two questions for different rows ("...and who can
  see it"); an offline and an online path, each asked for in detail (search, recommendations:
  pipeline, then walkthrough or sequence); over budget (overview + detail); two scenarios on the
  same parts. Draw the first. Not split: one picture that is asked for ("overall", "architecture
  of", "in one diagram"): the app's parts, both paths meeting at the index -> llm-app for an LLM
  or RAG app, else architecture (as pipeline stages the two paths make a tower:
  playbooks/pipeline.md rule 9); an LLM or RAG app named by its parts, with or without its
  indexing job -> llm-app; a happy path and its failure path asked together -> one sequence
  (`alt`) or flowchart.
