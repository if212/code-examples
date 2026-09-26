import React from 'react';
import {BOARD, tileRowCol} from '../../layout';
import {C, alpha} from '../../theme';
import {clamp01} from '../../motion';
import {Pill} from '../../components';
import type {TileState} from '../../components';
import {MissedSlotOnBoard} from '../s1/MissedSlotMark';

/**
 * S2 depth-of-field for the pieces the shared Tile draws OUTSIDE its (blurred) faces: the ember progress bar
 * under each worked tile, the coral 'missed one' tag on the tile's top edge, and S1's coral missed-slot mark.
 * The Tile renders the bar and tag on its outer (unfiltered) frame, so as the S2 board dims into the background
 * they stayed razor-sharp over 8px-blurred tiles. S2 turns them off on the Tile (progress 0, no tag) and draws
 * these pixel-identical copies as <Board> children instead, each with its own LEAF blur + opacity (no 3D
 * flipper is involved, so a filter is safe here). At lf0 (blur 0, opacity 1) they match S1's last frame exactly.
 * All coordinates are board-local px (0..1284 x 0..566); the board's own opacity/scale/camera still apply.
 */

const W = BOARD.tileW;
const H = BOARD.tileH;

/** A box that sits exactly on tile i's outer frame (its position + the jitter translate the Board gives it). */
const TileFrame: React.FC<{i: number; dx: number; dy: number; z: number; children: React.ReactNode}> = ({i, dx, dy, z, children}) => {
  const {row, col} = tileRowCol(i);
  return (
    <div
      style={{
        position: 'absolute',
        left: col * (W + BOARD.gap),
        top: row * (H + BOARD.gap),
        width: W,
        height: H,
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
        // above the tiles (zIndex 1..10), like the Tile's own tag / bar which sit over the faces
        zIndex: z,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
};

const blurFilter = (px: number): string | undefined => (px > 0.05 ? `blur(${px.toFixed(2)}px)` : undefined);

/** The Tile's ember progress bar (same geometry and paint as Tile.tsx), with a leaf blur. */
export const TileProgressDof: React.FC<{i: number; dx: number; dy: number; progress: number; blur: number; opacity: number}> = ({
  i,
  dx,
  dy,
  progress,
  blur,
  opacity,
}) => {
  if (progress <= 0.001 || opacity <= 0.002) return null;
  return (
    <TileFrame i={i} dx={dx} dy={dy} z={20}>
      <div
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: H + 9,
          height: 3,
          borderRadius: 2,
          background: alpha(C.frost, 0.07),
          opacity,
          filter: blurFilter(blur),
        }}
      >
        <div
          style={{
            width: `${(clamp01(progress) * 100).toFixed(2)}%`,
            height: 3,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${C.emberDeep}, ${C.ember} 60%, ${C.emberGlow})`,
            boxShadow: `0 0 10px ${alpha(C.ember, 0.7)}`,
          }}
        />
      </div>
    </TileFrame>
  );
};

/** The Tile's top-edge tag ('missed one'), same placement as Tile.tsx (no shake in S2), with a leaf blur. */
export const TileTagDof: React.FC<{i: number; dx: number; dy: number; tag: NonNullable<TileState['tag']>; blur: number; opacity: number}> = ({
  i,
  dx,
  dy,
  tag,
  blur,
  opacity,
}) => {
  if (tag.p <= 0.001 || opacity <= 0.002) return null;
  return (
    <TileFrame i={i} dx={dx} dy={dy} z={22}>
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: -15,
          transform: `scale(${Math.max(0, tag.p).toFixed(3)})`,
          transformOrigin: '80% 50%',
          opacity: Math.min(1, tag.p * 1.6) * opacity,
          filter: blurFilter(blur),
        }}
      >
        <Pill label={tag.label} tone={tag.tone} icon="dot" size={15} solid glow={0.8} />
      </div>
    </TileFrame>
  );
};

/** S1's coral missed-slot mark (dashed outline, wash, dot), pushed into the background plane. */
export const MissedSlotDof: React.FC<{p: number; dx: number; dy: number; blur: number; opacity: number}> = ({p, dx, dy, blur, opacity}) => {
  if (p <= 0.001 || opacity <= 0.002) return null;
  return (
    // 0x0 anchor at the board origin: the mark positions itself in board-local px; the group is filtered as one
    <div style={{position: 'absolute', left: 0, top: 0, width: 0, height: 0, zIndex: 30, opacity, filter: blurFilter(blur), pointerEvents: 'none'}}>
      <MissedSlotOnBoard p={p} dx={dx} dy={dy} />
    </div>
  );
};
