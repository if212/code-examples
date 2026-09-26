import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {evolvePath, getLength, getPointAtLength} from '@remotion/paths';
import {Pill, SkillCard, measureWidth, useFontsLoaded} from '../../components';
import {C, FONT, TYPE, alpha} from '../../theme';
import {PROMPT_PILL, SKILL_SHELF} from '../../layout';
import {COPY, MATCHED_SHELF_INDEX, PROMPT_GLOW_WORDS, SHELF} from '../../demoData';
import {bell, clamp01, glide, lerp, ramp, reveal, snap} from '../../motion';
import {CARD, CARD_PIVOT, CARD_RISE, LIFT_SCALE, SHELF_PUSH, T4, promptWordCentres} from './timing';
import {SHELF_LABEL} from './copy';

/**
 * The shelf of installed skills (one line each, under a small 'Your skills' label), the matched card (lift +
 * rise, 'matched', light pulse, icon row with only Playbook lit) and the match beam: a violet trace rises from
 * each lit word of the request, the two traces join above the pill and continue as ONE beam that plugs into the
 * left edge of the matching card (review r2: the old word-to-word arcs had interleaved ends, so they crossed and
 * ran over the other cards). The landing launches a light pulse along the card that lights the same two words in
 * its description, so 'this request -> this skill, because of these words' still reads.
 */

const isGlowWord = (w: string) => (PROMPT_GLOW_WORDS as readonly string[]).includes(w);
const MATCHED = SHELF[MATCHED_SHELF_INDEX];
const FS = 24; // SkillCard line-1 font size
const TRACK = -0.01 * FS;
/** Cards above the matched one make a little room as it lifts. */
const ROOM_UP = 18;

/* ------------------------------------------------------------------------------------------------
 * Beam timing (the landing drives the card's reaction)
 * ---------------------------------------------------------------------------------------------- */

/** Traces accelerate towards the merge point (they arrive moving, so the joined beam carries on). */
const LEG_EASE = Easing.bezier(0.42, 0, 0.8, 0.7);
/** The joined beam leaves the merge fast and lands softly on the card. */
const TRUNK_EASE = Easing.bezier(0.25, 0.6, 0.3, 1);
/** The light pulse along the card: launched by the landing, then eases out to the far end. */
const SWEEP_EASE = Easing.bezier(0.3, 0.45, 0.35, 1);
/** Progress at which the beam counts as landed. */
const LANDED = 0.97;

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const legProgress = (f: number, j: number) => {
  const leg = T4.legs[Math.min(j, T4.legs.length - 1)];
  return interpolate(f, [leg.at, leg.at + leg.dur], [0, 1], {...CLAMP, easing: LEG_EASE});
};
const trunkProgress = (f: number) => interpolate(f, [T4.trunk, T4.trunk + T4.trunkDur], [0, 1], {...CLAMP, easing: TRUNK_EASE});

/** First local frame at which the joined beam has landed on the card. */
const LAND: number = (() => {
  for (let k = 0; k <= T4.trunkDur; k++) if (trunkProgress(T4.trunk + k) >= LANDED) return T4.trunk + k;
  return T4.trunk + T4.trunkDur;
})();
/** The pulse leaves the landing point one frame before the head fully settles; 'matched' pops on the landing. */
const SWEEP_AT = LAND - 1;
const MATCHED_AT = LAND;

/* ------------------------------------------------------------------------------------------------
 * Shared per-frame state of the matched card
 * ---------------------------------------------------------------------------------------------- */

export type CardState = {
  /** 0..1(+) lift (landing bump, then GLIDE) */
  lift: number;
  /** current scale about CARD_PIVOT */
  scale: number;
  /** current rise (px, upwards) */
  rise: number;
  matched: number;
  iconsRow: number;
  playbook: number;
  /** light pulse centre in card-local x (null = not launched yet; stays at the far end afterwards) */
  sweepX: number | null;
  sweepO: number;
};

