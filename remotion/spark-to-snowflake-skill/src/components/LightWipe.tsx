import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, EASE, alpha} from '../theme';
import {WIPE_DURATION} from '../timeline';

/**
 * Diagonal light-wipe overlay: a band of ember -> white-hot -> ice with bloom that sweeps left->right in
 * 12 frames and fully covers the frame at its midpoint (where the hard cut happens underneath).
 *
 * Usage (Main does this for you): <Sequence from={cut - 6} durationInFrames={12}><LightWipe /></Sequence>
 * or pass `progress` (0..1) directly.
 */
export const LightWipe: React.FC<{progress?: number; duration?: number}> = ({progress, duration = WIPE_DURATION}) => {
  const f = useCurrentFrame();
  // sample at frame centre so the midpoint frame (f = duration/2) is exactly p = 0.5 when duration is even
  const p = progress ?? interpolate(f, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (p <= 0 || p >= 1) return null;
  const e = EASE.IN_OUT(p);
  // Band geometry along the sweep axis (rotated 20deg from vertical). Projection of the frame on the
  // axis is ~2175px; the opaque core is 2300px so at e=0.5 the frame is fully covered.
  const core = 2300;
  const ramp = 900;
  const bandW = core + 2 * ramp; // 4100
  const travel = 2175 + bandW; // from fully left of frame to fully right of it
  const centre = -travel / 2 + e * travel; // band centre offset from frame centre along axis
  // listed from the band's RIGHT (leading) edge to its LEFT (trailing) edge: the viewer sees ember arrive,
  // a white-hot core cover the cut, and ice trail off -> warm to cool as it passes (the film's arc).
  const stops = [
    `${alpha(C.ember, 0)} 0px`,
    `${alpha(C.emberDeep, 0.35)} ${ramp * 0.25}px`,
    `${alpha(C.ember, 0.85)} ${ramp * 0.6}px`,
    `${C.emberGlow} ${ramp * 0.85}px`,
    `${C.whiteHot} ${ramp}px`,
    `#FFF6EE ${ramp + core * 0.5}px`,
    `${C.whiteHot} ${ramp + core}px`,
    `${C.iceGlow} ${ramp + core + ramp * 0.15}px`,
    `${alpha(C.ice, 0.85)} ${ramp + core + ramp * 0.4}px`,
    `${alpha(C.iceDeep, 0.35)} ${ramp + core + ramp * 0.75}px`,
    `${alpha(C.ice, 0)} ${bandW}px`,
  ];
  const bloomO = 0.55 * Math.sin(Math.PI * p);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: 960 - bandW / 2,
          top: 540 - 2400,
          width: bandW,
          height: 4800,
          transform: `rotate(20deg) translateX(${centre.toFixed(1)}px)`,
          transformOrigin: '50% 50%',
          background: `linear-gradient(270deg, ${stops.join(', ')})`,
        }}
      />
      {/* bloom: soft wide glow riding with the band, additive */}
      <div
        style={{
          position: 'absolute',
          left: 960 - (bandW + 2400) / 2,
          top: 540 - 2400,
          width: bandW + 2400,
          height: 4800,
          transform: `rotate(20deg) translateX(${centre.toFixed(1)}px)`,
          transformOrigin: '50% 50%',
          background: `linear-gradient(270deg, rgba(0,0,0,0) 0px, ${alpha(C.ember, 0.35)} 1000px, ${alpha(C.whiteHot, 0.5)} 1900px, ${alpha(C.whiteHot, 0.5)} ${bandW + 500}px, ${alpha(C.ice, 0.35)} ${bandW + 1400}px, rgba(0,0,0,0) ${bandW + 2400}px)`,
          mixBlendMode: 'screen',
          opacity: bloomO,
        }}
      />
      {/* fine anamorphic streaks for texture */}
      <div
        style={{
          position: 'absolute',
          left: 960 - 3000,
          top: 540 - 2400,
          width: 6000,
          height: 4800,
          transform: `rotate(20deg) translateX(${(centre * 1.08).toFixed(1)}px)`,
          transformOrigin: '50% 50%',
          background: `repeating-linear-gradient(90deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 37px, ${alpha('#FFFFFF', 0.1)} 39px, rgba(255,255,255,0) 41px, rgba(255,255,255,0) 83px)`,
          WebkitMaskImage: `linear-gradient(90deg, transparent ${3000 - bandW / 2}px, #000 ${3000 - core / 2}px, #000 ${3000 + core / 2}px, transparent ${3000 + bandW / 2}px)`,
          maskImage: `linear-gradient(90deg, transparent ${3000 - bandW / 2}px, #000 ${3000 - core / 2}px, #000 ${3000 + core / 2}px, transparent ${3000 + bandW / 2}px)`,
          mixBlendMode: 'screen',
          opacity: 0.8 * Math.sin(Math.PI * p),
        }}
      />
    </AbsoluteFill>
  );
};
