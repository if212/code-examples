import {Easing} from 'remotion';
import type {SpringConfig} from 'remotion';

/**
 * Palette (storyboard style.palette). Use these tokens everywhere; never hard-code a hex in a scene.
 */
export const C = {
  ink: '#05070D', // Stage Ink: base background
  lift: '#0B1020', // Stage Lift: radial centre lift
  gridDot: '#1A2233',
  glassFill: 'rgba(255,255,255,0.05)', // #FFFFFF0D
  glassHairline: 'rgba(255,255,255,0.14)', // #FFFFFF24
  glassHighlight: 'rgba(255,255,255,0.10)', // #FFFFFF1A
  frost: '#F2F5FA', // headlines, primary text, the 'you' cursor
  slate: '#8B97AD', // sub-captions, glosses, labels
  dim: '#5E6A80', // footnote, DEMO PROJECT, dimmed cards, file hints
  ember: '#FF7A3D',
  emberGlow: '#FFB26B',
  emberDeep: '#7A2A0F',
  whiteHot: '#F5E6D8',
  ice: '#38E1FF',
  iceGlow: '#B8F3FF',
  iceDeep: '#0B4F74',
  violet: '#A98BFF', // everything that IS the skill
  violetGlow: '#6C4DFF',
  mint: '#34E0A1',
  amber: '#FFC857',
  coral: '#FF5C7A',
  codeBg: '#0A0E16',
  sqlKeyword: '#C9B6FF',
  identifier: '#D6E2F5',
  pink: '#F472B6', // Leo
  lime: '#A3E635', // Priya
  silver: '#E2E8F0', // Sam
} as const;

export type Tone = 'ember' | 'ice' | 'violet' | 'mint' | 'amber' | 'coral' | 'neutral' | 'frost';

/** Main colour + glow colour + deep colour for each semantic tone. */
export const TONES: Record<Tone, {main: string; glow: string; deep: string; text: string}> = {
  ember: {main: C.ember, glow: C.emberGlow, deep: C.emberDeep, text: '#FFC9A3'},
  ice: {main: C.ice, glow: C.iceGlow, deep: C.iceDeep, text: '#C9F6FF'},
  violet: {main: C.violet, glow: C.violetGlow, deep: '#2A1C66', text: '#D9CCFF'},
  mint: {main: C.mint, glow: '#9CF5D2', deep: '#0B5C40', text: '#B8F7DE'},
  amber: {main: C.amber, glow: '#FFE2A3', deep: '#6B4A0A', text: '#FFE3A6'},
  coral: {main: C.coral, glow: '#FFA3B4', deep: '#6B1426', text: '#FFB8C5'},
  neutral: {main: C.slate, glow: '#C5CEDD', deep: '#1A2233', text: '#C5CEDD'},
  frost: {main: C.frost, glow: '#FFFFFF', deep: '#3A4458', text: C.frost},
};

/** Hex (#RGB/#RRGGBB) -> rgba() string with the given alpha. */
export const alpha = (hex: string, a: number): string => {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
};

/** Signature gradient stops: ember -> ember glow -> white-hot -> ice glow -> ice. */
export const SIGNATURE_STOPS = [C.ember, C.emberGlow, C.whiteHot, C.iceGlow, C.ice] as const;

export type GradientName = 'signature' | 'ember' | 'ice' | 'violet' | 'mint' | 'amber' | 'frost';

/** CSS linear gradients (110deg, per storyboard) for key words, rims, beams. */
export const GRADIENT: Record<GradientName, string> = {
  signature: `linear-gradient(110deg, ${C.ember} 0%, ${C.emberGlow} 28%, ${C.whiteHot} 50%, ${C.iceGlow} 72%, ${C.ice} 100%)`,
  ember: `linear-gradient(110deg, ${C.ember} 0%, #FF9450 35%, ${C.emberGlow} 75%, #FFD2A8 100%)`,
  ice: `linear-gradient(110deg, #E8F9FF 0%, ${C.iceGlow} 30%, #6FEAFF 65%, ${C.ice} 100%)`,
  violet: `linear-gradient(110deg, #E4DAFF 0%, ${C.violet} 55%, #8C6CFF 100%)`,
  mint: `linear-gradient(110deg, #C9FBE6 0%, ${C.mint} 100%)`,
  amber: `linear-gradient(110deg, #FFE7B0 0%, ${C.amber} 100%)`,
  frost: `linear-gradient(110deg, #FFFFFF 0%, ${C.frost} 100%)`,
};

