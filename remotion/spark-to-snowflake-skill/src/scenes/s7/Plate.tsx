import React from 'react';
import {getLength} from '@remotion/paths';
import {GlassPanel} from '../../components';
import {C, alpha} from '../../theme';
import {clamp01} from '../../motion';
import {PLATE_R, Rect} from './geometry';

/**
 * A quiet glass "desk" behind a mini board. When the skill's beam lands on its port, light runs around the
 * rim in both directions from the port (violet -> ice) and stays on as a soft lit edge.
 * Rendered in world coordinates (inside the pull-back camera).
 */

/** rounded-rect outline that starts (and ends) at a port on the left or right edge, clockwise */
const rimPath = (r: Rect, side: 'left' | 'right', py: number, rad: number): string => {
  const {x, y, w, h} = r;
  const x1 = x + w;
  const y1 = y + h;
  if (side === 'left') {
    return [
      `M ${x} ${py}`,
      `L ${x} ${y + rad}`,
      `A ${rad} ${rad} 0 0 1 ${x + rad} ${y}`,
      `L ${x1 - rad} ${y}`,
      `A ${rad} ${rad} 0 0 1 ${x1} ${y + rad}`,
      `L ${x1} ${y1 - rad}`,
      `A ${rad} ${rad} 0 0 1 ${x1 - rad} ${y1}`,
      `L ${x + rad} ${y1}`,
      `A ${rad} ${rad} 0 0 1 ${x} ${y1 - rad}`,
      `L ${x} ${py}`,
    ].join(' ');
  }
  return [
    `M ${x1} ${py}`,
    `L ${x1} ${y1 - rad}`,
    `A ${rad} ${rad} 0 0 1 ${x1 - rad} ${y1}`,
    `L ${x + rad} ${y1}`,
    `A ${rad} ${rad} 0 0 1 ${x} ${y1 - rad}`,
    `L ${x} ${y + rad}`,
    `A ${rad} ${rad} 0 0 1 ${x + rad} ${y}`,
    `L ${x1 - rad} ${y}`,
    `A ${rad} ${rad} 0 0 1 ${x1} ${y + rad}`,
    `L ${x1} ${py}`,
  ].join(' ');
};

export const Plate: React.FC<{
  id: string;
  rect: Rect;
  side: 'left' | 'right';
  portY: number;
  /** 0..1 rim-light travel from the port (both directions) */
  lit: number;
  /** 0..1 landing flash (bell) */
  flash?: number;
  /** steady rim light level once lit (0..1) */
  rimLevel?: number;
  opacity?: number;
  from?: string;
  to?: string;
}> = ({id, rect, side, portY, lit, flash = 0, rimLevel = 0.6, opacity = 1, from = C.violet, to = C.ice}) => {
  if (opacity <= 0.001) return null;
  const p = clamp01(lit);
  const d = rimPath(rect, side, portY, PLATE_R);
  const L = getLength(d);
  const a = (L * p) / 2;
  const dash = `${a.toFixed(2)} ${Math.max(0, L - 2 * a).toFixed(2)} ${a.toFixed(2)}`;
  const M = 40;
  const gid = `plate-${id}`;
  const portX = side === 'left' ? rect.x : rect.x + rect.w;
  const farX = side === 'left' ? rect.x + rect.w : rect.x;
  const strength = rimLevel + (1 - rimLevel) * clamp01(flash);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity}}>
      <GlassPanel
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        radius={PLATE_R}
        backing={0.42}
        glow={0.5 * clamp01(flash)}
        tint={p > 0 ? 'violet' : undefined}
        tintStrength={0.35 * p}
      />
      {p > 0.001 ? (
        <svg
          width={rect.w + 2 * M}
          height={rect.h + 2 * M}
          style={{position: 'absolute', left: rect.x - M, top: rect.y - M, overflow: 'visible'}}
        >
          <defs>
            <linearGradient id={`${gid}-g`} gradientUnits="userSpaceOnUse" x1={portX} y1={portY} x2={farX} y2={portY}>
              <stop offset="0" stopColor={from} />
              <stop offset="0.55" stopColor={C.iceGlow} />
              <stop offset="1" stopColor={to} />
            </linearGradient>
            <filter id={`${gid}-b`} filterUnits="userSpaceOnUse" x={rect.x - M} y={rect.y - M} width={rect.w + 2 * M} height={rect.h + 2 * M}>
              <feGaussianBlur stdDeviation={5} />
            </filter>
          </defs>
          <g transform={`translate(${M - rect.x} ${M - rect.y})`}>
            <path d={d} fill="none" stroke={`url(#${gid}-g)`} strokeWidth={6} strokeDasharray={dash} opacity={0.55 * strength} filter={`url(#${gid}-b)`} />
            <path d={d} fill="none" stroke={`url(#${gid}-g)`} strokeWidth={1.6} strokeDasharray={dash} opacity={0.35 + 0.65 * strength} />
          </g>
        </svg>
      ) : null}
      {/* port: where the beam plugs in */}
      {p > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: portX - 30,
            top: portY - 30,
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: `radial-gradient(circle, #FFFFFF 0%, ${alpha(C.iceGlow, 0.9)} 9%, ${alpha(C.ice, 0.35)} 24%, ${alpha(C.ice, 0)} 62%)`,
            opacity: 0.45 + 0.55 * clamp01(flash),
          }}
        />
      ) : null}
    </div>
  );
};
