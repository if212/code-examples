import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, EASE, FONT, GRADIENT, GradientName, TYPE} from '../theme';
import {ZONES} from '../layout';
import {measureWidth, useFontsLoaded} from './textMeasure';

/* ------------------------------------------------------------------------------------------------
 * Word parsing
 * ---------------------------------------------------------------------------------------------- */

type WordKind = 'plain' | 'key' | 'accent';
type Word = {core: string; punct: string; kind: WordKind};

const norm = (s: string) => s.toLowerCase().replace(/[.,!?:;]+$/, '');
const asList = (v?: string | string[]) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map(norm);

const parseWords = (text: string, key?: string | string[], accent?: string | string[]): Word[] => {
  const keys = asList(key);
  const accents = asList(accent);
  return text
    .split(' ')
    .filter(Boolean)
    .map((tok) => {
      const m = tok.match(/^(.*?)([.,!?:;]*)$/);
      const core = m ? m[1] : tok;
      const punct = m ? m[2] : '';
      const n = norm(core);
      const kind: WordKind = accents.includes(n) ? 'accent' : keys.includes(n) ? 'key' : 'plain';
      return {core, punct, kind};
    });
};

/* ------------------------------------------------------------------------------------------------
 * Shared word-reveal engine (Headline + Caption)
 * ---------------------------------------------------------------------------------------------- */

type RevealParams = {
  enterAt: number;
  exitAt: number;
  stagger: number;
  duration: number;
  rise: number; // px translateY at start
  blur: number; // px blur at start
  exitRise: number; // px up on exit
  exitBlur: number;
  exitDur: number;
};

const wordState = (frame: number, i: number, p: RevealParams) => {
  const t = interpolate(frame, [p.enterAt + i * p.stagger, p.enterAt + i * p.stagger + p.duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.EXPO_OUT,
  });
  const q = Number.isFinite(p.exitAt)
    ? interpolate(frame, [p.exitAt, p.exitAt + p.exitDur], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: EASE.EXIT,
      })
    : 0;
  const opacity = Math.min(1, t * 1.25) * (1 - q);
  const y = p.rise * (1 - t) - p.exitRise * q;
  const blur = p.blur * (1 - t) + p.exitBlur * q;
  return {opacity, y, blur, visible: opacity > 0.001};
};

/**
 * Headline tracking (em). -0.04em on Inter Tight 800 made 'It', 'rt' and 'kn' collide at 120px, so the
 * display line runs at -0.03em with normal kerning, plus optical pair fixes (display headlines only).
 */
export const HEADLINE_TRACKING = -0.03;
/** Extra space (em) inserted between these letter pairs in display headlines ('It' read as 'lt'). */
export const PAIR_FIX: Readonly<Record<string, number>> = {It: 0.035, rt: 0.042, kn: 0.012};
/** Backwards-compatible alias: the 'It' pair extra. */
export const I_PAIR_EM = PAIR_FIX.It;
/** Per-character extra (em) to add AFTER character i of `core` (0 where no pair fix applies). */
const pairExtras = (core: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < core.length; i++) out.push(i < core.length - 1 ? PAIR_FIX[core[i] + core[i + 1]] ?? 0 : 0);
  return out;
};
const pairExtraTotal = (core: string): number => pairExtras(core).reduce((a, b) => a + b, 0);
/** Core text with pair-fix spans (a plain string when no pair applies). */
const withPairFix = (core: string): React.ReactNode => {
  const ex = pairExtras(core);
  if (!ex.some((v) => v > 0)) return core;
  const parts: React.ReactNode[] = [];
  let buf = '';
  ex.forEach((v, i) => {
    if (v > 0) {
      if (buf) parts.push(buf);
      buf = '';
      parts.push(
        <span key={i} style={{marginRight: `${v}em`}}>
          {core[i]}
        </span>,
      );
    } else {
      buf += core[i];
    }
  });
  if (buf) parts.push(buf);
  return <>{parts}</>;
};

