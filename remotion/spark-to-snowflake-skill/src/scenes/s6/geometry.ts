import {Easing, interpolate} from 'remotion';
import {BOARD, CODE_PANEL, CX, CY, SKILL_DOCK, tileRect} from '../../layout';
import {TRAP_INDEX} from '../../demoData';
import {TYPE} from '../../theme';
import {drift} from '../../components';
import {sceneById} from '../../timeline';
import {T6} from './timing';

/**
 * S6 geometry: the push-in camera (continuing exactly from S5's last camera), the tile -> panel morph box,
 * and the fixed layout inside the flat code panel. All canvas px.
 */

/** tile 2 = latest_customers.sql (the S1 'missed one') */
export const TRAP = tileRect(TRAP_INDEX);
export const PUSH_SCALE = 3.4;

/** S5's shot camera (see S5.tsx): drift about the board's bottom edge, y clamped <= 0, rotate x0.6. */
const S5_DUR = sceneById('S5').duration;
const S5_ORIGIN: [number, number] = [BOARD.cx, BOARD.top + BOARD.height];
const S5_END = (() => {
  const d = drift(S5_DUR, S5_DUR, 'S5', 0.025);
  return {scale: d.scale, rotate: d.rotate * 0.6, x: d.x, y: Math.min(0, d.y)};
})();

export type Cam = {origin: [number, number]; scale: number; rotate: number; x: number; y: number};

/**
 * Push progress with an acceleration head: frame 1 moves < 1% of the push, the peak is mid-move and it
 * settles softly (a camera move toward a visible target, not a jump cut).
 */
const PUSH_EASE = Easing.bezier(0.5, 0, 0.12, 1);
export const pushP = (f: number): number =>
  interpolate(f, [0, T6.pushTo], [0, 1], {easing: PUSH_EASE, extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Zoom interpolated in log space, so equal steps of p read as equal perceived speed. */
export const pushScale = (p: number): number => Math.pow(PUSH_SCALE, p);

/** Outer camera: S5's final drift, released to identity as the push runs. */
export const outerCam = (f: number): Cam => {
  const k = 1 - pushP(f);
  return {origin: S5_ORIGIN, scale: 1 + (S5_END.scale - 1) * k, rotate: S5_END.rotate * k, x: S5_END.x * k, y: S5_END.y * k};
};

/** Inner camera: the push into tile 2 (its centre travels to the hero centre). */
export const innerCam = (f: number): Cam => {
  const p = pushP(f);
  return {origin: [TRAP.cx, TRAP.cy], scale: pushScale(p), rotate: 0, x: (CX - TRAP.cx) * p, y: (CY - TRAP.cy) * p};
};

const apply = (c: Cam, x: number, y: number) => ({
  x: c.origin[0] + c.x + c.scale * (x - c.origin[0]),
  y: c.origin[1] + c.y + c.scale * (y - c.origin[1]),
});

/** Screen rect of tile 2 under both cameras (rotation ignored: it is < 0.2deg and released by the push). */
export const trapScreen = (f: number) => {
  const ic = innerCam(f);
  const oc = outerCam(f);
  const b = apply(ic, TRAP.x, TRAP.y);
  const a = apply(oc, b.x, b.y);
  const s = ic.scale * oc.scale;
  return {x: a.x, y: a.y, w: TRAP.w * s, h: TRAP.h * s, s};
};

/** The flat code panel. */
export const PANEL = {x: CODE_PANEL.left, y: CODE_PANEL.top, w: CODE_PANEL.w, h: CODE_PANEL.h, r: 26} as const;

/** Left column: filename header, state chip, code line, 'from Mappings' chip (vertical centres). */
export const CODE = {
  x: CODE_PANEL.codeX,
  fileY: 454,
  chipY: 522,
  /** the single state chip is set at the gloss size so it reads at a glance */
  chipSize: TYPE.gloss,
  lineY: 606,
  mapY: 694,
  size: TYPE.code,
  /** the full fixed line must end left of the result column, so the mono is tracked in slightly */
  trackingEm: -0.035,
} as const;

/** Right column: the 3-pill result stack at x1380-1540. */
/** nudged 16px right of the storyboard's x1380 so the fixed 35-char line (48px mono) keeps clear air */
const STACK_SHIFT = 16;
const PILL_H = 54;
const RING_PAD = 6;
const SLOT0 = 562;
/** tag pill height (Tag = 15px Pill -> round(15 * 1.85)) */
const TAG_H = 28;
export const STACK = {
  x0: CODE_PANEL.stackX0 + STACK_SHIFT,
  x1: CODE_PANEL.stackX1 + STACK_SHIFT,
  w: CODE_PANEL.stackX1 - CODE_PANEL.stackX0,
  cx: (CODE_PANEL.stackX0 + CODE_PANEL.stackX1) / 2 + STACK_SHIFT,
  pillH: PILL_H,
  ringPad: RING_PAD,
  slotY: (k: number): number => SLOT0 + k * 68,
  /** row tags sit 18px clear above the winner ring (never on its stroke) */
  tagY: SLOT0 - PILL_H / 2 - RING_PAD - 18 - TAG_H / 2,
  dividerX: CODE_PANEL.stackX0 + STACK_SHIFT - 26,
} as const;

/** Where the 'from Mappings' chip leaves the dock: the Mappings cell's right edge. */
export const DOCK_MAPPINGS = {x: SKILL_DOCK.x1 - 6, y: SKILL_DOCK.y0 + 90 + 76 + 34} as const;
