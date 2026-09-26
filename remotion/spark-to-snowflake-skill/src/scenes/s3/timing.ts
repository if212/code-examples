import {Easing, interpolate, spring} from 'remotion';
import type {SpringConfig} from 'remotion';
import {EASE, SPRING} from '../../theme';
import {TRIPTYCH} from '../../layout';
import {clamp01} from '../../motion';

/**
 * S3 timing + geometry (local frames, 0..149). Everything is a pure function of the frame.
 *
 * Choreography:
 *  lf0-16   the S2 folder turns toward the camera: a shallow yaw swing (0 -> 22deg -> 0, never edge-on) while
 *           it scales 1 -> 1.35 on a 20f GLIDE and rises from y620 to the axis at y600. At the widest point of
 *           the swing it cross-dissolves into the closed triptych slab (sizes matched every frame) under one
 *           specular sweep and a soft bloom.
 *  lf16     two white-hot seams light up on the slab's hinge lines; the headline starts (review r1: no empty
 *           headline band after the S2 exit at lf10).
 *  lf24/27  the left (Playbook) and right (Checks) wings swing open from +-180deg; light pours out of the
 *           hinges; the camera pulls back so the open triptych lands exactly on the TRIPTYCH constants.
 *           3f is the smallest stagger at which the two wings never intersect in 3D.
 *  lf48/66/84 panel contents reveal left to right; the panel being revealed is at 100%, the others 70%.
 *  lf80     sub-caption (who uses the folder); it exits lf136-146, clear of the S4 cut.
 *  lf100    the 'match' ticket slides out of the Checks panel's bottom slot (SNAP).
 *  lf112-149 hold: slow camera settle (ends at identity), one specular sheen across the glass.
 */
export const T = {
  turnEnd: 16,
  scaleDur: 20,
  seams: 16,
  openL: 24,
  openR: 27,
  headline: 16,
  sub: 80,
  subOut: 136,
  content: [48, 66, 84] as const,
  contentDur: 18,
  allBright: 102,
  slotGlow: 94,
  ticket: 100,
  sheenFrom: 110,
  sheenTo: 146,
  end: 149,
} as const;

/** Where S2 leaves the folder (SkillFolder at (960,620), width 520, lid shut, label typed). */
export const FOLDER = {cx: 960, cy: 620, width: 520} as const;

/** Final scale of the closed slab / folder (storyboard: 1 -> 1.35). */
export const SLAB_SCALE = 1.35;

/** Panel corner radius. */
export const PANEL_R = 22;

/** Perspective for the hinge (px). */
export const PERSPECTIVE = 2000;

/** Hinge axes (canvas x): the middle of each 16px gap. */
export const HINGE_L = TRIPTYCH.panelX(1) - TRIPTYCH.gap / 2; // 732
export const HINGE_R = TRIPTYCH.panelX(2) - TRIPTYCH.gap / 2; // 1188

/**
 * Wing spring: HINGE stiffness family, but damped so the 180deg swing overshoots ~3.6deg (2%), which is the
 * storyboard's "about 3deg". The raw HINGE config overshoots 21% (38deg on a 180deg swing).
 */
export const WING_SPRING: Partial<SpringConfig> = {stiffness: 120, damping: 17, mass: 1};

export const wingOpen = (f: number, at: number, fps = 30): number => spring({frame: f - at, fps, config: WING_SPRING});

/** Left wing (Playbook) and right wing (Checks) open progress. 0 = folded over the centre, 1 = open. */
export const openL = (f: number, fps = 30) => wingOpen(f, T.openL, fps);
export const openR = (f: number, fps = 30) => wingOpen(f, T.openR, fps);

/** GLIDE 0..1 over 20f, normalised so it is exactly 1 from lf20. */
const G20_END = spring({frame: T.scaleDur, fps: 30, config: SPRING.GLIDE, durationInFrames: T.scaleDur});
export const grow = (f: number, fps = 30): number =>
  f >= T.scaleDur ? 1 : clamp01(spring({frame: f, fps, config: SPRING.GLIDE, durationInFrames: T.scaleDur}) / G20_END);

/** Turn progress 0..1 (0 = folder face-on, 1 = slab face-on; the yaw peaks at 0.5). */
export const turnP = (f: number): number =>
  interpolate(f, [0, T.turnEnd], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.45, 0.05, 0.22, 1),
  });

/** Peak yaw of the turn (deg). Shallow on purpose: the object never goes edge-on (review r1). */
export const TURN_YAW = 22;
/** Small counter-tilt (deg) that gives the turn some depth. */
export const TURN_TILT = 3;

/** Yaw of the folder / slab during the turn: 0 -> TURN_YAW -> 0. */
export const turnYaw = (f: number): number => TURN_YAW * Math.sin(Math.PI * turnP(f));
export const turnTilt = (f: number): number => TURN_TILT * Math.sin(Math.PI * turnP(f));

/** Folder -> slab cross-dissolve 0..1 around the widest point of the swing. */
export const dissolve = (f: number): number => {
  const x = clamp01((turnP(f) - 0.3) / 0.4);
  return x * x * (3 - 2 * x);
};