export const cardState = (f: number, fps: number): CardState => {
  const land = 0.2 * bell(ramp(f, T4.flyTo, T4.flyTo + 14));
  const lift = Math.max(land, glide(f, T4.lift, fps));
  const l = clamp01(lift);
  const sweepT = interpolate(f, [SWEEP_AT, SWEEP_AT + T4.sweepDur], [0, 1], {...CLAMP, easing: SWEEP_EASE});
  const sweepO = f >= SWEEP_AT ? ramp(f, SWEEP_AT, SWEEP_AT + 2) * (1 - ramp(sweepT, 0.55, 1)) : 0;
  return {
    lift,
    scale: 1 + LIFT_SCALE * l,
    rise: CARD_RISE * l,
    matched: snap(f, MATCHED_AT, fps),
    iconsRow: reveal(f, T4.icons, T4.iconsDur),
    playbook: reveal(f, T4.playbook, T4.playbookDur),
    sweepX: f >= SWEEP_AT ? lerp(-40, CARD.w + 140, sweepT) : null,
    sweepO,
  };
};

/** Card-local point -> canvas point, for the card at scale `s` (about CARD_PIVOT) risen by `rise`. */
const cardToCanvas = (lx: number, ly: number, cs: CardState) => ({
  x: CARD_PIVOT.x + (lx - CARD.w / 2) * cs.scale,
  y: CARD_PIVOT.y + (ly - 38) * cs.scale - cs.rise,
});

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
 * Beam plan: two word traces -> merge point above the pill -> one beam into the card's left edge
 * ---------------------------------------------------------------------------------------------- */

/** Beam start: just above the prompt text's cap line (inside the pill's top padding). */
const START_Y = PROMPT_PILL.y0 + 18;
/** Height of the joined line above the pill (the pill top is at y552): it brackets the request's words. */
const BUS_Y = 490;
/** The traces join this far right of the last lit word, still over the pill. */
const MERGE_DX = 70;
/** The joined beam arrives at the card's left edge (card-local x) on line 1, at ~48 degrees. */
const END_LOCAL_X = -2;
const ARRIVE = {dx: 50, dy: 56};

type BeamPlan = {
  legs: {word: string; d: string}[];
  merge: {x: number; y: number};
  trunk: string;
  end: {x: number; y: number};
};

const f1 = (v: number) => v.toFixed(1);

const beamPlan = (f: number, fps: number): BeamPlan => {
  const cs = cardState(f, fps);
  const lit = promptWordCentres().filter((w) => isGlowWord(w.word));
  const merge = {x: lit[lit.length - 1].cx + MERGE_DX, y: BUS_Y};
  // each trace leaves its word straight up and eases into the horizontal line (no crossings: they meet at `merge`)
  const legs = lit.map((w) => {
    const x0 = w.cx;
    const c2x = x0 + 0.4 * (merge.x - x0);
    return {
      word: w.word,
      d: `M ${f1(x0)} ${f1(START_Y)} C ${f1(x0)} ${f1(BUS_Y)}, ${f1(c2x)} ${f1(BUS_Y)}, ${f1(merge.x)} ${f1(merge.y)}`,
    };
  });
  const end = cardToCanvas(END_LOCAL_X, 38, cs);
  const c1x = merge.x + 0.36 * (end.x - merge.x);
  const trunk = `M ${f1(merge.x)} ${f1(merge.y)} C ${f1(c1x)} ${f1(BUS_Y)}, ${f1(end.x - ARRIVE.dx)} ${f1(end.y - ARRIVE.dy)}, ${f1(end.x)} ${f1(end.y)}`;
  return {legs, merge, trunk, end};
};

/** Per-word 'lit' progress of the description words: each lights as the landing pulse passes it. */
const wordLit = (cs: CardState, w: {x: number; width: number}): number => {
  if (cs.sweepX === null) return 0;
  return clamp01((cs.sweepX - (w.x + w.width / 2) + 70) / 110);
};

/* ------------------------------------------------------------------------------------------------
 * 'Your skills' label over the shelf
 * ---------------------------------------------------------------------------------------------- */

