import React from 'react';
import {Cursor, DirectionalBlur} from '../../components';
import {C, FONT, alpha} from '../../theme';

/**
 * The S5 'you' cursor, split into two layers so motion blur never smears the name:
 *  - the arrow (the shared <Cursor> with showLabel={false}) gets the full velocity-driven directional blur;
 *  - the 'you' tag, a pixel-identical copy of the shared Cursor's label pill, gets at most `tagBlurCap` px,
 *    so it stays readable during the skim.
 * At rest (no blur, no press) it renders exactly like <Cursor label="you" .../>, which S6 draws on its first
 * frame, so the S5 -> S6 cut stays seamless.
 */

const TAG_DX = 26;
const TAG_DY = 34;
const DARK = '#0A0D14';

export const ReviewCursor: React.FC<{
  id: string;
  /** tip position (parent coordinates) */
  x: number;
  y: number;
  label: string;
  color?: string;
  opacity?: number;
  scale?: number;
  press?: number;
  tilt?: number;
  /** tip velocity (px/frame) and direction (deg) */
  speed: number;
  angle: number;
  arrowBlurCap?: number;
  tagBlurCap?: number;
}> = ({id, x, y, label, color = C.frost, opacity = 1, scale = 1, press = 0, tilt = 0, speed, angle, arrowBlurCap = 7, tagBlurCap = 1.2}) => {
  if (opacity <= 0.001) return null;
  const s = scale * (1 - 0.1 * press); // the shared Cursor's press squash, applied to the tag as well
  const arrowBlur = Math.min(arrowBlurCap, speed * 0.08);
  const tagBlur = Math.min(tagBlurCap, speed * 0.012);
  return (
    <>
      {/* arrow (and click ring): full motion blur */}
      <div style={{position: 'absolute', left: x - 60, top: y - 60}}>
        <DirectionalBlur id={`${id}-arrow`} amount={arrowBlur} angle={angle}>
          <div style={{position: 'relative', width: 120, height: 120}}>
            <Cursor x={60} y={60} opacity={opacity} scale={scale} press={press} tilt={tilt} showLabel={false} />
          </div>
        </DirectionalBlur>
      </div>
      {/* name tag: capped blur so it stays legible while moving */}
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
          zIndex: 51,
        }}
      >
        <DirectionalBlur id={`${id}-tag`} amount={tagBlur} angle={angle} style={{position: 'absolute', left: TAG_DX, top: TAG_DY}}>
          <div
            style={{
              padding: '6px 13px 6px',
              borderRadius: 10,
              borderTopLeftRadius: 3,
              background: `linear-gradient(180deg, ${color} 0%, ${alpha(color, 0.86)} 100%)`,
              boxShadow: `0 8px 20px -6px rgba(0,0,0,0.7), 0 0 22px ${alpha(color, 0.35)}, inset 0 1px 0 rgba(255,255,255,0.5)`,
              color: DARK,
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
        </DirectionalBlur>
      </div>
    </>
  );
};
