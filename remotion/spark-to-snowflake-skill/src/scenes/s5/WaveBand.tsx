import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, softRadial} from '../../theme';
import {BOARD, SKILL_DOCK, tileRect} from '../../layout';
import {clamp01, lerp} from '../../motion';

/**
 * The S5 violet-white light band. Its front is exactly the flip-wave front: tiles flip in (row+col) order,
 * and lines of equal row+col are perpendicular to n = (tileH+gap, tileW+gap). The band slides along n by one
 * diagonal step every `step` frames, so its core crosses each tile `lead` frames after that tile starts to
 * turn. Its length is clipped (softly) to the board's chord, and while it is being emitted its lower end is
 * pinned to the skill dock, so it visibly leaves the dock. Painted as sized, rotated soft-radial ellipses
 * (no full-screen gradient, no CSS blur).
 */

const TX = BOARD.tileW + BOARD.gap; // 328
const TY = BOARD.tileH + BOARD.gap; // 198
const NL = Math.hypot(TX, TY);
/** unit normal of the wave front (direction of travel: down-right) */
const N = {x: TY / NL, y: TX / NL};
/** unit vector along the front (up-right) */
const T = {x: TX / NL, y: -TY / NL};
export const BAND_ANGLE = (Math.atan2(T.y, T.x) * 180) / Math.PI; // ~ -31deg
/** projection distance between two neighbouring diagonals */
const DIAG_STEP = (TX * TY) / NL; // ~169.5px

const proj = (x: number, y: number) => x * N.x + y * N.y;

const R0 = tileRect(0);
const P0 = proj(R0.cx, R0.cy);
const BP = proj(BOARD.cx, BOARD.cy);
const HX = BOARD.width / 2 + 30;
const HY = BOARD.height / 2 + 30;

/** chord of the band line (offset `off` from the board centre along N) with the padded board rect, in s along T */
const chord = (off: number): {lo: number; hi: number} | null => {
  const a1 = (-HX - N.x * off) / T.x;
  const b1 = (HX - N.x * off) / T.x;
  const a2 = (HY - N.y * off) / T.y;
  const b2 = (-HY - N.y * off) / T.y;
  const lo = Math.max(Math.min(a1, b1), Math.min(a2, b2));
  const hi = Math.min(Math.max(a1, b1), Math.max(a2, b2));
  return hi > lo ? {lo, hi} : null;
};

export type WaveBandProps = {
  frame: number;
  /** local frame tile 0 starts flipping */
  waveStart: number;
  /** frames between diagonals */
  step: number;
  /** frames after a tile's flip start that the band's core crosses its centre */
  lead?: number;
  /** 0..1 overall intensity (fade in/out envelope from the caller) */
  intensity: number;
  /** 0..1: 0 = lower end pinned at the dock (being emitted), 1 = free, spanning the board */
  release: number;
};

export const WaveBand: React.FC<WaveBandProps> = ({frame, waveStart, step, lead = 2, intensity, release}) => {
  const I = clamp01(intensity);
  if (I <= 0.001) return null;
  const p = P0 + (DIAG_STEP * (frame - (waveStart + lead))) / step;
  const off = p - BP;
  const base = {x: BOARD.cx + N.x * off, y: BOARD.cy + N.y * off};
  const ch = chord(off) ?? {lo: -120, hi: 120};
  // s of the point on the band line nearest to the dock's inner edge
  const sDock = (SKILL_DOCK.x1 - base.x) * T.x + (SKILL_DOCK.cy - base.y) * T.y;
  const lo = lerp(Math.min(sDock, ch.lo), ch.lo, clamp01(release));
  const hi = Math.max(ch.hi, lo + 240);
  const mid = (lo + hi) / 2;
  const len = hi - lo;
  const cx = base.x + T.x * mid;
  const cy = base.y + T.y * mid;
  const layer = (lenK: number, thick: number, color: string, peak: number, sharp: number, key: string) => {
    const L = len * lenK;
    return (
      <div
        key={key}
        style={{
          position: 'absolute',
          left: cx - L / 2,
          top: cy - thick / 2,
          width: L,
          height: thick,
          transform: `rotate(${BAND_ANGLE.toFixed(3)}deg)`,
          transformOrigin: '50% 50%',
          background: softRadial('ellipse 50% 50% at 50% 50%', color, peak * I, 16, sharp),
          mixBlendMode: 'screen',
        }}
      />
    );
  };
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {layer(1.35, 620, C.violetGlow, 0.2, 2.2, 'haze')}
      {layer(1.2, 250, C.violet, 0.34, 2.0, 'glow')}
      {layer(1.0, 56, C.whiteHot, 0.42, 1.8, 'core')}
      {layer(0.85, 9, '#FFFFFF', 0.5, 1.6, 'filament')}
    </AbsoluteFill>
  );
};
