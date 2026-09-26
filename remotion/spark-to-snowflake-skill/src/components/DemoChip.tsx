import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, FONT, alpha} from '../theme';
import {ZONES} from '../layout';
import {COPY} from '../demoData';

/**
 * 'DEMO PROJECT' corner chip: bottom-left at x96, text baseline y980, 85% opacity (it is the disclaimer for
 * every count, so it must be legible). Main renders it persistently for S1-S7 (fades in at global f8).
 * `fadeInAt` is in the local frame of wherever it is used.
 */
export const DemoChip: React.FC<{fadeInAt?: number; opacity?: number}> = ({fadeInAt = 0, opacity = 0.85}) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [fadeInAt, fadeInAt + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const size = 18;
  const h = 36;
  // baseline at 980: text box centred in a 36px pill; cap-height ~0.73em -> baseline ~ centre + 0.36em
  const top = ZONES.demoChip.baseline - h / 2 - size * 0.36;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: ZONES.demoChip.x,
          top,
          height: h,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px 0 13px',
          borderRadius: h / 2,
          background: `linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03)), ${alpha(C.ink, 0.55)}`,
          boxShadow: `inset 0 0 0 1px ${alpha(C.slate, 0.3)}, inset 0 1px 0 ${alpha('#FFFFFF', 0.1)}`,
          opacity: a * opacity,
          fontFamily: FONT.display,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: '0.14em',
          color: '#9AA5B8',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        <div style={{width: 7, height: 7, borderRadius: '50%', background: C.slate, boxShadow: `0 0 0 3px ${alpha(C.slate, 0.22)}`}} />
        <span style={{transform: 'translateY(0.05em)'}}>{COPY.demoChip}</span>
      </div>
    </AbsoluteFill>
  );
};
