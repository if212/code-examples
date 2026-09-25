import React from 'react';
import {C, FONT, alpha} from '../theme';

/**
 * Labelled pointer. (x, y) is the TIP position in the coordinate space of its parent (canvas px when placed
 * directly in an AbsoluteFill). 'you' = Frost; teammates use C.pink / C.lime / C.silver.
 */
export type CursorProps = {
  x: number;
  y: number;
  label?: string;
  color?: string;
  opacity?: number;
  scale?: number;
  /** 0..1 click press (tip squash + ring) */
  press?: number;
  /** show the label pill */
  showLabel?: boolean;
  /** rotate the arrow a few degrees (natural hand angle) */
  tilt?: number;
};

const ARROW = 'M2 1.5 L2 25.5 L8.2 19.6 L12.4 29.2 L16.6 27.4 L12.5 17.9 L21 17.6 Z';

export const Cursor: React.FC<CursorProps> = ({x, y, label, color = C.frost, opacity = 1, scale = 1, press = 0, showLabel = true, tilt = 0}) => {
  const s = scale * (1 - 0.1 * press);
  const dark = '#0A0D14';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 0,
        height: 0,
        opacity,
        transform: `scale(${s.toFixed(4)})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {press > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: -26,
            top: -26,
            width: 52,
            height: 52,
            borderRadius: '50%',
            boxShadow: `0 0 0 2px ${alpha(color, 0.6 * press)}, 0 0 24px ${alpha(color, 0.4 * press)}`,
            transform: `scale(${(0.5 + 0.7 * press).toFixed(3)})`,
          }}
        />
      ) : null}
      <svg
        width={40}
        height={44}
        viewBox="0 0 24 32"
        style={{position: 'absolute', left: -3.4, top: -2.6, overflow: 'visible', transform: `rotate(${tilt}deg)`, transformOrigin: '3px 2px'}}
      >
        <defs>
          <linearGradient id={`cur-${color.replace('#', '')}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <path d={ARROW} fill="rgba(0,0,0,0.45)" transform="translate(1.2 2.2)" style={{filter: 'blur(1.6px)'}} />
        <path d={ARROW} fill={`url(#cur-${color.replace('#', '')})`} stroke={dark} strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
      {showLabel && label ? (
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 34,
            padding: '6px 13px 6px',
            borderRadius: 10,
            borderTopLeftRadius: 3,
            background: `linear-gradient(180deg, ${color} 0%, ${alpha(color, 0.86)} 100%)`,
            boxShadow: `0 8px 20px -6px rgba(0,0,0,0.7), 0 0 22px ${alpha(color, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.5)`,
            color: dark,
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 21,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};
