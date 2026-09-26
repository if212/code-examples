import {COPY} from '../../demoData';

/**
 * S6-only strings. The storyboard copy comes from demoData COPY; the two header-tag strings below were added in
 * the round-2 review so S1's callback reads as the BY-HAND miss that the skill catches (S1 keeps 'missed one').
 * (Candidates to move into demoData COPY when the shared data is next edited.)
 */
export const S6_COPY = {
  /** label chip, state 1 (storyboard: 'Label chip: Spark SQL -> as-is on Snowflake') */
  spark: COPY.s6LabelBefore,
  /** label chip, state 2 */
  asIs: COPY.s6LabelAfter,
  /** label chip, state 3 (fixed): 'as-is on Snowflake' without 'as-is' */
  fixed: COPY.s6LabelAfter.split(' ').slice(1).join(' '),
  /** header callback to S1 */
  missedByHand: 'missed by hand',
  caught: 'caught',
} as const;
