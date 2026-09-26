import React from 'react';
import {AbsoluteFill, interpolateColors} from 'remotion';
import {DirectionalBlur, Tag} from '../../components';
import {C, FONT, TONES, alpha} from '../../theme';
import {COPY, ROW_PILLS} from '../../demoData';
import {bell, clamp01, ramp, snap} from '../../motion';
import {STACK} from './geometry';
import {T6} from './timing';

/**
 * The result stack at x1380-1540: which row comes out on top. Three pills in 'on Spark' order (newest date
 * first, the NULL row last). The top slot carries the winner mark (a dot + ring): mint while the right row
 * wins, coral while the wrong one does.
 *  T6.stack  pills spring in (SNAP, staggered); T6.winner the mint winner ring + dot; T6.rightTag0 'right row'.
 *  T6.swap   (label chip -> 'as-is on Snowflake') the NULL pill rises to the top (SNAP), arcing out to the right
 *            in front while the others step left and recede, so no two labels ever sit on top of each other.
 *            The winner ring leaves Sep 01 and arrives riding the NULL pill (coral), then 'wrong row' pops.
 *  T6.fix    the NULL pill drops back the same way; the mint ring arrives with Sep 01; 'right row' again.
 * The single state label lives on the chip above the code (no duplicate label over the stack).
 */

const NULL_ROW = ROW_PILLS.length - 1;
/** slot of each pill on Spark (and after the fix) */
const SLOT_SPARK = ROW_PILLS.map((_, i) => i);
/** slot of each pill copied as-is: the NULL row jumps to the top, the dated rows shift down */
const SLOT_ASIS = ROW_PILLS.map((_, i) => (i === NULL_ROW ? 0 : i + 1));

const PILL_R = STACK.pillH / 2;

const RowPill: React.FC<{label: string; isNull: boolean; wrong: number; lifted?: number}> = ({label, isNull, wrong, lifted = 0}) => {
  const base: React.CSSProperties = {
    position: 'relative',
    width: STACK.w,
    height: STACK.pillH,
    borderRadius: PILL_R,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    lineHeight: 1,
    fontFeatureSettings: '"liga" 0, "calt" 0',
  };
  if (isNull) {
    const col = interpolateColors(clamp01(wrong), [0, 1], [C.slate, TONES.coral.text]);
    return (
      <div
        style={{
          ...base,
          background: `linear-gradient(180deg, ${alpha(C.coral, 0.1 * wrong)} 0%, ${alpha(C.coral, 0.04 * wrong)} 100%), #0B0F18`,
          border: `1.5px dashed ${interpolateColors(clamp01(wrong), [0, 1], [alpha(C.slate, 0.6), alpha(C.coral, 0.75)])}`,
          boxSizing: 'border-box',
          boxShadow: `0 ${Math.round(8 + 10 * lifted)}px ${Math.round(18 + 16 * lifted)}px -8px rgba(0,0,0,${(0.7 + 0.2 * lifted).toFixed(2)})`,
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: 24,
          letterSpacing: '0.08em',
          color: col,
        }}
      >
        {label}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.035) 100%), #0E121C',
        boxShadow: [
          'inset 0 0 0 1px rgba(255,255,255,0.16)',
          'inset 0 1px 0 rgba(255,255,255,0.14)',
          '0 8px 18px -8px rgba(0,0,0,0.7)',
        ].join(', '),
        fontFamily: FONT.mono,
        fontWeight: 500,
        fontSize: 26,
        letterSpacing: '-0.01em',
        color: C.frost,
      }}
    >
      {label}
    </div>
  );
};

/** A row tag riding above the top slot: pops in (SNAP) and bows out (scale down + fade). */
const RowTag: React.FC<{label: string; tone: 'mint' | 'coral'; pop: number; out: number}> = ({label, tone, pop, out}) => {
  if (pop <= 0.001 || out >= 0.999) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: STACK.cx,
        top: STACK.tagY,
        transform: `translate(-50%, -50%) translateY(${(6 * (1 - Math.min(1, pop)) - 6 * out).toFixed(2)}px) scale(${(Math.max(0, pop) * (1 - 0.3 * out)).toFixed(4)})`,
        opacity: clamp01(pop * 1.6) * (1 - out),
        zIndex: 6,
      }}
    >
      <Tag label={label} tone={tone} glow={0.8} />
    </div>
  );
};

/** The winner mark (ring + dot) drawn around ONE pill, riding with it: mint on a right row, coral on the wrong one. */
const WinnerMark: React.FC<{on: number; color: (a: number) => string; flash: number}> = ({on, color, flash}) => {
  if (on <= 0.001) return null;
  const pad = STACK.ringPad;
  const fl = clamp01(flash);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: -pad,
          top: -pad,
          width: STACK.w + pad * 2,
          height: STACK.pillH + pad * 2,
          borderRadius: PILL_R + pad,
          opacity: clamp01(on * 1.4),
          transform: `scale(${(1.08 - 0.08 * clamp01(on)).toFixed(4)})`,
          boxShadow: [`0 0 0 1.5px ${color(0.75 + 0.25 * fl)}`, `0 0 ${Math.round(22 + 26 * fl)}px ${color(0.3 + 0.3 * fl)}`].join(', '),
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 22 - 6,
          top: STACK.pillH / 2 - 6,
          width: 12,
          height: 12,
          borderRadius: 6,
          background: color(1),
          opacity: clamp01(on * 1.4),
          transform: `scale(${clamp01(on).toFixed(4)})`,
          boxShadow: `0 0 ${Math.round(12 + 14 * fl)}px ${color(0.9)}`,
        }}
      />
    </>
  );
};

