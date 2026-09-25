import React from 'react';
import {AbsoluteFill} from 'remotion';
import {getLength, getPointAtLength} from '@remotion/paths';
import {Beam} from '../../components';
import {C, EASE, alpha} from '../../theme';
import {bell, clamp01, ramp, reveal} from '../../motion';
import {MATES, YOU_LINK} from './geometry';
import {T7, mateBeamAt, mateLandAt} from './timing';

/**
 * Hub -> teammate beams (violet -> ice, evolvePath, 16f each, 6f stagger), the quieter You -> hub link, a
 * glowing port on the folder where each beam leaves, and (during the hold) small light packets that keep
 * flowing out along the beams so the frame stays alive.
 */

const Port: React.FC<{x: number; y: number; o: number; color: string}> = ({x, y, o, color}) =>
  o <= 0.001 ? null : (
    <div
      style={{
        position: 'absolute',
        left: x - 26,
        top: y - 26,
        width: 52,
        height: 52,
        borderRadius: '50%',
        opacity: o,
        background: `radial-gradient(circle, #FFFFFF 0%, ${alpha(color, 0.9)} 10%, ${alpha(color, 0.3)} 26%, ${alpha(color, 0)} 62%)`,
      }}
    />
  );

const PACKET_PERIOD = 30;
const PACKET_DUR = 18;

const Packet: React.FC<{d: string; t: number; color: string}> = ({d, t, color}) => {
  if (t <= 0 || t >= 1) return null;
  const len = getLength(d);
  const e = EASE.IN_OUT(t);
  const pt = getPointAtLength(d, len * e) ?? {x: 0, y: 0};
  const o = bell(t);
  return (
    <div
      style={{
        position: 'absolute',
        left: pt.x - 18,
        top: pt.y - 18,
        width: 36,
        height: 36,
        borderRadius: '50%',
        opacity: 0.85 * o,
        background: `radial-gradient(circle, #FFFFFF 0%, ${alpha(color, 0.85)} 14%, ${alpha(color, 0.25)} 34%, ${alpha(color, 0)} 64%)`,
      }}
    />
  );
};

export const TeamBeams: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const fade = 1 - recede;
  const linkP = reveal(f, T7.youLink, T7.youLinkDur);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* the You board -> hub: where the skill came from */}
      <Beam id="s7-you-link" d={YOU_LINK.d} progress={linkP} from={C.iceGlow} to={C.violet} width={2.4} opacity={0.8 * fade} />
      {MATES.map((m) => {
        const at = mateBeamAt(m.k);
        const p = reveal(f, at, T7.beamDur);
        const settle = ramp(f, mateLandAt(m.k) + 6, mateLandAt(m.k) + 30);
        return (
          <Beam
            key={m.key}
            id={`s7-beam-${m.key}`}
            d={m.beam}
            progress={p}
            from={C.violet}
            to={C.ice}
            width={3}
            opacity={(1 - 0.25 * settle) * fade}
          />
        );
      })}
      <AbsoluteFill>
        {/* ports on the folder: flare as a beam leaves, then glow softly */}
        {MATES.map((m) => {
          const at = mateBeamAt(m.k);
          const o = f < at ? 0 : 0.45 + 0.55 * bell(ramp(f, at - 2, at + 12));
          return <Port key={m.key} x={m.hubPort.x} y={m.hubPort.y} o={o * fade} color={C.violet} />;
        })}
        <Port
          x={YOU_LINK.to.x}
          y={YOU_LINK.to.y}
          o={(linkP > 0.9 ? 0.45 + 0.55 * bell(ramp(f, T7.youLink + 8, T7.youLink + 22)) : 0) * fade}
          color={C.violet}
        />
        {/* packets keep flowing out to the team during the hold */}
        {MATES.map((m) => {
          const t0 = mateLandAt(m.k) + 14;
          if (f < t0) return null;
          const ph = (f - t0) % PACKET_PERIOD;
          return <Packet key={m.key} d={m.beam} t={clamp01(ph / PACKET_DUR)} color={C.iceGlow} />;
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
