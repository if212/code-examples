# FAQ and Troubleshooting

## Common Issues

- Parser fails on label/value -> quote it.
- Unicode punctuation in syntax slots -> replace with ASCII punctuation.
- Diagram text too wide -> insert line breaks.
- SVG interactivity missing -> check embedding method.
- Browser/PNG render failures -> verify Playwright/Chromium dependencies.

## Quick Fix Pattern

1. run `d2 validate`
2. isolate failing block
3. quote suspicious keys/labels
4. replace Unicode lookalikes
5. re-run `d2 fmt` and render
