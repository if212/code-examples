import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {C, alpha} from '../theme';
import {WIPES, WIPE_DURATION} from '../timeline';

/**
 * Diagonal light-wipe: a narrow, screen-blended band of light (ember leading shoulder -> white-hot core with a
 * 3px specular filament -> ice trailing shoulder) that sweeps left->right in 12 frames. It is a REVEAL, not a
 * white-out: Main draws the outgoing scene only AHEAD of the band (right of its core) and the incoming scene only BEHIND it (left of its core), each with
 * a soft feathered edge that sits under the core. No frame is ever fully covered.
 *
 * Geometry: the band's axis is rotated 20deg from horizontal (u = (cos20, sin20)); positions along it are
 * measured in px from the frame centre (960,540). The frame spans [-WIPE_HALF_SPAN, +WIPE_HALF_SPAN] on it.
 * `wipeCentre(p)` is where the core centre is at progress p (0 = band fully off the left, 1 = fully off the
 * right); `wipeMask(side, centre)` is the matching CSS mask for scene layers.
 *
 * Usage (Main does this for you): <Sequence from={w.from} durationInFrames={12}><LightWipe /></Sequence>,
 * or pass `progress` (0..1) directly.
 */

export const WIPE_ANGLE = 20;
const RAD = (WIPE_ANGLE * Math.PI) / 180;
const COS = Math.cos(RAD);
const SIN = Math.sin(RAD);
/** Half the frame's extent along the band axis (~1087px). */
export const WIPE_HALF_SPAN = (1920 * COS + 1080 * SIN) / 2;
/**
 * Band profile along the axis (px): ember lead ahead of the core, a narrow white-hot core, ice trail behind it.
 * Tight on purpose: the band is a crisp sweep of light that SCREENS over the frame (content brightens under it,
 * it is never painted over), not a wide opaque wash.
 */
export const WIPE_BAND = {core: 120, lead: 220, trail: 320} as const;