const LABEL_FS = 18;
const ShelfLabel: React.FC<{f: number; dimP: number}> = ({f, dimP}) => {
  const p = reveal(f, T4.shelfLabel, T4.shelfLabelDur);
  if (p <= 0.002) return null;
  const cy = SKILL_SHELF.y0 - 30 - ROOM_UP * dimP;
  return (
    <div
      style={{
        position: 'absolute',
        left: CARD.x + 26,
        top: cy - 12,
        width: CARD.w - 26,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity: p * lerp(0.95, 0.7, dimP),
        transform: `translateY(${(10 * (1 - p)).toFixed(2)}px)`,
      }}
    >
      <span
        style={{
          fontFamily: FONT.display,
          fontWeight: 600,
          fontSize: LABEL_FS,
          lineHeight: 1,
          letterSpacing: TYPE.pillTracking,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: C.slate,
        }}
      >
        {SHELF_LABEL}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          transformOrigin: '0 50%',
          transform: `scaleX(${p.toFixed(3)})`,
          background: `linear-gradient(90deg, ${alpha(C.slate, 0.4)} 0%, ${alpha(C.slate, 0.12)} 60%, ${alpha(C.slate, 0)} 100%)`,
        }}
      />
    </div>
  );
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
  const cardTransform = `translateY(${(-cs.rise).toFixed(2)}px) scale(${cs.scale.toFixed(4)})`;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', isolation: 'isolate'}}>
      <ShelfLabel f={f} dimP={dimP} />
      {others.map((k, j) => {
        const inP = glide(f, T4.shelfIn[j], fps);
        if (inP <= 0.002) return null;
        const s = SHELF[k];
        // below: slide down to make room for the icon row (less the card's own rise); above: nudge up
        const push = k > MATCHED_SHELF_INDEX ? Math.max(0, SHELF_PUSH * cs.iconsRow - CARD_RISE * l) : -ROOM_UP * dimP;
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
          {/* extra ink backing: the light axis (y600) runs behind the risen card and must not show through */}
          {l > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: CARD.x,
                top: CARD.y,
                width: CARD.w,
                height: h,
                borderRadius: 18,
                background: alpha(C.ink, 0.62 * l),
                transform: cardTransform,
                transformOrigin: '50% 38px',
                zIndex: 4,
              }}
            />
          ) : null}
          <SkillCard
            name={MATCHED.name}
            description={MATCHED.description}
            x={CARD.x}
            y={CARD.y}
            lift={cs.lift}
            matched={0}
            iconsRow={cs.iconsRow}
            accent={1}
            lit={{playbook: cs.playbook}}
            descGlow={descGlow}
            transform={`translateY(${(-cs.rise).toFixed(2)}px)`}
          />
          {/* overlay in the card's own frame: light sweep + the request's words lighting up as the beams land */}
          <div
            style={{
              position: 'absolute',
              left: CARD.x,
              top: CARD.y,
              width: CARD.w,
              height: h,
              transform: cardTransform,
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
                    background: `linear-gradient(100deg, ${alpha(C.violet, 0)} 0%, ${alpha(C.violet, 0.22)} 30%, ${alpha(C.whiteHot, 0.3)} 50%, ${alpha(C.violet, 0.22)} 70%, ${alpha(C.violet, 0)} 100%)`,
                    mixBlendMode: 'screen',
                  }}
                />
              </div>
            ) : null}
            {/* 'matched' rides the top-LEFT edge, over the skill's name (with the rise it clears the light axis) */}
            {cs.matched > 0.001 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  top: -16,
                  transform: `scale(${Math.max(0, cs.matched).toFixed(3)})`,
                  transformOrigin: '20% 50%',
                  opacity: Math.min(1, cs.matched * 1.6),
                }}
              >
                <Pill label={COPY.s4Tag} tone="violet" icon="dot" size={15} solid glow={0.9} />
              </div>
            ) : null}
            <div style={{position: 'absolute', left: 0, top: 0, width: CARD.w, height: SKILL_SHELF.cardH}}>
              {words
                .filter((w) => w.glow)
                .map((w) => {
                  const p = wordLit(cs, w);
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
 * Beams: two word traces join into one beam that plugs into the matching card
 * ---------------------------------------------------------------------------------------------- */

/** One beam path: an 8px screen-blended glow copy under a 2px violet core with a hairline white-hot centre. */
const LinkBeam: React.FC<{id: string; d: string; progress: number; opacity: number; head?: boolean}> = ({
  id,
  d,
  progress,
  opacity,
  head = true,
}) => {
  const p = clamp01(progress);
  if (p <= 0 || opacity <= 0.002) return null;
  const ev = evolvePath(p, d);
  const len = getLength(d);
  const tip = getPointAtLength(d, len * p) ?? {x: 0, y: 0};
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let k = 0; k <= 16; k++) {
    const pt = getPointAtLength(d, (len * k) / 16) ?? {x: 0, y: 0};
    minX = Math.min(minX, pt.x);
    minY = Math.min(minY, pt.y);
    maxX = Math.max(maxX, pt.x);
    maxY = Math.max(maxY, pt.y);
  }
  const pad = 30;
  const dash = {strokeDasharray: ev.strokeDasharray, strokeDashoffset: ev.strokeDashoffset};
  const headO = head ? 1 - ramp(p, 0.9, 1) : 0;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x={minX - pad} y={minY - pad} width={maxX - minX + 2 * pad} height={maxY - minY + 2 * pad}>
            <feGaussianBlur stdDeviation={4} />
          </filter>
        </defs>
        <path
          d={d}
          fill="none"
          stroke={C.violet}
          strokeWidth={8}
          strokeLinecap="round"
          opacity={0.7}
          filter={`url(#${id}-glow)`}
          style={{mixBlendMode: 'screen'}}
          {...dash}
        />
        <path d={d} fill="none" stroke={C.violet} strokeWidth={2} strokeLinecap="round" {...dash} />
        <path d={d} fill="none" stroke={C.whiteHot} strokeOpacity={0.6} strokeWidth={0.8} strokeLinecap="round" {...dash} />
      </svg>
      {headO > 0.01 ? <Glint x={tip.x} y={tip.y} size={64} opacity={headO} /> : null}
    </AbsoluteFill>
  );
};

/** White-hot point with a violet halo (beam heads, the merge flash). */
const Glint: React.FC<{x: number; y: number; size: number; opacity: number}> = ({x, y, size, opacity}) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      opacity,
      background: `radial-gradient(circle, ${C.whiteHot} 0%, ${alpha(C.whiteHot, 0.85)} 9%, ${alpha(C.violet, 0.4)} 26%, ${alpha(C.violet, 0)} 62%)`,
    }}
  />
);

