import {measureWidth} from '../../components';
import {FONT, TYPE} from '../../theme';

/**
 * Laid-out width (px) of a one-line Headline, measured the same way Headline.tsx lays it out
 * (Inter Tight 800 at -0.04em, accent words in Instrument Serif Italic at 1.08x / -0.005em, 0.24em word gap).
 * Used to put the axis runner exactly under the headline's gradient-sweep band.
 * Only exact once fonts are loaded (the Headline on the same frame holds rendering until they are).
 */
const GAP_EM = 0.24;

export const headlineSpan = (text: string, accent: string[], size: number = TYPE.headline): number => {
  const disp = `800 ${size}px ${FONT.display}`;
  const track = -0.04 * size;
  const words = text.split(' ').filter(Boolean);
  let total = 0;
  words.forEach((tok) => {
    const m = tok.match(/^(.*?)([.,!?:;]*)$/);
    const core = m ? m[1] : tok;
    const punct = m ? m[2] : '';
    const isAccent = accent.map((a) => a.toLowerCase()).includes(core.toLowerCase());
    const aSize = size * TYPE.accentScale;
    total += isAccent
      ? measureWidth(core, `italic 400 ${aSize}px ${FONT.serif}`, -0.005 * aSize)
      : measureWidth(core, disp, track);
    if (punct) total += measureWidth(punct, disp, track);
  });
  return total + GAP_EM * size * Math.max(0, words.length - 1);
};