/** horizontal arc of a pass: the moving (NULL) pill swings out to the right, the others step left and recede */
const ARC_OUT = 32;
const ARC_IN = 22;

/** the moving (NULL) pill starts one frame after the others, so the stack parts first and the pill slides in */
const NULL_LAG = 1;

export const RowStack: React.FC<{f: number}> = ({f}) => {
  /** per-pill swap / fix progress (SNAP springs, may overshoot) */
  const prog = (isNull: boolean, fr: number) => {
    const lag = isNull ? NULL_LAG : 0;
    return {a: snap(fr, T6.swap + lag), b: snap(fr, T6.fix + lag)};
  };
  const nullP = prog(true, f);
  const pa = clamp01(nullP.a);
  const pb = clamp01(nullP.b);
  /** pill centre y at frame fr */
  const yOf = (i: number, fr: number) => {
    const {a, b} = prog(i === NULL_ROW, fr);
    const y0 = STACK.slotY(SLOT_SPARK[i]);
    const y1 = STACK.slotY(SLOT_ASIS[i]);
    return y0 + (y1 - y0) * a + (y0 - y1) * b;
  };
  /** how much pill i overlaps the moving NULL pill right now (0 = clear, 1 = on top of each other). The NULL
   *  pill swings out to the right exactly while it overlaps something and the pill it passes steps left and
   *  recedes, so the pass reads as one card sliding in front of the others, never as two labels on top of each
   *  other. At rest (68px pitch) nothing overlaps. */
  const CLEAR = STACK.pillH + 2 * STACK.ringPad;
  const yNull = yOf(NULL_ROW, f);
  const overlap = (i: number) => clamp01(((CLEAR - Math.abs(yOf(i, f) - yNull)) / CLEAR) * 1.8);
  const others = ROW_PILLS.map((_, i) => i).filter((i) => i !== NULL_ROW);
  const pass = Math.max(...others.map(overlap));
  /** 0 = the right row is on top, 1 = the wrong row is */
  const wrong = ramp(f, T6.swap + 2, T6.swap + 6) - ramp(f, T6.fix + 2, T6.fix + 6);
  const markIn = snap(f, T6.winner);
  const flashA = bell(ramp(f, T6.swap + 4, T6.swap + 18));
  const flashB = bell(ramp(f, T6.fix + 4, T6.fix + 18));

  /** winner weight per pill: the ring leaves the old winner as the pass starts and arrives WITH the new one */
  const winnerOn = (i: number): number => {
    if (i === 0) return clamp01(markIn) * (1 - ramp(pa, 0, 0.3)) + ramp(pb, 0.5, 0.95);
    if (i === NULL_ROW) return ramp(pa, 0.5, 0.95) * (1 - ramp(pb, 0, 0.3));
    return 0;
  };
  const mintC = (al: number) => alpha(C.mint, al);
  const coralC = (al: number) => alpha(C.coral, al);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* the pills (NULL rendered last and in front, so it passes over the others while they recede) */}
      {ROW_PILLS.map((label, i) => ({label, i}))
        .sort((p, q) => (p.i === NULL_ROW ? 1 : 0) - (q.i === NULL_ROW ? 1 : 0))
        .map(({label, i}) => {
          const e = snap(f, T6.stack + i * T6.stackStagger);
          if (e <= 0.001) return null;
          const isNull = i === NULL_ROW;
          const y = yOf(i, f);
          const ov = isNull ? pass : overlap(i);
          const dx = isNull ? ARC_OUT * ov : -ARC_IN * ov;
          const sc = (0.85 + 0.15 * e) * (isNull ? 1 + 0.05 * ov : 1 - 0.08 * ov);
          const dim = isNull ? 1 : 1 - 0.6 * ov;
          // vertical speed for a touch of motion blur on the moving pill
          const vy = y - yOf(i, f - 1);
          const pill = <RowPill label={label} isNull={isNull} wrong={isNull ? clamp01(wrong) : 0} lifted={isNull ? pass : 0} />;
          const on = winnerOn(i);
          return (
            <div
              key={label}
              style={{
                position: 'absolute',
                left: STACK.x0 + dx,
                top: y - STACK.pillH / 2 + 18 * (1 - Math.min(1, e)),
                width: STACK.w,
                height: STACK.pillH,
                transform: `scale(${sc.toFixed(4)})`,
                opacity: clamp01(e * 1.6) * dim,
                zIndex: isNull ? 3 : 1,
              }}
            >
              {isNull && Math.abs(vy) > 8 ? (
                <DirectionalBlur id={`s6-pill-${i}`} amount={Math.min(3, Math.abs(vy) * 0.08)} angle={90}>
                  {pill}
                </DirectionalBlur>
              ) : (
                pill
              )}
              <WinnerMark on={on} color={isNull ? coralC : mintC} flash={isNull ? flashA : flashB} />
            </div>
          );
        })}

      {/* row tags, 18px clear above the top slot: right (Spark) -> wrong (as-is) -> right (fixed). Each leaves
          before the next arrives, and the next arrives WITH the pill that lands on top. */}
      <RowTag label={COPY.s6Right} tone="mint" pop={snap(f, T6.rightTag0)} out={ramp(f, T6.swap, T6.swap + 4)} />
      <RowTag label={COPY.s6Wrong} tone="coral" pop={snap(f, T6.wrongTag)} out={ramp(f, T6.fix, T6.fix + 4)} />
      <RowTag label={COPY.s6Right} tone="mint" pop={snap(f, T6.rightTag)} out={0} />
    </AbsoluteFill>
  );
};
