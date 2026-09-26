import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Cursor, DirectionalBlur} from '../../components';
import {FONT, alpha} from '../../theme';
import {bell, clamp01, glide, lerp, ramp, reveal, velocity2D, wobble} from '../../motion';
import {CURSOR_SCALE, MATES, Mate, YOU_CURSOR, YOU_MATE} from './geometry';
import {T7, mateBeamAt, mateWaveAt} from './timing';

/**
 * One labelled cursor per person. Teammates glide in with their beam to the bottom-right tile of their board,
 * press as their wave starts, then hop onto the one amber tile their board lands (they review it). 'You'
 * returns onto your own amber tile, where S5 left it.
 *
 * Like S5's review cursor, each cursor is split in two layers so motion blur never smears a name: the arrow
 * gets velocity-driven directional blur, the name tag (a pixel copy of the shared Cursor's pill) at most ~1px.
 * So 'You · Leo · Priya · Sam' stay readable the whole time they are on screen.
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

/** the review hop starts just before the amber tile lands and is quick (EXPO_OUT), so every cursor is on its tile by ~lf70 */
const reviewAt = (m: Mate) => m.amberLand - T7.reviewLead;

const mateAt = (m: Mate, f: number): P => {
  const g1 = glide(f, mateBeamAt(m.k));
  let p = arc(m.cursorFrom, m.cursorHome, g1, 30);
  const g2 = reveal(f, reviewAt(m), T7.reviewDur);
  // the review hop bows up into the board (all review moves go left: +lift bows toward -y)
  if (g2 > 0) p = arc(m.cursorHome, m.cursorReview, g2, 16);
  const idle = ramp(f, mateBeamAt(m.k) + 14, mateBeamAt(m.k) + 30);
  return {x: p.x + 2 * idle * wobble(`s7-c${m.k}x`, f, 0.04), y: p.y + 1.6 * idle * wobble(`s7-c${m.k}y`, f, 0.04, 1)};
};

const youFrom = {x: YOU_CURSOR.x + 70, y: YOU_CURSOR.y + 70};
const youAt = (f: number): P => {
  const g = glide(f, T7.youCursor);
  const p = arc(youFrom, YOU_CURSOR, g, 18);
  const idle = ramp(f, T7.youCursor + 14, T7.youCursor + 30);
  return {x: p.x + 2 * idle * wobble('s7-cyx', f, 0.04), y: p.y + 1.6 * idle * wobble('s7-cyy', f, 0.04, 1)};
};

/* the shared Cursor's label pill geometry (Cursor.tsx), reproduced so the tag can be blurred separately */
const TAG_DX = 26;
const TAG_DY = 34;
const DARK = '#0A0D14';
const ARROW_BOX = 60;

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
  const s = CURSOR_SCALE * (1 - 0.1 * press); // the shared Cursor's press squash, applied to the tag too
  const arrowBlur = Math.min(12, v.speed * 0.3);
  const tagBlur = Math.min(1, v.speed * 0.012);
  return (
    <>
      {/* arrow (and click ring): full motion blur */}
      <div style={{position: 'absolute', left: p.x - ARROW_BOX, top: p.y - ARROW_BOX}}>
        <DirectionalBlur id={`${id}-arrow`} amount={arrowBlur} angle={v.angle}>
          <div style={{position: 'relative', width: 2 * ARROW_BOX, height: 2 * ARROW_BOX}}>
            <Cursor x={ARROW_BOX} y={ARROW_BOX} opacity={opacity} scale={CURSOR_SCALE} press={press} tilt={-2} showLabel={false} />
          </div>
        </DirectionalBlur>
      </div>
      {/* name tag: never smeared */}
      <div
        style={{
          position: 'absolute',
          left: p.x,
          top: p.y,
          width: 0,
          height: 0,
          opacity,
          transform: `scale(${s.toFixed(4)})`,
          transformOrigin: '0 0',
          zIndex: 51,
        }}
      >
        <DirectionalBlur id={`${id}-tag`} amount={tagBlur} angle={v.angle} style={{position: 'absolute', left: TAG_DX, top: TAG_DY}}>
          <div
            style={{
              padding: '6px 13px 6px',
              borderRadius: 10,
              borderTopLeftRadius: 3,
              background: `linear-gradient(180deg, ${color} 0%, ${alpha(color, 0.86)} 100%)`,
              boxShadow: `0 8px 20px -6px rgba(0,0,0,0.7), 0 0 22px ${alpha(color, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.5)`,
              color: DARK,
              fontFamily: FONT.display,
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {label}
          </div>
        </DirectionalBlur>
      </div>
    </>
  );
};

export const TeamCursors: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const fade = 1 - 0.3 * recede;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <MovingCursor
        id="s7-cur-you"
        pos={youAt}
        f={f}
        label={YOU_MATE.name}
        color={YOU_MATE.color}
        opacity={ramp(f, T7.youCursor, T7.youCursor + 6) * fade}
      />
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
