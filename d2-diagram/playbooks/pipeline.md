# Pipeline playbook: data pipelines and stage flows

Use for data that moves through stages: sources, ingestion, warehouse layers,
consumers (ETL/ELT, CDC, streaming, RAG indexing: rule 9). Control flow with
decisions is a flowchart (`${CLAUDE_SKILL_DIR}/playbooks/flowchart.md`). Start
from `${CLAUDE_SKILL_DIR}/templates/pipeline.d2`. Grid mechanics:
`${CLAUDE_SKILL_DIR}/reference/layout.md` section 7.

## 1. Pick the layout by where it is read

Measured on the template's content (3 sources, 3 warehouse layers, 3 consumers):

| Layout | 800px column | 1600px slide |
|---|---|---|
| ELK `direction: down`, one zone per stage, tools as hop end labels (the template) | 580x884, 14px: use | W-tall, W-aspect |
| the same with mid-edge hop labels | 580x1061 (W-tall) | - |
| ELK `direction: right`, the same zones, 130px layers, mid-edge hop labels | 7.6px text (E-small-text) | 1384x468, clean: use |
| Serpentine: root `grid-columns: 1`, each row ONE stage with its own `direction` | only when one edge joins two rows (rule 6) | fine |
| A grid container inside an ELK layout | collapsed into one 2040px row: never | never |

## 2. Notation checklist

- [ ] Zones are the stages the request names ("Sources", "Snowflake",
      "Consumers"), never layout rows; the warehouse is ONE zone holding its
      layers (RAW, STAGING, MARTS), the platform's name as its title.
- [ ] Tables, layers and databases are `datastore`, topics and streams `queue`.
- [ ] Labels are `"<role>\n<tool>"` with `tech`, role first everywhere, in the
      request's words: `"App DB\nPostgres"`, `"Dashboards\nLooker"`.
- [ ] Tools that move data (Fivetran, dbt, a Spark job) label the hops they
      perform (rule 3), never a node of their own or a title word.
- [ ] Co-equal sources: no main source, one look and one edge class for all.
      `flow` only on a chain the request describes, starting at the hub they
      merge into; a fan-out to peers ends it. The focus: `focal` on the table
      the request names ("Highlight MARTS").
- [ ] `external` on a source only when its owner matters to the reader; it
      then needs a key line (`${CLAUDE_SKILL_DIR}/reference/design-system.md` section 8).

## 3. Rules

**1. Stages stack down, each a zone; the warehouse is one zone.** Sources
in one row, the warehouse layers down its middle, consumers in the last row:
the template is 580x884. Stage rows of different widths are fine: ELK
centres every merge and fan-out.

**2. A merge from a whole stage, or a fan-out to one, is ONE edge to the
zone** (`sources -> wh.raw`, `wh.marts -> consumers`); the brief still lists
every edge and semcheck accepts the zone edge for them. Edge by edge also
passed (580x894) but repeated "Fivetran" three times and jogged two edges.

**3. A tool's name rides at the end of the hop it performs:** a local class
`hop: {source-arrowhead.style: {font-color: ${ink-600}; font-size: 14};
target-arrowhead.style: {font-color: ${ink-600}; font-size: 14}}`, then
`{class: [hop; dep]; target-arrowhead.label: dbt}` (or `source-arrowhead` for
the tail end). Mid-edge labels cost 59px a rank (580x1061, W-tall). Snowflake
brand: `${sf-gray}` in place of `${ink-600}` (left as is, the compile fails).

**4. Cylinders need their height.** One line needs 90px to clear the rims,
two lines 106 (E-label-overflow below that); a box beside a cylinder is
10px shorter, so its sides end on the walls (96 beside 106).

**5. Keep the warehouse column wide.** Layers as wide as the rows allow (230
under 530px rows): a 190px column left 170px voids beside it (I-sparse; the
check counts nodes, not zone fill).

**6. Serpentine only when each row is exactly one stage and ONE edge joins
two rows,** node to node, at a row end: d2 draws edges between grid cells as
straight centre-to-centre lines, so a merge or fan-out across rows comes out
diagonal. A grid cell honours its own `direction`; a plain container does not.

```d2
# cwd: ../templates
...@neutral-theme
grid-columns: 1
vertical-gap: 60
classes: {w: {width: 150}}
ingest: Ingest {
  class: zone
  direction: right
  app: "Clickstream\nSegment" {class: [service; tech; w]}
  kafka: "Events\nKafka" {class: [queue; tech; w]}
  app -> kafka: {class: dep}
}
process: Process {
  class: zone
  direction: left
  flink: "Enrich\nFlink" {class: [service; tech; w]}
  lake: "Sessions\nIceberg" {class: [datastore; tech; w]}
  flink -> lake: {class: dep}
}
ingest.kafka -> process.flink: {class: dep}
```

**7. Keep a serpentine's turns vertical:** one `width` on every node and the
same number of nodes per row; a turn at the left end is always vertical, at
the right end only while both rows are equally wide (rows of 3 and 2 tilted
it 133px; W-diagonal-edge flags a lean over 8px). A 2-node tail row folds into
the row before it. A labelled edge across `vertical-gap: 40` touched the row
border: 60 clears it.

**8. Slides: one ELK row.** `direction: right` with the template's zones and
130px layers, hop labels mid-edge (a row pays them in width): 1384x468 at
`--column 1600`, clean; with 230px layers, 1470px and W-aspect.

**9. RAG: indexing and answering.** Zone titles carry the cadence:
"Indexing (nightly)", "Answering (per question)". ONE embedding-model node
serves both paths (documents and questions need the same model); the person
asking sits outside every stage zone; the question is drawn into retrieve,
rerank and the prompt (a reranker scores question and chunk pairs, the
prompt carries the question); co-equal document sources share one look. Both
paths as stage zones in an 800px column made a 1331px tower: for one
picture draw the app view (`${CLAUDE_SKILL_DIR}/templates/llm-app.d2`, where
the vector index is the floor both paths meet, 776x818), or split indexing
and answering into two diagrams (`${CLAUDE_SKILL_DIR}/workflows/route.md`).

## 4. The template

`${CLAUDE_SKILL_DIR}/templates/pipeline.d2`: Sources (the app DB, the Stripe
API, Segment) load into RAW through one edge labelled Fivetran; dbt builds
STAGING and MARTS inside the Snowflake zone; one edge feeds the Consumers
zone. 580x884 at 800px, no errors or warnings, no key (one edge class).
