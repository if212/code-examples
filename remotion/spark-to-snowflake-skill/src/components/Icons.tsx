import React from 'react';
import {evolvePath} from '@remotion/paths';
import {C, alpha} from '../theme';
import {clamp01} from '../motion';

/**
 * Thin-stroke icons, drawable with evolvePath. All take `draw` (0..1, default 1) so scenes can draw them on.
 * No flame / star / six-arm snowflake glyphs anywhere (brand safety): embers are round dots, ice is a hexagon.
 */

type StrokeIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** 0..1 draw-on progress (paths draw in sequence) */
  draw?: number;
  /** soft glow behind the strokes (0..1) */
  glow?: number;
  style?: React.CSSProperties;
};

type IconDef = {paths: string[]; dots?: [number, number][]};

/** 48x48 icon geometry. */
export const ICON_PATHS: Record<'playbook' | 'mappings' | 'checks', IconDef> = {
  // list: three rules + three round bullets
  playbook: {
    paths: ['M18 14 H39', 'M18 24 H35', 'M18 34 H37'],
    dots: [
      [10.5, 14],
      [10.5, 24],
      [10.5, 34],
    ],
  },
  // two-way arrow
  mappings: {
    paths: ['M9 17 H38', 'M31 10 L38 17 L31 24', 'M39 31 H10', 'M17 24 L10 31 L17 38'],
  },
  // check in a box
  checks: {
    paths: ['M12 8.5 H36 A3.5 3.5 0 0 1 39.5 12 V36 A3.5 3.5 0 0 1 36 39.5 H12 A3.5 3.5 0 0 1 8.5 36 V12 A3.5 3.5 0 0 1 12 8.5 Z', 'M16.5 24.5 L22 30 L32 18.5'],
  },
};

const seqProgress = (draw: number, k: number, n: number) => {
  // each path takes 55% of the timeline, starts staggered evenly
  const span = 0.55;
  const start = n <= 1 ? 0 : (k * (1 - span)) / (n - 1);
  return clamp01((draw - start) / span);
};

export const SkillIcon: React.FC<StrokeIconProps & {kind: 'playbook' | 'mappings' | 'checks'}> = ({
  kind,
  size = 48,
  color = C.violet,
  strokeWidth = 2.6,
  draw = 1,
  glow = 0,
  style,
}) => {
  const def = ICON_PATHS[kind];
  const n = def.paths.length + (def.dots ? 1 : 0);
  const sw = strokeWidth * (48 / size) * (size / 48); // stroke in px at 48 grid
  const body = (
    <>
      {def.paths.map((d, k) => {
        const p = seqProgress(draw, k, n);
        if (p <= 0) return null;
        const ev = evolvePath(p, d);
        return (
          <path
            key={k}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
          />
        );
      })}
      {def.dots
        ? def.dots.map(([x, y], k) => {
            const p = seqProgress(draw, def.paths.length, n);
            const pk = clamp01(p * 3 - k);
            return pk > 0 ? <circle key={`d${k}`} cx={x} cy={y} r={2.4 * pk} fill={color} /> : null;
          })
        : null}
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{overflow: 'visible', ...style}}>
      {glow > 0 ? (
        <g opacity={0.55 * glow} style={{filter: `blur(${(size / 48) * 3}px)`}}>
          {body}
        </g>
      ) : null}
      {body}
    </svg>
  );
};

/** Tile / chip check mark (24 grid). */
export const CHECK_PATH = 'M6.5 12.5 L10.5 16.5 L18 8.5';

export const CheckMark: React.FC<StrokeIconProps> = ({size = 24, color = C.mint, strokeWidth = 2.4, draw = 1, style}) => {
  const p = clamp01(draw);
  if (p <= 0) return <svg width={size} height={size} />;
  const ev = evolvePath(p, CHECK_PATH);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', ...style}}>
      <path
        d={CHECK_PATH}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={ev.strokeDasharray}
        strokeDashoffset={ev.strokeDashoffset}
      />
    </svg>
  );
};

/** Pointy-top hexagon path in a 24 box (ice facet / needs-you badge). */
export const HEX_PATH = 'M12 2.2 L20.5 7.1 V16.9 L12 21.8 L3.5 16.9 V7.1 Z';

/** Small solid/outlined hexagon (ice pill icon). */
export const HexGlyph: React.FC<{size?: number; color?: string; filled?: boolean; strokeWidth?: number}> = ({
  size = 14,
  color = C.ice,
  filled = true,
  strokeWidth = 2,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', display: 'block'}}>
    <path
      d={HEX_PATH}
      fill={filled ? alpha(color, 0.9) : 'none'}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    {filled ? <path d="M12 6.5 L16.8 9.3 V14.7 L12 17.5 L7.2 14.7 V9.3 Z" fill={alpha('#FFFFFF', 0.35)} /> : null}
  </svg>
);

/** Round ember dot with a soft halo (ember pill icon). */
export const DotGlyph: React.FC<{size?: number; color?: string; halo?: boolean}> = ({size = 10, color = C.ember, halo = true}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, ${alpha('#FFFFFF', 0.7)} 0%, ${color} 45%, ${color} 100%)`,
      boxShadow: halo ? `0 0 ${size}px ${alpha(color, 0.8)}` : undefined,
      flexShrink: 0,
    }}
  />
);

/** Hex badge with '!' (needs-you) or a check (converted). size = outer px. */
export const HexBadge: React.FC<{size?: number; color?: string; mark?: '!' | 'check'; draw?: number}> = ({
  size = 30,
  color = C.amber,
  mark = '!',
  draw = 1,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', display: 'block'}}>
    <defs>
      <linearGradient id={`hexb-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={alpha(color, 0.38)} />
        <stop offset="1" stopColor={alpha(color, 0.16)} />
      </linearGradient>
    </defs>
    <path d={HEX_PATH} fill={`url(#hexb-${color.replace('#', '')})`} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    {mark === '!' ? (
      <>
        <path d="M12 7.6 V13" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={draw} />
        <circle cx={12} cy={16.4} r={1.35} fill={color} opacity={draw} />
      </>
    ) : (
      (() => {
        const d = 'M8 12.3 L10.8 15 L16 9.3';
        const ev = evolvePath(clamp01(draw), d);
        return (
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={ev.strokeDasharray}
            strokeDashoffset={ev.strokeDashoffset}
          />
        );
      })()
    )}
  </svg>
);

/** Check inside a soft mint disc (tile check). draw 0..1. */
export const CheckDisc: React.FC<{size?: number; color?: string; draw?: number}> = ({size = 30, color = C.mint, draw = 1}) => {
  const p = clamp01(draw);
  const disc = clamp01(p * 2.2);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 50% 40%, ${alpha(color, 0.3 * disc)} 0%, ${alpha(color, 0.12 * disc)} 70%)`,
        boxShadow: `inset 0 0 0 1px ${alpha(color, 0.55 * disc)}, 0 0 ${size * 0.6}px ${alpha(color, 0.35 * disc)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${0.7 + 0.3 * disc})`,
      }}
    >
      <CheckMark size={size * 0.72} color={color} strokeWidth={2.6} draw={clamp01((p - 0.25) / 0.75)} />
    </div>
  );
};