const PAD = {t: 0.3, x: 0.42, b: 0.46}; // mask box padding (em) so blur halos and descenders never clip
const FILL_PAD = {y: 0.22, x: 0.14}; // gradient-fill padding (em) so italic overhangs + descenders are filled
const GAP = 0.24; // word gap (em of base size)

const maskImage = `linear-gradient(180deg, #000 0%, #000 calc(100% - 0.3em), transparent calc(100% - 0.02em))`;

type Styling = {
  size: number;
  family: string;
  weight: number;
  tracking: number; // em
  color: string;
  keyGradient: GradientName;
  accentGradient: GradientName;
  glow: boolean;
  italicAccent: boolean;
  uppercase?: boolean;
  fontVariantNumeric?: string;
  /** apply the PAIR_FIX optical pair fixes (display headlines) */
  iPair?: boolean;
};

const fontFor = (kind: WordKind, s: Styling) =>
  kind === 'accent'
    ? {family: FONT.serif, weight: 400, size: s.size * TYPE.accentScale, tracking: -0.005, style: 'italic' as const}
    : {family: s.family, weight: s.weight, size: s.size, tracking: s.tracking, style: 'normal' as const};

/** Measured widths of each word (core + punct) at the given styling. */
const measureWords = (words: Word[], s: Styling): number[] =>
  words.map((w) => {
    const f = fontFor(w.kind, s);
    const core = s.uppercase ? w.core.toUpperCase() : w.core;
    const coreW =
      measureWidth(core, `${f.style === 'italic' ? 'italic ' : ''}${f.weight} ${f.size}px ${f.family}`, f.tracking * f.size) +
      (s.iPair && w.kind !== 'accent' ? pairExtraTotal(core) * f.size : 0);
    const pw = w.punct
      ? measureWidth(w.punct, `${s.weight} ${s.size}px ${s.family}`, s.tracking * s.size)
      : 0;
    return coreW + pw;
  });

const gradientFill = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
  backgroundImage: bg,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  ...extra,
});

/** Sweep gradient: frost outside a moving signature band. s = band centre in [-0.3, 1.3] of the line. */
const sweepGradient = (s: number, base: string) => {
  const pc = (v: number) => `${(v * 100).toFixed(2)}%`;
  return `linear-gradient(100deg, ${base} 0%, ${base} ${pc(s - 0.26)}, ${C.ember} ${pc(s - 0.17)}, ${C.emberGlow} ${pc(s - 0.08)}, ${C.whiteHot} ${pc(s)}, ${C.iceGlow} ${pc(s + 0.08)}, ${C.ice} ${pc(s + 0.17)}, ${base} ${pc(s + 0.26)}, ${base} 100%)`;
};

type LineProps = {
  words: Word[];
  frame: number;
  params: RevealParams;
  styling: Styling;
  /** 0..1 progress of the signature sweep through the whole line (undefined = none) */
  sweep?: number;
  widths: number[];
};

