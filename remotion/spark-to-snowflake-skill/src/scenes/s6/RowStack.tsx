import React from 'react';
import {AbsoluteFill, interpolateColors} from 'remotion';
import {DirectionalBlur, Tag} from '../../components';
import {C, FONT, TONES, alpha} from '../../theme';
import {COPY, ROW_PILLS} from '../../demoData';
import {bell, clamp01, ramp, reveal, snap} from '../../motion';
import {STACK} from './geometry';
import {AsIsLabel, ToneIcon} from './Labels';
import {T6} from './timing';

/**
 * The result stack at x1380-1540: which row comes out on top. Three pills in 'on Spark' order (newest date
 * first, the NULL row last). The top slot carries the winner mark (a dot + ring): mint while the right row
 * wins, coral while the wrong one does.
 *  lf30  pills spring in (SNAP, staggered), labelled 'on Spark'; lf38 the mint winner dot.
 *  lf50  label -> 'as-is on Snowflake'; the NULL pill jumps to the top (SNAP), coral 'wrong row' tag.
 *  lf100 the NULL pill drops back to the bottom (SNAP); mint 'right row' tag; 'as-is' is struck.
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

/** 'on Spark' -> 'as-is on Snowflake' above the stack. */
const StackLabel: React.FC<{f: number}> = ({f}) => {
  const pIn = reveal(f, T6.stack, 16);
  const out = ramp(f, T6.swap, T6.swap + 5);
  const pNew = snap(f, T6.swap + 3);
  const strike = reveal(f, T6.strike, 10);
  const common: React.CSSProperties = {
    position: 'absolute',
    left: STACK.cx,
    top: STACK.labelY,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: FONT.display,
    fontWeight: 600,
    fontSize: 20,
    letterSpacing: '-0.005em',
    color: alpha(C.frost, 0.84),
    whiteSpace: 'nowrap',
    lineHeight: 1,
  };
  return (
    <>
      {pIn > 0.001 && out < 1 ? (
        <div
          style={{
            ...common,
            transform: `translate(-50%, -50%) translateY(${(8 * (1 - pIn) - 8 * out).toFixed(2)}px)`,
            opacity: pIn * (1 - out),
          }}
        >
          <ToneIcon tone="ember" size={20} />
          <span>{COPY.s6StackBefore}</span>
        </div>
      ) : null}
      {pNew > 0.001 ? (
        <div
          style={{
            ...common,
            transform: `translate(-50%, -50%) translateY(${(8 * (1 - Math.min(1, pNew))).toFixed(2)}px)`,
            opacity: clamp01(pNew * 1.6),
          }}
        >
          <ToneIcon tone="ice" size={20} />
          <AsIsLabel strike={strike} color={alpha(C.frost, 0.82)} />
        </div>
      ) : null}
    </>
  );
};

