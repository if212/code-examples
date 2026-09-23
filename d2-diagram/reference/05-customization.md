# Customization

Topics:

- themes and dark themes
- style catalog (fill/stroke/font/etc.)
- classes (style grouping)
- dimensions and positions
- sketch mode
- interactive elements (links/tooltips)
- fonts
- animation (`style.animated`, composition with `--animate-interval`)

## Theme Example

```sh
d2 -t 101 --dark-theme 200 in.d2 out.svg
```

## Style Example

```d2
api.style.fill: "#E3F2FD"
api.style.stroke: "#0D47A1"
api.style.font-size: 18
api.style.animated: true
```
