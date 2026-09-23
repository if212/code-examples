# Exports

Supported formats:

- SVG
- PNG
- PDF
- PPTX
- GIF
- ASCII (`.txt`)

## Commands

```sh
d2 in.d2 out.svg
d2 in.d2 out.png
d2 in.d2 out.pdf
d2 in.d2 out.pptx
d2 in.d2 out.gif
d2 --ascii-mode standard in.d2 out.txt
```

## Notes

- PNG/PDF may rely on Playwright/Chromium availability.
- SVG interactivity depends on embedding method.
- ASCII is best for simple box/arrow diagrams.
- **Embedding shrinks by width.** When an SVG is embedded in a fixed-width
  column (Confluence, Google Docs, a README), the viewer scales the whole image
  to the column width, so a **wide** diagram scales down hard and its text turns
  tiny. Displayed font size is roughly `authored font x (column width / diagram
  width)`. Prefer a **narrow/tall or balanced** aspect ratio; the wrapped "stage
  per row" grid (`reference/06-layouts.md`) trades width for height for exactly
  this reason.
