import React from 'react';
import {C, FONT, TYPE, softRadial} from '../../theme';
import {BOARD, tileRowCol} from '../../layout';
import {COPY, MISSED_INDEX} from '../../demoData';
import {jitter} from '../../motion';
import {measureWidth} from '../../components';
import {S1_TAG_SCALE} from './state';

/**
 * S1-only coral bloom over the 'missed one' tag as it glitches on (a Board child, board-local px).
 * It mirrors the Tile's tag placement (right 14, top -15, Tag size 15, scale about 80% 50%) so it sits on the
 * tag at its settled 1.2x size, rides the tile's stepped jitter + glitch shake, and is screen-blended in a
 * box sized to the tag (no full-frame paint). `p` = s1MissFlare(f): 1 on the pop, decaying to 0 before the cut.
 */
const TAG_SIZE = 15;

const tagBox = (): {cx: number; cy: number; w: number; h: number} => {
  const {row, col} = tileRowCol(MISSED_INDEX);
  const label = COPY.s1Missed.toUpperCase();
  const textW = measureWidth(label, `600 ${TAG_SIZE}px ${FONT.display}`, parseFloat(TYPE.pillTracking) * TAG_SIZE);
  const w =
    Math.round(TAG_SIZE * 0.62) + Math.round(TAG_SIZE * 0.5) + Math.round(TAG_SIZE * 0.5) + textW + Math.round(TAG_SIZE * 0.78);
  const h = Math.round(TAG_SIZE * 1.85);
  const right = col * (BOARD.tileW + BOARD.gap) + BOARD.tileW - 14;
  const origin = right - 0.2 * w; // transformOrigin 80%
  return {
    cx: origin - 0.3 * w * S1_TAG_SCALE,
    cy: row * (BOARD.tileH + BOARD.gap) - 15 + h / 2,
    w: w * S1_TAG_SCALE,
    h: h * S1_TAG_SCALE,
  };
};

export const MissFlare: React.FC<{p: number; jitterFrame?: number; shake?: number}> = ({p, jitterFrame, shake = 0}) => {
  if (p <= 0.001) return null;
  const b = tagBox();
  const tj = jitterFrame !== undefined ? jitter(`tile-${MISSED_INDEX}`, jitterFrame, 2) : {x: 0, y: 0};
  const cx = b.cx + tj.x + shake;
  const cy = b.cy + tj.y;
  const rx = b.w * 0.95;
  const ry = b.h * 1.9;
  return (
    <>
      {/* wide coral bloom */}
      <div
        style={{
          position: 'absolute',
          left: cx - rx,
          top: cy - ry,
          width: rx * 2,
          height: ry * 2,
          zIndex: 25,
          opacity: p,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.coral, 0.55, 14, 2.4),
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* thin white-hot streak along the tag on the first steps (the glitch 'spark') */}
      <div
        style={{
          position: 'absolute',
          left: cx - b.w * 0.8,
          top: cy - 6,
          width: b.w * 1.6,
          height: 12,
          zIndex: 26,
          opacity: p * p,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.5, 12, 2.6),
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    </>
  );
};
