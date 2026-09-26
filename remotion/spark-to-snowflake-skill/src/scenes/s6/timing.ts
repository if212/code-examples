/**
 * S6 local-frame timings (storyboard S6 animationNotes), re-paced after the round-2 review so the scene reads as
 * ONE idea at a time: build the Spark baseline and say why it matters (sub-caption) BEFORE anything changes,
 * then one clean swap to the wrong row with a quiet hold, then the fix, then a long clean hold.
 *   lf0-19   push into tile 2, it flattens into the code panel
 *   lf15-26  the old line fills in fast (it is context, not news); the stack + 'right row' arrive
 *   lf28     sub-caption 'Spark and Snowflake sort NULLs differently.' (read during the Spark state)
 *   lf45     ONE change: chip rolls to 'as-is on Snowflake', NULL rises to the top, 'wrong row' (clean to lf66)
 *   lf66     'from Mappings' leaves the dock; lf70-85 ' NULLS LAST' types at 1.5f/char
 *   lf88     NULL drops back, 'right row', chip -> check 'on Snowflake', header 'missed by hand' -> 'caught'
 *   lf88-135 hold on the fixed state (~1.6s)
 * Global f750-885, 135 frames.
 */
export const T6 = {
  /** camera push into tile 2: log-space zoom 1 -> 3.4 with an ease-in head (see geometry.pushP) */
  pushTo: 22,
  /** target cue on tile 2 while the push accelerates: focus (un-dim, sharpen, highlight) and a violet focus
   *  ring. No tag here: the tile already shows a mint check, so a 'missed' tag would read as the skill's miss. */
  cueFocus: [0, 7] as const,
  cueRing: 0,
  /** ring rides the box while it still matches the tile, then bows out as it flattens */
  cueRingOut: [7, 11] as const,
  /** the rest of the board fades out (and is unmounted after `boardGone`) */
  othersFade: [4, 11] as const,
  /** the tile's box cross-dissolves into the flat code panel: box fades in, then flattens */
  morphFrom: 6,
  morphStart: 9,
  morphDur: 10,
  tileDissolve: [7, 11] as const,
  boardGone: 15,
  /** S5's stat chips ride the push camera out of frame and fade (EXIT) */
  statsOut: 8,
  /** previous headline exits lf0-10, the new one reveals at lf10 */
  headline: 10,
  /** filename header fades in as the panel lands */
  header: 13,
  /** the by-hand callback tag ('missed by hand', coral, quiet) fades in only after the panel has landed */
  handTag: 21,
  handTagDur: 10,
  /** the editor caret shows up as the panel lands, just before the line fills in */
  caretIn: 15,
  /** the label chip 'Spark SQL' above the code line */
  chip: 15,
  /** 'ORDER BY updated_at DESC' fills in fast (0.4f/char, done by lf26): it is context, not news */
  codeType: 16,
  codeFpc: 0.4,
  /** 3-pill stack springs in (SNAP), staggered */
  stack: 15,
  stackStagger: 2,
  /** mint winner ring + dot on the top pill (newest row wins) and a mint 'right row' baseline tag */
  winner: 21,
  rightTag0: 23,
  /** sub-caption, read during the Spark state so the swap PROVES what it just said */
  sub: 28,
  /** the one change: the chip rolls to 'as-is on Snowflake' (ice), the NULL pill rises to the top */
  swap: 45,
  /** coral 'wrong row' tag pops as the NULL pill arrives on top (the mint tag leaves first, no overlap) */
  wrongTag: 50,
  /** violet 'from Mappings' chip slides in from the dock; the dock's Mappings cell pulses */
  mappings: 66,
  mappingsFlight: 12,
  /** ' NULLS LAST' types at 1.5f/char in mint (lf70-85) */
  insert: 70,
  insertFpc: 1.5,
  /** NULL drops back to the bottom */
  fix: 88,
  /** the chip rolls to a mint check + 'on Snowflake' */
  asIsOut: 89,
  /** the header's 'missed by hand' tag hands over to a mint 'caught' */
  caught: 90,
  /** mint 'right row' tag pops as Sep 01 arrives back on top */
  rightTag: 93,
  /** caret goes away for a clean hold */
  caretOff: 100,
} as const;
