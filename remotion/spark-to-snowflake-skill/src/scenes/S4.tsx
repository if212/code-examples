import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Caption, Headline, drift} from '../components';
import {TYPE} from '../theme';
import {COPY} from '../demoData';
import {T4} from './s4/timing';
import {ClosingTriptych, SlabMorph, SnapFlash} from './s4/SlabToCard';
import {PromptPill} from './s4/PromptPill';
import {MatchBeams, Shelf, StatusLine} from './s4/Shelf';

/**
 * S4 — HOW YOU USE IT: "Just ask." Global f420-570 (150f).
 * The S3 triptych snaps shut and flies onto a shelf of one-line skills as the spark-to-snowflake card. On the
 * left a flat glass prompt pill types a plain request. On Enter the words 'Migrate' and 'Snowflake' light up,
 * violet beams carry them to the one card whose description matches, that card lifts with a 'matched' tag
 * while the others dim, grows its Playbook / Mappings / Checks row with only Playbook lit, and a status line
 * confirms the skill was loaded. The last frames hold the matched card exactly where S5 collapses it.
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
      <Caption text={COPY.s4Sub} enterAt={T4.sub} keyWord="matching" keyGradient="violet" />
    </AbsoluteFill>
  );
};
