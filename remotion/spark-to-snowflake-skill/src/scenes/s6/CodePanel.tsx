import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Caret, Tag, caretOn, measureWidth, sliceTokens, typedCount, useFontsLoaded} from '../../components';
import {C, EASE, FONT, SHADOW, alpha} from '../../theme';
import {CODE_BEFORE, CODE_INSERT, CODE_TOKENS, JOB_FILES, TRAP_INDEX} from '../../demoData';
import {bell, clamp01, lerp, ramp, reveal, snap} from '../../motion';
import {CODE, PANEL, STACK, trapScreen} from './geometry';
import {StateChip} from './Labels';
import type {ChipStage} from './Labels';
import {S6_COPY} from './copy';
import {T6} from './timing';

/**
 * The flat code panel (1280x400 at 320,400, Code BG). Its box is born from the trap tile's screen rect and
 * morphs to the panel rect while the tile dissolves under it (lf6-19). Inside: the filename header with the
 * by-hand callback tag ('missed by hand' -> 'caught'), ONE label chip ('Spark SQL' -> 'as-is on Snowflake' ->
 * check 'on Snowflake'), the one code line filled in fast, and later ' NULLS LAST' typed in mint over a mint wash.
 */

const MONO_FONT = `500 ${CODE.size}px "JetBrains Mono"`;
const TRACK_PX = CODE.trackingEm * CODE.size;

/** width of a code string as rendered (mono, tracked) */
export const codeWidth = (s: string): number => measureWidth(s, MONO_FONT, TRACK_PX);

/** x where the inserted word starts (after the leading space of ' NULLS LAST') */
export const insertX = (): number => CODE.x + codeWidth(CODE_BEFORE + CODE_INSERT.slice(0, CODE_INSERT.length - CODE_INSERT.trimStart().length));

/* -------------------------------------------------------------------------------------------------------- */

export const PanelBox: React.FC<{f: number}> = ({f}) => {
  if (f < T6.morphFrom) return null;
  // the box rides the tile's rect first, then flattens into the panel (ease in-out, no pop)
  const m = interpolate(f, [T6.morphStart, T6.morphStart + T6.morphDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.IN_OUT,
  });
  const t = trapScreen(f);
  const x = lerp(t.x, PANEL.x, m);
  const y = lerp(t.y, PANEL.y, m);
  const w = lerp(t.w, PANEL.w, m);
  const h = lerp(t.h, PANEL.h, m);
  const r = lerp(18 * t.s, PANEL.r, m);
  const o = ramp(f, T6.morphFrom, T6.morphFrom + 5);
  const iceT = 1 - m; // the ice tile tint fades out as it flattens into code
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: r,
          opacity: o,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 22%)',
            `radial-gradient(120% 90% at 0% 0%, ${alpha(C.ice, 0.1 * iceT + 0.035)} 0%, ${alpha(C.ice, 0)} 60%)`,
            `linear-gradient(180deg, ${alpha(C.codeBg, 0.94)} 0%, ${alpha(C.codeBg, 0.97)} 100%)`,
          ].join(', '),
          boxShadow: [SHADOW.lifted, `0 0 90px ${alpha(C.ice, 0.09)}`, `0 0 0 1px ${alpha(C.ice, 0.05)}`].join(', '),
        }}
      >
        {/* 1px hairline, brighter top-left, faint ice */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: r,
            padding: 1,
            background: `linear-gradient(160deg, rgba(255,255,255,0.30) 0%, ${alpha(C.iceGlow, 0.16)} 30%, rgba(255,255,255,0.05) 62%, ${alpha(C.ice, 0.14)} 100%)`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------------------------------------- */

/**
 * Filename header + the by-hand callback to S1. A quiet coral 'missed by hand' tag fades in only after the panel
 * has landed (never on the push-in, where the tile already shows a mint check). When the fix lands it hands over
 * to a mint 'caught' tag, so the payoff reads: you missed it by hand, the skill catches it.
 */
const Header: React.FC<{f: number}> = ({f}) => {
  const p = reveal(f, T6.header, 14);
  if (p <= 0.001) return null;
  const hand = reveal(f, T6.handTag, T6.handTagDur);
  const handOut = reveal(f, T6.caught, 6, EASE.IN_OUT);
  const caught = snap(f, T6.caught + 6);
  const handO = 0.8 * hand * (1 - handOut);
  return (
    <div
      style={{
        position: 'absolute',
        left: CODE.x,
        top: CODE.fileY,
        transform: `translateY(-50%) translateY(${(8 * (1 - p)).toFixed(2)}px)`,
        opacity: p,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: 22,
          color: alpha(C.slate, 0.95),
          letterSpacing: '-0.01em',
          fontFeatureSettings: '"liga" 0, "calt" 0',
          lineHeight: 1,
        }}
      >
        {JOB_FILES[TRAP_INDEX]}
      </span>
      <span style={{position: 'relative', display: 'inline-block', height: 28}}>
        {handO > 0.001 ? (
          <span
            style={{
              display: 'inline-block',
              transform: `translateX(${(-8 * (1 - hand)).toFixed(2)}px) scale(${(1 - 0.12 * handOut).toFixed(4)})`,
              transformOrigin: '0% 50%',
              opacity: handO,
            }}
          >
            <Tag label={S6_COPY.missedByHand} tone="coral" glow={0.3} />
          </span>
        ) : null}
        {caught > 0.001 ? (
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              display: 'inline-block',
              transform: `scale(${Math.max(0, caught).toFixed(4)})`,
              transformOrigin: '0% 50%',
              opacity: clamp01(caught * 1.6),
            }}
          >
            <Tag label={S6_COPY.caught} tone="mint" icon="check" glow={0.7} />
          </span>
        ) : null}
      </span>
    </div>
  );
};

