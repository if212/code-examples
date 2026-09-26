import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Caption, Headline, SkillDock, drift} from '../components';
import {SKILL_DOCK} from '../layout';
import {COPY} from '../demoData';
import {reveal} from '../motion';
import {EASE} from '../theme';
import {MatesLayer, YouLayer} from './s7/Boards';
import {TeamBeams} from './s7/Beams';
import {Hub, HubChip} from './s7/Hub';
import {TeamCursors} from './s7/Cursors';
import {T7} from './s7/timing';

/**
 * S7 — TEAM REUSE: "Same playbook. Whole team." Global f885-990 (105f).
 * The camera pulls back out of S6's code panel: the panel folds back into latest_customers.sql and the full
 * board shrinks into the 'You' mini board. S6's headline, sub-caption and skill dock clear over lf0-5, before
 * the fast part of the move; the teammate boards (still ember, waiting) fade in only once the camera settles.
 * The skill folder rises at centre as a glowing hub ('shared in your repo'). Beams draw from the hub to Leo,
 * Priya and Sam; each teammate's cursor glides in, each board runs the same diagonal ember -> ice wave and
 * lands exactly one amber tile, which its owner then moves onto to review. Hold from lf80; the stage recedes
 * behind the S7 -> S8 light-wipe (Main) from lf96.
 */

const LIT_ALL = {playbook: 1, mappings: 1, checks: 1};

export const S7: React.FC = () => {
  const f = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  // slow shot drift, zeroed at lf0 so the first frame is exactly S6's last picture
  const d0 = drift(0, durationInFrames, 'S7', 0.02);
  const d = drift(f, durationInFrames, 'S7', 0.02);
  const recede = reveal(f, T7.recede, T7.recedeDur, EASE.IN_OUT);
  const cam = {scale: d.scale * (1 - 0.1 * recede), rotate: d.rotate - d0.rotate, x: d.x - d0.x, y: d.y - d0.y};

  // S6's headline, sub-caption and dock all leave together over lf0-5 (opacity 0 by global 890)
  const prevOut = interpolate(f, [T7.prevExit, T7.prevExit + T7.prevExitDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.IN_OUT,
  });
  const dockOut = interpolate(f, [T7.prevExit, T7.prevExit + T7.dockExitDur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.IN_OUT,
  });
  const prevOn = f < T7.prevExit + T7.prevExitDur;

  return (
    <AbsoluteFill>
      {/* hero: boards, plates, beams, hub folder, chip */}
      <Camera {...cam}>
        <YouLayer f={f} recede={recede} />
        <MatesLayer f={f} recede={recede} />
        <TeamBeams f={f} recede={recede} />
        <Hub f={f} recede={recede} />
        <HubChip f={f} recede={recede} />
      </Camera>

      {/* cursors (same camera, so they stay registered on their boards) */}
      <Camera {...cam}>
        <TeamCursors f={f} recede={recede} />
      </Camera>

      {/* S6's dock, sliding 40px out to the left */}
      {dockOut < 1 ? (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          <SkillDock lit={LIT_ALL} opacity={1 - dockOut} x={SKILL_DOCK.x0 - 40 * dockOut} />
        </AbsoluteFill>
      ) : null}

      {/* headlines: S6's line and sub-caption clear over lf0-5, then the S7 line enters at lf6 */}
      {prevOn ? <Headline text={COPY.s6} keyWord="traps" enterAt={-100} exitAt={T7.prevExit} opacity={1 - prevOut} /> : null}
      {prevOn ? (
        <Caption text={COPY.s6Sub} enterAt={-100} exitAt={T7.prevExit} keyWord="NULLs" keyGradient="frost" opacity={1 - prevOut} />
      ) : null}
      <Headline text={COPY.s7} keyWord="team" keyGradient="ice" enterAt={T7.headline} />
    </AbsoluteFill>
  );
};
