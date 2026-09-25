import React from 'react';
import {AbsoluteFill} from 'remotion';
import {evolvePath, getPointAtLength, getLength} from '@remotion/paths';
import {C, alpha, softRadial} from '../theme';
import {clamp01} from '../motion';

/**
 * Small shared effects: Beam (drawn gradient path with a travelling head), Shockwave ring, Spotlight.
 * All in canvas coordinates, each in its own AbsoluteFill.
 */

/** Quadratic arc path from a to b, bowed by `bend` px (positive = bows up/left of travel). */
export const arcPath = (a: [number, number], b: [number, number], bend = -120): string => {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  return `M ${a[0]} ${a[1]} Q ${mx + nx * bend} ${my + ny * bend} ${b[0]} ${b[1]}`;
};

export const Beam: React.FC<{
  id: string;
  /** SVG path in canvas px (use arcPath) */
  d: string;
  /** 0..1 draw progress (evolvePath). EXPO_OUT outside for the reveal, or linear. */
  progress: number;
  from?: string;
  to?: string;
  width?: number;
  /** 0..1 overall opacity (fade the beam after it lands) */
  opacity?: number;
  /** glowing head dot at the draw tip */
  head?: boolean;
}> = ({id, d, progress, from = C.violet, to = C.ice, width = 3, opacity = 1, head = true}) => {
  const p = clamp01(progress);
  if (p <= 0 || opacity <= 0) return null;
  const ev = evolvePath(p, d);
  const len = getLength(d);
  const tip = getPointAtLength(d, len * p) ?? {x: 0, y: 0};
  const start = getPointAtLength(d, 0) ?? {x: 0, y: 0};
  const end = getPointAtLength(d, len) ?? {x: 0, y: 0};
  const gid = `beam-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // filter region in user space around the path's sampled bbox (objectBoundingBox fails for flat paths)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let k = 0; k <= 12; k++) {
    const pt = getPointAtLength(d, (len * k) / 12) ?? {x: 0, y: 0};
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  const pad = width * 10 + 20;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <filter
            id={`${gid}-glow`}
            filterUnits="userSpaceOnUse"
            x={minX - pad}
            y={minY - pad}
            width={maxX - minX + 2 * pad}
            height={maxY - minY + 2 * pad}
          >
            <feGaussianBlur stdDeviation={width * 2.4} />
          </filter>
        </defs>
        <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={width * 4} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={0.55} filter={`url(#${gid}-glow)`} />
        <path d={d} fill="none" stroke={`url(#${gid})`} strokeWidth={width} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
        <path d={d} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={Math.max(1, width * 0.35)} strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />
      </svg>
      {head && p < 0.999 ? (
        <div
          style={{
            position: 'absolute',
            left: tip.x - 40,
            top: tip.y - 40,
            width: 80,
            height: 80,
            background: `radial-gradient(circle, #FFFFFF 0%, ${alpha(C.whiteHot, 0.8)} 8%, ${alpha(to, 0.35)} 22%, ${alpha(to, 0)} 60%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** Gradient shockwave ring (S2 lid snap): r and opacity driven by the caller (r 80->560, 1->0 over 20f). */
export const Shockwave: React.FC<{cx: number; cy: number; r: number; opacity: number; width?: number; id?: string}> = ({
  cx,
  cy,
  r,
  opacity,
  width = 3,
  id = 'shock',
}) => {
  if (opacity <= 0.001) return null;
  const gid = `sw-${id}`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0.5" x2="1" y2="0.3">
            <stop offset="0" stopColor={C.ember} />
            <stop offset="0.3" stopColor={C.emberGlow} />
            <stop offset="0.5" stopColor={C.whiteHot} />
            <stop offset="0.7" stopColor={C.iceGlow} />
            <stop offset="1" stopColor={C.ice} />
          </linearGradient>
          <filter id={`${gid}-b`} filterUnits="userSpaceOnUse" x={cx - r - 60} y={cy - r - 60} width={2 * r + 120} height={2 * r + 120}>
            <feGaussianBlur stdDeviation={10} />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={width * 6} opacity={0.45} filter={`url(#${gid}-b)`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={width} />
      </svg>
    </AbsoluteFill>
  );
};

/** Soft radial spotlight (S5 amber tiles, S7 hub). Paints only its own bounding box (cheap). */
export const Spotlight: React.FC<{cx: number; cy: number; rx: number; ry?: number; color?: string; intensity?: number}> = ({
  cx,
  cy,
  rx,
  ry,
  color = C.whiteHot,
  intensity = 0.25,
}) => {
  const h = ry ?? rx * 0.7;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: cx - rx,
          top: cy - h,
          width: rx * 2,
          height: h * 2,
          background: softRadial('ellipse 50% 50% at 50% 50%', color, intensity, 14, 2.2),
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};
