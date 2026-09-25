import React from 'react';
import {AbsoluteFill, Easing, interpolate} from 'remotion';
import {DirectionalBlur, GlassPanel, SkillCard, SkillDock} from '../../components';
import type {SkillDockProps} from '../../components';
import {C, alpha} from '../../theme';
import {SKILL_DOCK, SKILL_SHELF} from '../../layout';
import {MATCHED_SHELF_INDEX, SHELF} from '../../demoData';
import {bezierPoint, clamp01, lerp, ramp, velocity2D} from '../../motion';

/**
 * S5 lf0-18: the matched shelf card (exactly as S4 leaves it: lifted, 'matched', icon row with Playbook lit)
 * collapses into the vertical skill dock on the left. A violet glass box morphs from the card's rect to the
 * dock's rect along a shallow arc, with a velocity-driven directional blur and a short light streak behind it;
 * the card face rides inside and fades out early, and the real SkillDock takes over exactly as the box lands,
 * so from `to` on it is just <SkillDock/>.
 */

const CARD_H = SKILL_SHELF.cardH + SKILL_SHELF.iconRowH; // card with its icon row grown
const LIFT_S = 1.06; // SkillCard lift scale, origin (50%, 38px)
const CARD_X = SKILL_SHELF.x0;
const CARD_Y = SKILL_SHELF.slotY(MATCHED_SHELF_INDEX);
/** visual rect of the lifted card */
const CV = {
  x: CARD_X + (SKILL_SHELF.cardW / 2) * (1 - LIFT_S),
  y: CARD_Y + 38 * (1 - LIFT_S),
  w: SKILL_SHELF.cardW * LIFT_S,
  h: CARD_H * LIFT_S,
};
const DK = {x: SKILL_DOCK.x0, y: SKILL_DOCK.y0, w: SKILL_DOCK.w, h: SKILL_DOCK.h};

const FLIGHT = Easing.bezier(0.55, 0, 0.12, 1);
const PAD = 70;

type Box = {x: number; y: number; w: number; h: number; r: number; cx: number; cy: number};

const boxAt = (frame: number, from: number, to: number): Box & {t: number} => {
  const t = interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: FLIGHT});
  const c0: [number, number] = [CV.x + CV.w / 2, CV.y + CV.h / 2];
  const c3: [number, number] = [DK.x + DK.w / 2, DK.y + DK.h / 2];
  const c = bezierPoint(t, c0, [c0[0] - 340, c0[1] - 110], [c3[0] + 300, c3[1] - 40], c3);
  // width collapses a little ahead of the travel, height grows into the strip on arrival
  const tw = clamp01(t * 1.1);
  const th = Math.pow(t, 1.4);
  const w = lerp(CV.w, DK.w, tw);
  const h = lerp(CV.h, DK.h, th);
  return {x: c.x - w / 2, y: c.y - h / 2, w, h, r: lerp(18, 26, t), cx: c.x, cy: c.y, t};
};

export const DockMorph: React.FC<{
  frame: number;
  /** local frame the collapse starts */
  from: number;
  /** local frame it lands in the dock */
  to: number;
  lit: SkillDockProps['lit'];
  pulse?: SkillDockProps['pulse'];
}> = ({frame, from, to, lit, pulse}) => {
  const matched = SHELF[MATCHED_SHELF_INDEX];
  const b = boxAt(frame, from, to);
  const t = b.t;
  const dockO = frame >= to ? 1 : ramp(t, 0.96, 1);
  const flying = frame < to;
  const center = (fr: number) => {
    const q = boxAt(fr, from, to);
    return {x: q.cx, y: q.cy};
  };
  const v = velocity2D(center, frame);
  // the card's own face (text, tag, icon row) rides inside the box, scaled uniformly, and fades out early
  const k = b.w / CV.w;
  const cardO = 1 - ramp(t, 0.12, 0.5);
  const boxO = frame < from ? 0 : ramp(t, 0, 0.1) * (1 - ramp(t, 0.97, 1));
  // light streak: from where the box was 2f ago to where it is now
  const tail = center(frame - 2);
  const sdx = b.cx - tail.x;
  const sdy = b.cy - tail.y;
  const sLen = Math.hypot(sdx, sdy);
  const streakO = flying && frame > from ? clamp01(sLen / 160) * (1 - ramp(t, 0.75, 0.98)) : 0;
  const sAng = (Math.atan2(sdy, sdx) * 180) / Math.PI;
  const sThick = Math.min(b.h, 150) * 0.7;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* the dock takes over as the box lands, then stays */}
      <SkillDock lit={lit} pulse={pulse} opacity={dockO} />
      {streakO > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: tail.x,
            top: tail.y - sThick / 2,
            width: sLen + 40,
            height: sThick,
            transform: `rotate(${sAng.toFixed(2)}deg)`,
            transformOrigin: `0 ${sThick / 2}px`,
            borderRadius: sThick / 2,
            background: `linear-gradient(90deg, ${alpha(C.violetGlow, 0)} 0%, ${alpha(C.violetGlow, 0.35)} 45%, ${alpha(C.violet, 0.55)} 80%, ${alpha('#E4DAFF', 0.7)} 100%)`,
            filter: 'blur(14px)',
            opacity: streakO,
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
      {flying ? (
        <div style={{position: 'absolute', left: b.x - PAD, top: b.y - PAD}}>
          <DirectionalBlur id="s5-dock-morph" amount={Math.min(20, v.speed * 0.09)} angle={v.angle}>
            <div style={{padding: PAD}}>
              <div style={{position: 'relative', width: b.w, height: b.h}}>
                {boxO > 0.001 ? (
                  <div style={{position: 'absolute', inset: 0, opacity: boxO}}>
                    <GlassPanel
                      width={b.w}
                      height={b.h}
                      radius={b.r}
                      tint="violet"
                      tintStrength={1.6}
                      glow={1}
                      rim="violet"
                      rimOpacity={1}
                      rimWidth={1.5}
                      backing={0.78}
                    />
                  </div>
                ) : null}
                {cardO > 0.001 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: (b.h - CV.h * k) / 2,
                      width: CV.w,
                      height: CV.h,
                      transform: `scale(${k.toFixed(4)})`,
                      transformOrigin: '0 0',
                      opacity: cardO,
                    }}
                  >
                    <SkillCard
                      name={matched.name}
                      description={matched.description}
                      x={CARD_X - CV.x}
                      y={CARD_Y - CV.y}
                      lift={1}
                      matched={1}
                      iconsRow={1}
                      accent={1}
                      lit={{playbook: 1}}
                      descGlow={0.6}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </DirectionalBlur>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
