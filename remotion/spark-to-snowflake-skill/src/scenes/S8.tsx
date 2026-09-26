import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption, Headline, useFontsLoaded} from '../components';
import {C, EASE, TYPE} from '../theme';
import {COPY} from '../demoData';
import {END_STACK} from '../layout';
import {ramp, reveal} from '../motion';
import {T8} from './s8/timing';
import {AxisLight} from './s8/AxisLight';
import {EndEmblem} from './s8/EndEmblem';
import {headlineSpan} from './s8/lineSpan';

/** The accent word of the end line (Instrument Serif Italic, gradient fill). */
const ACCENT = 'skill';

/**
 * The honest caveat, shortened (round-2 review: 16 words at 20px Dim could not be read in the ~2.4s left).
 * It keeps the first two sentences of COPY.s8Footnote verbatim, so the string still comes from demoData:
 * "Illustrative demo. Some Spark code needs a redesign, not a conversion." (11 words). That is the line that
 * heads off "will this convert everything?"; the dropped "Validate on your own workload." is implied by it.
 */
const FOOTNOTE = (COPY.s8Footnote.match(/[^.]+\./g) ?? [COPY.s8Footnote]).slice(0, 2).join('').trim();
/**
 * 22px (TYPE.footnote x1.1) in full Slate (~5.8:1 on this stage), up from 20px Dim/Slate 90%, so it survives
 * h264 and reads at 1x; still clearly the quietest line under the 44px Frost sub.
 */
const FOOTNOTE_SIZE = Math.round(TYPE.footnote * 1.1);
/** Caption y is the line-box centre; for Inter Tight the baseline sits ~0.35em below it, so this lands on y980. */
const FOOTNOTE_Y = END_STACK.footnoteBaseline - Math.round(0.35 * FOOTNOTE_SIZE);
/**
 * The sub sits 26px lower than END_STACK.subY: at y660 it was only ~14px under the descenders of 'Migration,'
 * and the title and sub felt jammed (round-1 review). This opens a ~40px gap.
 */
const LINE_DROP = 26;
const SUB_Y = END_STACK.subY + LINE_DROP;

/**
 * S8 END CARD (global f990-1110, 120 frames).
 * The S7->S8 light-wipe (drawn by Main, centred on the cut) clears to a calm, ice-dominant stage by lf6.
 *  - lf-2..26: the skill folder (230px, see EndEmblem) rises out of the wipe and settles on the light axis at
 *    (960,340) (GLIDE, focus pull). Its spring starts under the wipe, so it is already there, still rising, as
 *    the wipe clears (no empty beat). From lf8 an edge light (a ~70deg arc + bloom) orbits its rim, 1 rev / 90f.
 *  - lf12: 'Migration, as a skill.' builds word by word ('skill' in Instrument Serif Italic).
 *  - lf30-60: the signature gradient sweeps left->right through the line; a matching warm->cool glint runs
 *    along the axis exactly above the band and passes THROUGH the folder, which catches the light.
 *  - lf34 sub (44px Frost); lf40 the short honest footnote fades in (22px Slate, baseline 980).
 *    The storyboard's mono line is cut: S2, S3 and S7 already show the folder name and its three parts, and it
 *    left ~30 words to read in ~1.2s (round-2 review).
 *  - lf66-120: calm hold (orbiting edge light, slow float, breathing halo). No fade to black.
 */
export const S8: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  useFontsLoaded();
  const span = headlineSpan(COPY.s8, [ACCENT]);
  return (
    <AbsoluteFill>
      {/* light on the axis (behind the folder, seen through its glass) */}
      <AxisLight f={f} span={span} />
      {/* hero: the folder emblem */}
      <EndEmblem f={f} fps={fps} span={span} />
      {/* headline + lines */}
      <Headline
        text={COPY.s8}
        accentWord={ACCENT}
        enterAt={T8.headline}
        y={END_STACK.headlineCapY}
        sweep={ramp(f, T8.sweepFrom, T8.sweepTo)}
      />
      <Caption text={COPY.s8Sub} enterAt={T8.sub} y={SUB_Y} fontSize={TYPE.sub} color={C.frost} />
      <Caption
        text={FOOTNOTE}
        enterAt={T8.footnote}
        y={FOOTNOTE_Y}
        fontSize={FOOTNOTE_SIZE}
        color={C.slate}
        opacity={reveal(f, T8.footnote, T8.footnoteFade, EASE.IN_OUT)}
        perWord={false}
        mode="fade"
        duration={1}
      />
    </AbsoluteFill>
  );
};
