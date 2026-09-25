import {Easing, interpolate} from 'remotion';
import {MATCHED_SHELF_INDEX, PROMPT_TEXT, STATUS_LINE} from '../../demoData';
import {PROMPT_PILL, SKILL_SHELF, TRIPTYCH} from '../../layout';
import {TYPE} from '../../theme';
import {bezierPoint, clamp01, lerp} from '../../motion';

/**
 * S4 timing + geometry (LOCAL frames 0..149, global 420-570). Pure functions of the frame only.
 *
 *  lf0-6     the S3 triptych snaps shut (HINGE; the wing lands on the centre panel, no pass-through),
 *            the 'match' ticket slides back into its slot, the S3 headline exits (lf0-10).
 *  lf6-24    the closed slab shrinks to a 760x76 card and arcs right into shelf slot 3 (directional blur);
 *            the other three shelf cards glide in at 55%.
 *  lf10      'Just ask.' (160px).
 *  lf12-20   the prompt pill glides in; lf20-72 it types the request at 2f/char, caret blinking.
 *  lf80      Enter: the pill presses, a light ring pulses out (20f, 0.6 -> 0).
 *  lf80-90   'Migrate' and 'Snowflake' glow ice. lf81/83 two violet beams leave those words and merge
 *            into the matching card (evolvePath, 18f).
 *  lf86-100  the card lifts (scale 1.06, violet rim), 'matched' pops (SNAP), the others dim to 30% + 2px blur.
 *  lf88-102  a light sweep crosses the card; the same two words light up in its description.
 *  lf100-116 the card grows its icon row; only Playbook lights (lf108).
 *  lf100-131 the status line types under the pill (1f/char).
 *  lf108     sub-caption. lf132-150 hold (the S4->S5 light-wipe starts at lf144).
 */
export const T4 = {
  closeR: 0,
  closeL: 1,
  ticketDur: 3,
  seamOff: 6,
  flyFrom: 6,
  flyTo: 24,
  /** shelf cards 0, 1, 3 glide in */
  shelfIn: [6, 9, 12] as const,
  headlineOut: 0,
  headline: 10,
  pillIn: 12,
  type: 20,
  enter: 80,
  glowDur: 10,
  ringDur: 20,
  beams: [81, 83] as const,
  beamDur: 18,
  lift: 86,
  matched: 91,
  dim: 86,
  dimDur: 14,
  sweep: 88,
  sweepDur: 14,
  icons: 100,
  iconsDur: 16,
  playbook: 108,
  playbookDur: 8,
  status: 100,
  sub: 108,
  beamFadeFrom: 106,
  beamFadeTo: 126,
} as const;

/* ------------------------------------------------------------------------------------------------
 * Geometry
 * ---------------------------------------------------------------------------------------------- */

/** The closed slab = the centre panel's rect (the Playbook wing lies on top of it). */
export const SLAB = {x: TRIPTYCH.panelX(1), y: TRIPTYCH.top, w: TRIPTYCH.panelW, h: TRIPTYCH.panelH} as const;

/** The matched card's slot (shelf slot 3 = index 2). */
export const CARD = {
  x: SKILL_SHELF.x0,
  y: SKILL_SHELF.slotY(MATCHED_SHELF_INDEX),
  w: SKILL_SHELF.cardW,
  h: SKILL_SHELF.cardH,
} as const;
/** SkillCard lift scales about (50%, 38px). */
export const CARD_PIVOT = {x: CARD.x + CARD.w / 2, y: CARD.y + 38} as const;
export const LIFT_SCALE = 0.06;

/** Cards below the matched one slide down by this much when it grows its icon row. */
export const SHELF_PUSH = SKILL_SHELF.iconRowH + 12;

/* Prompt pill text metrics (JetBrains Mono advance = 0.6em). */
export const PROMPT_FONT = TYPE.prompt; // 40
export const MONO_ADVANCE = 0.6;
export const PILL_PAD_L = 40;
export const GLYPH_GAP = 18;
/** canvas x of the first typed character */
export const PROMPT_TEXT_X = PROMPT_PILL.x0 + PILL_PAD_L + PROMPT_FONT * MONO_ADVANCE + GLYPH_GAP;

/** Canvas x-centre of each word of the prompt (for the beams). */
export const promptWordCentres = (): {word: string; cx: number}[] => {
  const out: {word: string; cx: number}[] = [];
  let i = 0;
  for (const word of PROMPT_TEXT.split(' ')) {
    out.push({word, cx: PROMPT_TEXT_X + (i + word.length / 2) * PROMPT_FONT * MONO_ADVANCE});
    i += word.length + 1;
  }
  return out;
};

/** Status line position (under the pill, aligned with the prompt text). */
export const STATUS = {x: PROMPT_TEXT_X, cy: PROMPT_PILL.y1 + 50, size: TYPE.status, text: STATUS_LINE} as const;

/* ------------------------------------------------------------------------------------------------
 * Slab -> card flight
 * ---------------------------------------------------------------------------------------------- */

/** ease-in-out with a quick lift-off and a long soft landing */
const FLIGHT = Easing.bezier(0.55, 0, 0.12, 1);

export type Box = {x: number; y: number; w: number; h: number; r: number; cx: number; cy: number; t: number};

export const flightT = (frame: number): number =>
  interpolate(frame, [T4.flyFrom, T4.flyTo], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: FLIGHT});

/** Rect of the morphing slab/card at `frame` (canvas px). */
export const boxAt = (frame: number, panelR: number): Box => {
  const t = flightT(frame);
  const c0: [number, number] = [SLAB.x + SLAB.w / 2, SLAB.y + SLAB.h / 2];
  const c3: [number, number] = [CARD.x + CARD.w / 2, CARD.y + CARD.h / 2];
  const c = bezierPoint(t, c0, [c0[0] + 150, c0[1] - 120], [c3[0] - 190, c3[1] - 90], c3);
  // height collapses first, width stretches out late
  const th = 1 - Math.pow(1 - t, 2.2);
  const tw = Math.pow(t, 1.25);
  const w = lerp(SLAB.w, CARD.w, tw);
  const h = lerp(SLAB.h, CARD.h, th);
  return {x: c.x - w / 2, y: c.y - h / 2, w, h, r: lerp(panelR, 18, clamp01(t)), cx: c.x, cy: c.y, t};
};
