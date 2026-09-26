import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Caption, Headline, drift} from '../components';
import {TYPE} from '../theme';
import {COPY} from '../demoData';
import {T4} from './s4/timing';
import {ClosingTriptych, SlabMorph, SnapFlash} from './s4/SlabToCard';
import {PromptPill} from './s4/PromptPill';
import {MatchBeams, Shelf} from './s4/Shelf';
import {StatusLine} from './s4/StatusLine';
import {S4_SUB, S4_SUB_KEY} from './s4/copy';

/**
 * S4 — HOW YOU USE IT: "Just ask." Global f420-570 (150f).
 * The S3 triptych snaps shut and flies onto a labelled shelf of one-line skills ('Your skills') as the
 * spark-to-snowflake card. On the left a flat glass prompt pill types a plain request. On Enter the words
 * 'Migrate' and 'Snowflake' light up; a violet trace rises from each, the two join above the pill and continue
 * as one beam into the one card whose description matches. That card lifts (clear of the light axis) with a
 * 'matched' tag while the others dim, a light pulse runs along it lighting the same two words in its
 * description, and it grows its Playbook / Mappings / Checks row with only Playbook lit. The status line types
 * under the pill; the sub-caption (from Enter) names who does the matching. The last frames hold for S5.
 */

const SHOT = 150;

export const S4: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  // slow shot drift, zeroed at lf0 so the first frame matches S3's last frame exactly
  const d0 = drift(0, SHOT, 'S4', 0.02);
  const d = drift(f, SHOT, 'S4', 0.02);
  const cam = {scale: d.scale, rotate: d.rotate - d0.rotate, x: d.x - d0.x, y: d.y - d0.y};

  return (
    <AbsoluteFill>
      {/* hero objects */}
      <Camera drift={cam}>
        <ClosingTriptych f={f} fps={fps} />
        <SnapFlash f={f} />
        <Shelf f={f} fps={fps} />
        <SlabMorph f={f} />
        <PromptPill f={f} fps={fps} />
        <StatusLine f={f} fps={fps} />
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <MatchBeams f={f} fps={fps} />
        </AbsoluteFill>
      </Camera>

      {/* headlines + sub-caption (outside the camera) */}
      {f < T4.headlineOut + 12 ? <Headline text={COPY.s3} accentWord="skill" enterAt={-100} exitAt={T4.headlineOut} /> : null}
      <Headline text={COPY.s4} keyWord="ask" fontSize={TYPE.headlineJustAsk} enterAt={T4.headline} />
      <Caption text={S4_SUB} enterAt={T4.sub} keyWord={S4_SUB_KEY} keyGradient="violet" />
    </AbsoluteFill>
  );
};
