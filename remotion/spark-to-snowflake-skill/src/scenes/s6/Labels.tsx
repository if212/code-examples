import React from 'react';
import {C, FONT, TONES, Tone, alpha} from '../../theme';
import {DotGlyph, HexGlyph} from '../../components';
import {COPY} from '../../demoData';
import {clamp01, lerp} from '../../motion';

/**
 * Small label pieces shared by the code column and the result stack:
 *  - ChipShell: the glass Chip look (same recipe as components/Glass Chip) but with arbitrary children, so
 *    the 'as-is' word can be struck through without changing the copy.
 *  - AsIsLabel: 'as-is on Snowflake' with an optional strike through 'as-is' (0..1). After ' NULLS LAST' is
 *    added the line is no longer as-is, so the word is struck (the copy itself stays verbatim).
 */

const [AS_IS_WORD, ...REST] = COPY.s6LabelAfter.split(' ');
const AFTER_REST = REST.join(' ');

export const ToneIcon: React.FC<{tone: Tone; size: number}> = ({tone, size}) =>
  tone === 'ice' ? <HexGlyph size={Math.round(size * 0.72)} color={TONES.ice.main} /> : <DotGlyph size={Math.round(size * 0.5)} color={TONES[tone].main} />;

export const ChipShell: React.FC<{tone: Tone; size: number; icon?: React.ReactNode; glow?: number; children: React.ReactNode}> = ({
  tone,
  size,
  icon,
  glow = 0,
  children,
}) => {
  const t = TONES[tone];
  const h = Math.round(size * 1.75);
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.45),
        height: h,
        padding: `0 ${Math.round(size * 0.72)}px`,
        borderRadius: Math.round(h * 0.36),
        background: `linear-gradient(180deg, ${alpha(t.main, 0.18)} 0%, ${alpha(t.main, 0.08)} 100%)`,
        boxShadow: [
          `inset 0 0 0 1px ${alpha(t.main, 0.5)}`,
          `inset 0 1px 0 ${alpha('#FFFFFF', 0.12)}`,
          glow > 0 ? `0 0 ${Math.round(26 * glow)}px ${alpha(t.main, 0.42 * glow)}` : null,
        ]
          .filter(Boolean)
          .join(', '),
        color: t.text,
        fontFamily: FONT.display,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      {icon}
      <span style={{transform: 'translateY(0.03em)'}}>{children}</span>
    </div>
  );
};

/** 'as-is on Snowflake' with a drawn strike through 'as-is'. */
export const AsIsLabel: React.FC<{strike: number; color: string}> = ({strike, color}) => {
  const s = clamp01(strike);
  return (
    <span style={{whiteSpace: 'nowrap'}}>
      <span style={{position: 'relative', display: 'inline-block', opacity: lerp(1, 0.42, s)}}>
        {AS_IS_WORD}
        {s > 0.001 ? (
          <span
            style={{
              position: 'absolute',
              left: -2,
              top: '54%',
              height: 2,
              width: `calc(${(s * 100).toFixed(2)}% + 4px)`,
              borderRadius: 1,
              background: color,
              boxShadow: `0 0 6px ${alpha(C.frost, 0.35)}`,
            }}
          />
        ) : null}
      </span>
      {` ${AFTER_REST}`}
    </span>
  );
};
