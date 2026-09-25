import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, FONT, alpha} from '../theme';
import {ZONES} from '../layout';
import {COPY} from '../demoData';

/**
 * 'DEMO PROJECT' corner chip: bottom-left at x96, text baseline y980, 60% opacity. Main renders it
 * persistently for S1-S7 (fades in at global f20). `fadeInAt` is in the local frame of wherever it is used.
 */
export const DemoChip: React.FC<{fadeInAt?: number; opacity?: number}> = ({fadeInAt = 0, opacity = 0.6}) => {
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
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
          boxShadow: `inset 0 0 0 1px ${alpha('#FFFFFF', 0.13)}, inset 0 1px 0 ${alpha('#FFFFFF', 0.08)}`,
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
        <div style={{width: 7, height: 7, borderRadius: '50%', background: C.dim, boxShadow: `0 0 0 3px ${alpha(C.dim, 0.25)}`}} />
        <span style={{transform: 'translateY(0.05em)'}}>{COPY.demoChip}</span>
      </div>
    </AbsoluteFill>
  );
};
