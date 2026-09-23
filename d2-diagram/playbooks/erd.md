# Playbook: ER diagrams and UML class diagrams

ERD: tables, keys and relationships of a relational schema. UML class: an
object model (fields, methods, inheritance, composition). Templates:
`templates/erd.d2` (4 tables, a nullable FK, a legend, an enum note) and
`templates/class.d2` (5 classes, composition, realization). Syntax of
`sql_table` and `class`: `reference/syntax.md` section 12.

## ERD skeleton

| Part | How |
|---|---|
| Engine and direction | ELK (the theme) with `direction: right`: ELK attaches each edge to its column row |
| Tables | `shape: sql_table`, no class; the one focus table `class: focal-solid; style.stroke: ${paper}` |
| Table style | the globs at the END of the file (template): 16px rows, 1px rules, square corners, slate headers |
| Relationships | `parent.pk <-> child.fk` with both arrowheads set to `cf-*`; the template's last glob makes them `dep` at 2px |
| Legend | `vars.d2-legend`: one `a -> b` line per symbol used, 4px (rule 5) |
| Enum values | a `note` named after the type: `"order_status values:\npending, paid"` |

## Budget at 800px (measured)

ELK puts one FK level per column. The legend adds about 160px and its text is
fixed at 14px, so the SVG must stay under about 930px:

| Schema | Width | Smallest text at 800px |
|---|---|---|
| 3 levels + legend (template) | 825px | 13.5px |
| 4 levels + legend (6 tables) | 1183px | 9.5px: `E-small-text` |
| 4 levels, no legend | 1024px | 12.5px |

Four levels: drop the legend and say "crow's-foot notation" in the caption.
Five or more: split by domain into two diagrams. `direction: down` is no way
out: ELK builds a staircase 1.2-1.5x wider, with crossings.

## ERD notation checklist

- [ ] Every column the request names, with PK / FK / UNQ constraints (`S-missing-column`).
- [ ] Every relationship is `<->` with a `cf-*` head on both ends (`S-erd-cardinality`).
- [ ] Each FK line touches its FK row and its PK row (`S-erd-anchor`: ELK, not dagre).
- [ ] Nullable FK: `cf-one` at the parent; NOT NULL: `cf-one-required`.
- [ ] `semcheck --explain` reads every relationship back the way the request says.

## ERD rules

### 1. Both ends need an arrowhead: write `<->`

`->` silently drops the source head and `--` draws neither. The symbol at an
end says how many rows of THAT end's table match one row of the other:

| Head | Reads | Use at |
|---|---|---|
| `cf-one-required` | exactly one | the parent of a NOT NULL FK |
| `cf-one` | zero or one | the parent of a nullable FK |
| `cf-many-required` | one or many | the child when a parent needs at least one |
| `cf-many` | zero or many | the child, usually |

### 2. Nullable FK = `cf-one` at the parent

```d2
# cwd: ../templates
...@neutral-theme
direction: right
attendees: {shape: sql_table; id: uuid {constraint: primary_key}}
tickets: {
  shape: sql_table
  id: uuid {constraint: primary_key}
  attendee_id: uuid {constraint: [foreign_key; nullable]}
}
attendees.id <-> tickets.attendee_id: {source-arrowhead.shape: cf-one; target-arrowhead.shape: cf-many}
```

Show `nullable` in the constraint so the reader sees why the end is optional.
One glob that forces the same heads onto every relationship is how a nullable
FK ends up drawn as "exactly one".

### 3. Parent first; join tables between their parents

Write each edge parent PK first: ELK puts the source left, so roots (the
tenant, the aggregate) land in the left column. A join table then sits right
of both parents, between them. List its FK columns in the same top-to-bottom
order as the parents: swapping `org_id` and `user_id` in `memberships` removed
the only crossing of a 6-table schema.

### 4. Tables take no role class; style them with the globs

On `sql_table` and `class`, `style.stroke` paints the whole BODY, so every node
class (they all set a stroke) turns the rows dark. Use the template's globs
after the last table: 16px rows (the d2 default is 20px), square corners.
The focus table keeps `focal-solid` with `style.stroke: ${paper}`: blue header,
white body. Globs beat local styles, so the second glob skips it with
`!&class: focal-solid`.

### 5. Crow's feet stay legible on 2px lines

The template's last glob, `(** <-> **)[*]: {class: dep; style.stroke-width: 2}`,
gives every relationship the `dep` role at 2px: on 1px lines the crow's feet
thin to hairlines at 800px. The legend draws at half scale, so its lines are
4px and one-ended (`a -> b: zero or many {style.stroke-width: 4;
target-arrowhead.shape: cf-many}`): each key symbol then matches the diagram.
No verb labels by default: each labelled relationship widens its column gap by
the label width.

### 6. Enum values and domain notes

Put enum values in one `note` named after the type; keep the type name in the
column (`status: ticket_status`). Group large schemas with `zone` containers
per domain only when the grouping is part of the request.

## UML class rules

| Relationship | Write | Draws |
|---|---|---|
| Inheritance | `Parent <- Child: {source-arrowhead: {shape: triangle; style.filled: false}}` | solid line, hollow triangle |
| Realization | the same plus `style.stroke-dash: 4` | dashed line, hollow triangle |
| Composition | `Whole <- Part: contains {source-arrowhead: {shape: diamond; style.filled: true}}` | filled diamond on the whole |
| Aggregation | `Whole <- Part: {source-arrowhead.shape: diamond}` | hollow diamond |
| Association | `A -> B: label {target-arrowhead.label: "0..1"}` | multiplicity at the end |

```d2
# cwd: ../templates
...@neutral-theme
direction: down
Drawable: "<<interface>>\nDrawable" {shape: class; +area(): float}
Circle: {shape: class; -r: float}
Canvas: {shape: class; +draw(): void}
Drawable <- Circle: {class: dep; style.stroke-dash: 4; source-arrowhead: {shape: triangle; style.filled: false}}
Canvas <- Drawable: holds {class: dep; source-arrowhead: {shape: diamond; style.filled: true}; target-arrowhead.label: "0..*"}
*: {&shape: class; style: {font-size: 16; stroke-width: 1; border-radius: 0}}
*: {&shape: class; style.fill: ${ink-600}}
```

- `direction: down` with `Parent <- Child`: parents and wholes rank above
  their children. `direction: up` with `Child -> Parent` came out 1063px wide
  against 831px, with a bent edge.
- Edges `dep`. A multiplicity (`1`, `0..1`, `1..*`) is an arrowhead label on
  a NAMED edge (`contains`): ELK puts neighbouring classes 40px apart, so on
  an unnamed edge it sits by both ends and `1..*` reads as the count of the
  whole. A name adds a label layer and moves it to its own end.
- Members: `+name: Type`, methods `+total(): Money`. Quote any member that
  holds `:` or `#`: `"+pay(m: Method)": Receipt`, `"#status": Status`.
- A class key is case-insensitive, so `Shape`, `Label`, `Style` or `Link`
  collide with keywords. Keep the name in the label: `shape_cls: Shape {shape: class}`.

```d2-bad
# expect: reserved field
Shape: {shape: class; +area(): float}
```
- A class member name takes the header fill color: `focal` (a pale fill)
  makes the names invisible. Focus class: `focal-solid` + `style.stroke: ${paper}`.
- An `<<interface>>` stereotype goes on the label's first line.
