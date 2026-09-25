import React from 'react';
import {C, FONT, alpha} from '../theme';
import {SKILL_DOCK} from '../layout';
import {SKILL_PARTS, SkillPartKey} from '../demoData';
import {clamp01} from '../motion';
import {GlassPanel} from './Glass';
import {SkillIcon} from './Icons';

/**
 * S5-S6 skill dock: the vertical glass strip (120x320 at x96-216, y440-760) the matched shelf card collapses
 * into. Folder glyph on top, then Playbook / Mappings / Checks cells that light violet independently.
 *   lit.mappings -> S5 lf14, lit.checks -> S5 lf40; pulse.mappings -> S6 lf72.
 */
export type SkillDockProps = {
  /** 0..1 per part: lit violet */
  lit?: Partial<Record<SkillPartKey, number>>;
  /** 0..1 per part: one-shot pulse ring (drive 0->1 over ~16f) */
  pulse?: Partial<Record<SkillPartKey, number>>;
  /** 0..1 reveal: the strip grows from its top edge (scaleY) and fades in */
  reveal?: number;
  opacity?: number;
  /** override position (top-left) */
  x?: number;
  y?: number;
};

export const SkillDock: React.FC<SkillDockProps> = ({lit = {}, pulse = {}, reveal = 1, opacity = 1, x = SKILL_DOCK.x0, y = SKILL_DOCK.y0}) => {
  const r = clamp01(reveal);
  if (r <= 0 || opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: SKILL_DOCK.w,
        height: SKILL_DOCK.h,
        opacity: opacity * Math.min(1, r * 1.5),
        transform: `scaleY(${(0.35 + 0.65 * r).toFixed(4)})`,
        transformOrigin: '50% 0%',
      }}
    >
      <GlassPanel width={SKILL_DOCK.w} height={SKILL_DOCK.h} radius={26} tint="violet" tintStrength={0.9} glow={0.35} rim="violet" rimOpacity={0.7}>
        {/* folder glyph */}
        <div style={{position: 'absolute', left: 0, right: 0, top: 22, display: 'flex', justifyContent: 'center'}}>
          <svg width={40} height={40} viewBox="0 0 24 24" style={{overflow: 'visible'}}>
            <path
              d="M3 7.2 A1.6 1.6 0 0 1 4.6 5.6 H9.4 L11.4 7.6 H19.4 A1.6 1.6 0 0 1 21 9.2 V17.4 A1.6 1.6 0 0 1 19.4 19 H4.6 A1.6 1.6 0 0 1 3 17.4 Z"
              fill={alpha(C.violet, 0.25)}
              stroke={C.violet}
              strokeWidth={1.5}
              strokeLinejoin="round"
              style={{filter: `drop-shadow(0 0 6px ${alpha(C.violetGlow, 0.9)})`}}
            />
          </svg>
        </div>
        <div style={{position: 'absolute', left: 22, right: 22, top: 76, height: 1, background: alpha('#FFFFFF', 0.1)}} />
        {SKILL_PARTS.map((part, k) => {
          const on = clamp01(lit[part.key] ?? 0);
          const pu = clamp01(pulse[part.key] ?? 0);
          const col = on > 0 ? `color-mix(in srgb, ${C.dim} ${Math.round((1 - on) * 100)}%, ${C.violet})` : C.dim;
          const top = 90 + k * 76;
          return (
            <div key={part.key} style={{position: 'absolute', left: 14, top, width: SKILL_DOCK.w - 28, height: 68}}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 16,
                  background: alpha(C.violet, 0.14 * on),
                  boxShadow: `inset 0 0 0 1px ${alpha(C.violet, 0.45 * on)}, 0 0 ${Math.round(24 * on)}px ${alpha(C.violetGlow, 0.4 * on)}`,
                }}
              />
              {pu > 0 && pu < 1 ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 16,
                    transform: `scale(${(1 + 0.45 * pu).toFixed(3)})`,
                    boxShadow: `0 0 0 ${(2 * (1 - pu)).toFixed(2)}px ${alpha(C.violet, 0.9 * (1 - pu))}, 0 0 ${Math.round(26 * (1 - pu))}px ${alpha(C.violetGlow, 0.8 * (1 - pu))}`,
                  }}
                />
              ) : null}
              <div style={{position: 'absolute', left: 0, right: 0, top: 6, display: 'flex', justifyContent: 'center'}}>
                <SkillIcon kind={part.key} size={34} color={col} strokeWidth={3.2} glow={on} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 44,
                  textAlign: 'center',
                  fontFamily: FONT.display,
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: '0.02em',
                  color: col,
                }}
              >
                {part.title}
              </div>
            </div>
          );
        })}
      </GlassPanel>
    </div>
  );
};
