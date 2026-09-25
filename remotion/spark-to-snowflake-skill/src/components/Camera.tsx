import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {noise2D} from '@remotion/noise';

/**
 * Shot drift + push/pull camera. There is no one-take camera: each scene wraps its hero layer in <Camera>.
 *  - drift(frame, duration): scale 1.00 -> 1.03 over the shot, +/-0.3deg slow noise rotation, tiny float.
 *  - <Camera scale x y rotate origin> applies a transform about a focal point (canvas px).
 * Do NOT put filters on the Camera (it may contain preserve-3d tiles). Headlines stay OUTSIDE the camera.
 */
export const drift = (frame: number, duration: number, seed = 'shot', amount = 0.03) => {
  const t = Math.max(0, Math.min(1, frame / Math.max(1, duration)));
  return {
    scale: 1 + amount * t,
    rotate: 0.3 * noise2D(`${seed}-r`, frame * 0.012, 0),
    x: 6 * noise2D(`${seed}-x`, frame * 0.01, 1),
    y: 4 * noise2D(`${seed}-y`, frame * 0.01, 2),
  };
};

/** Push-in / pull-back helper: interpolate scale over [from, to] frames with a given easing. */
export const push = (
  frame: number,
  from: number,
  to: number,
  s0: number,
  s1: number,
  easing?: (t: number) => number,
): number => interpolate(frame, [from, to], [s0, s1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

export const Camera: React.FC<{
  scale?: number;
  x?: number;
  y?: number;
  rotate?: number;
  /** focal point in canvas px (default the hero centre 960,600) */
  origin?: [number, number];
  /** combine with a drift() result */
  drift?: {scale: number; rotate: number; x: number; y: number};
  opacity?: number;
  children: React.ReactNode;
}> = ({scale = 1, x = 0, y = 0, rotate = 0, origin = [960, 600], drift: d, opacity = 1, children}) => {
  const s = scale * (d ? d.scale : 1);
  const r = rotate + (d ? d.rotate : 0);
  const tx = x + (d ? d.x : 0);
  const ty = y + (d ? d.y : 0);
  return (
    <AbsoluteFill
      style={{
        transformOrigin: `${origin[0]}px ${origin[1]}px`,
        transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
