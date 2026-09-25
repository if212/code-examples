import React from 'react';
import {C, alpha} from '../../theme';
import {BOARD, tileRowCol} from '../../layout';
import {MISSED_CHIP_SLOT, MISSED_INDEX} from '../../demoData';
import {clamp01, jitter} from '../../motion';
import {chipSlots} from './state';

/**
 * Coral mark over the empty dashed 'Fix' slot on the missed tile: coral dashed outline, soft wash and the
 * coral dot. Rendered as a <Board> child (board-local px). p = pop progress (spring ok).
 */
export const MissedSlotMark: React.FC<{x: number; y: number; w: number; h: number; p: number}> = ({x, y, w, h, p}) => {
  if (p <= 0.001) return null;
  const o = clamp01(p * 1.4);
  const s = 1.25 - 0.25 * Math.min(1, p) + (p > 1 ? (p - 1) * 0.25 : 0);
  const r = Math.round(26 * 0.36);
  const dot = 7;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: 30,
        transform: `scale(${s.toFixed(3)})`,
        opacity: o,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          boxSizing: 'border-box',
          borderRadius: r,
          border: `1.5px dashed ${alpha(C.coral, 0.95)}`,
          background: alpha(C.coral, 0.1),
          boxShadow: `0 0 16px ${alpha(C.coral, 0.45)}, inset 0 0 10px ${alpha(C.coral, 0.25)}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: w / 2 - dot / 2,
          top: h / 2 - dot / 2,
          width: dot,
          height: dot,
          borderRadius: '50%',
          background: C.coral,
          boxShadow: `0 0 10px ${alpha(C.coral, 0.9)}, 0 0 3px ${alpha('#FFFFFF', 0.6)}`,
        }}
      />
    </div>
  );
};

/**
 * The mark placed on the missed tile's MISSED_CHIP_SLOT, as a <Board> child. Pass the same jitterFrame you
 * give the Board (S1 stepped time) so it rides the tile's jitter; S2 can use it with p=1 and no jitter:
 *   <Board ...><MissedSlotOnBoard p={1}/></Board>
 * Extra offsets (dx/dy) let S2 follow a tile that moves.
 */
export const MissedSlotOnBoard: React.FC<{p: number; jitterFrame?: number; shake?: number; dx?: number; dy?: number}> = ({
  p,
  jitterFrame,
  shake = 0,
  dx = 0,
  dy = 0,
}) => {
  const slot = chipSlots(MISSED_INDEX)[MISSED_CHIP_SLOT];
  const {row, col} = tileRowCol(MISSED_INDEX);
  const tj = jitterFrame !== undefined ? jitter(`tile-${MISSED_INDEX}`, jitterFrame, 2) : {x: 0, y: 0};
  return (
    <MissedSlotMark
      x={col * (BOARD.tileW + BOARD.gap) + tj.x + slot.x + shake + dx}
      y={row * (BOARD.tileH + BOARD.gap) + tj.y + slot.y + dy}
      w={slot.w}
      h={slot.h}
      p={p}
    />
  );
};
