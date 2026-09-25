/**
 * S6 local-frame timings (storyboard S6 animationNotes). Global f750-885, 135 frames.
 */
export const T6 = {
  /** camera push into tile 2: scale 1 -> 3.4, EXPO_OUT */
  pushTo: 18,
  /** the tile's box cross-dissolves into the flat code panel */
  morphFrom: 3,
  morphDur: 13,
  /** the rest of the board fades out (and is unmounted after `boardGone`) */
  othersFade: [1, 9] as const,
  boardGone: 12,
  /** S5's stat chips leave with the push */
  statsOut: 7,
  /** previous headline exits lf0-10, the new one reveals at lf10 */
  headline: 10,
  /** small filename header fades in as the panel lands */
  header: 10,
  /** the editor caret shows up (blinking) as the panel lands, before the line types */
  caretIn: 12,
  /** ember label chip 'Spark SQL' above the code line */
  chip: 18,
  /** 'ORDER BY updated_at DESC' types at 1f/char */
  codeType: 18,
  /** 3-pill stack springs in (SNAP), staggered */
  stack: 30,
  stackStagger: 3,
  /** mint dot on the top pill (newest row wins) */
  winner: 38,
  /** label chip -> 'as-is on Snowflake', NULL jumps to the top */
  swap: 50,
  /** coral 'wrong row' tag */
  wrongTag: 55,
  /** sub-caption */
  sub: 52,
  /** violet 'from Mappings' chip slides in from the dock; the dock's Mappings cell pulses */
  mappings: 72,
  mappingsFlight: 18,
  /** ' NULLS LAST' types at 2f/char in mint */
  insert: 76,
  /** NULL drops back to the bottom */
  fix: 100,
  /** 'as-is' gets struck through on both labels (it is no longer as-is) */
  strike: 100,
  /** mint 'right row' tag */
  rightTag: 104,
  /** caret goes away for a clean hold */
  caretOff: 112,
} as const;
