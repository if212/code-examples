import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT, alpha} from '../theme';

/**
 * Typing helpers. Typing is LINEAR (the only linear motion besides the light-axis draw).
 * Rates: 2f/char for the prompt and ' NULLS LAST'; 1f/char for status lines, the folder tab and the code line.
 * Caret blinks every 15f (solid while typing).
 */

/** Number of characters visible at `frame` when typing starts at `startAt` with `framesPerChar`. */
export const typedCount = (frame: number, startAt: number, length: number, framesPerChar = 2): number =>
  Math.max(0, Math.min(length, Math.floor((frame - startAt) / framesPerChar) + 1));

/** Visible substring + state. */
export const typed = (text: string, frame: number, startAt: number, framesPerChar = 2) => {
  const n = frame < startAt ? 0 : typedCount(frame, startAt, text.length, framesPerChar);
  const done = n >= text.length;
  const doneAt = startAt + (text.length - 1) * framesPerChar;
  return {text: text.slice(0, n), count: n, done, doneAt, typing: frame >= startAt && !done};
};

/** Caret visibility: solid while typing, then blinks (15f on / 15f off) counted from `since`. */
export const caretOn = (frame: number, since = 0, typing = false): boolean => typing || Math.floor((frame - since) / 15) % 2 === 0;

/** Slice an array of coloured tokens to the first `count` characters (syntax-coloured typing, S6). */
export const sliceTokens = <T extends {text: string}>(tokens: readonly T[], count: number): T[] => {
  const out: T[] = [];
  let left = count;
  for (const t of tokens) {
    if (left <= 0) break;
    const s = t.text.slice(0, left);
    out.push({...t, text: s});
    left -= t.text.length;
  }
  return out;
};

export const Caret: React.FC<{on: boolean; height: number; color?: string; width?: number; glow?: boolean}> = ({
  on,
  height,
  color = C.frost,
  width,
  glow = true,
}) => (
  <span
    style={{
      display: 'inline-block',
      width: width ?? Math.max(2, Math.round(height * 0.09)),
      height,
      marginLeft: Math.round(height * 0.08),
      background: color,
      borderRadius: 1,
      opacity: on ? 1 : 0,
      boxShadow: glow ? `0 0 ${Math.round(height * 0.3)}px ${alpha(color, 0.7)}` : undefined,
      verticalAlign: 'middle',
      transform: `translateY(-${Math.round(height * 0.06)}px)`,
    }}
  />
);

/**
 * Convenience: a typed line with a caret. Uses the LOCAL frame.
 * <TypeText text={PROMPT_TEXT} startAt={20} framesPerChar={2} fontSize={40} />
 */
export const TypeText: React.FC<{
  text: string;
  startAt: number;
  framesPerChar?: number;
  fontSize?: number;
  color?: string;
  mono?: boolean;
  caret?: boolean;
  caretColor?: string;
  /** hide the caret after typing finished + this many frames */
  caretHideAfter?: number;
  style?: React.CSSProperties;
}> = ({text, startAt, framesPerChar = 2, fontSize = 40, color = C.frost, mono = true, caret = true, caretColor, caretHideAfter, style}) => {
  const frame = useCurrentFrame();
  const t = typed(text, frame, startAt, framesPerChar);
  const showCaret = caret && frame >= startAt - 1 && (caretHideAfter === undefined || frame < t.doneAt + caretHideAfter);
  return (
    <span
      style={{
        fontFamily: mono ? FONT.mono : FONT.display,
        fontWeight: 500,
        fontSize,
        color,
        whiteSpace: 'pre',
        fontFeatureSettings: '"liga" 0, "calt" 0',
        ...style,
      }}
    >
      {t.text}
      {showCaret ? <Caret on={caretOn(frame, t.doneAt, t.typing)} height={fontSize * 1.05} color={caretColor ?? color} /> : null}
    </span>
  );
};
