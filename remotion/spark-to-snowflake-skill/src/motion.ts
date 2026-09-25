import {interpolate, random, spring} from 'remotion';
import {noise2D} from '@remotion/noise';
import {EASE, SPRING} from './theme';

/**
 * Pure motion helpers. Every helper is a pure function of the frame you pass in (usually the LOCAL frame
 * from useCurrentFrame()). No Math.random / Date anywhere.
 */

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 0->1 over [at, at+dur] with EXPO_OUT (default 20f). The reveal curve for everything. */
export const reveal = (frame: number, at: number, dur = 20, easing = EASE.EXPO_OUT): number =>
  interpolate(frame, [at, at + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing});

/** 0->1 over [at, at+dur] with the EXIT curve (default 10f). 0 = still visible, 1 = gone. */
export const exitP = (frame: number, at: number, dur = 10): number =>
  interpolate(frame, [at, at + dur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.EXIT});

/** Linear 0->1 over [a, b]. */
export const ramp = (frame: number, a: number, b: number): number =>
  interpolate(frame, [a, b], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Spring shorthands starting at local frame `at` (0 before). Values can overshoot 1 (SNAP/HINGE). */
export const snap = (frame: number, at: number, fps = 30): number => spring({frame: frame - at, fps, config: SPRING.SNAP});
export const glide = (frame: number, at: number, fps = 30, durationInFrames?: number): number =>
  spring({frame: frame - at, fps, config: SPRING.GLIDE, durationInFrames});
export const hinge = (frame: number, at: number, fps = 30): number => spring({frame: frame - at, fps, config: SPRING.HINGE});

/** sin bell: 0 at p=0 and p=1, 1 at p=0.5. Use for mid-flip tilt / sheen. */
export const bell = (p: number): number => Math.sin(Math.PI * clamp01(p));

/**
 * Stepped time for the S1 'by hand' layer: pf = floor(f/step)*step.
 * Feed the result into every animation of the ember layer instead of the raw frame.
 */
export const steppedFrame = (frame: number, step = 3): number => Math.floor(frame / step) * step;

/** Seeded +/-amp px jitter that changes once per stepped frame. key distinguishes objects. */
export const jitter = (key: string | number, pf: number, amp = 2): {x: number; y: number} => ({
  x: (random(`jx-${key}-${pf}`) * 2 - 1) * amp,
  y: (random(`jy-${key}-${pf}`) * 2 - 1) * amp,
});

/** Slow organic wobble in [-1, 1] (noise2D). speed ~0.01-0.03 per frame. */
export const wobble = (seed: string, frame: number, speed = 0.015, lane = 0): number => noise2D(seed, frame * speed, lane);

/**
 * Velocity of a 1D motion function at `frame` (units per frame). Use to drive directional blur:
 * const v = velocity((f) => xAt(f), frame);  <DirectionalBlur amount={Math.abs(v) * 0.35} ...>
 */
export const velocity = (fn: (f: number) => number, frame: number): number => fn(frame) - fn(frame - 1);

/** 2D speed + angle of a motion function returning {x, y}. */
export const velocity2D = (
  fn: (f: number) => {x: number; y: number},
  frame: number,
): {vx: number; vy: number; speed: number; angle: number} => {
  const a = fn(frame - 1);
  const b = fn(frame);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  return {vx, vy, speed: Math.hypot(vx, vy), angle: (Math.atan2(vy, vx) * 180) / Math.PI};
};

/** Cubic bezier point (for flight paths when you do not want an SVG path). */
export const bezierPoint = (
  t: number,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
): {x: number; y: number} => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {x: a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], y: a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]};
};

/** Number roll-up for stat chips: integer shown at progress p (0..1) of a 12f roll. */
export const rollNumber = (value: number, p: number): number => Math.round(value * clamp01(p));
