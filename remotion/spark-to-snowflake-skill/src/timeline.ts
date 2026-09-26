/** Global frame timeline. 1110 frames = 37.0s @30fps. */

export type SceneId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

export type SceneSpan = {id: SceneId; from: number; duration: number};

export const SCENES: SceneSpan[] = [
  {id: 'S1', from: 0, duration: 150},
  {id: 'S2', from: 150, duration: 120},
  {id: 'S3', from: 270, duration: 150},
  {id: 'S4', from: 420, duration: 150},
  {id: 'S5', from: 570, duration: 180},
  {id: 'S6', from: 750, duration: 135},
  {id: 'S7', from: 885, duration: 105},
  {id: 'S8', from: 990, duration: 120},
];

export const TOTAL = 1110;
export const FPS = 30;

export const sceneById = (id: SceneId): SceneSpan => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

/** Global frame -> scene id. */
export const sceneAt = (globalFrame: number): SceneId => {
  for (let i = SCENES.length - 1; i >= 0; i--) {
    if (globalFrame >= SCENES[i].from) return SCENES[i].id;
  }
  return 'S1';
};

/**
 * Light-wipes (drawn by Main). Each is 12 frames CENTRED on a scene boundary. They are reveals: the band's
 * core crosses the frame centre at `cut`; the outgoing scene stays ahead of the band (frozen at its last frame
 * after `cut`) and the incoming scene appears behind it (frozen at its lf0 before `cut`).
 *  - S4->S5: global 564-576, cut 570 (= S4 lf144, S5 lf0). S4 lf144-149 and S5 lf0-5 are (partly) covered.
 *  - S7->S8: global 984-996, cut 990 (= S7 lf99, S8 lf0).  S7 lf99-104 and S8 lf0-5 are (partly) covered.
 */
export const WIPE_DURATION = 12;
export const WIPES = [
  {from: 564, cut: 570, duration: WIPE_DURATION},
  {from: 984, cut: 990, duration: WIPE_DURATION},
] as const;

/**
 * DEMO PROJECT chip: fades in at global 8 (with '12 Spark jobs.', the first count on screen) at 85% so the
 * disclaimer is legible, and stays until the S7->S8 wipe carries it away.
 */
export const DEMO_CHIP = {from: 8, until: 990, opacity: 0.85} as const;

/**
 * Colour arc: ember share of the orbs (ice = 1 - ember). Storyboard anchors: 70/30 at f0, ~45/55 by the end
 * of S5, ~25/75 in S7, 20/80 at f1110. Piecewise-linear through these keyframes (smoothstep inside each segment).
 */
const ARC_F = [0, 570, 750, 990, 1110];
const ARC_V = [0.7, 0.57, 0.45, 0.25, 0.2];
export const emberShare = (globalFrame: number): number => {
  const f = Math.max(0, Math.min(TOTAL, globalFrame));
  for (let i = 0; i < ARC_F.length - 1; i++) {
    if (f <= ARC_F[i + 1]) {
      const t = (f - ARC_F[i]) / (ARC_F[i + 1] - ARC_F[i]);
      const s = t * t * (3 - 2 * t);
      return ARC_V[i] + (ARC_V[i + 1] - ARC_V[i]) * (0.5 * t + 0.5 * s);
    }
  }
  return ARC_V[ARC_V.length - 1];
};