/**
 * The one label chip above the code (storyboard 'Label chip: Spark SQL -> as-is on Snowflake'); it labels the
 * whole panel, code and stack, so the stack carries no second label. Once the line is fixed it settles on a mint
 * check + 'on Snowflake'. See Labels.tsx for the in-place roll.
 */
const CHIP_STAGES: readonly [ChipStage, ChipStage, ChipStage] = [
  {label: S6_COPY.spark, tone: 'ember', icon: 'dot'},
  {label: S6_COPY.asIs, tone: 'ice', icon: 'hex'},
  {label: S6_COPY.fixed, tone: 'mint', icon: 'check'},
];

const LabelChip: React.FC<{f: number}> = ({f}) => {
  const size = CODE.chipSize;
  const pIn = snap(f, T6.chip);
  if (pIn <= 0.001) return null;
  // linear progress: Labels.tsx shapes each half of the roll itself
  const t01 = ramp(f, T6.swap, T6.swap + 10);
  const t12 = ramp(f, T6.asIsOut, T6.asIsOut + 10);
  const flash = bell(ramp(f, T6.swap, T6.swap + 16)) + bell(ramp(f, T6.asIsOut, T6.asIsOut + 18));
  return (
    <div
      style={{
        position: 'absolute',
        left: CODE.x,
        top: CODE.chipY,
        transform: `translateY(-50%) scale(${(0.86 + 0.14 * pIn).toFixed(4)})`,
        transformOrigin: '0% 50%',
        opacity: clamp01(pIn * 1.6),
      }}
    >
      <StateChip stages={CHIP_STAGES} t={[t01, t12]} size={size} glow={0.35 + 0.5 * clamp01(flash)} />
    </div>
  );
};