/** Glow colour used behind gradient text of each gradient (24px, 35%). */
export const GRADIENT_GLOW: Record<GradientName, string> = {
  signature: C.whiteHot,
  ember: C.ember,
  ice: C.ice,
  violet: C.violetGlow,
  mint: C.mint,
  amber: C.amber,
  frost: C.frost,
};

/**
 * Smooth (Gaussian-like) radial falloff as a CSS radial-gradient string. Many stops = no visible rings.
 * shape e.g. 'circle 600px at 30% 70%' or 'ellipse 900px 500px at 50% 50%'.
 */
export const softRadial = (shape: string, color: string, peak: number, stops = 14, sharpness = 2.6): string => {
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = peak * Math.exp(-sharpness * t * t) * (1 - t * t * t); // gaussian with a hard zero at the edge
    parts.push(`${alpha(color, a)} ${(t * 100).toFixed(1)}%`);
  }
  return `radial-gradient(${shape}, ${parts.join(', ')})`;
};

/** Font stacks (loaded by src/fonts.ts). */
export const FONT = {
  display: '"Inter Tight", Inter, "Helvetica Neue", Arial, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  mono: '"JetBrains Mono", "DejaVu Sans Mono", monospace',
} as const;

/** Type scale from style.typography. */
export const TYPE = {
  headline: 120,
  headlineJustAsk: 160,
  headlineMin: 112,
  headlineTracking: '-0.03em',
  headlineLineHeight: 0.95,
  accentScale: 1.08,
  sub: 44, // Inter Tight 500, Slate
  triptychTitle: 48, // 700
  gloss: 28, // 500
  pill: 19, // 600 uppercase +0.14em (18-20)
  pillTracking: '0.14em',
  footnote: 20, // 500
  prompt: 40, // mono
  code: 48, // mono
  tileFile: 22, // mono
  stat: 30, // mono tabular-nums
  status: 26, // mono
  folderTab: 28, // mono
  endMono: 24, // mono
} as const;

/** Easing curves (style.motionLanguage). */
export const EASE = {
  /** every reveal and camera move (18-24f) */
  EXPO_OUT: Easing.bezier(0.16, 1, 0.3, 1),
  /** exits over 10f */
  EXIT: Easing.bezier(0.7, 0, 0.84, 0),
  /** symmetric, used by the light-wipe travel */
  IN_OUT: Easing.bezier(0.65, 0, 0.35, 1),
  LINEAR: Easing.linear,
} as const;

/** Spring configs (use with spring({frame, fps, config})). */
export const SPRING: Record<'GLIDE' | 'SNAP' | 'HINGE', Partial<SpringConfig>> = {
  /** panels, pills, float-forward. No bounce. */
  GLIDE: {damping: 200},
  /** tiles, cards, chips, badges. Small premium overshoot. */
  SNAP: {mass: 0.8, damping: 14, stiffness: 120},
  /** triptych hinges and folder lid. ~3deg overshoot. */
  HINGE: {stiffness: 260, damping: 14},
};

/** Shadow presets for glass objects. */
export const SHADOW = {
  glass: '0 1px 0 0 rgba(255,255,255,0.10) inset, 0 24px 48px -18px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.35)',
  lifted: '0 1px 0 0 rgba(255,255,255,0.14) inset, 0 48px 80px -24px rgba(0,0,0,0.85), 0 6px 18px rgba(0,0,0,0.45)',
  soft: '0 12px 32px -12px rgba(0,0,0,0.7)',
} as const;