const RevealLine: React.FC<LineProps> = ({words, frame, params, styling: s, sweep, widths}) => {
  const lineW = widths.reduce((a, b) => a + b, 0) + GAP * s.size * Math.max(0, words.length - 1);
  let cursor = 0;
  const sweeping = sweep !== undefined && sweep > 0 && sweep < 1;
  const sweepPos = sweep === undefined ? 0 : -0.3 + 1.6 * sweep;
  return (
    <div
      style={{
        whiteSpace: 'nowrap',
        lineHeight: TYPE.headlineLineHeight,
        fontFamily: s.family,
        fontWeight: s.weight,
        fontSize: s.size,
        letterSpacing: `${s.tracking}em`,
        color: s.color,
        textTransform: s.uppercase ? 'uppercase' : undefined,
        fontVariantNumeric: s.fontVariantNumeric,
        fontFeatureSettings: '"liga" 0, "calt" 0',
        fontKerning: 'normal',
        display: 'inline-block',
      }}
    >
      {words.map((w, i) => {
        const st = wordState(frame, i, params);
        const left = cursor;
        cursor += widths[i] + GAP * s.size;
        const f = fontFor(w.kind, s);
        const last = i === words.length - 1;
        const coreText = s.iPair && w.kind !== 'accent' ? withPairFix(w.core) : w.core;
        const fillBox: React.CSSProperties = {
          display: 'inline-block',
          padding: `${FILL_PAD.y}em ${FILL_PAD.x}em`,
          margin: `-${FILL_PAD.y}em -${FILL_PAD.x}em`,
        };
        let coreStyle: React.CSSProperties;
        let glowBg: string | null = null;
        if (w.kind === 'accent') {
          coreStyle = {
            ...fillBox,
            ...gradientFill(GRADIENT[s.accentGradient]),
            fontFamily: FONT.serif,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: `${TYPE.accentScale}em`,
            letterSpacing: `${f.tracking}em`,
          };
          glowBg = GRADIENT[s.accentGradient];
        } else if (w.kind === 'key') {
          coreStyle = {...fillBox, ...gradientFill(GRADIENT[s.keyGradient])};
          glowBg = GRADIENT[s.keyGradient];
        } else if (sweeping) {
          // continuous gradient across the whole line: size = line width, offset = this word's left
          const padPx = FILL_PAD.x * s.size;
          coreStyle = {
            ...fillBox,
            ...gradientFill(sweepGradient(sweepPos, s.color), {
              backgroundSize: `${lineW + 2 * padPx}px 100%`,
              backgroundPosition: `${-left}px 0px`,
              backgroundRepeat: 'no-repeat',
            }),
          };
        } else {
          coreStyle = fillBox;
        }
        const punctStyle: React.CSSProperties =
          sweeping
            ? {
                ...fillBox,
                ...gradientFill(sweepGradient(sweepPos, s.color), {
                  backgroundSize: `${lineW + 2 * FILL_PAD.x * s.size}px 100%`,
                  backgroundPosition: `${-(left + widths[i] - measureWidth(w.punct, `${s.weight} ${s.size}px ${s.family}`, s.tracking * s.size))}px 0px`,
                  backgroundRepeat: 'no-repeat',
                }),
              }
            : {};
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              padding: `${PAD.t}em ${PAD.x}em ${PAD.b}em`,
              margin: `-${PAD.t}em ${last ? -PAD.x : GAP - PAD.x}em -${PAD.b}em -${PAD.x}em`,
              WebkitMaskImage: maskImage,
              maskImage,
              visibility: st.visible ? 'visible' : 'hidden',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                transform: `translateY(${st.y.toFixed(2)}px)`,
                filter: st.blur > 0.05 ? `blur(${st.blur.toFixed(2)}px)` : undefined,
                opacity: st.opacity,
              }}
            >
              <span style={{position: 'relative', display: 'inline-block'}}>
                {glowBg && s.glow ? (
                  <span
                    aria-hidden
                    style={{
                      ...coreStyle,
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      filter: `blur(${(0.1 * s.size).toFixed(1)}px)`,
                      opacity: 0.35,
                    }}
                  >
                    {coreText}
                  </span>
                ) : null}
                <span style={coreStyle}>{coreText}</span>
              </span>
              {w.punct ? <span style={punctStyle}>{w.punct}</span> : null}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Headline
 * ---------------------------------------------------------------------------------------------- */

export type HeadlineProps = {
  text: string;
  /** word(s) that get the gradient fill + 24px glow (matched case-insensitively, trailing punctuation ignored) */
  keyWord?: string | string[];
  keyGradient?: GradientName;
  /** word(s) set in Instrument Serif Italic at 1.08x with a gradient fill ('once', 'skill') */
  accentWord?: string | string[];
  accentGradient?: GradientName;
  /** local frame the per-word reveal starts (4f stagger, 20f EXPO_OUT) */
  enterAt?: number;
  /** local frame the 10f exit starts (default: never) */
  exitAt?: number;
  /** base size in px (120 default; 160 for 'Just ask.') */
  fontSize?: number;
  /** never shrink below this when fitting (112) */
  minFontSize?: number;
  /** auto-fit width (1500) */
  maxWidth?: number;
  /** centre x (960) */
  x?: number;
  /** cap-centre y (190 = headline band) */
  y?: number;
  color?: string;
  stagger?: number;
  duration?: number;
  /** 0..1: sweep the signature gradient left->right through the whole line (S8) */
  sweep?: number;
  /** global opacity multiplier */
  opacity?: number;
  /** extra CSS transform appended to the line (e.g. a drift) */
  transform?: string;
};

/**
 * One-line keynote headline, rendered in its own AbsoluteFill. Fits to maxWidth by lowering the font size
 * (never below minFontSize). Deterministic: measured with canvas after fonts load.
 */
export const Headline: React.FC<HeadlineProps> = ({
  text,
  keyWord,
  keyGradient = 'signature',
  accentWord,
  accentGradient = 'signature',
  enterAt = 0,
  exitAt = Number.POSITIVE_INFINITY,
  fontSize = TYPE.headline,
  minFontSize = TYPE.headlineMin,
  maxWidth = ZONES.headline.maxWidth,
  x = ZONES.headline.cx,
  y = ZONES.headline.capY,
  color = C.frost,
  stagger = 4,
  duration = 20,
  sweep,
  opacity = 1,
  transform,
}) => {
  const frame = useCurrentFrame();
  useFontsLoaded();
  const words = parseWords(text, keyWord, accentWord);
  const base: Styling = {
    size: fontSize,
    family: FONT.display,
    weight: 800,
    tracking: HEADLINE_TRACKING,
    color,
    keyGradient,
    accentGradient,
    glow: true,
    italicAccent: true,
    iPair: true,
  };
  const w0 = measureWords(words, base);
  const lineW0 = w0.reduce((a, b) => a + b, 0) + GAP * fontSize * Math.max(0, words.length - 1);
  const size = lineW0 > maxWidth ? Math.max(minFontSize, (fontSize * maxWidth) / lineW0) : fontSize;
  const styling: Styling = {...base, size};
  const widths = size === fontSize ? w0 : measureWords(words, styling);
  const k = size / 120;
  const params: RevealParams = {
    enterAt,
    exitAt,
    stagger,
    duration,
    rise: 40 * k,
    blur: 16 * k,
    exitRise: 16 * k,
    exitBlur: 8 * k,
    exitDur: 10,
  };
  if (frame >= exitAt + 10 || frame < enterAt) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          // line box centre ~= cap centre for Inter Tight at line-height 0.95; small em nudge calibrated by render
          transform: `translate(-50%, -50%) translateY(${(0.005 * size).toFixed(2)}px)${transform ? ` ${transform}` : ''}`,
        }}
      >
        <RevealLine words={words} frame={frame} params={params} styling={styling} sweep={sweep} widths={widths} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Caption (sub-captions, glosses, mono lines, footnote)
 * ---------------------------------------------------------------------------------------------- */

export type CaptionProps = {
  text: string;
  enterAt?: number;
  exitAt?: number;
  /** centre x (960) */
  x?: number;
  /** vertical centre of the line box (920 = sub band) */
  y?: number;
  /** 'center' (default) anchors x at the centre; 'left' anchors x at the left edge */
  align?: 'center' | 'left';
  fontSize?: number;
  weight?: number;
  color?: string;
  font?: 'display' | 'mono' | 'serif';
  tracking?: number; // em
  uppercase?: boolean;
  keyWord?: string | string[];
  keyGradient?: GradientName;
  /** reveal per word (default) or as a single unit */
  perWord?: boolean;
  stagger?: number;
  duration?: number;
  /** 'rise' (default: y 16->0 + blur 8->0) or 'fade' (opacity only) */
  mode?: 'rise' | 'fade';
  opacity?: number;
  maxWidth?: number;
};

/** Smaller text with the same reveal grammar (softer: 16px rise, 8px blur, 2f stagger, 18f). */
export const Caption: React.FC<CaptionProps> = ({
  text,
  enterAt = 0,
  exitAt = Number.POSITIVE_INFINITY,
  x = 960,
  y = ZONES.sub.cy,
  align = 'center',
  fontSize = TYPE.sub,
  weight = 500,
  color = C.slate,
  font = 'display',
  tracking = -0.01,
  uppercase,
  keyWord,
  keyGradient = 'signature',
  perWord = true,
  stagger = 2,
  duration = 18,
  mode = 'rise',
  opacity = 1,
  maxWidth = 1600,
}) => {
  const frame = useCurrentFrame();
  useFontsLoaded();
  const family = font === 'mono' ? FONT.mono : font === 'serif' ? FONT.serif : FONT.display;
  const words = perWord ? parseWords(text, keyWord) : [{core: text, punct: '', kind: 'plain' as WordKind}];
  const base: Styling = {
    size: fontSize,
    family,
    weight,
    tracking,
    color,
    keyGradient,
    accentGradient: 'signature',
    glow: false,
    italicAccent: false,
    uppercase,
  };
  const w0 = measureWords(words, base);
  const lineW0 = w0.reduce((a, b) => a + b, 0) + GAP * fontSize * Math.max(0, words.length - 1);
  const size = lineW0 > maxWidth ? (fontSize * maxWidth) / lineW0 : fontSize;
  const styling = {...base, size};
  const widths = size === fontSize ? w0 : measureWords(words, styling);
  const params: RevealParams = {
    enterAt,
    exitAt,
    stagger: perWord ? stagger : 0,
    duration,
    rise: mode === 'fade' ? 0 : 16 * (size / 44),
    blur: mode === 'fade' ? 0 : 8 * (size / 44),
    exitRise: mode === 'fade' ? 0 : 8,
    exitBlur: mode === 'fade' ? 0 : 6,
    exitDur: 10,
  };
  if (frame >= exitAt + 10 || frame < enterAt) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity}}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          transform: align === 'center' ? 'translate(-50%, -50%)' : 'translate(0, -50%)',
        }}
      >
        <RevealLine words={words} frame={frame} params={params} styling={styling} widths={widths} />
      </div>
    </AbsoluteFill>
  );
};

