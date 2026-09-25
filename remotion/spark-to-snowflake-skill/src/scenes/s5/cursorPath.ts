import {tileRect} from '../../layout';
import {JOBS} from '../../demoData';

/**
 * S5 review cursor: a smooth serpentine skim across the board, row by row (row 0 left->right, row 1
 * right->left, row 2 left->right), then up onto the first amber tile's neighbour column where it settles
 * on churn_model.py. Pure module-level geometry (Catmull-Rom through tile-anchored waypoints, re-parametrised
 * by arc length) so the speed is even along the path; timing is an ease-in-out over the skim window.
 */

type Pt = [number, number];

export const SKIM = {from: 96, to: 142} as const;
/** frames of ease-in at the start and ease-out at the end; constant speed in between */
const ACCEL = 6;
const DECEL = 12;

const r = (i: number) => tileRect(i);

/** Waypoints (cursor TIP, canvas px), anchored to the BOARD constants. */
const WAYPOINTS: Pt[] = (() => {
  const t = (i: number, dx = 0, dy = 30): Pt => [r(i).cx + dx, r(i).cy + dy];
  const r0 = r(0);
  const r2 = r(2);
  const r4 = r(4);
  const r7 = r(7);
  return [
    [r0.x + 40, r0.y + 40], // appears on the board's upper-left tile
    t(0, 30, 34),
    t(1, 0, 36),
    t(2, -40, 38),
    [r2.cx + 40, (r(2).cy + r(6).cy) / 2 + 12], // U-turn (right), stays inside the ice columns
    t(6, -40, 42),
    t(5, 0, 42),
    t(4, 40, 42),
    [r4.cx - 60, (r(4).cy + r(8).cy) / 2 + 12], // U-turn (left)
    t(8, 40, 34),
    t(9, 0, 34),
    t(10, 0, 34),
    t(11, -60, 8),
    [r7.cx - 34, r7.cy + 26], // settles on churn_model.py (amber)
  ];
})();

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

/** Dense polyline + cumulative arc length. */
const SAMPLES: {x: number; y: number; s: number}[] = (() => {
  const pts = WAYPOINTS;
  const out: {x: number; y: number; s: number}[] = [];
  const per = 48;
  let s = 0;
  let prev: {x: number; y: number} | null = null;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    for (let j = k === 0 ? 0 : 1; j <= per; j++) {
      const t = j / per;
      const x = catmull(p0[0], p1[0], p2[0], p3[0], t);
      const y = catmull(p0[1], p1[1], p2[1], p3[1], t);
      if (prev) s += Math.hypot(x - prev.x, y - prev.y);
      out.push({x, y, s});
      prev = {x, y};
    }
  }
  return out;
})();

const TOTAL_LEN = SAMPLES[SAMPLES.length - 1].s;

/** Point at arc-length fraction u (0..1). */
const pointAtU = (u: number): {x: number; y: number} => {
  const target = Math.max(0, Math.min(1, u)) * TOTAL_LEN;
  let lo = 0;
  let hi = SAMPLES.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (SAMPLES[mid].s < target) lo = mid;
    else hi = mid;
  }
  const a = SAMPLES[lo];
  const b = SAMPLES[hi];
  const k = b.s - a.s > 1e-6 ? (target - a.s) / (b.s - a.s) : 0;
  return {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k};
};

/**
 * Skim timing: quadratic ease-in over ACCEL frames, constant speed, quadratic ease-out over DECEL frames
 * (C1-continuous, so the speed never jumps and the peak speed stays as low as possible).
 */
export const skimU = (frame: number): number => {
  const dur = SKIM.to - SKIM.from;
  const v = 1 / (dur - ACCEL / 2 - DECEL / 2);
  const x = Math.max(0, Math.min(dur, frame - SKIM.from));
  if (x <= ACCEL) return (v * x * x) / (2 * ACCEL);
  const a = (v * ACCEL) / 2;
  if (x <= dur - DECEL) return a + v * (x - ACCEL);
  const y = dur - x;
  return 1 - (v * y * y) / (2 * DECEL);
};

/** Cursor tip position at a (possibly fractional) local frame. */
export const cursorAt = (frame: number): {x: number; y: number} => pointAtU(skimU(frame));

/**
 * For every converted tile the skim passes over: the frame of closest approach (the 'reviewed' tick).
 * Computed once by sampling the path at 1/4 frame.
 */
export const REVIEW_TICKS: Record<number, number> = (() => {
  const best: Record<number, {d: number; f: number}> = {};
  for (let f = SKIM.from; f <= SKIM.to; f += 0.25) {
    const p = cursorAt(f);
    for (const job of JOBS) {
      if (job.outcome !== 'converted') continue;
      const rc = tileRect(job.index);
      const d = Math.hypot(p.x - rc.cx, p.y - (rc.cy + 30));
      if (!best[job.index] || d < best[job.index].d) best[job.index] = {d, f};
    }
  }
  const out: Record<number, number> = {};
  for (const k of Object.keys(best)) {
    const b = best[Number(k)];
    if (b.d < 90) out[Number(k)] = b.f;
  }
  return out;
})();
