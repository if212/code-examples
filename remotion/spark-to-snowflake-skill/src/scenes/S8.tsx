import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Caption, Headline, useFontsLoaded} from '../components';
import {C, EASE, TYPE} from '../theme';
import {COPY, SKILL_FOLDER_LABEL} from '../demoData';
import {END_STACK} from '../layout';
import {ramp, reveal} from '../motion';
import {T8} from './s8/timing';
import {AxisLight} from './s8/AxisLight';
import {EndEmblem} from './s8/EndEmblem';
import {headlineSpan} from './s8/lineSpan';

/** The accent word of the end line (Instrument Serif Italic, gradient fill). */
const ACCENT = 'skill';

/**
 * The footnote is the honest caveat, so it must stay readable after h264 compression. Dim (#5E6A80) is only
 * ~3.4:1 on this stage, so the line uses Slate at 80% (~5:1). It is still clearly the quietest line on screen
 * (20px, vs the 24px mono line and the 44px sub).
 */
const FOOTNOTE_OPACITY = 0.8;
/** Caption y is the line-box centre; -7px puts a 20px Inter Tight baseline on y980 (render-verified). */
const FOOTNOTE_Y = END_STACK.footnoteBaseline - 7;

/**
 * S8 END CARD (global f990-1110, 120 frames).
 * The S7->S8 light-wipe (drawn by Main, centred on the cut) clears to a calm, ice-dominant stage by lf6.
 *  - lf2-28: the skill folder (160px) rises out of the wipe and settles on the light axis at (960,340) (GLIDE,
 *    focus pull); from lf8 a conic edge light orbits its rim, 1 revolution per 90f, with a travelling glint.
 *  - lf16: 'Migration, as a skill.' builds word by word ('skill' in Instrument Serif Italic).
 *  - lf30-60: the signature gradient sweeps left->right through the line; a matching warm->cool glint runs
 *    along the axis exactly above the band and passes THROUGH the folder, which catches the light.
 *  - lf40 sub (44px Frost), lf52 mono line (24px Slate, folder name in violet), lf60 footnote fades in.
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
      <Caption text={COPY.s8Sub} enterAt={T8.sub} y={END_STACK.subY} fontSize={TYPE.sub} color={C.frost} />
      <Caption
        text={COPY.s8Mono}
        enterAt={T8.mono}
        y={END_STACK.monoY}
        font="mono"
        fontSize={TYPE.endMono}
        tracking={0}
        color={C.slate}
        keyWord={SKILL_FOLDER_LABEL}
        keyGradient="violet"
      />
      <Caption
        text={COPY.s8Footnote}
        enterAt={T8.footnote}
        y={FOOTNOTE_Y}
        fontSize={TYPE.footnote}
        color={C.slate}
        opacity={FOOTNOTE_OPACITY * reveal(f, T8.footnote, T8.footnoteFade, EASE.IN_OUT)}
        perWord={false}
        mode="fade"
        duration={1}
      />
    </AbsoluteFill>
  );
};
