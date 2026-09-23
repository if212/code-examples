#!/usr/bin/env python3
"""Contact sheet: sheet.py OUT.png COLS CELLW img.png:label ... (Pillow).
Images wider than CELLW are scaled down; cells are laid out row by row."""
import sys

from PIL import Image, ImageDraw, ImageFont


def main(argv):
    if len(argv) < 4:
        print(__doc__.strip())
        return 2
    out, cols, cellw = argv[0], int(argv[1]), int(argv[2])
    items = []
    for arg in argv[3:]:
        path, _, label = arg.rpartition(':')  # the label is after the LAST colon: paths may hold one
        if not path:
            path, label = label, ''
        im = Image.open(path).convert('RGB')
        if im.width > cellw:
            im = im.resize((cellw, round(im.height * cellw / im.width)), Image.LANCZOS)
        items.append((im, label or path))
    try:
        font = ImageFont.truetype('DejaVuSans-Bold.ttf', 18)
    except OSError:
        font = ImageFont.load_default()
    rows = [items[i:i + cols] for i in range(0, len(items), cols)]
    heights = [max(im.height for im, _ in row) + 48 for row in rows]
    sheet = Image.new('RGB', (cols * (cellw + 16) + 16, sum(heights) + 16), '#E5E7EB')
    draw = ImageDraw.Draw(sheet)
    y = 8
    for row, h in zip(rows, heights):
        for c, (im, label) in enumerate(row):
            x = 16 + c * (cellw + 16)
            draw.rectangle([x, y, x + cellw - 1, y + h - 12], fill='white')
            draw.text((x + 10, y + 8), label, fill='#111827', font=font)
            sheet.paste(im, (x + (cellw - im.width) // 2, y + 38))
        y += h
    sheet.save(out)
    print(f'sheet: {out} {sheet.size[0]}x{sheet.size[1]}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