const headlineStyling = (size: number): Styling => ({
  size,
  family: FONT.display,
  weight: 800,
  tracking: HEADLINE_TRACKING,
  color: C.frost,
  keyGradient: 'signature',
  accentGradient: 'signature',
  glow: false,
  italicAccent: false,
  iPair: true,
});

/** Exported for components that need the same fit logic (e.g. a headline inside a panel). */
export const headlineFontSize = (text: string, fontSize = 120, maxWidth = 1500, minFontSize = 112): number => {
  const words = parseWords(text);
  const w = measureWords(words, headlineStyling(fontSize)).reduce((a, b) => a + b, 0) + GAP * fontSize * Math.max(0, words.length - 1);
  return w > maxWidth ? Math.max(minFontSize, (fontSize * maxWidth) / w) : fontSize;
};

/**
 * Laid-out width (px) of a Headline line exactly as <Headline> sets it (after auto-fit), e.g. to put something
 * under its sweep band. Pass the same text/accentWord/fontSize/maxWidth/minFontSize as the Headline.
 * Exact once fonts are loaded (a Headline on the same frame holds rendering until they are).
 */
export const headlineWidth = (
  text: string,
  opts: {accentWord?: string | string[]; fontSize?: number; maxWidth?: number; minFontSize?: number} = {},
): number => {
  const {accentWord, fontSize = TYPE.headline, maxWidth = ZONES.headline.maxWidth, minFontSize = TYPE.headlineMin} = opts;
  const words = parseWords(text, undefined, accentWord);
  const size = (() => {
    const w0 = measureWords(words, headlineStyling(fontSize)).reduce((a, b) => a + b, 0) + GAP * fontSize * Math.max(0, words.length - 1);
    return w0 > maxWidth ? Math.max(minFontSize, (fontSize * maxWidth) / w0) : fontSize;
  })();
  return measureWords(words, headlineStyling(size)).reduce((a, b) => a + b, 0) + GAP * size * Math.max(0, words.length - 1);
};
