import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Caption, Headline, SkillFolder, folderMetrics} from '../components';
import {C, EASE, softRadial} from '../theme';
import {TRIPTYCH} from '../layout';
import {COPY, SKILL_FOLDER_LABEL} from '../demoData';
import {bell, clamp01, ramp, reveal, snap, wobble} from '../motion';
import {CoreGlow, HingeLights, SheenBand, Triptych} from './s3/Triptych';
import {S3_HEADLINE, S3_SUB, S3_SUB_KEY} from './s3/copy';
import {MatchTicket} from './s3/MatchTicket';
import {
  CORE_GLOW_REST,
  FOLDER,
  SEAM_REST,
  SLAB_SCALE,
  SLAB_W,
  SLOT_REST,
  T,
  cameraScale,
  cameraX,
  cameraY,
  coverMorph,
  dissolve,
  grow,
  interiorLight,
  matchWidth,
  openL,
  openR,
  panelAccent,
  panelBright,
  turnP,
  turnSheen,
  turnTilt,
  turnYaw,
} from './s3/timing';

/**
 * S3 — WHAT A SKILL IS (the screenshot moment), global f270-420 (150f).
 * The S2 folder swings toward the camera (a shallow yaw, never edge-on) and cross-dissolves into a glass slab
 * (the closed triptych) at 1.35x; two white-hot seams light
 * its hinges; the Playbook and Checks wings swing open from +-180deg with light pouring through the hinges
 * while the camera pulls back onto the TRIPTYCH constants. Contents reveal left to right (the active panel
 * at 100%, the others at 70%), then a mint 'match' ticket slides out of the sealed Checks panel. A slate
 * sub-caption names who uses the folder (the film has no audio). The last
 * frame is exactly the open triptych at identity camera, which S4 snaps shut.
 */

/** Soft bloom that peaks while the folder cross-dissolves into the slab (sized to the object, screen-blended). */
const TurnBloom: React.FC<{p: number; cy: number}> = ({p, cy}) => {
  if (p <= 0.002) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 960 - 520,
          top: cy - 360,
          width: 1040,
          height: 720,
          opacity: p,
          background: [
            softRadial('ellipse 36% 34% at 50% 50%', C.whiteHot, 0.13, 12, 2.6),
            softRadial('ellipse 50% 50% at 50% 50%', C.violet, 0.16, 14, 2.4),
          ].join(', '),
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  // turn + grow (lf0-20): a shallow yaw swing (never edge-on) with a size-matched cross-dissolve folder -> slab
  const u = turnP(f);
  const g = grow(f, fps);
  const yaw = turnYaw(f);
  const tilt = turnTilt(f);
  const x = dissolve(f);
  const mw = matchWidth(f);
  const camUp = 1 + (SLAB_SCALE - 1) * g; // the hero camera scale while the turn runs (pull-back starts at lf22)
  const folderScale = camUp * (mw / FOLDER.width);
  const slabK = mw / SLAB_W;
  const folderCy = FOLDER.cy - (FOLDER.cy - 600) * g;
  const sheen = turnSheen(f);
  const bloom = bell(clamp01((u - 0.22) / 0.56));
  const fm = folderMetrics(FOLDER.width);
  const folderTransform = `perspective(${(2000 * camUp).toFixed(1)}px) rotateX(${tilt.toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg) scale(${folderScale.toFixed(5)})`;
  const showFolder = x < 0.999;
  const showSlab = x > 0.001;

  // camera (hero): 1 -> 1.35 -> pull-back to exactly 1 at lf149
  const S = cameraScale(f, fps);
  const camX = cameraX(f, fps);
  const camY = cameraY(f, fps);

  // hinges
  const pL = openL(f, fps);
  const pR = openR(f, fps);
  const appear = reveal(f, T.seams, 12);
  const seamPulse = 0.7 * bell(ramp(f, T.seams, T.seams + 12));
  const seamLevel =
    appear * (SEAM_REST + 0.5 * (1 - ramp(f, T.openR + 6, 84))) +
    0.05 * wobble('s3-seam', f, 0.03) * ramp(f, 60, 70);
  const flareL = bell(clamp01(pL)) + seamPulse;
  const flareR = bell(clamp01(pR)) + seamPulse;

  // light, brightness, sheen
  const light = interiorLight(f);
  const bright = [panelBright(f, 0), panelBright(f, 1), panelBright(f, 2)] as const;
  const accent = [panelAccent(f, 0), panelAccent(f, 1), panelAccent(f, 2)] as const;
  const sheenP = interpolate(f, [T.sheenFrom, T.sheenTo], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.IN_OUT});
  const sheenX = f >= T.sheenFrom && f <= T.sheenTo ? -320 + (TRIPTYCH.width + 640) * sheenP : null;

  // ticket
  const slot = SLOT_REST * ramp(f, T.slotGlow, T.slotGlow + 6) + (1 - SLOT_REST) * bell(ramp(f, T.slotGlow, T.ticket + 16));
  const ticketP = snap(f, T.ticket, fps);
  const ticketDraw = reveal(f, T.ticket + 5, 12);
  const ticketGlow = bell(ramp(f, T.ticket + 4, T.ticket + 26));

  const coreGlow = (CORE_GLOW_REST + 0.5 * light) * x;

  return (
    <AbsoluteFill>
      {/* the S2 folder turning toward the camera, dissolving into the slab (lf0 ~ lf11) */}
      {showFolder ? (
        <AbsoluteFill>
          <SkillFolder
            cx={FOLDER.cx}
            cy={folderCy}
            width={FOLDER.width}
            label={SKILL_FOLDER_LABEL}
            glow={0.6}
            opacity={1 - x}
            transform={folderTransform}
          />
          {sheen.strength > 0.01 ? (
            <div
              style={{
                position: 'absolute',
                left: FOLDER.cx - FOLDER.width / 2,
                top: folderCy - fm.height / 2,
                width: FOLDER.width,
                height: fm.height,
                opacity: 1 - x,
                transform: folderTransform,
              }}
            >
              <SheenBand pos={sheen.pos} strength={sheen.strength} radius={fm.r} style={{top: fm.tabH}} />
            </div>
          ) : null}
        </AbsoluteFill>
      ) : null}

      {/* hero: the slab / triptych, in camera space */}
      <Camera scale={S} x={camX} y={camY}>
        <CoreGlow strength={coreGlow} />
        {showSlab ? (
          <Triptych
            frame={f}
            openL={pL}
            openR={pR}
            turn={yaw}
            tilt={tilt}
            turnScale={slabK}
            coverSheen={sheen}
            coverMorph={coverMorph(f)}
            opacity={x}
            starts={T.content}
            bright={bright}
            accent={accent}
            light={light}
            sheenX={sheenX}
            slot={slot}
          />
        ) : null}
        <HingeLights level={seamLevel} flareL={flareL} flareR={flareR} appear={appear} />
        <MatchTicket p={ticketP} draw={ticketDraw} glow={ticketGlow} />
      </Camera>

      <TurnBloom p={bloom} cy={folderCy} />

      {/* headlines (outside the camera) */}
      {f < 12 ? <Headline text={COPY.s2} accentWord="once" enterAt={-100} exitAt={0} /> : null}
      <Headline text={S3_HEADLINE} accentWord="skill" enterAt={T.headline} />
      <Caption text={S3_SUB} keyWord={S3_SUB_KEY} keyGradient="violet" enterAt={T.sub} exitAt={T.subOut} />
    </AbsoluteFill>
  );
};
