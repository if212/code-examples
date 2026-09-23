# Playbook: ER diagrams and UML class diagrams

ERD: tables, keys and relationships of a relational schema. UML class: an object model
(fields, methods, inheritance, composition). Templates: `templates/erd.d2` (4 tables, a
nullable FK, the crow's-foot key, an enum note) and `templates/class.d2` (5 classes,
composition, realization). Syntax of `sql_table` and `class`: `reference/syntax.md`
section 12.

## ERD skeleton

| Part | How |
|---|---|
| Engine and direction | ELK (the theme) with `direction: right`: ELK attaches each edge to its column row |
| Tables | `shape: sql_table`, no class; a table the request highlights: `class: focal-solid; style.stroke: ${paper}` (blue header, white body) |
| Table style | the template's globs at the END of the file: 16px rows, square corners, `ink-500` headers; d2check draws 1px row rules and bold headers |
| Relationships | `parent.pk <-> child.fk` with both arrowheads `cf-*`; the last glob makes them `dep` at 2px |
| Key | the crow's-foot `vars.d2-legend` (four lines at 4px, rule 5), or a `caption` naming the notation |
| Enum values | one `[note; compact]` named after the type: `"order_status values:\npending, paid"` |

## Budget at 800px (measured)

d2check spaces the columns 72px apart when a file draws tables (the two ends of a
relationship stay apart) and moves the key under the diagram when it does not fit beside
it: the key costs height, not width. ELK puts one FK level per column.

| Schema | Width | Text at 800px |
|---|---|---|
| 2 levels, 4 tables (template) | 669 | 14px |
| 4 levels, 6 tables | 1025 | 12.5px |

Five levels or more: split by domain into two diagrams. `direction: down` is no way out:
ELK builds a staircase 1.2-1.5x wider, with crossings. Short constraint text keeps tables
narrow: `[foreign_key; "null"]` shows `FK, null` (`nullable` widens its table).

## ERD notation checklist

- [ ] Every column the request names, with PK / FK / UNQ constraints (`S-missing-column`).
- [ ] Every relationship is `<->` with a `cf-*` head on both ends (`S-erd-cardinality`).
- [ ] Each FK line touches its FK row and its PK row (`S-erd-anchor`: ELK, not dagre).
- [ ] Nullable FK: `cf-one` at the parent, dashed when its parent row has other FKs (rule 7).
- [ ] The crow's-foot key or caption (`S-key`); a blue table only when the request asks.

## ERD rules

### 1. Both ends need an arrowhead: write `<->`

`->` silently drops the source head and `--` draws neither. The symbol at an end says how
many rows of THAT end's table match one row of the other:

| Head | Reads | Use at |
|---|---|---|
| `cf-one-required` | exactly one | the parent of a NOT NULL FK |
| `cf-one` | zero or one | the parent of a nullable FK |
| `cf-many-required` | one or many | the child when a parent needs at least one |
| `cf-many` | zero or many | the child, usually |

### 2. Nullable FK = `cf-one` at the parent

Mark the column (`attendee_id: uuid {constraint: [foreign_key; "null"]}`) so the reader
sees why the end is optional. One glob that forces the same heads onto every relationship
is how a nullable FK ends up drawn as "exactly one".

### 3. Parent first; join tables between their parents

Write each edge parent PK first: ELK puts the source left, so roots (the tenant, the
aggregate) land in the left column and a join table sits right of both parents. List its
FK columns in the parents' top-to-bottom order: swapping `org_id` and `user_id` in
`memberships` removed the only crossing of a 6-table schema.

### 4. Tables take no role class; style them with the globs