/** Progress 0..1 of a wipe at local frame f (sampled so the cut frame f = duration/2 is exactly p = 0.5). */
export const wipeProgress = (f: number, duration = WIPE_DURATION): number =>
  interpolate(f, [0, duration], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

/**
 * Core-centre position along the band axis (px from frame centre) at progress p.
 * A near-linear in-out: the band is on screen for all 11 of its frames and never jumps much more than its
 * own width per frame (peak ~300px/frame against a ~660px band), so the narrow band reads as one sweep.
 */
const WIPE_EASE = Easing.bezier(0.3, 0.1, 0.7, 0.9);

export const wipeCentre = (p: number): number => {
  const e = WIPE_EASE(Math.max(0, Math.min(1, p)));
  const c0 = -WIPE_HALF_SPAN - WIPE_BAND.core / 2 - WIPE_BAND.lead; // leading edge just off the left
  const c1 = WIPE_HALF_SPAN + WIPE_BAND.core / 2 + WIPE_BAND.trail; // trailing edge just off the right
  return c0 + e * (c1 - c0);
};

/** Scene-mask feather (px each side of the core centre): the swap happens under the brightest part of the band. */
export const WIPE_FEATHER = 100;

/**
 * CSS mask (for mask-image on a full-frame 1920x1080 layer) that keeps the part of the frame AHEAD of the
 * band core ('ahead' = the outgoing scene) or BEHIND it ('behind' = the incoming scene). The edge is feathered
 * over +/-feather px under the core and its inner shoulders, so the two scenes cross-dissolve beneath the light.
 */
export const wipeMask = (side: 'ahead' | 'behind', centre: number, feather = WIPE_FEATHER): string => {
  const t = WIPE_HALF_SPAN + centre; // position on the 110deg gradient line (length 2*WIPE_HALF_SPAN)
  const a = (t - feather).toFixed(1);
  const b = (t + feather).toFixed(1);
  return side === 'behind'
    ? `linear-gradient(${90 + WIPE_ANGLE}deg, #000 ${a}px, transparent ${b}px)`
    : `linear-gradient(${90 + WIPE_ANGLE}deg, transparent ${a}px, #000 ${b}px)`;
};

/** The active wipe at a global frame: {wipe, p, centre}, or null when no band is on screen. */
export const wipeAt = (globalFrame: number) => {
  for (const w of WIPES) {
    const p = wipeProgress(globalFrame - w.from, w.duration);
    if (p > 0 && p < 1) return {wipe: w, p, centre: wipeCentre(p)};
  }
  return null;
};

/** A div spanning [x0, x1] along the band axis (relative to the core centre), riding the band. */
const BandStrip: React.FC<{x0: number; x1: number; centre: number; style: React.CSSProperties}> = ({x0, x1, centre, style}) => {
  const w = x1 - x0;
  const h = 2600; // covers the frame's extent across the axis (+/-1101px) with margin
  return (
    <div
      style={{
        position: 'absolute',
        left: 960 + x0,
        top: 540 - h / 2,
        width: w,
        height: h,
        transformOrigin: `${-x0}px ${h / 2}px`,
        transform: `rotate(${WIPE_ANGLE}deg) translateX(${centre.toFixed(1)}px)`,
        ...style,
      }}
    />
  );
};

export const LightWipe: React.FC<{progress?: number; duration?: number}> = ({progress, duration = WIPE_DURATION}) => {
  const f = useCurrentFrame();
  const p = progress ?? wipeProgress(f, duration);
  if (p <= 0 || p >= 1) return null;
  const centre = wipeCentre(p);
  const {core, lead, trail} = WIPE_BAND;
  const k = core / 2;
  // Colour band, SCREEN-blended (it brightens what is under it). Stops from the TRAILING (left, ice) edge to the
  // LEADING (right, ember) edge, in px from x0 = -(k+trail).
  const x0 = -(k + trail);
  const at = (x: number) => `${(x - x0).toFixed(1)}px`;
  const stops = [
    `${alpha(C.ice, 0)} ${at(x0)}`,
    `${alpha(C.iceDeep, 0.22)} ${at(-k - trail * 0.78)}`,
    `${alpha(C.ice, 0.34)} ${at(-k - trail * 0.52)}`,
    `${alpha(C.ice, 0.55)} ${at(-k - trail * 0.26)}`,
    `${alpha(C.iceGlow, 0.66)} ${at(-k - trail * 0.08)}`,
    `${alpha(C.whiteHot, 0.72)} ${at(-k)}`,
    `${alpha('#FFF8F1', 0.8)} ${at(0)}`,
    `${alpha(C.whiteHot, 0.72)} ${at(k)}`,
    `${alpha(C.emberGlow, 0.66)} ${at(k + lead * 0.1)}`,
    `${alpha(C.ember, 0.55)} ${at(k + lead * 0.32)}`,
    `${alpha(C.ember, 0.32)} ${at(k + lead * 0.56)}`,
    `${alpha(C.emberDeep, 0.16)} ${at(k + lead * 0.8)}`,
    `${alpha(C.ember, 0)} ${at(k + lead)}`,
  ];
  const s = Math.sin(Math.PI * p);
  // bloom: soft additive glow riding with the band (cool behind, warm ahead), a little wider than the band
  const bx0 = -(k + trail + 320);
  const bx1 = k + lead + 260;
  const bat = (x: number) => `${(x - bx0).toFixed(1)}px`;
  const bloom = `linear-gradient(90deg, rgba(0,0,0,0) ${bat(bx0)}, ${alpha(C.ice, 0.16)} ${bat(-k - trail * 0.7)}, ${alpha(C.iceGlow, 0.3)} ${bat(-k)}, ${alpha(C.whiteHot, 0.38)} ${bat(0)}, ${alpha(C.emberGlow, 0.3)} ${bat(k)}, ${alpha(C.ember, 0.14)} ${bat(k + lead * 0.7)}, rgba(0,0,0,0) ${bat(bx1)})`;
  // anamorphic streaks: fine lines across the core, with slight parallax, masked to the core region
  const sx0 = -(k + 220);
  const sx1 = k + 220;
  const sw = sx1 - sx0;
  const streakMask = `linear-gradient(90deg, transparent 0px, #000 ${(sw * 0.32).toFixed(0)}px, #000 ${(sw * 0.68).toFixed(0)}px, transparent ${sw}px)`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      <BandStrip x0={bx0} x1={bx1} centre={centre} style={{background: bloom, mixBlendMode: 'screen', opacity: 0.55 * s}} />
      <BandStrip
        x0={x0}
        x1={k + lead}
        centre={centre}
        style={{background: `linear-gradient(90deg, ${stops.join(', ')})`, mixBlendMode: 'screen', opacity: 0.35 + 0.65 * Math.min(1, 1.6 * s)}}
      />
      <BandStrip
        x0={sx0}
        x1={sx1}
        centre={centre * 1.04}
        style={{
          background: `repeating-linear-gradient(90deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 37px, ${alpha('#FFFFFF', 0.14)} 39px, rgba(255,255,255,0) 41px, rgba(255,255,255,0) 83px)`,
          WebkitMaskImage: streakMask,
          maskImage: streakMask,
          mixBlendMode: 'screen',
          opacity: 0.7 * s,
        }}
      />
      {/* the filament: a 3px white-hot specular line at the core centre, with a tight glow */}
      <BandStrip
        x0={-40}
        x1={40}
        centre={centre}
        style={{
          background: `linear-gradient(90deg, rgba(255,255,255,0) 0px, ${alpha('#FFFFFF', 0.35)} 30px, ${alpha('#FFFFFF', 0.95)} 38.5px, ${alpha('#FFFFFF', 0.95)} 41.5px, ${alpha('#FFFFFF', 0.35)} 50px, rgba(255,255,255,0) 80px)`,
          mixBlendMode: 'screen',
          opacity: 0.6 + 0.4 * s,
        }}
      />
    </AbsoluteFill>
  );
};
