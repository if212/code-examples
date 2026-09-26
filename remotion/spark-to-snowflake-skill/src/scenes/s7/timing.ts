/**
 * S7 local-frame timings (storyboard S7 animationNotes). Global f885-990, 105 frames.
 * The S7->S8 light-wipe (Main) starts covering at lf99 and is fully white-hot at the cut (lf105 = S8 lf0).
 */
export const T7 = {
  /**
   * camera pull-back: board scale 3.4 -> 0.34 in log space, eased-in head (lf1 moves ~1%, lf2 ~4%), fastest
   * around lf6-8, settled by lf20. Tile 2 is the anchor.
   */
  pull: 0,
  pullDur: 20,
  /** S6's code panel content fades out as it rides the pull-back */
  panelFade: [2, 6] as const,
  /** the code panel's box morphs back into tile 2's rect, then dissolves onto the real tile */
  morph: [3, 8] as const,
  boxFade: [5, 9] as const,
  trapIn: [4, 8] as const,
  /** the rest of the You board fades back in */
  othersIn: [4, 8] as const,
  /** full tile faces -> simplified mini faces (crossfade while the board is small and moving) */
  miniSwap: [8, 12] as const,
  /** glass plate behind the You board */
  youPlate: [9, 17] as const,
  /** S6's headline, sub-caption and skill dock leave together over lf0-5 (gone before the fast part) */
  prevExit: 0,
  prevExitDur: 5,
  /** the dock also slides 40px left */
  dockExitDur: 6,
  /** motion blur ramps in over the first frames of the pull */
  blurRamp: 3,
  /** teammate boards stay hidden while the stage is still huge, then fade in as the camera settles */
  matesIn: [12, 20] as const,
  /** storyboard lf6: S6's line is fully gone at lf5, so only one headline is ever on screen */
  headline: 6,
  /** the folder rises to the hub (GLIDE) as the You board clears the centre */
  folder: 8,
  /** 'shared in your repo' chip pops under the folder (SNAP) */
  chip: 12,
  /** the You board links into the hub (it is where the skill came from) */
  youLink: 12,
  youLinkDur: 14,
  youCursor: 12,
  /** beams hub -> Leo / Priya / Sam: 16f each, 6f stagger */
  beam0: 18,
  beamDur: 16,
  beamStagger: 6,
  /** beam head reaches the plate (EXPO_OUT p ~0.97): the plate's rim lights and the board wakes */
  beamLand: 9,
  /** teammate waves: board k starts at wave0 + k*waveOffset, tile delay (row+col)*tileDelay */
  wave0: 40,
  waveOffset: 8,
  tileDelay: 3,
  /** SNAP reaches 1 about 9f after a tile starts */
  flipLand: 9,
  /** a teammate's cursor starts its hop onto the amber tile this many frames before the tile lands */
  reviewLead: 3,
  reviewDur: 12,
  /** hold */
  hold: 80,
  /** the stage recedes behind the S7->S8 light-wipe (storyboard S8 lf0-12) */
  recede: 96,
  recedeDur: 9,
} as const;

/** teammate k (0 = Leo, 1 = Priya, 2 = Sam) */
export const mateBeamAt = (k: number): number => T7.beam0 + k * T7.beamStagger;
export const mateLandAt = (k: number): number => mateBeamAt(k) + T7.beamLand;
export const mateWaveAt = (k: number): number => T7.wave0 + k * T7.waveOffset;
