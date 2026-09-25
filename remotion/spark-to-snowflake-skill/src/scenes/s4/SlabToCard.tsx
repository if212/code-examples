import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {DirectionalBlur, Hairline, SkillCard} from '../../components';
import {C, EASE, SHADOW, alpha, softRadial} from '../../theme';
import {TRIPTYCH} from '../../layout';
import {MATCHED_SHELF_INDEX, SHELF} from '../../demoData';
import {bell, clamp01, hinge, ramp, velocity2D, wobble} from '../../motion';
import {CoreGlow, Cover, HingeLights, PanelFace} from '../s3/Triptych';
import {MatchTicket} from '../s3/MatchTicket';
import {PANEL_R, PERSPECTIVE, S3_END} from '../s3/timing';
import {CARD, SLAB, T4, boxAt} from './timing';

/**
 * S4 lf0-24: the open S3 triptych snaps shut (HINGE), then the closed slab shrinks into a one-line shelf card
 * and arcs into shelf slot 3. The 3D triptych is only rendered until it is fully closed (lf6); from then on
 * the slab is a flat morphing box, so the directional blur never touches a preserve-3d group.
 */

/** S3's last frame, for a seamless match cut. */
const S3_LAST = 149;
const PW = TRIPTYCH.panelW;
const PH = TRIPTYCH.panelH;
/** Hinge axes (canvas x): the middle of each 16px gap (same as S3). */
const HINGE_L = TRIPTYCH.panelX(1) - TRIPTYCH.gap / 2; // 732
const HINGE_R = TRIPTYCH.panelX(2) - TRIPTYCH.gap / 2; // 1188

/** Wing open progress while snapping shut: the HINGE spring, stopped by the centre panel (no pass-through). */
export const wingOpen = (f: number, at: number, fps: number): number => 1 - Math.min(1, hinge(f, at, fps));

/** Back of the Checks wing: plain smoked glass (same look as S3's). */
const SmokedBack: React.FC<{light?: number}> = ({light = 0}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: PANEL_R,
      background: 'linear-gradient(170deg, rgba(24,26,36,0.96) 0%, rgba(6,7,11,0.97) 100%)',
      boxShadow: SHADOW.glass,
      overflow: 'hidden',
    }}
  >
    <Hairline radius={PANEL_R} />
    {light > 0.004 ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: softRadial('ellipse 45% 85% at 0% 50%', C.whiteHot, 0.32 * light, 12, 2.4),
          mixBlendMode: 'screen',
        }}
      />
    ) : null}
  </div>
);

/**
 * One face of a hinged wing, drawn FLAT: each face carries its own perspective + rotateY about the hinge line
 * (vanishing point at the stage centre 960,600, like S3), with backface-visibility hidden. No preserve-3d, so
 * nothing can be depth-sorted wrongly when the wing is almost shut; the DOM order stacks the wings.
 */
const WingFace: React.FC<{k: 0 | 2; theta: number; back?: boolean; children: React.ReactNode}> = ({k, theta, back, children}) => {
  const left = TRIPTYCH.panelX(k);
  const hinge = k === 0 ? HINGE_L : HINGE_R;
  const hx = hinge - 960;
  const cx = left + PW / 2 - 960;
  const flip = back ? ` translateX(${cx}px) rotateY(180deg) translateX(${-cx}px)` : '';
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: TRIPTYCH.top,
        width: PW,
        height: PH,
        transformOrigin: `${960 - left}px ${600 - TRIPTYCH.top}px`,
        transform: `perspective(${PERSPECTIVE}px) translateX(${hx}px) rotateY(${theta.toFixed(3)}deg) translateX(${-hx}px)${flip}`,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {children}
    </div>
  );
};