export const RowStack: React.FC<{f: number}> = ({f}) => {
  const a = snap(f, T6.swap);
  const b = snap(f, T6.fix);
  /** 0 = the right row is on top, 1 = the wrong row is */
  const wrong = ramp(f, T6.swap + 3, T6.swap + 8) - ramp(f, T6.fix + 3, T6.fix + 8);
  /** winner-mark colour at alpha a: mint (right row on top) <-> coral (wrong row on top) */
  const mark = (a: number) => interpolateColors(clamp01(wrong), [0, 1], [alpha(C.mint, a), alpha(C.coral, a)]);
  const markIn = snap(f, T6.winner);
  const flash = bell(ramp(f, T6.swap + 3, T6.swap + 17)) + bell(ramp(f, T6.fix + 3, T6.fix + 17));

  const top0 = STACK.slotY(0);
  const ringPad = 6;

  const wrongPop = snap(f, T6.wrongTag);
  const wrongOut = ramp(f, T6.fix, T6.fix + 6);
  const rightPop = snap(f, T6.rightTag);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <StackLabel f={f} />

      {/* the pills (NULL rendered last so it passes in front while it jumps) */}
      {ROW_PILLS.map((label, i) => ({label, i}))
        .sort((p, q) => (p.i === NULL_ROW ? 1 : 0) - (q.i === NULL_ROW ? 1 : 0))
        .map(({label, i}) => {
          const e = snap(f, T6.stack + i * T6.stackStagger);
          if (e <= 0.001) return null;
          const y0 = STACK.slotY(SLOT_SPARK[i]);
          const y1 = STACK.slotY(SLOT_ASIS[i]);
          const y = y0 + (y1 - y0) * a + (y0 - y1) * b;
          const isNull = i === NULL_ROW;
          const hop = isNull ? bell(clamp01(a)) + bell(clamp01(b)) : 0;
          const dx = isNull ? 22 * hop : -3 * (bell(clamp01(a)) + bell(clamp01(b)));
          const sc = (0.85 + 0.15 * e) * (1 + 0.08 * clamp01(hop));
          // vertical speed for a touch of motion blur on the jump
          const yPrev = (() => {
            const ap = snap(f - 1, T6.swap);
            const bp = snap(f - 1, T6.fix);
            return y0 + (y1 - y0) * ap + (y0 - y1) * bp;
          })();
          const vy = y - yPrev;
          const pill = <RowPill label={label} isNull={isNull} wrong={isNull ? clamp01(wrong) : 0} lifted={clamp01(hop)} />;
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
                opacity: clamp01(e * 1.6),
                zIndex: isNull ? 3 : 1,
              }}
            >
              {isNull && Math.abs(vy) > 3 ? (
                <DirectionalBlur id={`s6-pill-${i}`} amount={Math.min(6, Math.abs(vy) * 0.18)} angle={90}>
                  {pill}
                </DirectionalBlur>
              ) : (
                pill
              )}
            </div>
          );
        })}

      {/* winner mark on the top slot: ring + dot */}
      {markIn > 0.001 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: STACK.x0 - ringPad,
              top: top0 - PILL_R - ringPad,
              width: STACK.w + ringPad * 2,
              height: STACK.pillH + ringPad * 2,
              borderRadius: PILL_R + ringPad,
              opacity: clamp01(markIn * 1.4),
              transform: `scale(${(1.08 - 0.08 * markIn).toFixed(4)})`,
              boxShadow: [
                `0 0 0 1.5px ${mark(0.75 + 0.25 * clamp01(flash))}`,
                `0 0 ${Math.round(22 + 26 * clamp01(flash))}px ${mark(0.3 + 0.3 * clamp01(flash))}`,
              ].join(', '),
              zIndex: 4,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: STACK.x0 + 22 - 6,
              top: top0 - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              background: mark(1),
              transform: `scale(${Math.max(0, markIn).toFixed(4)})`,
              boxShadow: `0 0 ${Math.round(12 + 14 * clamp01(flash))}px ${mark(0.9)}`,
              zIndex: 5,
            }}
          />
        </>
      ) : null}

      {/* tags ride the top slot's upper edge */}
      {wrongPop > 0.001 && wrongOut < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: STACK.cx,
            top: top0 - PILL_R - 8,
            transform: `translate(-50%, -50%) scale(${(Math.max(0, wrongPop) * (1 - 0.3 * wrongOut)).toFixed(4)})`,
            opacity: clamp01(wrongPop * 1.6) * (1 - wrongOut),
            zIndex: 6,
          }}
        >
          <Tag label={COPY.s6Wrong} tone="coral" glow={0.8} />
        </div>
      ) : null}
      {rightPop > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: STACK.cx,
            top: top0 - PILL_R - 8,
            transform: `translate(-50%, -50%) scale(${Math.max(0, rightPop).toFixed(4)})`,
            opacity: clamp01(rightPop * 1.6),
            zIndex: 6,
          }}
        >
          <Tag label={COPY.s6Right} tone="mint" glow={0.8} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
