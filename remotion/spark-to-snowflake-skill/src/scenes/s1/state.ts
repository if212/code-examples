import {spring} from 'remotion';
import {BOARD, tileRect, tileRowCol} from '../../layout';
import {COPY, FIX_CHIPS, MISSED_CHIP_SLOT, MISSED_INDEX} from '../../demoData';
import {EASE, FONT, SPRING} from '../../theme';
import {clamp01, jitter, lerp, ramp, snap, steppedFrame} from '../../motion';
import {sceneById} from '../../timeline';
import {drift, measureWidth} from '../../components';
import type {TileChip, TileState} from '../../components';

/**
 * S1 ("by hand") state, as PURE functions of the S1 local frame.
 *
 * Exported so S2 can reproduce the S1 end state exactly (chips on tiles 0-2, 'again' stamp, missed dashed
 * slot + coral 'missed one' tag, cursor position, camera drift):
 *   const end = S1_END_FRAME;                       // 150 = first frame of S2
 *   <Camera drift={s1Camera(end)}> <Board tile={(i) => ({...s1TileState(i, end), ...yourS2State(i)})}/>
 *   const cur = s1Cursor(end);                       // {x, y, opacity, ...} in canvas px (inside the camera)
 */

export const S1_DURATION = sceneById('S1').duration; // 150
/** Local frame to sample for "how S1 ends" (S2 lf0). */
export const S1_END_FRAME = S1_DURATION;

/** From this local frame the ember layer runs on stepped 'by hand' time. */
export const STEP_FROM = 30;
export const STEP = 3;

/** Stepped time: smooth before lf30, floor(f/3)*3 afterwards. */
export const s1pf = (f: number): number => (f >= STEP_FROM ? steppedFrame(f, STEP) : f);

/**
 * A stepped SNAP spring that is already visible on the step that starts at `at` (the spring is sampled
 * one step ahead, so an event scheduled for lf36 shows on lf36, not on lf39).
 */
const stepSnap = (pf: number, at: number, lead = 1): number => (pf >= at ? snap(pf, at - lead * STEP) : 0);

/** The miss pops harder: sampled two steps ahead, so it is ~85% there on its first frame (glitch pop). */
const MISS_LEAD = 2;
/** 4f glitch shake (x px) on the miss pop, raw frame so each frame of the glitch differs. */
export const s1MissShake = (f: number): number => {
  const g = f - S1_MISSED_AT;
  return g >= 0 && g < 4 ? [-6, 5, -4, 3][g] : 0;
};

/* ------------------------------------------------------------------------------------------------
 * Script: the three tiles worked by hand. chipAt[k] = stamp frame of FIX_CHIPS[k].
 * The missed tile's MISSED_CHIP_SLOT is skipped: its dashed outline shows at chipAt[slot] instead.
 * ---------------------------------------------------------------------------------------------- */

export type S1Pass = {
  tile: number;
  /** cursor starts its hop here */
  hop: number;
  chipAt: [number, number, number];
  /** ember progress bar crawl [from, to] */
  progress: [number, number];
  /** cursor leaves this tile */
  leave: number;
  /** from this frame the tile's chips linger as 30% ghosts (storyboard: tile 0 while tile 1 is worked) */
  ghostAt?: number;
  stampAt?: number;
  missed?: boolean;
};

export const S1_PASSES: S1Pass[] = [
  {tile: 0, hop: 30, chipAt: [36, 42, 48], progress: [36, 60], leave: 60, ghostAt: 63},
  {tile: 1, hop: 60, chipAt: [66, 69, 72], progress: [66, 90], leave: 93, stampAt: 78},
  // tile 2 is rushed: the cursor leaves right after the last stamp (lf108), so the miss can flag earlier and
  // hold longer (review r1: the tag read for only ~1s before S2 dims the board)
  {tile: MISSED_INDEX, hop: 93, chipAt: [99, 102, 105], progress: [99, 108], leave: 108, missed: true},
];

/**
 * 'missed one' tag + coral glitch: one step after the cursor has moved on to the next job, so it holds
 * lf111-149 (1.3s) in S1 and then dissolves over S2's dim (~1.6s readable in total).
 */
export const S1_MISSED_AT = 111;
/**
 * The 'missed one' tag settles at 1.2x (15px Tag -> 18px) for legibility. It is carried by the tag's p (the
 * Tile, and S2's TileTagDof, both render scale(p) about 80% 50%), so S2 inherits the size from s1TileState at
 * the cut with no change on its side.
 */
export const S1_TAG_SCALE = 1.2;
/** The cursor moves on to the next job (unaware of the miss). */
export const S1_NEXT_TILE = MISSED_INDEX + 1;
export const S1_NEXT_HOP = S1_PASSES[S1_PASSES.length - 1].leave; // 108
/** Cursor fade-in (before the first hop) */
export const S1_CURSOR_IN = 20;

