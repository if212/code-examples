import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Board, Camera, Cursor, Headline, Spotlight, useFontsLoaded} from '../components';
import {C} from '../theme';
import {tileRect} from '../layout';
import {MISSED_INDEX} from '../demoData';
import {clamp01} from '../motion';
import {S1_HEADLINE_A, S1_HEADLINE_B, s1ActiveTile, s1Camera, s1Cursor, s1JitterFrame, s1MissP, s1MissShake, s1TileState} from './s1/state';
import {MissedSlotOnBoard} from './s1/MissedSlotMark';

/**
 * S1 - HOOK + PAIN (global f0-150).
 * A 4x3 wall of ember Spark job tiles cascades in; from lf30 the ember layer runs on stepped 'by hand' time
 * (floor(f/3)*3 + seeded jitter). The 'you' cursor stamps Rewrite / Fix / Test on tile 0, again on tile 1
 * ('again' stamp), then rushes tile 2 and skips 'Fix' (empty dashed slot) and moves on; at lf120 the slot
 * turns coral and the 'missed one' tag glitches on behind it. Headlines stay on smooth time.
 * All state lives in ./s1/state.ts so S2 can reproduce the end frame.
 */
export const S1: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  useFontsLoaded(); // chip geometry (cursor targets, missed-slot mark) is measured from the loaded font

  const cam = s1Camera(f);
  const cur = s1Cursor(f);
  const active = s1ActiveTile(f);
  const jf = s1JitterFrame(f);
  const miss = s1MissP(f);
  const activeRect = active >= 0 ? tileRect(active) : null;
  const missRect = tileRect(MISSED_INDEX);

  return (
    <AbsoluteFill>
      {/* hero: glow pools + board + cursor share the shot drift */}
      <Camera drift={cam}>
        {activeRect ? <Spotlight cx={activeRect.cx} cy={activeRect.cy + 10} rx={300} ry={190} color={C.ember} intensity={0.16} /> : null}
        {miss > 0.001 ? <Spotlight cx={missRect.cx} cy={missRect.cy} rx={330} ry={210} color={C.coral} intensity={0.22 * clamp01(miss)} /> : null}
        <Board tile={(i) => s1TileState(i, f, fps)} jitterFrame={jf}>
          <MissedSlotOnBoard p={miss} jitterFrame={jf} shake={s1MissShake(f)} />
        </Board>
        <AbsoluteFill>
          <Cursor x={cur.x} y={cur.y} label="you" opacity={cur.opacity} scale={cur.scale} press={cur.press} tilt={-4} />
        </AbsoluteFill>
      </Camera>
      {/* headlines: smooth time, outside the camera */}
      <Headline {...S1_HEADLINE_A} />
      <Headline {...S1_HEADLINE_B} />
    </AbsoluteFill>
  );
};