/** lf0-6: the triptych closing, with the hinge light flaring through the narrowing gaps. */
export const ClosingTriptych: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const oL = wingOpen(f, T4.closeL, fps);
  const oR = wingOpen(f, T4.closeR, fps);
  // light pours out of the hinges as the gaps narrow, then is shut in
  const light = S3_END.light * (1 - ramp(f, 0, 4)) + 0.5 * bell(1 - oL) * (oL > 0 ? 1 : 0);
  const seam = (S3_END.hingeLevel + 0.05 * wobble('s3-seam', S3_LAST + f, 0.03)) * (1 - ramp(f, 0, T4.seamOff));
  // the ticket is pulled back into its slot while the Checks wing folds (gone before the wing is edge-on)
  const ticket = 1 - interpolate(f, [0, T4.ticketDur], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.IN_OUT});
  const slot = S3_END.slot + 0.5 * bell(ramp(f, 0, T4.ticketDur + 1));
  const thL = 180 * (1 - oL);
  const thR = -180 * (1 - oR);
  const swingL = oL < 0.999 ? bell(clamp01(oL)) : 0;
  const swingR = oR < 0.999 ? bell(clamp01(oR)) : 0;
  const face = (k: 0 | 1 | 2, extra: {swing?: number; slot?: number}) => (
    <PanelFace k={k} frame={S3_LAST + f} start={-Infinity} bright={S3_END.bright[k]} accent={S3_END.accent[k]} light={light} {...extra} />
  );
  return (
    <>
      <CoreGlow strength={S3_END.coreGlow * (1 - ramp(f, 0, 16))} />
      {f < T4.flyFrom ? (
        <AbsoluteFill>
          <div style={{position: 'absolute', left: TRIPTYCH.panelX(1), top: TRIPTYCH.top, width: PW, height: PH}}>{face(1, {})}</div>
          <WingFace k={2} theta={thR}>
            {face(2, {swing: swingR, slot})}
          </WingFace>
          <WingFace k={2} theta={thR} back>
            <SmokedBack light={light * (1 - clamp01(oR))} />
          </WingFace>
          <WingFace k={0} theta={thL}>
            {face(0, {swing: swingL})}
          </WingFace>
          <WingFace k={0} theta={thL} back>
            <Cover swing={swingL} />
          </WingFace>
          <HingeLights level={seam} flareL={0.7 * bell(oL)} flareR={0.7 * bell(oR)} appear={1} />
          <MatchTicket p={ticket} draw={S3_END.ticketDraw} glow={0} />
        </AbsoluteFill>
      ) : null}
    </>
  );
};

/**
 * The flat slab -> card morph (lf6-24). A violet glass box interpolates from the closed slab's rect to the
 * card slot along an arc; the slab's cover (label + icons) fades out early, the real card face fades in late,
 * so on landing it is exactly the <SkillCard/> that takes over.
 */
const PAD = 90;

/** The closed slab's body (same fill as the S3 cover, without its label and icons). */
const SLAB_BODY = [
  'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0.0) 60%)',
  `linear-gradient(172deg, ${alpha(C.violet, 0.4)} 0%, ${alpha(C.violetGlow, 0.24)} 40%, ${alpha('#1A1045', 0.86)} 100%)`,
  'rgba(10,8,26,0.9)',
].join(', ');
const SIGNATURE_RIM = `linear-gradient(115deg, ${C.ember} 0%, ${C.emberGlow} 28%, ${C.whiteHot} 50%, ${C.iceGlow} 72%, ${C.ice} 100%)`;

