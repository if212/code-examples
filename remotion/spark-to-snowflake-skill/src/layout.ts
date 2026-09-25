/**
 * Fixed object constants from storyboard style.layout. All coordinates are canvas pixels (1920x1080).
 * Share these between scenes so match cuts line up exactly.
 */

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const CX = 960;
export const CY = 600; // the light axis / hero centre

/** Title-safe box (96px margin all round). */
export const SAFE = {margin: 96, x0: 96, y0: 96, x1: 1824, y1: 984} as const;

/** 12-column grid inside the safe margins: 122px columns, 24px gutters. */
export const GRID = {columns: 12, col: 122, gutter: 24, left: 96} as const;
/** Left x of column n (0-based). */
export const colX = (n: number): number => GRID.left + n * (GRID.col + GRID.gutter);
/** Width spanning `span` columns (including inner gutters). */
export const colSpan = (span: number): number => span * GRID.col + (span - 1) * GRID.gutter;

export const ZONES = {
  /** Headline band: centred at x960, cap-centre y~190 (y110-270). */
  headline: {cx: 960, capY: 190, top: 110, bottom: 270, maxWidth: 1500},
  /** Hero zone: y300-880 centred on the light axis at y=600. */
  hero: {top: 300, bottom: 880, axisY: 600},
  /** Sub / stat band: y890-950, centred. */
  sub: {top: 890, bottom: 950, cy: 920},
  /** DEMO PROJECT chip: bottom-left, x96, text baseline y980 (S1-S7). */
  demoChip: {x: 96, baseline: 980},
  /** Footnote (S8 only): centred, baseline y980. */
  footnote: {cx: 960, baseline: 980},
} as const;

/** Light axis: 1px signature-gradient line. y=600 for S1-S7, y=340 in S8 (under the end folder). */
export const LIGHT_AXIS = {y: 600, yEnd: 340} as const;

/** BOARD: 4x3 tiles, 300x170, radius 18, 28px gaps, 1284x566 centred at (960,600). */
export const BOARD = {
  cols: 4,
  rows: 3,
  count: 12,
  tileW: 300,
  tileH: 170,
  radius: 18,
  gap: 28,
  width: 4 * 300 + 3 * 28, // 1284
  height: 3 * 170 + 2 * 28, // 566
  cx: 960,
  cy: 600,
  left: 960 - (4 * 300 + 3 * 28) / 2, // 318
  top: 600 - (3 * 170 + 2 * 28) / 2, // 317
} as const;

export type Rect = {x: number; y: number; w: number; h: number; cx: number; cy: number};

/** Row / column of tile index i (row-major). */
export const tileRowCol = (i: number): {row: number; col: number} => ({row: Math.floor(i / BOARD.cols), col: i % BOARD.cols});

/**
 * Canvas rect of tile i for a board centred at (cx,cy) with the given scale (default = full board).
 * Use it to aim cursors, beams, push-ins at a tile.
 */
export const tileRect = (i: number, cx: number = BOARD.cx, cy: number = BOARD.cy, scale = 1): Rect => {
  const {row, col} = tileRowCol(i);
  const lx = col * (BOARD.tileW + BOARD.gap) - BOARD.width / 2;
  const ly = row * (BOARD.tileH + BOARD.gap) - BOARD.height / 2;
  const x = cx + lx * scale;
  const y = cy + ly * scale;
  const w = BOARD.tileW * scale;
  const h = BOARD.tileH * scale;
  return {x, y, w, h, cx: x + w / 2, cy: y + h / 2};
};

/** TRIPTYCH: 3 panels 440x320, 16px gaps (1352x320) centred at (960,600). */
export const TRIPTYCH = {
  panelW: 440,
  panelH: 320,
  gap: 16,
  width: 1352,
  height: 320,
  cx: 960,
  cy: 600,
  left: 960 - 1352 / 2, // 284
  top: 600 - 320 / 2, // 440
  /** left x of panel i */
  panelX: (i: number): number => 284 + i * (440 + 16),
} as const;

/** PROMPT PILL: x120-900, y552-648, radius 48. */
export const PROMPT_PILL = {x0: 120, x1: 900, y0: 552, y1: 648, w: 780, h: 96, radius: 48, cy: 600} as const;

/** SKILL SHELF: 4 cards 760x76, 16px gaps, x1000-1760, y420-772. */
export const SKILL_SHELF = {
  cardW: 760,
  cardH: 76,
  gap: 16,
  x0: 1000,
  x1: 1760,
  y0: 420,
  y1: 772,
  /** top y of card slot i (0-3) */
  slotY: (i: number): number => 420 + i * (76 + 16),
  /** extra height when a card grows its icon row */
  iconRowH: 60,
} as const;

/** SKILL DOCK (S5-S6): vertical glass strip 120x320 at x96-216, y440-760. */
export const SKILL_DOCK = {x0: 96, x1: 216, y0: 440, y1: 760, w: 120, h: 320, cx: 156, cy: 600} as const;

/** CODE PANEL (S6): 1280x400 centred at (960,600). Code starts at x380; pill stack at x1380-1540. */
export const CODE_PANEL = {
  w: 1280,
  h: 400,
  cx: 960,
  cy: 600,
  left: 320,
  top: 400,
  codeX: 380,
  stackX0: 1380,
  stackX1: 1540,
} as const;

/** S7 mini boards (0.34 scale) and the folder hub. */
export const MINI_BOARDS = {
  scale: 0.34,
  you: {cx: 500, cy: 440},
  leo: {cx: 1420, cy: 440},
  priya: {cx: 500, cy: 820},
  sam: {cx: 1420, cy: 820},
  hub: {cx: 960, cy: 630},
} as const;

/** S8 end stack. */
export const END_STACK = {
  folder: {cx: 960, cy: 340, size: 160},
  headlineCapY: 560,
  subY: 660,
  monoY: 730,
  footnoteBaseline: 980,
} as const;
