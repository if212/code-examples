import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {fontsReady} from '../fonts';

/**
 * Synchronous text measurement (canvas) that is only trusted after the local fonts are loaded.
 * useFontsLoaded() holds the frame with delayRender until fonts are in, then re-renders, so any width
 * computed during render is exact and deterministic.
 */
let loaded = false;
if (typeof document !== 'undefined') {
  fontsReady.then(() => {
    loaded = true;
  });
}

export const useFontsLoaded = (): boolean => {
  const [ok, setOk] = useState(loaded);
  const [handle] = useState<number | null>(() => (loaded ? null : delayRender('Fonts for text measurement')));
  useEffect(() => {
    if (ok) return;
    let alive = true;
    fontsReady.then(() => {
      if (alive) setOk(true);
    });
    return () => {
      alive = false;
    };
  }, [ok]);
  useEffect(() => {
    if (ok && handle !== null) continueRender(handle);
  }, [ok, handle]);
  return ok;
};

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/**
 * Width in px of `text` in the given CSS font shorthand (e.g. '800 120px "Inter Tight"'), with letter
 * spacing in px (CSS letter-spacing adds after every glyph, same as canvas letterSpacing).
 */
export const measureWidth = (text: string, font: string, letterSpacingPx = 0): number => {
  if (typeof document === 'undefined') return text.length * 0.55 * 100;
  const key = `${font}|${letterSpacingPx}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx) {
    const c = document.createElement('canvas');
    ctx = c.getContext('2d');
  }
  if (!ctx) return 0;
  ctx.font = font;
  (ctx as unknown as {letterSpacing: string}).letterSpacing = `${letterSpacingPx}px`;
  const w = ctx.measureText(text).width;
  if (loaded) cache.set(key, w);
  return w;
};