/* ------------------------------------------------------------------------------------------------
 * Chip-row geometry (mirrors Tile.tsx: row at left 16 / bottom 14, gap 6, Chip size 15 = 26px tall,
 * 11px side padding; the dashed variant adds a 1.5px border).
 * ---------------------------------------------------------------------------------------------- */

const CHIP_ROW = {left: 16, bottom: 14, gap: 6, size: 15, h: 26, padX: 11, dashedBorder: 1.5};
const chipTextW = (label: string): number => measureWidth(label, `600 ${CHIP_ROW.size}px ${FONT.display}`, -0.005 * CHIP_ROW.size);

export type SlotRect = {x: number; y: number; w: number; h: number; cx: number; cy: number};

/** Tile-local rects of the three chip slots on tile `tileIndex` (accounts for the dashed missed slot). */
export const chipSlots = (tileIndex: number): SlotRect[] => {
  const pass = S1_PASSES.find((p) => p.tile === tileIndex);
  const missedTile = !!pass?.missed;
  const widths = FIX_CHIPS.map((label, k) => {
    const dashed = missedTile && k === MISSED_CHIP_SLOT;
    return chipTextW(label) + CHIP_ROW.padX * 2 + (dashed ? CHIP_ROW.dashedBorder * 2 : 0);
  });
  const rowH = CHIP_ROW.h + (missedTile ? CHIP_ROW.dashedBorder * 2 : 0);
  const rowTop = BOARD.tileH - CHIP_ROW.bottom - rowH;
  let x = CHIP_ROW.left;
  return widths.map((w, k) => {
    const dashed = missedTile && k === MISSED_CHIP_SLOT;
    const h = dashed ? rowH : CHIP_ROW.h;
    const r = {x, y: rowTop, w, h, cx: x + w / 2, cy: rowTop + h / 2};
    x += w + CHIP_ROW.gap;
    return r;
  });
};

/* ------------------------------------------------------------------------------------------------
 * Tiles
 * ---------------------------------------------------------------------------------------------- */

/** Which tile the cursor is working on / hovering at local frame f (-1 = none). */
export const s1ActiveTile = (f: number): number => {
  const pf = s1pf(f);
  if (pf >= S1_NEXT_HOP + STEP) return S1_NEXT_TILE;
  for (let k = S1_PASSES.length - 1; k >= 0; k--) {
    if (pf >= S1_PASSES[k].hop + STEP) return S1_PASSES[k].tile;
  }
  return -1;
};

const chipsFor = (pass: S1Pass, pf: number): TileChip[] =>
  FIX_CHIPS.map((label, k) => {
    const at = pass.chipAt[k];
    if (pass.missed && k === MISSED_CHIP_SLOT) {
      return {label, p: pf >= at ? ramp(pf, at - STEP, at + STEP) : 0, state: 'missing' as const};
    }
    const p = stepSnap(pf, at);
    const ghost = pass.ghostAt !== undefined && pf >= pass.ghostAt;
    return {label, p, state: ghost ? ('ghost' as const) : ('solid' as const)};
  });

/**
 * Full per-tile state of the S1 board at local frame f (entry cascade, stepped work, stamp, tag, hover).
 * Board jitter is NOT included here: pass `jitterFrame={s1JitterFrame(f)}` to <Board>.
 */
export const s1TileState = (i: number, f: number, fps = 30): Partial<TileState> => {
  const pf = s1pf(f);
  const {row, col} = tileRowCol(i);
  // entry cascade: lf4 + (row+col)*2, SNAP from translateZ -200, blur 12, opacity 0 (smooth time)
  const e = spring({frame: f - 4 - (row + col) * 2, fps, config: SPRING.SNAP});
  const st: Partial<TileState> = {
    z: -200 * (1 - e),
    blur: 12 * (1 - clamp01(e)),
    opacity: clamp01(e * 1.2),
  };
  const active = s1ActiveTile(f);
  st.highlight = active === i ? 1 : 0;

  const pass = S1_PASSES.find((p) => p.tile === i);
  if (pass) {
    st.chips = chipsFor(pass, pf);
    st.progress = ramp(pf, pass.progress[0], pass.progress[1]);
    if (pass.stampAt !== undefined) {
      st.stamp = {label: COPY.s1Stamp, p: stepSnap(pf, pass.stampAt), tone: 'ember'};
    }
    if (pass.missed) {
      st.tag = {label: COPY.s1Missed, p: S1_TAG_SCALE * stepSnap(pf, S1_MISSED_AT, MISS_LEAD), tone: 'coral', shake: s1MissShake(f)};
    }
  }
  return st;
};

