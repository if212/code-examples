import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BOARD, tileRowCol} from '../layout';
import {JOB_FILES} from '../demoData';
import {jitter} from '../motion';
import {Tile, TileState} from './Tile';

/**
 * The 4x3 job board built from BOARD constants. Identical geometry in S1, S5 (match cut), S6 (push-in
 * source) and S7 (mini boards at 0.34). Per-tile state comes from `tile(i)`, so scenes own all timing.
 *
 * Coordinates: the board is centred at (cx, cy) and scaled about its centre. Tile i sits at
 * layout.tileRect(i, cx, cy, scale) on the canvas.
 */
export type BoardProps = {
  cx?: number;
  cy?: number;
  scale?: number;
  /** per-tile state (file defaults to JOB_FILES[i]) */
  tile?: (i: number) => Partial<TileState>;
  files?: readonly string[];
  opacity?: number;
  /**
   * Stepped-time 'by hand' jitter (S1): pass the STEPPED frame (motion.steppedFrame(f)) and each tile gets a
   * seeded +/-amp px offset that changes once per step. Omit for smooth boards.
   */
  jitterFrame?: number;
  jitterAmp?: number;
  /** simplified tile faces (use for 0.34 mini boards) */
  mini?: boolean;
  /** render inside its own AbsoluteFill (default true). false = just the positioned board div. */
  fill?: boolean;
  /** extra CSS transform applied after the centring/scale (e.g. a camera drift) */
  transform?: string;
  children?: React.ReactNode;
};

export const Board: React.FC<BoardProps> = ({
  cx = BOARD.cx,
  cy = BOARD.cy,
  scale = 1,
  tile,
  files = JOB_FILES,
  opacity = 1,
  jitterFrame,
  jitterAmp = 2,
  mini,
  fill = true,
  transform,
  children,
}) => {
  const board = (
    <div
      style={{
        position: 'absolute',
        left: cx - BOARD.width / 2,
        top: cy - BOARD.height / 2,
        width: BOARD.width,
        height: BOARD.height,
        transform: `scale(${scale})${transform ? ` ${transform}` : ''}`,
        transformOrigin: '50% 50%',
        opacity,
      }}
    >
      {new Array(BOARD.count).fill(0).map((_, i) => {
        const {row, col} = tileRowCol(i);
        const st = tile ? tile(i) : {};
        const j = jitterFrame !== undefined ? jitter(`tile-${i}`, jitterFrame, jitterAmp) : {x: 0, y: 0};
        return (
          <Tile
            key={i}
            file={files[i] ?? ''}
            mini={mini}
            {...st}
            x={col * (BOARD.tileW + BOARD.gap)}
            y={row * (BOARD.tileH + BOARD.gap)}
            dx={(st.dx ?? 0) + j.x}
            dy={(st.dy ?? 0) + j.y}
          />
        );
      })}
      {children}
    </div>
  );
  if (!fill) return board;
  return <AbsoluteFill style={{pointerEvents: 'none'}}>{board}</AbsoluteFill>;
};
