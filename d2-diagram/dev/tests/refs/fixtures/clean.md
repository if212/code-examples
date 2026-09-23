# A clean doc: every block passes (exit 0)

```d2
vars: {d2-config: {layout-engine: elk; pad: 24}}
web: Web
api: API
web -> api: HTTPS
```

```d2-bad
# expect: failed to import
...@no-such-theme
a -> b
```

```d2
# fragment
a.style.fill: "#FFFFFF"
```
