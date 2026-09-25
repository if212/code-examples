import React from 'react';
import {AbsoluteFill, interpolateColors} from 'remotion';
import {Caret, GlassPanel, Hairline, caretOn, typed} from '../../components';
import {C, FONT, alpha} from '../../theme';
import {PROMPT_PILL} from '../../layout';
import {PROMPT_GLOW_WORDS, PROMPT_GLYPH, PROMPT_TEXT} from '../../demoData';
import {bell, clamp01, glide, ramp, reveal} from '../../motion';
import {GLYPH_GAP, PILL_PAD_L, PROMPT_FONT, T4} from './timing';

/**
 * The flat glass prompt pill (no terminal chrome). It glides in, types the request at 2f/char with a caret,
 * and on Enter presses, pulses a light ring and lights the words the skill will match in ice.
 */

const isGlowWord = (w: string) => (PROMPT_GLOW_WORDS as readonly string[]).includes(w);

const MONO: React.CSSProperties = {
  fontFamily: FONT.mono,
  fontWeight: 500,
  fontSize: PROMPT_FONT,
  whiteSpace: 'pre',
  fontFeatureSettings: '"liga" 0, "calt" 0',
  letterSpacing: 0,
  lineHeight: 1,
};

export const PromptPill: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const inP = glide(f, T4.pillIn, fps);
  if (inP <= 0.002) return null;
  const p = typed(PROMPT_TEXT, f, T4.type, 2);
  const entered = f >= T4.enter;
  const glowP = reveal(f, T4.enter, T4.glowDur);
  const press = bell(ramp(f, T4.enter, T4.enter + 7));
  const scale = (0.965 + 0.035 * clamp01(inP)) * (1 - 0.014 * press);
  const rimFlash = bell(ramp(f, T4.enter, T4.enter + 14));
  const glyphHot = bell(ramp(f, T4.enter - 1, T4.enter + 10));

  // words, sliced to the typed count
  const words = PROMPT_TEXT.split(' ');
  let left = p.count;
  const spans: React.ReactNode[] = [];
  words.forEach((w, i) => {
    if (left <= 0) return;
    const vis = w.slice(0, left);
    left -= w.length;
    const glow = isGlowWord(w) ? glowP : 0;
    spans.push(
      <span
        key={`w${i}`}
        style={
          glow > 0
            ? {
                color: interpolateColors(glow, [0, 1], [C.frost, C.iceGlow]),
                textShadow: `0 0 ${(16 * glow).toFixed(1)}px ${alpha(C.ice, 0.85 * glow)}, 0 0 ${(38 * glow).toFixed(1)}px ${alpha(C.ice, 0.45 * glow)}`,
              }
            : undefined
        }
      >
        {vis}
      </span>,
    );
    if (left > 0 && i < words.length - 1) {
      spans.push(<span key={`s${i}`}>{' '}</span>);
      left -= 1;
    }
  });

  const showCaret = !entered;
  const caretVisible = caretOn(f, f < T4.type ? T4.pillIn : p.doneAt, p.typing);

  // Enter ring: grows out of the pill's outline, 0.6 -> 0 over 20f
  const ringP = reveal(f, T4.enter, T4.ringDur);
  const ringO = entered ? 0.6 * (1 - ramp(f, T4.enter, T4.enter + T4.ringDur)) : 0;
  const d = 56 * ringP;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {ringO > 0.005 ? (
        <div
          style={{
            position: 'absolute',
            left: PROMPT_PILL.x0 - d,
            top: PROMPT_PILL.y0 - d * 0.62,
            width: PROMPT_PILL.w + 2 * d,
            height: PROMPT_PILL.h + 2 * d * 0.62,
            borderRadius: PROMPT_PILL.radius + d,
            boxShadow: [
              `0 0 0 1.5px ${alpha(C.whiteHot, ringO)}`,
              `0 0 22px ${alpha(C.violet, 0.9 * ringO)}`,
              `inset 0 0 22px ${alpha(C.violet, 0.6 * ringO)}`,
            ].join(', '),
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: PROMPT_PILL.x0,
          top: PROMPT_PILL.y0,
          width: PROMPT_PILL.w,
          height: PROMPT_PILL.h,
          opacity: clamp01(inP * 1.3),
          transform: `translateY(${(22 * (1 - clamp01(inP))).toFixed(2)}px) scale(${scale.toFixed(4)})`,
          transformOrigin: '50% 50%',
        }}
      >
        <GlassPanel width={PROMPT_PILL.w} height={PROMPT_PILL.h} radius={PROMPT_PILL.radius} glow={0.22 + 0.5 * rimFlash} backing={0.9} lifted>
          {rimFlash > 0.01 ? (
            <Hairline
              radius={PROMPT_PILL.radius}
              width={1.5}
              opacity={rimFlash}
              color={`linear-gradient(110deg, #E4DAFF 0%, ${C.violet} 35%, ${C.whiteHot} 60%, ${C.violet} 100%)`}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: PILL_PAD_L,
              top: 0,
              height: PROMPT_PILL.h,
              display: 'flex',
              alignItems: 'center',
              gap: GLYPH_GAP,
              color: C.frost,
              ...MONO,
            }}
          >
            <span
              style={{
                color: interpolateColors(glyphHot, [0, 1], [C.violet, '#F1EBFF']),
                textShadow: `0 0 ${(10 + 14 * glyphHot).toFixed(1)}px ${alpha(C.violet, 0.55 + 0.4 * glyphHot)}`,
              }}
            >
              {PROMPT_GLYPH}
            </span>
            <span style={{display: 'inline-flex', alignItems: 'center'}}>
              <span>{spans}</span>
              {showCaret ? <Caret on={caretVisible} height={Math.round(PROMPT_FONT * 1.05)} color={C.frost} /> : null}
            </span>
          </div>
        </GlassPanel>
      </div>
    </AbsoluteFill>
  );
};