export const SlabMorph: React.FC<{f: number}> = ({f}) => {
  if (f < T4.flyFrom || f >= T4.flyTo) return null;
  const b = boxAt(f, PANEL_R);
  const t = b.t;
  const centre = (fr: number) => {
    const q = boxAt(fr, PANEL_R);
    return {x: q.cx, y: q.cy};
  };
  const v = velocity2D(centre, f);
  const matched = SHELF[MATCHED_SHELF_INDEX];
  // impact of the snap (the wing lands ~lf5): a white-hot rim flash + glow, fading while it flies
  const impact = bell(ramp(f, 3, 13));
  // the violet slab body persists through the flight; only its label + icons fade early, and the card face
  // (lifted -> resting) cross-fades in so the landing frame is exactly the resting <SkillCard/>
  const coverO = 1 - ramp(t, 0.02, 0.34);
  const baseO = 1 - ramp(t, 0.62, 0.96);
  const cardO = ramp(t, 0.34, 0.8);
  const cardLift = 0.8 * (1 - t);
  const k = b.w / CARD.w;
  // light streak from where the box was 2f ago
  const tail = centre(f - 2);
  const sdx = b.cx - tail.x;
  const sdy = b.cy - tail.y;
  const sLen = Math.hypot(sdx, sdy);
  const streakO = clamp01(sLen / 120) * (1 - ramp(t, 0.7, 0.95));
  const sAng = (Math.atan2(sdy, sdx) * 180) / Math.PI;
  const sThick = Math.min(b.h, 150) * 0.6;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {streakO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: tail.x - 60,
            top: tail.y - sThick / 2,
            width: sLen + 120,
            height: sThick,
            transform: `rotate(${sAng.toFixed(2)}deg)`,
            transformOrigin: `60px ${sThick / 2}px`,
            borderRadius: sThick / 2,
            background: `linear-gradient(90deg, ${alpha(C.violetGlow, 0)} 0%, ${alpha(C.violetGlow, 0.3)} 45%, ${alpha(C.violet, 0.5)} 80%, ${alpha('#E4DAFF', 0.6)} 100%)`,
            filter: 'blur(14px)',
            opacity: streakO,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', left: b.x - PAD, top: b.y - PAD}}>
        <DirectionalBlur id="s4-slab-morph" amount={Math.min(12, v.speed * 0.15)} angle={v.angle}>
          <div style={{padding: PAD}}>
            <div style={{position: 'relative', width: b.w, height: b.h}}>
              {baseO > 0.001 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: baseO,
                    borderRadius: b.r,
                    background: SLAB_BODY,
                    boxShadow: `${SHADOW.lifted}, 0 0 ${Math.round(50 + 30 * impact)}px ${alpha(C.violetGlow, 0.34 + 0.3 * impact)}`,
                  }}
                >
                  <Hairline radius={b.r} width={1.6} opacity={0.95} color={SIGNATURE_RIM} />
                </div>
              ) : null}
              {coverO > 0.001 ? (
                <div style={{position: 'absolute', inset: 0, opacity: coverO, borderRadius: b.r, overflow: 'hidden'}}>
                  <Cover />
                </div>
              ) : null}
              {cardO > 0.001 ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: (b.h - CARD.h * k) / 2,
                    width: CARD.w,
                    height: CARD.h,
                    transform: `scale(${k.toFixed(4)})`,
                    transformOrigin: '0 0',
                    opacity: cardO,
                  }}
                >
                  <SkillCard name={matched.name} description={matched.description} x={0} y={0} accent={1} lift={cardLift} />
                </div>
              ) : null}
              {impact > 0.01 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: -1,
                    borderRadius: b.r + 1,
                    boxShadow: `0 0 0 1.5px ${alpha(C.whiteHot, 0.85 * impact)}, 0 0 ${Math.round(30 * impact)}px ${alpha(C.whiteHot, 0.5 * impact)}, 0 0 ${Math.round(70 * impact)}px ${alpha(C.violet, 0.45 * impact)}`,
                  }}
                />
              ) : null}
            </div>
          </div>
        </DirectionalBlur>
      </div>
    </AbsoluteFill>
  );
};

/** The seam flash on the closed slab at the moment the wings land (lf3-6, before the morph takes over). */
export const SnapFlash: React.FC<{f: number}> = ({f}) => {
  if (f < 3 || f >= T4.flyFrom) return null;
  const impact = bell(ramp(f, 3, 13));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: SLAB.x - 1,
          top: SLAB.y - 1,
          width: SLAB.w + 2,
          height: SLAB.h + 2,
          borderRadius: PANEL_R + 1,
          boxShadow: `0 0 0 1.5px ${alpha(C.whiteHot, 0.85 * impact)}, 0 0 ${Math.round(30 * impact)}px ${alpha(C.whiteHot, 0.5 * impact)}, 0 0 ${Math.round(70 * impact)}px ${alpha(C.violet, 0.45 * impact)}`,
        }}
      />
    </AbsoluteFill>
  );
};
