/**
 * S8 local-frame timings (storyboard S8 animationNotes). Global f990-1110, 120 frames.
 * The S7->S8 light-wipe is centred on the cut (global 984-996), so S8 lf0-5 are (partly) covered and the
 * calm end stage is revealed by lf6. Every other timing is kept exactly as written in the storyboard.
 */
export const T8 = {
  /** the folder rises out of the wipe and settles on the light axis at (960,340) (GLIDE) */
  folderIn: 2,
  folderDur: 26,
  /** conic edge light ignites and orbits the rim (1 revolution per 90f) */
  edgeLightAt: 8,
  edgeLightDur: 20,
  /** a soft glint blooms along the axis where the folder settles */
  glintPeak: 16,
  /** 'Migration, as a skill.' word reveal */
  headline: 16,
  /** signature gradient sweeps left->right through the whole line */
  sweepFrom: 30,
  sweepTo: 60,
  /** 'Write once. Reuse on every job.' (44px, Frost) */
  sub: 40,
  /** 'spark-to-snowflake/ · playbook · mappings · checks' (24px mono, Slate) */
  mono: 52,
  /** honest footnote fades in (20px, baseline 980; Slate at 80% for legibility, see S8.tsx) */
  footnote: 60,
  /** a gentle (IN_OUT) fade rather than the front-loaded EXPO_OUT reveal */
  footnoteFade: 18,
  /** calm hold to the last frame (no fade to black) */
  holdFrom: 66,
} as const;

/** degrees per frame of the orbiting edge light: 360 / 90f */
export const EDGE_DEG_PER_FRAME = 4;
