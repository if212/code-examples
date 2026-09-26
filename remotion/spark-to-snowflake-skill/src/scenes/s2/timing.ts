import {Easing, interpolate, random, spring} from 'remotion';
import type {SpringConfig} from 'remotion';
import {noise2D} from '@remotion/noise';
import {BOARD, tileRowCol} from '../../layout';
import {FIX_CHIPS, MISSED_CHIP_SLOT, MISSED_INDEX, SKILL_FOLDER_LABEL} from '../../demoData';
import {EASE, TONES} from '../../theme';
import {bell, bezierPoint, clamp01, glide, jitter, lerp, ramp, reveal} from '../../motion';
import {folderMetrics} from '../../components/SkillFolder';
import {S1_END_FRAME, S1_PASSES, chipSlots, s1Camera, s1pf} from '../s1/state';

/**
 * S2 - THE IDEA (global f150-270, 120f). Everything here is a pure function of the S2 LOCAL frame.
 *
 * Choreography (local frames):
 *  lf0-15    the S1 end-state board dims (opacity 1 -> 0.35, scale 1 -> 0.96, 8px leaf blur), its stepped
 *            jitter settles to zero (smooth time from here on) and the 'you' cursor fades out.
 *  lf0       the 8 chip notes (3 + 3 + 2) leave the tiles' chip rows and stay bright over the dimming board.
 *  lf4-24    the glass folder springs up (GLIDE) from y+220 to (960,620); its lid opens (lf10) to receive.
 *  lf6-60    the notes peel off (rotateX -25deg, translateZ +80) one after another and fly along seeded
 *            cubic Bezier paths (arc-length parametrised) with velocity-driven directional blur and short
 *            light trails; each turns ember -> violet as it nears the rim and drops in behind the lid with a
 *            small violet flash. The dashed empty slot stays behind on tile 2.
 *  lf10      headline 'Write the know-how once.'
 *  lf72-78   the lid winds up a few degrees; lf78 it snaps shut (HINGE stiffness, damped to ~3deg overshoot)
 *            and makes contact at lf84.
 *  lf84      2f white-hot flash, seam streak, gradient shockwave ring r80 -> 560 over 20f; the board fades out.
 *  lf84-102  the tab types 'spark-to-snowflake/' at 1f/char (caret blinks, off by lf118).
 *  lf96-119  the folder breathes (noise2D, +-4px) and settles exactly at (960,620) for S3's lf0.
 */

export const T = {
  dimDur: 15,
  markRecede: 30, // the coral missed-slot mark racks into the background after tile 2's chips have gone
  markRecedeDur: 30,
  cursorOutDur: 12,
  headline: 10,
  folderRise: 4,
  folderFadeDur: 14,
  lidOpen: 10,
  notesFrom: 6,
  noteSpan: 30, // last note starts at notesFrom + noteSpan
  flightMin: 24,
  flightMax: 34,
  windUp: 72,
  lidSnap: 78, // spring start; contact at lf84
  snap: 84,
  typeFrom: 84,
  boardOut: 84,
  boardOutDur: 30,
  shockDur: 20,
  breatheFrom: 96,
  end: 120,
} as const;

/** Where the folder settles (S3 picks it up here: SkillFolder cx 960, cy 620, width 520). */
export const FOLDER = {cx: 960, cy: 620, width: 520, rise: 220} as const;

/** Lid spring: HINGE stiffness, damping raised so the 62deg swing overshoots ~3.3deg (5%), per storyboard. */
export const LID_SPRING: Partial<SpringConfig> = {stiffness: 260, damping: 22};

/* ------------------------------------------------------------------------------------------------
 * Board (S1 end state, dimmed)
 * ---------------------------------------------------------------------------------------------- */

