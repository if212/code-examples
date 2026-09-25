import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Camera, Headline, SkillFolder} from '../components';
import {C, EASE, alpha, softRadial} from '../theme';
import {TRIPTYCH} from '../layout';
import {COPY, SKILL_FOLDER_LABEL} from '../demoData';
import {bell, clamp01, ramp, reveal, snap, wobble} from '../motion';
import {CoreGlow, HingeLights, Triptych} from './s3/Triptych';
import {MatchTicket} from './s3/MatchTicket';
import {CORE_GLOW_REST, FOLDER, SEAM_REST, SLOT_REST, T, cameraScale, cameraX, cameraY, grow, interiorLight, openL, openR, panelAccent, panelBright, turnP} from './s3/timing';

/**
 * S3 — WHAT A SKILL IS (the screenshot moment), global f270-420 (150f).
 * The S2 folder turns and becomes a glass slab (the closed triptych) at 1.35x; two white-hot seams light
 * its hinges; the Playbook and Checks wings swing open from +-180deg with light pouring through the hinges
 * while the camera pulls back onto the TRIPTYCH constants. Contents reveal left to right (the active panel
 * at 100%, the others at 70%), then a mint 'match' ticket slides out of the sealed Checks panel. The last
 * frame is exactly the open triptych at identity camera, which S4 snaps shut.
 */

/** White-hot edge glint while the folder / slab is edge-on during the turn (canvas space). */
const EdgeGlint: React.FC<{p: number; cy: number; h: number}> = ({p, cy, h}) => {
  if (p <= 0.002) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 960 - 160,
          top: cy - h / 2 - 90,
          width: 320,
          height: h + 180,
          opacity: p,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.5, 12, 2.6),
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 960 - 2,
          top: cy - h / 2,
          width: 4,
          height: h,
          borderRadius: 2,
          opacity: p,
          background: `linear-gradient(180deg, ${alpha(C.whiteHot, 0)} 0%, #FFFFFF 18%, ${C.whiteHot} 50%, #FFFFFF 82%, ${alpha(C.whiteHot, 0)} 100%)`,
          boxShadow: `0 0 12px ${alpha(C.whiteHot, 0.95)}, 0 0 36px ${alpha(C.violet, 0.8)}`,
        }}
      />
    </AbsoluteFill>
  );
};

export const S3: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  // turn + grow (lf0-20)
  const u = turnP(f);
  const g = grow(f, fps);
  const folderScale = 1 + 0.35 * g;
  const folderCy = FOLDER.cy - (FOLDER.cy - 600) * g;
  const showFolder = u < 0.5;
  const showSlab = u > 0.5;
  const folderDeg = 180 * u; // 0 -> 90
  const slabDeg = 180 * u - 180; // -90 -> 0
  const glint = clamp01(1 - Math.abs(u - 0.5) / 0.17);

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

  const coreGlow = showSlab ? CORE_GLOW_REST + 0.5 * light : 0;

  return (
    <AbsoluteFill>
      {/* the S2 folder turning away (lf0 ~ lf7) */}
      {showFolder ? (
        <AbsoluteFill>
          <SkillFolder
            cx={FOLDER.cx}
            cy={folderCy}
            width={FOLDER.width}
            label={SKILL_FOLDER_LABEL}
            glow={0.6}
            transform={`perspective(2000px) rotateY(${folderDeg.toFixed(3)}deg) scale(${folderScale.toFixed(4)})`}
          />
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
            turn={slabDeg}
            starts={T.content}
            bright={bright}
            accent={accent}
            light={light}
            sheenX={sheenX}
            slot={slot}
          />
        ) : null}
        {showSlab ? <HingeLights level={seamLevel} flareL={flareL} flareR={flareR} appear={appear} /> : null}
        <MatchTicket p={ticketP} draw={ticketDraw} glow={ticketGlow} />
      </Camera>

      <EdgeGlint p={glint} cy={folderCy} h={420 * folderScale} />

      {/* headlines (outside the camera) */}
      {f < 12 ? <Headline text={COPY.s2} accentWord="once" enterAt={-100} exitAt={0} /> : null}
      <Headline text={COPY.s3} accentWord="skill" enterAt={T.headline} />
    </AbsoluteFill>
  );
};
