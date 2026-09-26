import {tileRect} from '../../layout';
import {JOBS} from '../../demoData';

/**
 * S5 review cursor: it glides in from just left of the board, then skims the board row by row in a smooth
 * serpentine (row 0 left->right, row 1 right->left, row 2 left->right), and finally goes up onto
 * churn_model.py (amber), where it settles. Pure module-level geometry: a Catmull-Rom spline through
 * tile-anchored waypoints, re-parametrised by arc length. Timing runs through a 'dwell' warp. The cursor
 * slows to about a quarter of its speed at each row's U-turn, so each row reads as one reviewed pass,
 * and the whole skim eases in and out.
 *
 * Row 2's waypoints sit high on the tiles, so the 'you' tag (which hangs about 67px below the tip) stays
 * above y≈860 and never touches the stat chips under the board.
 *
 * S6 imports cursorAt(S5 duration) for its first frame, so the LAST waypoint must not move.
 */

type Pt = [number, number];

export const SKIM = {from: 96, to: 142} as const;
/** frames of ease-in at the start and ease-out at the end; constant (warped) speed in between */
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
    [r0.x - 84, r0.y + 8], // enters from just left of the board (right of the skill dock, above it)
    t(0, 20, 30),
    t(1, 0, 34),
    t(2, -40, 38),
    [r2.cx + 40, (r(2).cy + r(6).cy) / 2 + 12], // U-turn (right), stays inside the ice columns
    t(6, -40, 40),
    t(5, 0, 40),
    t(4, 40, 40),
    [r4.cx - 60, (r(4).cy + r(8).cy) / 2 + 2], // U-turn (left)
    t(8, 40, -14),
    t(9, 0, -14),
    t(10, 0, -14),
    t(11, -60, -22),
    [r7.cx - 34, r7.cy + 26], // settles on churn_model.py (amber). S6 continues from here: keep it fixed.
  ];
})();

/** Waypoints where the skim slows down (the two U-turns between rows). */
const DWELL_AT = [4, 8];
/** peak slow-down (time density 1 + DWELL_GAIN at the waypoint) and its half-width along the path, px */
const DWELL_GAIN = 3;
const DWELL_W = 55;

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

const PER = 48;

/** Dense polyline + cumulative arc length s. */
const SAMPLES: {x: number; y: number; s: number}[] = (() => {
  const pts = WAYPOINTS;
  const out: {x: number; y: number; s: number}[] = [];
  let s = 0;
  let prev: {x: number; y: number} | null = null;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    for (let j = k === 0 ? 0 : 1; j <= PER; j++) {
      const t = j / PER;
      const x = catmull(p0[0], p1[0], p2[0], p3[0], t);
      const y = catmull(p0[1], p1[1], p2[1], p3[1], t);
      if (prev) s += Math.hypot(x - prev.x, y - prev.y);
      out.push({x, y, s});
      prev = {x, y};
    }
  }
  return out;
})();

/** Arc length at each dwell waypoint (waypoint k is sample k * PER). */
const DWELL_S = DWELL_AT.map((k) => SAMPLES[k * PER].s);

/** Cumulative 'time' along the path: tau(s) = integral of the dwell density. */
const TAU: number[] = (() => {
  const dens = (s: number) => 1 + DWELL_S.reduce((acc, ds) => acc + DWELL_GAIN * Math.exp(-(((s - ds) / DWELL_W) ** 2)), 0);
  const out: number[] = [0];
  for (let k = 1; k < SAMPLES.length; k++) {
    const a = SAMPLES[k - 1];
    const b = SAMPLES[k];
    out.push(out[k - 1] + (b.s - a.s) * 0.5 * (dens(a.s) + dens(b.s)));
  }
  return out;
})();
const TAU_TOTAL = TAU[TAU.length - 1];

/** Point at warped-time fraction u (0..1). */
const pointAtU = (u: number): {x: number; y: number} => {
  const target = Math.max(0, Math.min(1, u)) * TAU_TOTAL;
  let lo = 0;
  let hi = SAMPLES.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (TAU[mid] < target) lo = mid;
    else hi = mid;
  }
  const a = SAMPLES[lo];
  const b = SAMPLES[hi];
  const span = TAU[hi] - TAU[lo];
  const k = span > 1e-6 ? (target - TAU[lo]) / span : 0;
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
      const d = Math.hypot(p.x - rc.cx, p.y - (rc.cy + 20));
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