export const dimP = (f: number): number => reveal(f, 0, T.dimDur);
export const outP = (f: number): number =>
  interpolate(f, [T.boardOut, T.boardOut + T.boardOutDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
export const boardScale = (f: number): number => 1 - 0.04 * dimP(f) - 0.04 * outP(f);
export const boardOpacity = (f: number): number => (1 - 0.65 * dimP(f)) * (1 - outP(f));
export const tileBlur = (f: number): number => 8 * dimP(f);
/**
 * Depth of field for the pieces the Tile draws outside its faces (see ./BoardDof.tsx):
 *  - the ember progress bars take the tiles' own 8px leaf blur (the board opacity dims them to 0.35 with it);
 *  - the coral 'missed one' tag blurs with the tiles and fades out over the dim (lf0-15): the storyboard keeps
 *    only the dashed empty slot behind on tile 2;
 *  - the coral missed-slot mark (the dashed slot's callback, 'stays behind on tile 2') keeps the board's 0.35 and
 *    only softens slightly (1.2px) while tile 2's chips peel off around it (lf15, lf27), so the empty slot
 *    between them still reads; then it racks back into the background plane (lf30-60): blur -> 3px and
 *    opacity x1 -> x0.55, so it never floats sharp over the folder.
 */
const markRecede = (f: number): number => reveal(f, T.markRecede, T.markRecedeDur, EASE.IN_OUT);
/** the tag blurs with the tiles (EXPO_OUT) but dissolves on a gentler IN_OUT curve, so it recedes rather than blinks */
export const tagOpacity = (f: number): number => 1 - reveal(f, 0, T.dimDur, EASE.IN_OUT);
export const missMarkBlur = (f: number): number => 1.2 * dimP(f) + 1.8 * markRecede(f);
export const missMarkOpacity = (f: number): number => 1 - 0.45 * markRecede(f);
/** The S1 stepped jitter, frozen on the S1 end step and relaxing to zero (smooth time). */
export const jitterAmp = (f: number): number => 2 * (1 - dimP(f));
/** S1's last frame: the board, cursor and chips start from exactly what S1 showed on it. */
export const S1_LAST = S1_END_FRAME - 1;
export const JITTER_FRAME = s1pf(S1_LAST);
/** Board camera: the S1 shot drift simply continues one frame on (seamless across the cut). */
export const boardCam = (f: number) => s1Camera(S1_END_FRAME + f);

/** Board-local px (0..1284 x 0..566) -> canvas px, through the board scale and the board camera. */
export const boardToCanvas = (bx: number, by: number, f: number): {x: number; y: number} => {
  const bs = boardScale(f);
  const px = BOARD.cx + (bx - BOARD.width / 2) * bs;
  const py = BOARD.cy + (by - BOARD.height / 2) * bs;
  const cam = boardCam(f);
  const r = (cam.rotate * Math.PI) / 180;
  const dx = (px - 960) * cam.scale;
  const dy = (py - 600) * cam.scale;
  return {x: 960 + cam.x + dx * Math.cos(r) - dy * Math.sin(r), y: 600 + cam.y + dx * Math.sin(r) + dy * Math.cos(r)};
};

/** Tile jitter (board-local px) at local frame f. */
export const tileJitter = (i: number, f: number) => jitter(`tile-${i}`, JITTER_FRAME, jitterAmp(f));

/* ------------------------------------------------------------------------------------------------
 * Folder
 * ---------------------------------------------------------------------------------------------- */

export const folderRise = (f: number, fps = 30): number => glide(f, T.folderRise, fps);
export const folderOpacity = (f: number): number => reveal(f, T.folderRise, T.folderFadeDur);
export const breathe = (f: number): number => 4 * noise2D('s2-breathe', f * 0.06, 0) * bell(ramp(f, T.breatheFrom, T.end));
export const folderCy = (f: number, fps = 30): number => FOLDER.cy + FOLDER.rise * (1 - folderRise(f, fps)) + breathe(f);

/** Lid open amount: opens (GLIDE) to receive the notes, winds up, then snaps shut (contact at lf84). */
export const lidOpen = (f: number, fps = 30): number => {
  const openP = glide(f, T.lidOpen, fps);
  const wind = 1 + 0.1 * interpolate(f, [T.windUp, T.lidSnap], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.EXPO_OUT});
  const shut = spring({frame: f - T.lidSnap, fps, config: LID_SPRING});
  return openP * wind * (1 - shut);
};

/** 2f white-hot flash at contact. */
export const flashP = (f: number): number =>
  interpolate(f, [T.snap - 1, T.snap, T.snap + 1, T.snap + 6], [0, 1, 0.9, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/** Shockwave ring: r 80 -> 560 (EXPO_OUT) and opacity 1 -> 0 over 20f. */
export const shock = (f: number): {r: number; opacity: number} => {
  const p = reveal(f, T.snap, T.shockDur);
  return {r: 80 + 480 * p, opacity: f >= T.snap ? 1 - ramp(f, T.snap, T.snap + T.shockDur) : 0};
};

/** Small impact swell at contact (scale), 0 outside lf83-95. */
export const impact = (f: number): number => 0.018 * bell(ramp(f, T.snap - 1, T.snap + 11));

export const LABEL_LEN = SKILL_FOLDER_LABEL.length;
export const labelDoneAt = T.typeFrom + LABEL_LEN - 1;

/**
 * Canvas geometry of the lid's top edge for a 520 folder centred at cy with the lid open by `open`
 * (mirrors SkillFolder: lid hinged at its bottom edge, perspective width*2.6, rotateX(-62deg * open)).
 */
export const lidTop = (cy: number, open: number): {y: number; halfW: number} => {
  const m = folderMetrics(FOLDER.width);
  const h = m.height - m.frontTop;
  const d = Math.round(FOLDER.width * 2.6);
  const a = (-62 * open * Math.PI) / 180;
  const yp = -h * Math.cos(a);
  const zp = -h * Math.sin(a);
  const k = d / (d - zp);
  return {y: cy - m.height / 2 + m.height + yp * k, halfW: (FOLDER.width / 2) * k};
};

/** Lid top edge once the folder has settled with the lid fully open (where the notes drop in). */
export const LID_REST = lidTop(FOLDER.cy, 1);
/** Closed lid seam (canvas y) - where the snap streak fires. */
export const SEAM_Y = lidTop(FOLDER.cy, 0).y;

/* ------------------------------------------------------------------------------------------------
 * Chip notes
 * ---------------------------------------------------------------------------------------------- */

/** Base size of a flying note (Chip at 22px); on the tile it is the 15px chip, so it starts at 15/22. */
export const NOTE_SIZE = 22;
export const TILE_CHIP_SIZE = 15;

type NoteSrc = {tile: number; slot: number; label: string; ghost: boolean};

/** All chips that exist on the board at the end of S1 (tile 0 ghosts, tile 1 solid, tile 2 minus the missed slot). */
const SOURCES: NoteSrc[] = S1_PASSES.flatMap((pass) =>
  FIX_CHIPS.map((label, slot) => ({tile: pass.tile, slot, label, ghost: pass.ghostAt !== undefined, missed: !!pass.missed && slot === MISSED_CHIP_SLOT}))
    .filter((c) => !c.missed)
    .map(({tile, slot, label, ghost}) => ({tile, slot, label, ghost})),
);

/** Peel order: interleaved across the three tiles so several streams swirl at once. */
const ORDER: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [MISSED_INDEX, 0],
  [0, 1],
  [1, 1],
  [MISSED_INDEX, 2],
  [0, 2],
  [1, 2],
];
/** Landing x offsets across the mouth (px from centre), spread so neighbours differ. */
const LAND_X = [-120, 20, 130, -40, -150, 60, 150, -90];

export type NoteDef = NoteSrc & {k: number; start: number; landX: number; side: number; seed: string};

export const NOTES: NoteDef[] = ORDER.map(([tile, slot], k) => {
  const src = SOURCES.find((s) => s.tile === tile && s.slot === slot);
  if (!src) throw new Error(`S2: no chip for tile ${tile} slot ${slot}`);
  const {col} = tileRowCol(tile);
  // left tiles swirl out to the right and curl back in, right tiles the opposite, the middle alternates
  const side = col === 0 ? 1 : col >= 2 ? -1 : k % 2 === 0 ? 1 : -1;
  return {
    ...src,
    k,
    start: T.notesFrom + Math.round((k * T.noteSpan) / (ORDER.length - 1)),
    landX: LAND_X[k],
    side,
    seed: `s2-note-${k}`,
  };
});

/** Chip centre (canvas px) while it still sits on its tile. */
export const chipOnBoard = (n: NoteDef, f: number): {x: number; y: number} => {
  const {row, col} = tileRowCol(n.tile);
  const slots = chipSlots(n.tile);
  const slot = slots[n.slot];
  // the Tile's chip row is bottom-aligned: on the missed tile the dashed slot makes the row 3px taller and the
  // solid chips sit at its bottom (measured against S1's last frame), so centre the note on the chip, not the row top
  const rowH = Math.max(...slots.map((s) => s.h));
  const cy = slot.y + rowH - slot.h / 2;
  const j = tileJitter(n.tile, f);
  return boardToCanvas(col * (BOARD.tileW + BOARD.gap) + j.x + slot.cx, row * (BOARD.tileH + BOARD.gap) + j.y + cy, f);
};

/** Chip scale on the tile (relative to a NOTE_SIZE note). */
export const chipScaleOnBoard = (f: number): number => boardCam(f).scale * boardScale(f) * (TILE_CHIP_SIZE / NOTE_SIZE);

type Pt = {x: number; y: number};
export type Path = {p: [Pt, Pt, Pt, Pt]; lut: number[]; len: number; flight: number};

const LUT_N = 72;

/** The seeded cubic Bezier flight path of note n (fixed once the note peels). */
export const notePath = (n: NoteDef): Path => {
  const p0 = chipOnBoard(n, n.start);
  const r = (s: string) => random(`${n.seed}-${s}`);
  const p1 = {x: p0.x + (r('p1x') - 0.5) * 120, y: p0.y - (170 + 50 * r('p1y'))};
  const p2 = {x: FOLDER.cx + n.side * (120 + 110 * r('p2x')), y: 300 + 50 * r('p2y')};
  const p3 = {x: FOLDER.cx + n.landX, y: LID_REST.y + 58};
  const lut: number[] = [0];
  let prev = p0;
  let len = 0;
  for (let i = 1; i <= LUT_N; i++) {
    const q = bezierPoint(i / LUT_N, [p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]);
    len += Math.hypot(q.x - prev.x, q.y - prev.y);
    lut.push(len);
    prev = q;
  }
  // longer swirls get a little more time, so every note reads at about the same speed
  const flight = Math.round(Math.max(T.flightMin, Math.min(T.flightMax, 18 + len / 60)));
  return {p: [p0, p1, p2, p3], lut, len, flight};
};

/** Point at arc-length fraction s (0..1) of a path. */
export const pointAt = (path: Path, s: number): Pt => {
  const target = clamp01(s) * path.len;
  let i = 1;
  while (i < LUT_N && path.lut[i] < target) i++;
  const a = path.lut[i - 1];
  const b = path.lut[i];
  const t = (i - 1 + (b > a ? (target - a) / (b - a) : 0)) / LUT_N;
  const [p0, p1, p2, p3] = path.p;
  return bezierPoint(t, [p0.x, p0.y], [p1.x, p1.y], [p2.x, p2.y], [p3.x, p3.y]);
};

/** Flight timing: slow peel, fast swoop, still moving as it drops behind the lid. */
export const EASE_FLIGHT = Easing.bezier(0.45, 0.02, 0.3, 1);
export const flightU = (n: NoteDef, path: Path, f: number): number => clamp01((f - n.start) / path.flight);
export const flightS = (n: NoteDef, path: Path, f: number): number => EASE_FLIGHT(flightU(n, path, f));

/** Note centre at frame f (on the tile before it peels, on its path after). */
export const notePos = (n: NoteDef, path: Path, f: number): Pt => (f < n.start ? chipOnBoard(n, f) : pointAt(path, flightS(n, path, f)));

/** Distance from a point to the open lid's top edge (the rim the notes cross). */
export const distToRim = (p: Pt): number => Math.hypot(Math.max(0, Math.abs(p.x - FOLDER.cx) - LID_REST.halfW), p.y - LID_REST.y);

/** Ember -> violet mix by distance to the rim (1 = fully violet). */
export const violetMix = (p: Pt): number => {
  const d = distToRim(p);
  const t = clamp01((220 - d) / 190);
  return t * t * (3 - 2 * t);
};

/** First frame at which note n's centre drops below the rim (the violet flash + folder glow pulse). */
export const crossFrame = (n: NoteDef, path: Path): number => {
  for (let f = n.start; f <= n.start + path.flight; f++) {
    if (pointAt(path, flightS(n, path, f)).y >= LID_REST.y) return f;
  }
  return n.start + path.flight;
};

/* ------------------------------------------------------------------------------------------------
 * Colour helpers (tokens only)
 * ---------------------------------------------------------------------------------------------- */

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

/** Mix two theme hex colours (t = 0 -> a, 1 -> b); returns a hex string so theme alpha() still works. */
export const mixHex = (a: string, b: string, t: number): string => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = x.map((v, i) => Math.round(lerp(v, y[i], clamp01(t))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

export const NOTE_FROM = {main: TONES.ember.main, text: TONES.ember.text} as const;
export const NOTE_TO = {main: TONES.violet.main, text: TONES.violet.text} as const;
