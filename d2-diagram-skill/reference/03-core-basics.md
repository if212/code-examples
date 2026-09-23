# Core Basics

## Shapes

```d2
api: API
db: Database
db.shape: cylinder
```

## Connections

Valid connectors: `--`, `->`, `<-`, `<->`.

```d2
api -> db: reads/writes
```

## Containers

```d2
cloud: {
  app
  db
  app -> db
}
```

Notes:

- Keys are case-insensitive.
- Undeclared node references in connections auto-create nodes.
