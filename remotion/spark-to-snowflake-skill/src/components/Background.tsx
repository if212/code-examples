import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {C} from '../theme';
import {emberShare} from '../timeline';
import {wobble} from '../motion';

/**
 * Global stage: ink base, stage-lift radial, two huge soft orbs (ember bottom-left, ice top-right) whose mix
 * follows the global colour arc, a 48px dot grid with slow 0.3x parallax, and a vignette.
 *
 * PERFORMANCE: every soft shape is a pre-rendered falloff PNG (public/grain/*.png from
 * scripts/make-grain.py) composited with CSS opacity + position. Painting the same shapes as full-screen
 * CSS radial-gradients cost ~120ms/frame; images cost ~10ms. No CSS blur anywhere. The grain overlay
 * (Grain, rendered topmost by Main) dithers any 8-bit banding.
 *
 * The orbs are driven by the GLOBAL frame: globalFrame = useCurrentFrame() + frameOffset
 * (or `globalFrame` if given). Main passes nothing; a per-scene preview passes frameOffset = scene.from.
 */
const Soft: React.FC<{src: string; cx: number; cy: number; rx: number; ry?: number; opacity: number}> = ({src, cx, cy, rx, ry, opacity}) => (
  <Img
    src={staticFile(`grain/${src}`)}
    style={{
      position: 'absolute',
      left: cx - rx,
      top: cy - (ry ?? rx),
      width: rx * 2,
      height: (ry ?? rx) * 2,
      opacity: Math.max(0, Math.min(1, opacity)),
    }}
  />
);

export const orbState = (g: number) => {
  const e = emberShare(g); // 0.70 -> 0.20
  const i = 1 - e; // 0.30 -> 0.80
  return {
    e,
    i,
    ex: 250 + wobble('orb-ex', g, 0.006) * 60,
    ey: 960 + wobble('orb-ey', g, 0.006) * 40,
    ix: 1680 + wobble('orb-ix', g, 0.006) * 60,
    iy: 110 + wobble('orb-iy', g, 0.006) * 40,
    eR: 780 + 620 * e,
    iR: 780 + 620 * i,
  };
};

export const Background: React.FC<{frameOffset?: number; globalFrame?: number; grid?: boolean}> = ({
  frameOffset = 0,
  globalFrame,
  grid = true,
}) => {
  const local = useCurrentFrame();
  const g = globalFrame ?? local + frameOffset;
  const o = orbState(g);
  // 0.3x parallax plane: a slow pan of the dot grid (wraps every 48px cell)
  const gx = -((g * 0.16) % 48);
  const gy = -((g * 0.07) % 48);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
      {/* stage lift behind the light axis */}
      <Soft src="stage-lift.png" cx={960} cy={599} rx={1150} ry={720} opacity={1} />
      {/* ember orb (bottom-left): broad deep body + warmer core */}
      <Soft src="orb-ember-deep.png" cx={o.ex} cy={o.ey} rx={o.eR} opacity={0.95 * o.e + 0.05} />
      <Soft src="orb-ember-core.png" cx={o.ex} cy={o.ey} rx={o.eR * 0.55} opacity={0.2 * o.e + 0.02} />
      {/* ice orb (top-right) */}
      <Soft src="orb-ice-deep.png" cx={o.ix} cy={o.iy} rx={o.iR} opacity={0.95 * o.i + 0.05} />
      <Soft src="orb-ice-core.png" cx={o.ix} cy={o.iy} rx={o.iR * 0.55} opacity={0.17 * o.i + 0.02} />
      {grid ? (
        <Img
          src={staticFile('grain/dots.png')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 1968,
            height: 1128,
            transform: `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px)`,
            opacity: 0.6,
          }}
        />
      ) : null}
      {/* vignette */}
      <Img src={staticFile('grain/vignette.png')} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080}} />
    </AbsoluteFill>
  );
};

/**
 * Animated film grain (required: dark gradients band). 6 pre-rendered tileable PNGs (scripts/make-grain.py)
 * cycled every 2 frames, repeated as a CSS background at ~4% opacity. Main renders it ONCE, topmost.
 */
export const GRAIN_TILES = 6;
export const Grain: React.FC<{frameOffset?: number; opacity?: number}> = ({frameOffset = 0, opacity = 0.04}) => {
  const f = useCurrentFrame() + frameOffset;
  const k = Math.floor(f / 2);
  const idx = k % GRAIN_TILES;
  // shift the tile each cycle so the 512px repeat never lines up frame to frame
  const ox = (k * 173) % 512;
  const oy = (k * 311) % 512;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile(`grain/grain-${idx}.png`)})`,
        backgroundRepeat: 'repeat',
        backgroundSize: '512px 512px',
        backgroundPosition: `${ox}px ${oy}px`,
        opacity,
        pointerEvents: 'none',
      }}
    >
      {/* preload all tiles so no frame ever waits on a fetch */}
      <div style={{display: 'none'}}>
        {new Array(GRAIN_TILES).fill(0).map((_, n) => (
          <Img key={n} src={staticFile(`grain/grain-${n}.png`)} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
