import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, EASE, alpha, softRadial} from '../../theme';
import {clamp01} from '../../motion';

/**
 * Lid-snap light streak: at contact a thin signature-gradient line shoots out along the closed seam
 * (ember left -> white-hot centre -> ice right) with a soft white-hot bloom, then fades. Box-sized, cheap.
 * The line's glow is a vertically masked copy of the gradient (an outer box-shadow is clipped under its own
 * box, which would leave a dark core at the faint tails). p = 0..1 progress over ~14f from contact.
 */
const lineGradient = `linear-gradient(90deg, ${alpha(C.ember, 0)} 0%, ${C.ember} 16%, ${C.emberGlow} 32%, #FFFFFF 50%, ${C.iceGlow} 68%, ${C.ice} 84%, ${alpha(C.ice, 0)} 100%)`;
const vMask = 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 30%, #000 50%, rgba(0,0,0,0.35) 70%, transparent 100%)';

export const SnapStreak: React.FC<{p: number; cx: number; y: number}> = ({p, cx, y}) => {
  if (p <= 0 || p >= 1) return null;
  const e = EASE.EXPO_OUT(clamp01(p));
  const half = 220 + 620 * e;
  const o = (1 - clamp01(p)) ** 1.4;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: cx - half * 0.8,
          top: y - 60,
          width: half * 1.6,
          height: 120,
          opacity: o * 0.9,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.55, 12, 2.6),
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: cx - half,
          top: y - 14,
          width: half * 2,
          height: 28,
          opacity: o * 0.55,
          background: lineGradient,
          WebkitMaskImage: vMask,
          maskImage: vMask,
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: cx - half,
          top: y - 1.5,
          width: half * 2,
          height: 3,
          borderRadius: 2,
          opacity: o,
          background: lineGradient,
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};
