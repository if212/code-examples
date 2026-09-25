import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Cursor, DirectionalBlur} from '../../components';
import {bell, clamp01, glide, lerp, ramp, velocity2D, wobble} from '../../motion';
import {MATES, Mate, YOU_CURSOR, YOU_MATE} from './geometry';
import {T7, mateBeamAt, mateWaveAt} from './timing';

/**
 * One labelled cursor per person. Teammates glide in with their beam to the bottom-right of their board,
 * press as their wave starts, then move onto the one amber tile their board lands (they review it).
 * 'You' returns onto your own amber tile, where S5 left it.
 */

type P = {x: number; y: number};

const arc = (a: P, b: P, t: number, lift: number): P => {
  const x = lerp(a.x, b.x, t);
  const y = lerp(a.y, b.y, t);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const k = lift * bell(clamp01(t));
  return {x: x + (-dy / len) * k, y: y + (dx / len) * k};
};

const reviewAt = (m: Mate) => m.amberLand + 1;

const mateAt = (m: Mate, f: number): P => {
  const g1 = glide(f, mateBeamAt(m.k));
  let p = arc(m.cursorFrom, m.cursorHome, g1, 30);
  const g2 = glide(f, reviewAt(m));
  // the review hop bows up into the board (all review moves go left: +lift bows toward -y)
  if (g2 > 0) p = arc(m.cursorHome, m.cursorReview, g2, 22);
  const idle = ramp(f, mateBeamAt(m.k) + 14, mateBeamAt(m.k) + 30);
  return {x: p.x + 2.5 * idle * wobble(`s7-c${m.k}x`, f, 0.04), y: p.y + 2 * idle * wobble(`s7-c${m.k}y`, f, 0.04, 1)};
};

const youFrom = {x: YOU_CURSOR.x + 70, y: YOU_CURSOR.y + 70};
const youAt = (f: number): P => {
  const g = glide(f, T7.youCursor);
  const p = arc(youFrom, YOU_CURSOR, g, 18);
  const idle = ramp(f, T7.youCursor + 14, T7.youCursor + 30);
  return {x: p.x + 2.5 * idle * wobble('s7-cyx', f, 0.04), y: p.y + 2 * idle * wobble('s7-cyy', f, 0.04, 1)};
};

const BOX = {w: 220, h: 140, pad: 50};

const MovingCursor: React.FC<{
  id: string;
  pos: (f: number) => P;
  f: number;
  label: string;
  color: string;
  opacity: number;
  press?: number;
}> = ({id, pos, f, label, color, opacity, press = 0}) => {
  if (opacity <= 0.001) return null;
  const p = pos(f);
  const v = velocity2D(pos, f);
  return (
    <DirectionalBlur
      id={id}
      amount={Math.min(16, v.speed * 0.35)}
      angle={v.angle}
      style={{position: 'absolute', left: p.x - BOX.pad, top: p.y - BOX.pad, width: BOX.w, height: BOX.h}}
    >
      <div style={{position: 'relative', width: BOX.w, height: BOX.h}}>
        <Cursor x={BOX.pad} y={BOX.pad} label={label} color={color} opacity={opacity} press={press} tilt={-2} />
      </div>
    </DirectionalBlur>
  );
};

export const TeamCursors: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const fade = 1 - 0.3 * recede;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <MovingCursor id="s7-cur-you" pos={youAt} f={f} label={YOU_MATE.name} color={YOU_MATE.color} opacity={ramp(f, T7.youCursor, T7.youCursor + 6) * fade} />
      {MATES.map((m) => {
        const w = mateWaveAt(m.k);
        return (
          <MovingCursor
            key={m.key}
            id={`s7-cur-${m.key}`}
            pos={(fr) => mateAt(m, fr)}
            f={f}
            label={m.name}
            color={m.color}
            opacity={ramp(f, mateBeamAt(m.k), mateBeamAt(m.k) + 6) * fade}
            press={bell(ramp(f, w - 4, w + 6))}
          />
        );
      })}
    </AbsoluteFill>
  );
};
