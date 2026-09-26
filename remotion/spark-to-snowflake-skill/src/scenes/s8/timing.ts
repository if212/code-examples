/**
 * S8 local-frame timings (storyboard S8 animationNotes). Global f990-1110, 120 frames.
 * The S7->S8 light-wipe is centred on the cut (global 984-996), so S8 lf0-5 are (partly) covered and the
 * calm end stage is revealed by lf6.
 *
 * Round-3 deviations from the storyboard (both for reading time and to remove the dead beat after the wipe):
 *  - the folder's GLIDE starts under the wipe (lf-2) so it is already ~90% visible, still rising, at lf6;
 *  - the headline builds from lf12 (was lf16), the sub from lf34 (was lf40);
 *  - the mono line is cut (S2, S3 and S7 already show the folder name and its three parts);
 *  - the (shortened) footnote fades in at lf40 (was lf60), so it is on screen for 80f = 2.7s.
 */
export const T8 = {
  /**
   * the folder rises out of the wipe and settles on the light axis at (960,340) (GLIDE). The spring starts
   * 2f before the scene, i.e. under the white-hot wipe core, so it is ~50% settled (~90% opaque) at lf6.
   */
  folderIn: -2,
  folderDur: 28,
  /** conic edge light ignites and orbits the rim (1 revolution per 90f) */
  edgeLightAt: 8,
  edgeLightDur: 20,
  /** a soft glint blooms along the axis where the folder settles */
  glintPeak: 16,
  /** 'Migration, as a skill.' word reveal */
  headline: 12,
  /** signature gradient sweeps left->right through the whole line */
  sweepFrom: 30,
  sweepTo: 60,
  /** 'Write once. Reuse on every job.' (44px, Frost) */
  sub: 34,
  /** honest footnote (shortened, 22px Slate, baseline 980) fades in right after the sub */
  footnote: 40,
  /** a gentle (IN_OUT) fade rather than the front-loaded EXPO_OUT reveal */
  footnoteFade: 12,
  /** calm hold to the last frame (no fade to black) */
  holdFrom: 66,
} as const;

/** degrees per frame of the orbiting edge light: 360 / 90f */
export const EDGE_DEG_PER_FRAME = 4;
