import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, EASE, alpha} from '../theme';
import {LIGHT_AXIS} from '../layout';

/**
 * The persistent 1px light axis (signature gradient) with a 40px bloom and a white-hot draw tip.
 * Draws left->right with EXPO_OUT over [drawFrom, drawFrom+drawDur] of the GLOBAL frame.
 * Main renders it once; y jumps from 600 to 340 at the S7->S8 cut (hidden by the light-wipe).
 *
 * Occlusion: the axis sits BEHIND the hero glass, and glass tiles are translucent, so a crisp 1px line would
 * read as a strikethrough/underline on their text. `occlude` dims the crisp core + tight bloom to
 * `occludeFloor` (and the wide bloom to `occludeBloomFloor`) across x-spans where hero glass sits, with a soft
 * feather at each end, so the axis visibly runs INTO the glass and diffuses behind it. Main drives it per scene
 * (axisOccludersAt in Main.tsx).
 */
export const axisYAt = (globalFrame: number): number => (globalFrame >= 990 ? LIGHT_AXIS.yEnd : LIGHT_AXIS.y);

/** One occluding x-span (canvas px). strength 0..1 (0 = no effect), feather = px ramp outside each end. */
export type AxisOccluder = {x0: number; x1: number; strength?: number; feather?: number};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const normalizeOccluders = (occ?: [number, number] | AxisOccluder[]): AxisOccluder[] => {
  if (!occ) return [];
  if (occ.length === 2 && typeof occ[0] === 'number' && typeof occ[1] === 'number') {
    return [{x0: occ[0], x1: occ[1]}];
  }
  return (occ as AxisOccluder[]).filter((o) => clamp01(o.strength ?? 1) > 0.001 && o.x1 > o.x0);
};

/**
 * Horizontal mask (for a 1920px-wide layer at left 0): alpha 1 outside every span, `floor` inside a span at
 * full strength, linear feathers. Overlapping spans take the strongest (max), they never compound.
 */
export const axisOcclusionMask = (occ: AxisOccluder[], floor: number): string | null => {
  if (!occ.length) return null;
  const pts = new Set<number>([0, 1920]);
  for (const o of occ) {
    const fe = Math.max(1, o.feather ?? 30);
    for (const x of [o.x0 - fe, o.x0, o.x1, o.x1 + fe]) pts.add(Math.max(0, Math.min(1920, x)));
  }
  const xs = [...pts].sort((a, b) => a - b);
  const alphaAt = (x: number): number => {
    let m = 0;
    for (const o of occ) {
      const fe = Math.max(1, o.feather ?? 30);
      const w = x < o.x0 ? 1 - (o.x0 - x) / fe : x > o.x1 ? 1 - (x - o.x1) / fe : 1;
      m = Math.max(m, clamp01(o.strength ?? 1) * clamp01(w));
    }
    return 1 - m * (1 - floor);
  };
  return `linear-gradient(90deg, ${xs.map((x) => `rgba(0,0,0,${alphaAt(x).toFixed(3)}) ${x.toFixed(1)}px`).join(', ')})`;
};

const maskBox = (mask: string | null): React.CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 1920,
  height: 120,
  ...(mask ? {WebkitMaskImage: mask, maskImage: mask} : {}),
});

export const LightAxis: React.FC<{
  frameOffset?: number;
  /** override y (canvas px). Default: axisYAt(globalFrame). */
  y?: number;
  opacity?: number;
  drawFrom?: number;
  drawDur?: number;
  /** x-span(s) where hero glass sits over the axis: [x0, x1] or a list of AxisOccluder. */
  occlude?: [number, number] | AxisOccluder[];
  /** what is left of the crisp core + tight bloom inside a full-strength span (default 0.12) */
  occludeFloor?: number;
  /** what is left of the wide soft bloom inside a full-strength span (default 0.5: light diffusing behind glass) */
  occludeBloomFloor?: number;
}> = ({frameOffset = 0, y, opacity = 1, drawFrom = 0, drawDur = 10, occlude, occludeFloor = 0.12, occludeBloomFloor = 0.5}) => {
  const g = useCurrentFrame() + frameOffset;
  const p = interpolate(g, [drawFrom, drawFrom + drawDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.EXPO_OUT,
  });
  const ay = y ?? axisYAt(g);
  // subtle breathing of the bloom
  const breathe = 0.9 + 0.1 * Math.sin(g / 23);
  const grad = `linear-gradient(90deg, ${C.ember} 0%, ${C.emberGlow} 30%, ${C.whiteHot} 50%, ${C.iceGlow} 70%, ${C.ice} 100%)`;
  const tipX = p * 1920;
  const occ = normalizeOccluders(occlude);
  const coreMask = axisOcclusionMask(occ, occludeFloor);
  const bloomMask = axisOcclusionMask(occ, occludeBloomFloor);
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
      {/* horizontal edge fade */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: ay - 60,
          width: 1920,
          height: 120,
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%)',
        }}
      >
        {/* draw progress clip */}
        <div style={{position: 'absolute', left: 0, top: 0, width: tipX, height: 120, overflow: 'hidden'}}>
          {/* wide bloom (soft: it may diffuse behind glass) */}
          <div style={maskBox(bloomMask)}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 20,
                width: 1920,
                height: 80,
                background: grad,
                opacity: 0.2 * breathe,
                WebkitMaskImage:
                  'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 25%, rgba(0,0,0,0.35) 40%, #000 50%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 75%, transparent 100%)',
                maskImage:
                  'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 25%, rgba(0,0,0,0.35) 40%, #000 50%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 75%, transparent 100%)',
              }}
            />
          </div>
          {/* crisp parts (occluded behind glass) */}
          <div style={maskBox(coreMask)}>
            {/* tight bloom */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 54,
                width: 1920,
                height: 12,
                background: grad,
                opacity: 0.45,
                WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 50%, transparent)',
                maskImage: 'linear-gradient(180deg, transparent, #000 50%, transparent)',
              }}
            />
            {/* the 1px core */}
            <div style={{position: 'absolute', left: 0, top: 59.5, width: 1920, height: 1, background: grad, opacity: 0.95}} />
          </div>
        </div>
      </div>
      {/* white-hot draw tip while drawing */}
      {p > 0 && p < 0.999 ? (
        <div
          style={{
            position: 'absolute',
            left: tipX - 90,
            top: ay - 90,
            width: 180,
            height: 180,
            background: `radial-gradient(circle, ${alpha(C.whiteHot, 0.9)} 0%, ${alpha(C.whiteHot, 0.35)} 12%, ${alpha(C.emberGlow, 0.12)} 35%, transparent 70%)`,
            opacity: 1 - p,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
