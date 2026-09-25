#!/usr/bin/env python3
"""Generate tileable film-grain PNGs for the Background grain overlay.

Writes public/grain/grain-0.png .. grain-5.png (512x512, 8-bit greyscale) and
public/grain/dots.png (the pre-faded 48px dot grid, see make_dots()), and the orb / stage-lift /
vignette images used by src/components/Background.tsx (see make_orbs()).
Each tile is Gaussian luminance noise (mean ~128) with a very light
wrap-around blur so the grain reads as soft film grain instead of hard
digital pixels. Because the blur is done on a 3x3 tiled copy and the centre
is cropped back out, every tile repeats seamlessly as a CSS background.

Run from the project root:  python3 scripts/make-grain.py
Deterministic: Pillow's effect_noise is seeded per tile via random.seed.
"""
import os
import random

from PIL import Image, ImageFilter, ImageChops

SIZE = 512
COUNT = 6
SIGMA = 58  # std-dev of the luminance noise (out of 255)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'grain')


def tile_noise(seed: int) -> Image.Image:
    random.seed(seed)
    # effect_noise is not seedable, so build the noise from Python's seeded RNG.
    data = bytes(
        max(0, min(255, int(round(random.gauss(128, SIGMA)))))
        for _ in range(SIZE * SIZE)
    )
    img = Image.frombytes('L', (SIZE, SIZE), data)
    # Seamless soft blur: blur a 3x3 tiling, crop the middle tile back out.
    big = Image.new('L', (SIZE * 3, SIZE * 3))
    for gx in range(3):
        for gy in range(3):
            big.paste(img, (gx * SIZE, gy * SIZE))
    big = big.filter(ImageFilter.GaussianBlur(0.55))
    img = big.crop((SIZE, SIZE, SIZE * 2, SIZE * 2))
    # Restore contrast lost to the blur (keep mean at 128).
    img = img.point(lambda v: max(0, min(255, int(round(128 + (v - 128) * 1.6)))))
    return img


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for i in range(COUNT):
        img = tile_noise(1000 + i * 7919)
        path = os.path.join(OUT, f'grain-{i}.png')
        img.save(path, optimize=True)
        print('wrote', os.path.relpath(path))



# ---------------------------------------------------------------------------------------------
# Dot grid: 48px dot grid, pre-faded with a soft elliptical falloff around the hero zone, so the
# Background can draw it as ONE image (cheap) instead of a masked CSS gradient (expensive offscreen pass).
# Written to public/grain/dots.png (1968x1128 = 1920x1080 + one 48px cell, for the parallax shift).
# ---------------------------------------------------------------------------------------------
def make_dots() -> None:
    import math

    W, H, STEP = 1920 + 48, 1080 + 48, 48
    SS = 4  # supersample for round anti-aliased dots
    dot = Image.new('L', (STEP * SS, STEP * SS), 0)
    from PIL import ImageDraw

    d = ImageDraw.Draw(dot)
    c = STEP * SS / 2
    r = 1.45 * SS
    d.ellipse((c - r, c - r, c + r, c + r), fill=255)
    dot = dot.resize((STEP, STEP), Image.LANCZOS)
    tile = Image.new('L', (W, H), 0)
    for y in range(0, H, STEP):
        for x in range(0, W, STEP):
            tile.paste(dot, (x, y))
    # elliptical fade centred on the hero zone (x 50%, y 55%), matching the old CSS mask
    cx, cy = W / 2, H * 0.55
    rx, ry = 980.0, 620.0
    fade = Image.new('L', (W, H), 0)
    px = fade.load()
    for y in range(H):
        for x in range(W):
            t = math.hypot((x - cx) / rx, (y - cy) / ry)
            if t >= 1:
                v = 0.0
            elif t <= 0.55:
                v = 1.0 - (1 - 0.55) * (t / 0.55)
            else:
                v = 0.55 * (1 - (t - 0.55) / 0.45)
            px[x, y] = int(round(255 * v))
    alpha_ch = ImageChops.multiply(tile, fade)
    rgba = Image.new('RGBA', (W, H), (0x2A, 0x35, 0x50, 0))
    rgba.putalpha(alpha_ch)
    path = os.path.join(OUT, 'dots.png')
    rgba.save(path, optimize=True)
    print('wrote', os.path.relpath(path))


# ---------------------------------------------------------------------------------------------
# Orbs / stage lift / vignette as images. Painting six full-screen CSS radial gradients cost ~120ms per
# frame in headless Chrome; compositing pre-rendered images with CSS opacity costs ~10ms. The falloff
# matches theme.softRadial(): alpha = exp(-k t^2) * (1 - t^3), t = distance / radius.
# ---------------------------------------------------------------------------------------------
ORB_SIZE = 768


def falloff_image(rgb, sharpness, size=ORB_SIZE):
    import math

    im = Image.new('RGBA', (size, size))
    px = im.load()
    c = (size - 1) / 2.0
    r = size / 2.0
    for y in range(size):
        for x in range(size):
            t = math.hypot(x - c, y - c) / r
            a = 0.0 if t >= 1 else math.exp(-sharpness * t * t) * (1 - t ** 3)
            px[x, y] = (rgb[0], rgb[1], rgb[2], int(round(255 * a)))
    return im


def make_orbs() -> None:
    import math

    specs = {
        'orb-ember-deep.png': ((0x7A, 0x2A, 0x0F), 2.2),
        'orb-ember-core.png': ((0xFF, 0x7A, 0x3D), 2.4),
        'orb-ice-deep.png': ((0x0B, 0x4F, 0x74), 2.2),
        'orb-ice-core.png': ((0x38, 0xE1, 0xFF), 2.4),
        'stage-lift.png': ((0x0B, 0x10, 0x20), 2.2),
    }
    for name, (rgb, k) in specs.items():
        path = os.path.join(OUT, name)
        falloff_image(rgb, k).save(path, optimize=True)
        print('wrote', os.path.relpath(path))
    # vignette: full frame at half resolution (displayed at 1920x1080)
    W, H = 960, 540
    im = Image.new('RGBA', (W, H))
    px = im.load()
    stops = [(0.0, 0.0), (0.45, 0.0), (0.60, 0.10), (0.75, 0.24), (0.90, 0.42), (1.0, 0.55)]
    cx, cy = W * 0.5, H * 0.52
    rx, ry = 650.0, 430.0  # 1300x860 ellipse at full res -> radii 650x430 at half res
    for y in range(H):
        for x in range(W):
            t = math.hypot((x - cx) / rx, (y - cy) / ry)
            a = stops[-1][1]
            for i in range(len(stops) - 1):
                if t <= stops[i + 1][0]:
                    t0, a0 = stops[i]
                    t1, a1 = stops[i + 1]
                    a = a0 + (a1 - a0) * (t - t0) / (t1 - t0)
                    break
            px[x, y] = (2, 3, 7, int(round(255 * a)))
    path = os.path.join(OUT, 'vignette.png')
    im.save(path, optimize=True)
    print('wrote', os.path.relpath(path))


if __name__ == '__main__':
    main()
    make_dots()
    make_orbs()
