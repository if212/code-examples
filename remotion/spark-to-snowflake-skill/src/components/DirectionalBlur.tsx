import React from 'react';

/**
 * Cheap velocity-driven motion blur: SVG feGaussianBlur with stdDeviation "amount 0" along the direction of
 * travel. `angle` (deg, 0 = +x, 90 = +y) rotates the blur axis: the wrapper rotates by `angle`, blurs along
 * its local x, and counter-rotates the content so it stays upright.
 *
 * Put it around LEAF content (a note, a card, a board layer) — never around a preserve-3d element.
 * `id` must be unique on the frame (use a stable string, e.g. `note-${i}`).
 *
 *   const v = velocity2D((f) => pathPoint(f), frame);
 *   <DirectionalBlur id={`note-${i}`} amount={v.speed * 0.35} angle={v.angle}> ... </DirectionalBlur>
 */
export const DirectionalBlur: React.FC<{
  id: string;
  /** blur std-dev in px along the axis (0 = no filter). Typical: speed(px/frame) * 0.3, capped ~24 */
  amount: number;
  /** direction in degrees */
  angle?: number;
  /** small cross-axis blur (px) */
  cross?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({id, amount, angle = 0, cross = 0, style, children}) => {
  const a = Math.min(40, Math.max(0, amount));
  const fid = `dblur-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (a < 0.3 && cross < 0.3) return <div style={style}>{children}</div>;
  const rotated = Math.abs(angle % 180) > 0.5;
  const filterEl = (
    <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
      <defs>
        <filter id={fid} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${a.toFixed(2)} ${cross.toFixed(2)}`} />
        </filter>
      </defs>
    </svg>
  );
  if (!rotated) {
    return (
      <div style={style}>
        {filterEl}
        <div style={{filter: `url(#${fid})`}}>{children}</div>
      </div>
    );
  }
  return (
    <div style={style}>
      {filterEl}
      <div style={{transform: `rotate(${angle}deg)`}}>
        <div style={{filter: `url(#${fid})`}}>
          <div style={{transform: `rotate(${-angle}deg)`}}>{children}</div>
        </div>
      </div>
    </div>
  );
};