On `sql_table` and `class`, `style.stroke` paints the whole BODY, so a node class (they
all set a stroke) turns the rows dark. The template's globs come after the last table:
16px rows (d2's default is 20px), square corners, `ink-500` headers. The second glob skips
a `focal-solid` table (`!&class: focal-solid`); give one only when the request highlights it.

### 5. Crow's feet stay legible: 2px lines, a 4px key

The last glob, `(** <-> **)[*]: {class: dep; style.stroke-width: 2}`, gives every
relationship the `dep` role at 2px: at 1px the crow's feet thin to hairlines. d2 draws the
key's lines at half scale, so its lines are `dep` at 4px and one-ended (`a -> b: zero or
many {class: dep; style.stroke-width: 4; target-arrowhead.shape: cf-many}`; without `dep`
a dashed line turns near-black). No verb labels by default: each labelled relationship
widens its column gap by the label width.

### 6. Enum values and domain notes

Put enum values in one `[note; compact]` named after the type; keep the type name in the
column (`status: ticket_status`). Group tables in `zone`s per domain only when the request
names the grouping (a tenant boundary it describes).

### 7. A nullable FK beside NOT NULL ones on one parent row: dash it

Every relationship of one PK row leaves from one port, so the parent-end heads of
`users.id` (`cf-one-required` for authors, `cf-one` for assignees) draw on top of each
other. Dash the optional one (`style.stroke-dash: 3` on that edge) and add the key line
`a -> b: optional (nullable FK) {class: dep; style.stroke-width: 4; style.stroke-dash: 3;
target-arrowhead.shape: cf-many}`: the line then says what the stacked heads cannot.

```d2
# cwd: ../templates
...@neutral-theme
direction: right
vars: {
  d2-legend: {
    a: {class: ghost}
    b: {class: ghost}
    a -> b: exactly one {class: dep; style.stroke-width: 4; target-arrowhead.shape: cf-one-required}
    a -> b: zero or one {class: dep; style.stroke-width: 4; target-arrowhead.shape: cf-one}
    a -> b: zero or many {class: dep; style.stroke-width: 4; target-arrowhead.shape: cf-many}
    a -> b: optional (nullable FK) {class: dep; style.stroke-width: 4; style.stroke-dash: 3; target-arrowhead.shape: cf-many}
  }
}
users: {shape: sql_table; id: uuid {constraint: primary_key}; email: text; name: text}
tasks: {shape: sql_table; id: uuid {constraint: primary_key}; title: text; status: text; assignee_id: uuid {constraint: [foreign_key; "null"]}}
comments: {shape: sql_table; id: uuid {constraint: primary_key}; body: text; posted_at: timestamptz; author_id: uuid {constraint: foreign_key}}
users.id <-> comments.author_id: {source-arrowhead.shape: cf-one-required; target-arrowhead.shape: cf-many}
users.id <-> tasks.assignee_id: {source-arrowhead.shape: cf-one; target-arrowhead.shape: cf-many; style.stroke-dash: 3}
*: {&shape: sql_table; style: {font-size: 16; stroke-width: 1; border-radius: 0; fill: ${ink-500}}}
(** <-> **)[*]: {class: dep; style.stroke-width: 2}
```

## UML class rules

| Relationship | Write | Draws |
|---|---|---|
| Inheritance | `Parent <- Child: {source-arrowhead: {shape: triangle; style.filled: false}}` | solid line, hollow triangle |
| Realization | the same plus `style.stroke-dash: 4` | dashed line, hollow triangle |
| Composition | `Whole <- Part: contains {source-arrowhead: {shape: diamond; style.filled: true}}` | filled diamond on the whole |
| Aggregation | `Whole <- Part: {source-arrowhead.shape: diamond}` | hollow diamond |
| Association | `A -> B: label {target-arrowhead.label: "0..1"}` | multiplicity at the end |

- `direction: down` with `Parent <- Child`: parents and wholes rank above their children
  (`direction: up` with `Child -> Parent` came out 1063px wide against 831, with a bend).
- One width class per row; a class with classes under it is their sum plus 20px gaps
  (`width: 620` over two `row2: {width: 300}`): ELK centres it on its edges, no hole.
- Edges `dep`. A multiplicity (`1`, `0..1`, `1..*`) is an arrowhead label on a NAMED edge
  (`contains`): on an unnamed one it sits by both ends, and `1..*` reads as the whole's count.
- Members: `+name: Type`, methods `+total(): Money`; quote a member holding `:` or `#`
  (`"+pay(m: Method)": Receipt`). Class headers are 20px, `ink-500`, bold (d2check);
  member names take the header color, so a pale `focal` header hides them: a focus class
  is `focal-solid` + `style.stroke: ${paper}`. An `<<interface>>` stereotype goes on the
  label's first line.
- A class key is case-insensitive, so `Shape`, `Label`, `Style` or `Link` collide with
  keywords: `shape_cls: Shape {shape: class}`.

```d2-bad
# expect: reserved field
Shape: {shape: class; +area(): float}
```