export const MatchBeams: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  if (f < T4.legs[0].at) return null;
  // the beam has done its job once the card has reacted: it fades out completely (review r2)
  const fade = 1 - ramp(f, T4.beamFadeFrom, T4.beamFadeTo);
  if (fade <= 0.002) return null;
  const plan = beamPlan(f, fps);
  const trunkP = trunkProgress(f);
  // the traces meet: a short white-hot flash at the join, then the joined beam carries on
  const mergeFlash = bell(ramp(f, T4.trunk - 1, T4.trunk + 8));
  // landing flare on the card's left edge
  const flare = bell(ramp(f, LAND - 1, LAND + 13));
  return (
    <>
      {plan.legs.map((leg, j) => {
        const p = legProgress(f, j);
        return <LinkBeam key={leg.word} id={`s4-leg-${j}`} d={leg.d} progress={p} opacity={fade} head={p < 0.999} />;
      })}
      <LinkBeam id="s4-trunk" d={plan.trunk} progress={trunkP} opacity={fade} />
      {mergeFlash > 0.01 ? <Glint x={plan.merge.x} y={plan.merge.y} size={96} opacity={mergeFlash * fade} /> : null}
      {flare > 0.01 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: plan.end.x - 100,
              top: plan.end.y - 70,
              width: 200,
              height: 140,
              opacity: flare,
              background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${alpha(C.whiteHot, 0.9)} 0%, ${alpha(C.iceGlow, 0.55)} 18%, ${alpha(C.violet, 0.25)} 42%, ${alpha(C.violet, 0)} 100%)`,
              mixBlendMode: 'screen',
            }}
          />
          <Glint x={plan.end.x} y={plan.end.y} size={56} opacity={flare} />
        </>
      ) : null}
    </>
  );
};