/** The one code line, syntax coloured, filled in fast (T6.codeFpc), then ' NULLS LAST' at T6.insertFpc in mint. */
const CodeLine: React.FC<{f: number}> = ({f}) => {
  useFontsLoaded();
  if (f < T6.caretIn) return null;
  const n = f >= T6.codeType ? typedCount(f, T6.codeType, CODE_BEFORE.length, T6.codeFpc) : 0;
  const baseDoneAt = T6.codeType + (CODE_BEFORE.length - 1) * T6.codeFpc;
  const toks = sliceTokens(CODE_TOKENS, n);
  const k = f >= T6.insert ? typedCount(f, T6.insert, CODE_INSERT.length, T6.insertFpc) : 0;
  const insDoneAt = T6.insert + (CODE_INSERT.length - 1) * T6.insertFpc;
  const ins = CODE_INSERT.slice(0, k);
  const lead = CODE_INSERT.length - CODE_INSERT.trimStart().length;
  const word = ins.slice(lead);
  const typingBase = f >= T6.codeType && f < baseDoneAt;
  const typingIns = f >= T6.insert && f < insDoneAt;
  const caretVisible = f >= T6.caretIn && f < T6.caretOff;
  const since = f >= T6.insert ? insDoneAt : f >= T6.codeType ? baseDoneAt : T6.caretIn;
  const on = caretVisible && caretOn(f, since, typingBase || typingIns);

  // mint wash behind the inserted word
  const x0 = insertX();
  const wWord = word.length > 0 ? codeWidth(word) : 0;
  const washO = ramp(f, T6.insert + 1, T6.insert + 5);
  const done = bell(ramp(f, insDoneAt, insDoneAt + 20));
  const lineH = Math.round(CODE.size * 1.3);
  return (
    <>
      {washO > 0.001 && wWord > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: x0 - 8,
            top: CODE.lineY - 36,
            width: wWord + 16 - TRACK_PX,
            height: 72,
            borderRadius: 12,
            opacity: washO,
            background: alpha(C.mint, 0.14),
            boxShadow: [
              `inset 0 0 0 1px ${alpha(C.mint, 0.3 + 0.3 * done)}`,
              `0 0 ${Math.round(24 + 30 * done)}px ${alpha(C.mint, 0.14 + 0.22 * done)}`,
            ].join(', '),
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: CODE.x,
          top: CODE.lineY - lineH / 2,
          height: lineH,
          display: 'flex',
          alignItems: 'center',
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: CODE.size,
          letterSpacing: `${CODE.trackingEm}em`,
          lineHeight: 1,
          whiteSpace: 'pre',
          fontFeatureSettings: '"liga" 0, "calt" 0',
        }}
      >
        <span>
          {toks.map((t, i) => (
            <span
              key={i}
              style={{
                color: t.color,
                textShadow: t.color === C.sqlKeyword ? `0 0 18px ${alpha(C.sqlKeyword, 0.3)}` : undefined,
              }}
            >
              {t.text}
            </span>
          ))}
          {ins.length > 0 ? (
            <span style={{color: C.mint, textShadow: `0 0 ${Math.round(16 + 14 * done)}px ${alpha(C.mint, 0.55 + 0.3 * done)}`}}>{ins}</span>
          ) : null}
        </span>
        {caretVisible ? <Caret on={on} height={Math.round(CODE.size * 1.08)} color={f >= T6.insert ? C.mint : C.frost} width={4} /> : null}
      </div>
    </>
  );
};

/** Hairline between the code column and the result stack. */
const Divider: React.FC<{f: number}> = ({f}) => {
  const p = reveal(f, T6.stack - 4, 18);
  if (p <= 0.001) return null;
  const h = 300 * p;
  return (
    <div
      style={{
        position: 'absolute',
        left: STACK.dividerX,
        top: PANEL.y + PANEL.h / 2 - h / 2,
        width: 1,
        height: h,
        background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0) 100%)`,
      }}
    />
  );
};

export const CodeColumn: React.FC<{f: number}> = ({f}) => (
  <AbsoluteFill style={{pointerEvents: 'none'}}>
    <Header f={f} />
    <LabelChip f={f} />
    <CodeLine f={f} />
    <Divider f={f} />
  </AbsoluteFill>
);