/** Cover layout morph (1 = matches the folder's label / emblem, 0 = the cover's own layout), after the dissolve. */
export const coverMorph = (f: number): number => {
  const x = clamp01((turnP(f) - 0.55) / 0.45);
  return 1 - x * x * (3 - 2 * x);
};

/** Width the folder and slab share during the turn (before the camera scale): 520 -> 440. */
export const SLAB_W = TRIPTYCH.panelW;
export const matchWidth = (f: number): number => FOLDER.width + (SLAB_W - FOLDER.width) * turnP(f);

/** Specular sweep across the face during the turn: band centre 0..1 across the object, and its strength. */
export const turnSheen = (f: number): {pos: number; strength: number} => {
  const u = turnP(f);
  const pos = interpolate(u, [0.12, 0.88], [-0.3, 1.3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const strength = Math.sin(Math.PI * clamp01((u - 0.08) / 0.84));
  return {pos, strength: Math.max(0, strength)};
};

/**
 * Camera pull-back 0..1 from lf22 to the end of the scene: most of it (83%) while the wings open, then a slow
 * linear drift that lands exactly at identity on the last frame (clean hand-off to S4).
 */
export const pullBack = (f: number): number => {
  const fast = interpolate(f, [22, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.4, 0, 0.2, 1)});
  const slow = interpolate(f, [22, T.end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return 0.83 * fast + 0.17 * slow;
};

/** Camera (hero) scale about (960,600): 1 -> 1.35 with the folder, then back to exactly 1 at lf149. */
export const cameraScale = (f: number, fps = 30): number => {
  const up = 1 + (SLAB_SCALE - 1) * grow(f, fps);
  return up * (1 - (1 - 1 / SLAB_SCALE) * pullBack(f));
};

/** Share of the lopsided Playbook-open moment the camera re-centres (review r1: the group sat off-centre). */
export const CAMERA_LEAN = 0.62;

/**
 * Camera x offset: while only the Playbook wing is open the object's weight sits left of centre, so the camera
 * leans a little toward it, then settles back as the Checks wing opens (0 once both are open).
 */
export const cameraX = (f: number, fps = 30): number => {
  const cL = clamp01(openL(f, fps));
  const cR = clamp01(openR(f, fps));
  return (960 - (TRIPTYCH.left + TRIPTYCH.panelX(2) - TRIPTYCH.gap) / 2) * CAMERA_LEAN * (cL - cR) * cameraScale(f, fps);
};

/** Camera y offset: the object rises from the folder's y620 to the axis at y600. */
export const cameraY = (f: number, fps = 30): number => (FOLDER.cy - 600) * (1 - grow(f, fps));

/** Interior light that pours out as the wings open (0..1). */
export const interiorLight = (f: number): number => {
  const up = interpolate(f, [T.openL, T.openL + 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const down = interpolate(f, [T.openR + 6, 96], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.EXPO_OUT});
  return up * down;
};

/** Brightness of panel k (0.7..1): the panel being revealed is at 100%, the others at 70%; from lf102 all 100%. */
export const panelBright = (f: number, k: number): number => {
  const dim =
    interpolate(f, [T.content[0] - 6, T.content[0] + 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) *
    (1 - interpolate(f, [T.allBright, T.allBright + 10], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const sw = (a: number) => interpolate(f, [a - 4, a + 2], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const focus = k === 0 ? 1 - sw(T.content[1]) : k === 1 ? sw(T.content[1]) * (1 - sw(T.content[2])) : sw(T.content[2]);
  return 1 - 0.3 * dim * (1 - focus);
};

/** Top-edge light of panel k: a pulse while its contents reveal. */
export const panelAccent = (f: number, k: number): number => {
  const a = T.content[k];
  const up = interpolate(f, [a - 2, a + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const down = interpolate(f, [a + 18, a + 40], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return up * down;
};

/**
 * Hinge seam level (0..1): lights at lf16, flares while the wings swing, then rests at
 * SEAM_REST + 0.05 * wobble('s3-seam', f, 0.03) (S4 continues that same wobble from lf149).
 */
export const SEAM_REST = 0.34;

/** Violet core glow behind the triptych at rest (S4 starts its CoreGlow at this value). */
export const CORE_GLOW_REST = 0.8;

/** Resting glow of the Checks slot after the ticket has left. */
export const SLOT_REST = 0.22;

/** Handoff for S4: the exact state on S3's last frame (lf149). */
export const S3_END = {
  cameraScale: 1,
  cameraX: 0,
  cameraY: 0,
  openL: 1,
  openR: 1,
  turn: 0,
  content: [1, 1, 1] as const,
  bright: [1, 1, 1] as const,
  /** the ticket is fully out: its visible part spans y760-812 under the Checks panel */
  ticket: 1,
  ticketDraw: 1,
  light: 0,
  accent: [0, 0, 0] as const,
  /** plus 0.05 * wobble('s3-seam', 149, 0.03) */
  hingeLevel: SEAM_REST,
  coreGlow: CORE_GLOW_REST,
  slot: SLOT_REST,
} as const;
