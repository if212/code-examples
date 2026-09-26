import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Caret, sliceTokens, typed} from '../../components';
import {C, FONT, TONES, alpha} from '../../theme';
import {SKILL_NAME, STATUS_LINE} from '../../demoData';
import {clamp01, snap} from '../../motion';
import {STATUS, T4} from './timing';

/**
 * The storyboard's status line under the prompt pill (restored in review r2: it restates the match in the
 * agent's own words and balances the otherwise empty lower-left of the frame). A small violet dot pops under the
 * prompt's '›' as the beam lands, then 'Loaded skill: spark-to-snowflake' types at 1f/char in JetBrains Mono
 * 26px Slate; the skill's name is drawn in the violet text tint so it ties to the matched card.
 */

const TOKENS = (() => {
  const i = STATUS_LINE.indexOf(SKILL_NAME);
  if (i < 0) return [{text: STATUS_LINE, color: C.slate}];
  return [
    {text: STATUS_LINE.slice(0, i), color: C.slate},
    {text: STATUS_LINE.slice(i), color: TONES.violet.text},
  ];
})();

export const StatusLine: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const dotP = snap(f, T4.status - 1, fps);
  if (dotP <= 0.002) return null;
  const t = typed(STATUS_LINE, f, T4.status, 1);
  const parts = sliceTokens(TOKENS, t.count);
  const fs = STATUS.fontSize;
  const dot = 10;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: STATUS.dotX - dot / 2,
          top: STATUS.cy - dot / 2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          background: C.violet,
          boxShadow: `0 0 10px ${alpha(C.violet, 0.9)}, 0 0 22px ${alpha(C.violetGlow, 0.5)}`,
          opacity: clamp01(dotP * 1.5),
          transform: `scale(${Math.max(0, dotP).toFixed(3)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: STATUS.textX,
          top: STATUS.cy - fs * 0.7,
          height: fs * 1.4,
          display: 'flex',
          alignItems: 'center',
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: fs,
          lineHeight: 1,
          whiteSpace: 'pre',
          letterSpacing: 0,
          fontFeatureSettings: '"liga" 0, "calt" 0',
        }}
      >
        {parts.map((p, k) => (
          <span key={k} style={{color: p.color}}>
            {p.text}
          </span>
        ))}
        {t.typing ? <Caret on height={Math.round(fs * 1.05)} color={C.slate} glow={false} /> : null}
      </div>
    </AbsoluteFill>
  );
};
