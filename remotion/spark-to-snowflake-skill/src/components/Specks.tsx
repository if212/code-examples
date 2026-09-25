import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {noise2D} from '@remotion/noise';
import {C, alpha} from '../theme';
import {emberShare} from '../timeline';

/**
 * Foreground bokeh plane (1.3x parallax): soft ember round specks (lower-left) and ice hex specks
 * (upper-right). Their balance follows the global colour arc. Rendered once by Main above the scenes.
 * Never a star or snowflake glyph: embers are round dots, ice uses hex facets.
 */
const COUNT = 22;

const hexClip = 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)';

export const Specks: React.FC<{frameOffset?: number; opacity?: number}> = ({frameOffset = 0, opacity = 1}) => {
  const g = useCurrentFrame() + frameOffset;
  const e = emberShare(g);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      {new Array(COUNT).fill(0).map((_, n) => {
        const isIce = n % 2 === 1;
        const r1 = random(`speck-x-${n}`);
        const r2 = random(`speck-y-${n}`);
        const size = 5 + random(`speck-s-${n}`) * 13;
        const depthBlur = size > 12 ? 1 : 0;
        // ember specks live lower-left, ice specks upper-right
        const bx = isIce ? 760 + r1 * 1180 : -40 + r1 * 1180;
        const by = isIce ? -20 + r2 * 700 : 380 + r2 * 720;
        // 1.3x parallax drift: faster than the 0.3x grid
        const x = bx - g * 0.55 * (0.6 + r2 * 0.6) + noise2D(`speck-nx-${n}`, g * 0.01, 0) * 30;
        const y = by - g * 0.18 * (0.5 + r1) + noise2D(`speck-ny-${n}`, g * 0.01, 1) * 24;
        const wx = ((x % 2040) + 2040) % 2040 - 60;
        const wy = ((y % 1200) + 1200) % 1200 - 60;
        const twinkle = 0.55 + 0.45 * noise2D(`speck-t-${n}`, g * 0.03, 2);
        const share = isIce ? 1 - e : e;
        const a = (0.1 + 0.28 * share) * twinkle;
        const col = isIce ? C.iceGlow : C.emberGlow;
        return (
          <div
            key={n}
            style={{
              position: 'absolute',
              left: wx,
              top: wy,
              width: size,
              height: size,
              opacity: a,
              borderRadius: isIce ? 0 : '50%',
              clipPath: isIce ? hexClip : undefined,
              background: isIce
                ? `radial-gradient(circle, ${alpha(col, 0.95)} 0%, ${alpha(C.ice, 0.55)} 55%, ${alpha(C.ice, 0.15)} 100%)`
                : `radial-gradient(circle, ${alpha(col, 1)} 0%, ${alpha(C.ember, 0.6)} 40%, ${alpha(C.ember, 0)} 72%)`,
              filter: depthBlur ? 'blur(1.5px)' : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
