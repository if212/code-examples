import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/**
 * Offline font loading. Imported ONCE by src/Root.tsx (side effect).
 * @remotion/fonts' loadFont() holds rendering with delayRender() until each face is ready.
 * Do NOT use @remotion/google-fonts (fails in this container).
 */
type Face = {family: string; file: string; weight: string; style?: 'normal' | 'italic'};

const FACES: Face[] = [
  {family: 'Inter Tight', file: 'inter-tight-latin-500-normal.woff2', weight: '500'},
  {family: 'Inter Tight', file: 'inter-tight-latin-600-normal.woff2', weight: '600'},
  {family: 'Inter Tight', file: 'inter-tight-latin-700-normal.woff2', weight: '700'},
  {family: 'Inter Tight', file: 'inter-tight-latin-800-normal.woff2', weight: '800'},
  {family: 'Instrument Serif', file: 'instrument-serif-latin-400-italic.woff2', weight: '400', style: 'italic'},
  {family: 'JetBrains Mono', file: 'jetbrains-mono-latin-500-normal.woff2', weight: '500'},
  {family: 'JetBrains Mono', file: 'jetbrains-mono-latin-700-normal.woff2', weight: '700'},
];

let started: Promise<void> | null = null;

/** Starts loading all faces (idempotent). Resolves when every face is in document.fonts. */
export const loadAllFonts = (): Promise<void> => {
  if (!started) {
    started = Promise.all(
      FACES.map((f) =>
        loadFont({
          family: f.family,
          url: staticFile(`fonts/${f.file}`),
          weight: f.weight,
          style: f.style ?? 'normal',
        }),
      ),
    ).then(() => undefined);
  }
  return started;
};

/** Resolves once all fonts are loaded. Components that measure text await this. */
export const fontsReady: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : loadAllFonts();
