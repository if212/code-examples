import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Beam, Caret, DotGlyph, SkillCard, caretOn, measureWidth, typed, useFontsLoaded} from '../../components';
import {C, EASE, FONT, TONES, alpha} from '../../theme';
import {PROMPT_PILL, SKILL_SHELF} from '../../layout';
import {MATCHED_SHELF_INDEX, PROMPT_GLOW_WORDS, SHELF, SKILL_NAME, STATUS_LINE} from '../../demoData';
import {bell, clamp01, glide, lerp, ramp, reveal, snap} from '../../motion';
import {CARD, CARD_PIVOT, LIFT_SCALE, SHELF_PUSH, STATUS, T4, promptWordCentres} from './timing';

/**
 * The shelf of installed skills (one line each), the matched card (lift, 'matched', light sweep, the request's
 * words lighting up in its description, icon row with only Playbook lit), the beams from the request to the
 * card, and the status line under the pill.
 */

const isGlowWord = (w: string) => (PROMPT_GLOW_WORDS as readonly string[]).includes(w);
const MATCHED = SHELF[MATCHED_SHELF_INDEX];
const FS = 24; // SkillCard line-1 font size
const TRACK = -0.01 * FS;

/* ------------------------------------------------------------------------------------------------
 * Shared per-frame state of the matched card
 * ---------------------------------------------------------------------------------------------- */

export type CardState = {
  lift: number;
  matched: number;
  iconsRow: number;
  playbook: number;
  /** light sweep centre in card-local x (null = none) */
  sweepX: number | null;
  sweepO: number;
};

export const cardState = (f: number, fps: number): CardState => {
  const land = 0.2 * bell(ramp(f, T4.flyTo, T4.flyTo + 14));
  const lift = Math.max(land, glide(f, T4.lift, fps));
  const sweepT = interpolate(f, [T4.sweep, T4.sweep + T4.sweepDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.IN_OUT,
  });
  const sweeping = f >= T4.sweep && f <= T4.sweep + T4.sweepDur + 2;
  return {
    lift,
    matched: snap(f, T4.matched, fps),
    iconsRow: reveal(f, T4.icons, T4.iconsDur),
    playbook: reveal(f, T4.playbook, T4.playbookDur),
    sweepX: f >= T4.sweep ? lerp(-140, CARD.w + 140, sweepT) : null,
    sweepO: sweeping ? bell(clamp01(sweepT * 1.05)) : 0,
  };
};

/** Card-local layout of line 1 (mirrors SkillCard: left 26, folder 28, gap 14, name, gap, '·', gap, description). */
const useLineMetrics = () => {
  useFontsLoaded();
  const nameW = measureWidth(MATCHED.name, `500 ${FS}px ${FONT.mono}`, TRACK);
  const dotW = measureWidth('·', `500 ${FS}px ${FONT.display}`, 0);
  const descX0 = 26 + 28 + 14 + nameW + 14 + dotW + 14;
  const font = `500 ${FS}px ${FONT.display}`;
  const tokens = MATCHED.description.split(' ');
  let idx = 0;
  const words = tokens.map((w) => {
    const x = descX0 + measureWidth(MATCHED.description.slice(0, idx), font, TRACK);
    const width = measureWidth(w, font, TRACK);
    idx += w.length + 1;
    return {w, x, width, glow: isGlowWord(w)};
  });
  return {descX0, words};
};

/* ------------------------------------------------------------------------------------------------
 * Shelf
 * ---------------------------------------------------------------------------------------------- */

