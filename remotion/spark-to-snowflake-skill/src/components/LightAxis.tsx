import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, EASE, alpha} from '../theme';
import {LIGHT_AXIS} from '../layout';

/**
 * The persistent 1px light axis (signature gradient) with a 40px bloom and a white-hot draw tip.
 * Draws left->right with EXPO_OUT over [drawFrom, drawFrom+drawDur] of the GLOBAL frame.
 * Main renders it once; y jumps from 600 to 340 at the S7->S8 cut (hidden by the light-wipe).
 */
export const axisYAt = (globalFrame: number): number => (globalFrame >= 990 ? LIGHT_AXIS.yEnd : LIGHT_AXIS.y);

export const LightAxis: React.FC<{
  frameOffset?: number;
  /** override y (canvas px). Default: axisYAt(globalFrame). */
  y?: number;
  opacity?: number;
  drawFrom?: number;
  drawDur?: number;
}> = ({frameOffset = 0, y, opacity = 1, drawFrom = 0, drawDur = 10}) => {
  const g = useCurrentFrame() + frameOffset;
  const p = interpolate(g, [drawFrom, drawFrom + drawDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.EXPO_OUT,
  });
  const ay = y ?? axisYAt(g);
  // subtle breathing of the bloom
  const breathe = 0.9 + 0.1 * Math.sin(g / 23);
  const grad = `linear-gradient(90deg, ${C.ember} 0%, ${C.emberGlow} 30%, ${C.whiteHot} 50%, ${C.iceGlow} 70%, ${C.ice} 100%)`;
  const tipX = p * 1920;
  return (
    <AbsoluteFill style={{opacity, pointerEvents: 'none'}}>
      {/* horizontal edge fade */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: ay - 60,
          width: 1920,
          height: 120,
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%)',
          maskImage: 'linear-gradient(90deg, transparent 0%, #000 16%, #000 84%, transparent 100%)',
        }}
      >
        {/* draw progress clip */}
        <div style={{position: 'absolute', left: 0, top: 0, width: tipX, height: 120, overflow: 'hidden'}}>
          {/* wide bloom */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 20,
              width: 1920,
              height: 80,
              background: grad,
              opacity: 0.2 * breathe,
              WebkitMaskImage:
                'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 25%, rgba(0,0,0,0.35) 40%, #000 50%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 75%, transparent 100%)',
              maskImage:
                'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 25%, rgba(0,0,0,0.35) 40%, #000 50%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.08) 75%, transparent 100%)',
            }}
          />
          {/* tight bloom */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 54,
              width: 1920,
              height: 12,
              background: grad,
              opacity: 0.45,
              WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 50%, transparent)',
              maskImage: 'linear-gradient(180deg, transparent, #000 50%, transparent)',
            }}
          />
          {/* the 1px core */}
          <div style={{position: 'absolute', left: 0, top: 59.5, width: 1920, height: 1, background: grad, opacity: 0.95}} />
        </div>
      </div>
      {/* white-hot draw tip while drawing */}
      {p > 0 && p < 0.999 ? (
        <div
          style={{
            position: 'absolute',
            left: tipX - 90,
            top: ay - 90,
            width: 180,
            height: 180,
            background: `radial-gradient(circle, ${alpha(C.whiteHot, 0.9)} 0%, ${alpha(C.whiteHot, 0.35)} 12%, ${alpha(C.emberGlow, 0.12)} 35%, transparent 70%)`,
            opacity: 1 - p,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