/** Pass as Board jitterFrame: stepped jitter only once stepped time starts (undefined = no jitter). */
export const s1JitterFrame = (f: number): number | undefined => (f >= STEP_FROM ? s1pf(f) : undefined);

/** Coral 'miss' glow progress (0..1, stepped) for the missed slot overlay. */
export const s1MissP = (f: number): number => stepSnap(s1pf(f), S1_MISSED_AT, MISS_LEAD);

/**
 * Coral bloom that flares on the tag's pop and decays (stepped) to nothing well before the cut (< 0.02 by
 * ~lf140), so S2's first frame, which has no flare, still matches S1's last one.
 */
export const s1MissFlare = (f: number): number => {
  const pf = s1pf(f);
  if (pf < S1_MISSED_AT) return 0;
  const v = Math.exp(-(pf - S1_MISSED_AT) / 7);
  return v < 0.02 ? 0 : v;
};

/* ------------------------------------------------------------------------------------------------
 * Cursor (tip in canvas px, board centred at BOARD.cx/cy; place it inside the same Camera as the board)
 * ---------------------------------------------------------------------------------------------- */

type Waypoint = {at: number; x: number; y: number; dur?: number};

const slotPoint = (tile: number, slot: number): {x: number; y: number} => {
  const r = tileRect(tile);
  const s = chipSlots(tile)[slot];
  // tip lands just inside the lower-left of the chip (so the arrow doesn't cover the label)
  return {x: r.x + s.x + s.w * 0.84, y: r.y + s.cy + 6};
};

const cursorWaypoints = (): Waypoint[] => {
  const t0 = tileRect(0);
  const wps: Waypoint[] = [
    // resting in the left margin, beside tile 0, while the board lands
    {at: -1, x: t0.x - 78, y: t0.y + BOARD.tileH * 0.62},
  ];
  for (const pass of S1_PASSES) {
    pass.chipAt.forEach((at, k) => {
      const p = slotPoint(pass.tile, k);
      // first chip of a tile: the hop from the previous tile starts at pass.hop
      wps.push({at: k === 0 ? pass.hop : pass.chipAt[k - 1], x: p.x, y: p.y, dur: k === 0 ? at - pass.hop : at - pass.chipAt[k - 1]});
    });
  }
  const nx = tileRect(S1_NEXT_TILE);
  wps.push({at: S1_NEXT_HOP, x: nx.x + 118, y: nx.y + 104, dur: 6});
  return wps;
};

export type S1CursorState = {x: number; y: number; opacity: number; press: number; scale: number};

/** Stepped cursor state at local frame f. */
export const s1Cursor = (f: number): S1CursorState => {
  const pf = s1pf(f);
  const wps = cursorWaypoints();
  let pos = {x: wps[0].x, y: wps[0].y};
  for (let k = 1; k < wps.length; k++) {
    const w = wps[k];
    const dur = w.dur ?? 6;
    if (pf < w.at) break;
    const t = EASE.EXPO_OUT(clamp01((pf - w.at) / dur));
    pos = {x: lerp(pos.x, w.x, t), y: lerp(pos.y, w.y, t)};
  }
  // press ring on every real stamp
  let press = 0;
  for (const pass of S1_PASSES) {
    pass.chipAt.forEach((at, k) => {
      if (pass.missed && k === MISSED_CHIP_SLOT) return;
      if (pf === at) press = Math.max(press, 1);
      else if (pf === at + STEP) press = Math.max(press, 0.4);
    });
  }
  const j = f >= STEP_FROM ? jitter('s1-cursor', pf, 1.5) : {x: 0, y: 0};
  const inP = clamp01((f - S1_CURSOR_IN) / 8);
  return {
    x: pos.x + j.x,
    y: pos.y + j.y,
    opacity: EASE.EXPO_OUT(inP),
    press,
    scale: 0.9 + 0.1 * EASE.EXPO_OUT(inP),
  };
};

/* ------------------------------------------------------------------------------------------------
 * Camera + headlines
 * ---------------------------------------------------------------------------------------------- */

/** S1 shot drift (smooth). S2 should start from s1Camera(S1_END_FRAME) to keep the match cut seamless. */
export const s1Camera = (f: number) => drift(f, S1_DURATION, 'S1', 0.03);

/** Headline B props so S2 can re-render it for its exit at S2 lf0-10 (enterAt -100, exitAt 0). */
export const S1_HEADLINE_A = {text: COPY.s1a, keyWord: 'Spark', keyGradient: 'ember' as const, enterAt: 8, exitAt: 84};
export const S1_HEADLINE_B = {text: COPY.s1b, keyWord: 'Same', keyGradient: 'ember' as const, enterAt: 94};
