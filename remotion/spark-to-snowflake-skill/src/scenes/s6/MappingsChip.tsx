import React from 'react';
import {AbsoluteFill, Easing} from 'remotion';
import {Chip, DirectionalBlur, SkillIcon, useFontsLoaded} from '../../components';
import {C, alpha} from '../../theme';
import {COPY} from '../../demoData';
import {bezierPoint, clamp01, ramp, reveal, velocity2D} from '../../motion';
import {CODE, DOCK_MAPPINGS} from './geometry';
import {insertX} from './CodePanel';
import {T6} from './timing';

/**
 * lf72: the violet 'from Mappings' chip leaves the dock's Mappings cell and slides along a shallow arc to
 * land right under the spot where ' NULLS LAST' is about to be typed. A short violet -> mint thread then
 * ties it to the inserted words. Velocity-driven directional blur in flight.
 */

const CHIP_SIZE = 22;
const CHIP_H = Math.round(CHIP_SIZE * 1.75);
/** eases out of the dock (so you see it leave the Mappings cell), glides fast, then settles softly */
const SLIDE = Easing.bezier(0.45, 0, 0.2, 1);

export const MappingsChip: React.FC<{f: number}> = ({f}) => {
  useFontsLoaded();
  if (f < T6.mappings) return null;
  const ix = insertX();
  const p0: [number, number] = [DOCK_MAPPINGS.x, DOCK_MAPPINGS.y];
  const p3: [number, number] = [ix - 6, CODE.mapY];
  const p1: [number, number] = [p0[0] + 320, p0[1] + 80];
  const p2: [number, number] = [p3[0] - 280, p3[1] + 14];
  const at = (fr: number) => bezierPoint(reveal(fr, T6.mappings, T6.mappingsFlight, SLIDE), p0, p1, p2, p3);
  const pos = at(f);
  const v = velocity2D(at, f);
  const t = reveal(f, T6.mappings, T6.mappingsFlight, SLIDE);
  const sc = 0.72 + 0.28 * reveal(f, T6.mappings, 8);
  const o = ramp(f, T6.mappings, T6.mappings + 3);
  const blur = Math.min(10, v.speed * 0.14);

  // thread from the chip up to the mint wash
  const thread = reveal(f, T6.mappings + T6.mappingsFlight - 3, 10);
  const threadX = ix + 16;
  const threadTop = CODE.lineY + 36;
  const threadBottom = CODE.mapY - CHIP_H / 2;
  const threadH = (threadBottom - threadTop) * thread;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {thread > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: threadX - 1,
            top: threadBottom - threadH,
            width: 2,
            height: threadH,
            borderRadius: 1,
            background: `linear-gradient(0deg, ${C.violet} 0%, ${alpha(C.mint, 0.9)} 100%)`,
            boxShadow: `0 0 10px ${alpha(C.violetGlow, 0.8)}`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: pos.x - 40,
          top: pos.y - CHIP_H / 2 - 40,
          opacity: o,
        }}
      >
        <DirectionalBlur id="s6-mappings-chip" amount={blur} angle={v.angle}>
          <div style={{padding: 40}}>
            <div style={{transform: `scale(${sc.toFixed(4)})`, transformOrigin: '0% 50%'}}>
              <Chip
                label={COPY.s6Chip}
                tone="violet"
                size={CHIP_SIZE}
                glow={0.6 + 0.6 * clamp01(1 - t) + 0.3 * (1 - ramp(f, T6.mappings + T6.mappingsFlight, T6.mappings + T6.mappingsFlight + 16))}
                icon={<SkillIcon kind="mappings" size={24} color={C.violet} strokeWidth={3.4} />}
              />
            </div>
          </div>
        </DirectionalBlur>
      </div>
    </AbsoluteFill>
  );
};
