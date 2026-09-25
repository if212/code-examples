/**
 * S7 local-frame timings (storyboard S7 animationNotes). Global f885-990, 105 frames.
 * The S7->S8 light-wipe (Main) starts covering at lf99 and is fully white-hot at the cut (lf105 = S8 lf0).
 */
export const T7 = {
  /** camera pull-back: board scale 3.4 -> 0.34 (EXPO_OUT), tile 2 is the anchor */
  pull: 0,
  pullDur: 18,
  /** S6's code panel content fades out as it rides the pull-back */
  panelFade: [0, 5] as const,
  /** the code panel's box morphs back into tile 2's rect, then dissolves onto the real tile */
  morph: [1, 7] as const,
  boxFade: [4, 9] as const,
  trapIn: [2, 6] as const,
  /** the rest of the You board fades back in */
  othersIn: [1, 5] as const,
  /** full tile faces -> simplified mini faces (crossfade while the board is small and moving) */
  miniSwap: [5, 9] as const,
  /** glass plate behind the You board */
  youPlate: [6, 15] as const,
  /** S6's skill dock, headline and sub-caption exit over lf0-10 */
  prevExit: 0,
  /** R8: one headline at a time -> the new one enters once S6's has finished its 10f exit */
  headline: 10,
  /** the folder rises to the hub (GLIDE) */
  folder: 4,
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
