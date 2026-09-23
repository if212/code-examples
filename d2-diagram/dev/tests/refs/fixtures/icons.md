# verify_icons.sh self-test fixture

Explicit refs in prose: `lucide:database`, logos:postgresql and `k8s:pod`.
An alias still works but earns a WARN: `lucide:alert-triangle`.
`lucide:api` does not exist: use `lucide:plug`.

| Concept | Icon (lucide) | Alternatives |
|---|---|---|
| Cache | `zap` | `database-zap` |
| Queue | `list-ordered` | `layers`; brand: `logos:kafka-icon` |
| API | `webhook` | `plug` (`api` does NOT exist) |

| Lucide | Logos |
|---|---|
| `server` | `redis` |

A table without a family header: its bare names are not icons.

| Shape | Use |
|---|---|
| `cylinder` | databases |

```d2
db: Orders DB {icon: https://api.iconify.design/lucide/server.svg?color=%23475569}
```

Not refs: https://api.iconify.design/lucide/<name>.svg, https://example.com/page,
`localhost:3000`, `label.near: top-left`, 12:30, `sf-primary`, lucide:<name>.
