import {BOARD, CX, CY, MINI_BOARDS, tileRect, tileRowCol} from '../../layout';
import {TEAMMATES, TRAP_INDEX} from '../../demoData';
import {folderMetrics} from '../../components';
import {lerp, reveal} from '../../motion';
import {T7, mateWaveAt} from './timing';

/**
 * S7 geometry. Every position is derived from the layout constants (MINI_BOARDS, BOARD, the hub folder).
 *
 * THE PULL-BACK. S6 ends pushed in on tile 2 (latest_customers.sql) at 3.4x, its centre on the hero centre
 * (960,600). The whole team stage (four 0.34 mini boards at their final canvas positions) sits under one
 * "world" camera anchored on tile 2 of the You board: its screen centre travels from (960,600) to its final
 * mini position while the zoom goes 10 -> 1 (board scale 3.4 -> 0.34). So the You board shrinks into place
 * and the teammate boards are revealed from the frame edges, like a real camera pulling back.
 */

export const PUSH_SCALE = 3.4;
export const MINI = MINI_BOARDS.scale;
export const HUB = MINI_BOARDS.hub;
export const HUB_W = 260;
export const HUB_M = folderMetrics(HUB_W);
export const HUB_RECT = {
  x0: HUB.cx - HUB_W / 2,
  x1: HUB.cx + HUB_W / 2,
  y0: HUB.cy - HUB_M.height / 2,
  y1: HUB.cy + HUB_M.height / 2,
} as const;

export type BoardKey = 'you' | 'leo' | 'priya' | 'sam';

/** tile 2 of the You board at its final mini position: the pull-back anchor */
export const T2 = tileRect(TRAP_INDEX, MINI_BOARDS.you.cx, MINI_BOARDS.you.cy, MINI);

export const pullP = (f: number): number => reveal(f, T7.pull, T7.pullDur);
/** on-screen scale of the You board */
export const boardScaleAt = (f: number): number => lerp(PUSH_SCALE, MINI, pullP(f));

export type Cam = {origin: [number, number]; scale: number; x: number; y: number};

export const worldCamAt = (f: number): Cam => {
  const p = pullP(f);
  const z = boardScaleAt(f) / MINI;
  const ax = lerp(CX, T2.cx, p);
  const ay = lerp(CY, T2.cy, p);
  return {origin: [T2.cx, T2.cy], scale: z, x: ax - T2.cx, y: ay - T2.cy};
};

export const toScreen = (c: Cam, x: number, y: number): {x: number; y: number} => ({
  x: c.origin[0] + c.x + c.scale * (x - c.origin[0]),
  y: c.origin[1] + c.y + c.scale * (y - c.origin[1]),
});

/* ---------------------------------------------------------------------------------------------- boards */

export const MINI_W = BOARD.width * MINI;
export const MINI_H = BOARD.height * MINI;
export const PLATE_PAD = 22;
export const PLATE_R = 22;

export type Rect = {x: number; y: number; w: number; h: number};

export const plateRect = (key: BoardKey): Rect => {
  const b = MINI_BOARDS[key];
  return {x: b.cx - MINI_W / 2 - PLATE_PAD, y: b.cy - MINI_H / 2 - PLATE_PAD, w: MINI_W + 2 * PLATE_PAD, h: MINI_H + 2 * PLATE_PAD};
};

/** true when a world rect is (partly) on screen under the camera */
export const onScreen = (c: Cam, r: Rect, margin = 60): boolean => {
  const a = toScreen(c, r.x, r.y);
  const b = toScreen(c, r.x + r.w, r.y + r.h);
  return b.x > -margin && a.x < 1920 + margin && b.y > -margin && a.y < 1080 + margin;
};

/* ------------------------------------------------------------------------------------------- teammates */

export type Mate = {
  k: number;
  key: BoardKey;
  name: string;
  color: string;
  amberTiles: number[];
  /** the plate edge facing the hub */
  side: 'left' | 'right';
  /** beam: hub port -> plate port (cubic, canvas px) */
  beam: string;
  hubPort: {x: number; y: number};
  platePort: {x: number; y: number};
  /** cursor: entry point, home (bottom-right tile, label hangs outside the board), review (the amber tile) */
  cursorFrom: {x: number; y: number};
  cursorHome: {x: number; y: number};
  cursorReview: {x: number; y: number};
  /** the frame this board's amber tile lands (SNAP ~1) */
  amberLand: number;
};

const PORT_DY = 55;
const cursorOn = (i: number, key: BoardKey) => {
  const b = MINI_BOARDS[key];
  const r = tileRect(i, b.cx, b.cy, MINI);
  return {x: r.cx + 14, y: r.cy + 12};
};

const beamPath = (a: {x: number; y: number}, b: {x: number; y: number}): string => {
  const dir = Math.sign(b.x - a.x) || 1;
  const up = b.y < a.y ? -1 : 1;
  return `M ${a.x} ${a.y} C ${a.x + dir * 46} ${a.y + up * 16} ${b.x - dir * 56} ${b.y} ${b.x} ${b.y}`;
};

const buildMate = (t: (typeof TEAMMATES)[number], k: number): Mate => {
  const key = t.board as BoardKey;
  const b = MINI_BOARDS[key];
  const pr = plateRect(key);
  const side: 'left' | 'right' = b.cx > HUB.cx ? 'left' : 'right';
  const upper = b.cy < HUB.cy;
  const hubPort = {x: side === 'left' ? HUB_RECT.x1 : HUB_RECT.x0, y: HUB.cy + (upper ? -PORT_DY : PORT_DY)};
  const platePort = {x: side === 'left' ? pr.x : pr.x + pr.w, y: b.cy};
  const amber = t.amberTiles[0];
  const {row, col} = tileRowCol(amber);
  const home = cursorOn(BOARD.count - 1, key);
  // entry from outside the frame: right-hand boards from the right edge, the lower-left board from below
  const cursorFrom = b.cx > HUB.cx ? {x: home.x + 260, y: home.y + (upper ? -190 : 190)} : {x: home.x + 40, y: home.y + 200};
  return {
    k,
    key,
    name: t.name,
    color: t.color,
    amberTiles: [...t.amberTiles],
    side,
    beam: beamPath(hubPort, platePort),
    hubPort,
    platePort,
    cursorFrom,
    cursorHome: home,
    cursorReview: cursorOn(amber, key),
    amberLand: mateWaveAt(k) + (row + col) * T7.tileDelay + T7.flipLand,
  };
};

export const MATES: Mate[] = TEAMMATES.filter((t) => t.board !== 'you').map((t, k) => buildMate(t, k));

export const YOU_MATE = TEAMMATES.find((t) => t.board === 'you') ?? TEAMMATES[0];

/** You -> hub link (the skill came from your board) */
export const YOU_LINK = (() => {
  const pr = plateRect('you');
  const a = {x: pr.x + pr.w, y: MINI_BOARDS.you.cy};
  const b = {x: HUB_RECT.x0, y: HUB.cy - PORT_DY};
  return {d: beamPath(a, b), from: a, to: b};
})();

/** the You cursor rests on its second amber tile (churn_model.py), as S5 left it */
export const YOU_CURSOR = cursorOn(YOU_MATE.amberTiles[YOU_MATE.amberTiles.length - 1], 'you');

/** chip under the folder */
export const CHIP_Y = HUB_RECT.y1 + 50;