export const Shelf: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const {descX0, words} = useLineMetrics();
  const cs = cardState(f, fps);
  const dimP = reveal(f, T4.dim, T4.dimDur);
  const others = SHELF.map((_, k) => k).filter((k) => k !== MATCHED_SHELF_INDEX);
  const cardOn = f >= T4.flyTo;
  const descGlow = cs.sweepX === null ? 0 : 0.6 * clamp01((cs.sweepX - descX0) / 260);
  const l = clamp01(cs.lift);
  const rowH = SKILL_SHELF.iconRowH * clamp01(cs.iconsRow);
  const h = SKILL_SHELF.cardH + rowH;
  const scale = 1 + LIFT_SCALE * l;
  const wordP = (x: number, w: number) => (cs.sweepX === null ? 0 : clamp01((cs.sweepX - x) / Math.max(40, w)));
  return (
    <AbsoluteFill style={{pointerEvents: 'none', isolation: 'isolate'}}>
      {others.map((k, j) => {
        const inP = glide(f, T4.shelfIn[j], fps);
        if (inP <= 0.002) return null;
        const s = SHELF[k];
        const push = k > MATCHED_SHELF_INDEX ? SHELF_PUSH * cs.iconsRow : 0;
        return (
          <SkillCard
            key={s.name}
            name={s.name}
            description={s.description}
            x={CARD.x + 48 * (1 - clamp01(inP))}
            y={SKILL_SHELF.slotY(k) + push}
            opacity={clamp01(inP) * lerp(0.55, 0.3, dimP)}
            blur={2 * dimP + 4 * (1 - clamp01(inP))}
          />
        );
      })}
      {cardOn ? (
        <>
          <SkillCard
            name={MATCHED.name}
            description={MATCHED.description}
            x={CARD.x}
            y={CARD.y}
            lift={cs.lift}
            matched={cs.matched}
            iconsRow={cs.iconsRow}
            accent={1}
            lit={{playbook: cs.playbook}}
            descGlow={descGlow}
          />
          {/* overlay in the card's own frame: light sweep + the request's words lighting up */}
          <div
            style={{
              position: 'absolute',
              left: CARD.x,
              top: CARD.y,
              width: CARD.w,
              height: h,
              transform: ` scale(${scale.toFixed(4)})`,
              transformOrigin: '50% 38px',
              zIndex: 6,
            }}
          >
            {cs.sweepO > 0.005 && cs.sweepX !== null ? (
              <div style={{position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden'}}>
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    bottom: -10,
                    left: cs.sweepX - 130,
                    width: 260,
                    opacity: cs.sweepO,
                    background: `linear-gradient(100deg, ${alpha(C.violet, 0)} 0%, ${alpha(C.violet, 0.22)} 30%, ${alpha('#F3EEFF', 0.34)} 50%, ${alpha(C.violet, 0.22)} 70%, ${alpha(C.violet, 0)} 100%)`,
                    mixBlendMode: 'screen',
                  }}
                />
              </div>
            ) : null}
            <div style={{position: 'absolute', left: 0, top: 0, width: CARD.w, height: SKILL_SHELF.cardH}}>
              {words
                .filter((w) => w.glow)
                .map((w) => {
                  const p = wordP(w.x, w.width);
                  if (p <= 0.002) return null;
                  return (
                    <span
                      key={w.w}
                      style={{
                        position: 'absolute',
                        left: w.x,
                        top: 0,
                        height: SKILL_SHELF.cardH,
                        display: 'flex',
                        alignItems: 'center',
                        fontFamily: FONT.display,
                        fontWeight: 500,
                        fontSize: FS,
                        letterSpacing: '-0.01em',
                        whiteSpace: 'pre',
                        color: C.iceGlow,
                        opacity: p,
                        textShadow: `0 0 12px ${alpha(C.ice, 0.8)}, 0 0 28px ${alpha(C.ice, 0.4)}`,
                      }}
                    >
                      {w.w}
                    </span>
                  );
                })}
            </div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Beams: one from each lit word of the request, merging into the matching card
 * ---------------------------------------------------------------------------------------------- */

export const MatchBeams: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  if (f < T4.beams[0]) return null;
  const cs = cardState(f, fps);
  const s = 1 + LIFT_SCALE * clamp01(cs.lift);
  const P = {x: CARD_PIVOT.x - (CARD.w / 2) * s - 3, y: CARD_PIVOT.y};
  const glowWords = promptWordCentres().filter((w) => isGlowWord(w.word));
  const n = glowWords.length;
  const fade = 1 - 0.6 * ramp(f, T4.beamFadeFrom, T4.beamFadeTo);
  return (
    <>
      {glowWords.map((w, j) => {
        // leftmost word = outer (tallest) arc that lands most vertically, so the arcs nest and never cross
        const outer = n <= 1 ? 1 : 1 - j / (n - 1);
        const sx = w.cx;
        const sy = PROMPT_PILL.y0 + 16;
        const d = [
          `M ${sx.toFixed(1)} ${sy}`,
          `C ${sx.toFixed(1)} ${(sy - 90 - 80 * outer).toFixed(1)},`,
          `${(P.x - 110 + 50 * outer).toFixed(1)} ${(P.y - 130 - 130 * outer).toFixed(1)},`,
          `${P.x.toFixed(1)} ${P.y.toFixed(1)}`,
        ].join(' ');
        const at = T4.beams[Math.min(j, T4.beams.length - 1)];
        const progress = reveal(f, at, T4.beamDur);
        return <Beam key={w.word} id={`s4-beam-${j}`} d={d} progress={progress} from={C.violet} to={C.violet} width={3} opacity={fade} />;
      })}
    </>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Status line under the pill
 * ---------------------------------------------------------------------------------------------- */

export const StatusLine: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const dotP = snap(f, T4.status - 2, fps);
  if (dotP <= 0.002) return null;
  const s = typed(STATUS_LINE, f, T4.status, 1);
  const split = STATUS_LINE.indexOf(SKILL_NAME);
  const a = s.text.slice(0, Math.min(s.count, split));
  const b = s.count > split ? s.text.slice(split) : '';
  const caretShow = f < s.doneAt + 12;
  const pulse = bell(ramp(f, s.doneAt, s.doneAt + 14));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: STATUS.x - 30,
          top: STATUS.cy - 20,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          whiteSpace: 'pre',
        }}
      >
        <div
          style={{
            width: 30,
            display: 'flex',
            justifyContent: 'flex-start',
            transform: `scale(${Math.max(0, dotP).toFixed(3)})`,
            transformOrigin: '6px 50%',
          }}
        >
          <DotGlyph size={11 + 3 * pulse} color={C.violet} />
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: STATUS.size,
            letterSpacing: 0,
            fontFeatureSettings: '"liga" 0, "calt" 0',
            lineHeight: 1,
          }}
        >
          <span style={{color: C.slate}}>{a}</span>
          <span style={{color: TONES.violet.text, textShadow: `0 0 ${(10 + 12 * pulse).toFixed(1)}px ${alpha(C.violet, 0.35 + 0.35 * pulse)}`}}>{b}</span>
        </span>
        {caretShow ? <Caret on={caretOn(f, s.doneAt, s.typing)} height={Math.round(STATUS.size * 1.05)} color={C.slate} glow={false} /> : null}
      </div>
    </AbsoluteFill>
  );
};
