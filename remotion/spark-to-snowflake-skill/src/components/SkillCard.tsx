import React from 'react';
import {C, FONT, SHADOW, alpha} from '../theme';
import {SKILL_SHELF} from '../layout';
import {SKILL_PARTS, SkillPartKey} from '../demoData';
import {Hairline, Pill} from './Glass';
import {SkillIcon} from './Icons';
import {clamp01} from '../motion';

/**
 * One-line shelf card: 'name · one-line description' (760x76). When matched it lifts (scale 1.06, violet
 * rim + glow), pops a 'matched' tag, and grows a second row of three micro icons (Playbook · Mappings ·
 * Checks); each icon lights violet independently.
 */
export type SkillCardProps = {
  name: string;
  description: string;
  /** top-left canvas position (default: shelf column x, slot 0) */
  x?: number;
  y?: number;
  width?: number;
  opacity?: number;
  /** depth-of-field blur px */
  blur?: number;
  /** 0..1 lift: scale 1.06, violet rim, glow, deeper shadow */
  lift?: number;
  /** 0..1 (spring ok) 'matched' tag pop */
  matched?: number;
  /** 0..1 growth of the icon row (height 76 -> 136) */
  iconsRow?: number;
  /** 0..1 per icon: lit violet */
  lit?: Partial<Record<SkillPartKey, number>>;
  /** 0..1 glow on the description (beam target) */
  descGlow?: number;
  /** leading folder glyph colour weight 0..1 (violet when it is ours) */
  accent?: number;
  transform?: string;
};

const MiniFolder: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block', overflow: 'visible'}}>
    <path
      d="M3 7.2 A1.6 1.6 0 0 1 4.6 5.6 H9.4 L11.4 7.6 H19.4 A1.6 1.6 0 0 1 21 9.2 V17.4 A1.6 1.6 0 0 1 19.4 19 H4.6 A1.6 1.6 0 0 1 3 17.4 Z"
      fill={alpha(color, 0.16)}
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  </svg>
);

export const SkillCard: React.FC<SkillCardProps> = ({
  name,
  description,
  x = SKILL_SHELF.x0,
  y = SKILL_SHELF.y0,
  width = SKILL_SHELF.cardW,
  opacity = 1,
  blur = 0,
  lift = 0,
  matched = 0,
  iconsRow = 0,
  lit = {},
  descGlow = 0,
  accent = 0,
  transform,
}) => {
  const l = clamp01(lift);
  const rowH = SKILL_SHELF.iconRowH * clamp01(iconsRow);
  const h = SKILL_SHELF.cardH + rowH;
  const fs = 24;
  const folderCol = accent > 0 ? C.violet : C.dim;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height: h,
        opacity,
        transform: `${transform ?? ''} scale(${(1 + 0.06 * l).toFixed(4)})`,
        transformOrigin: '50% 38px',
        zIndex: l > 0 ? 5 : 1,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 50%)',
            `linear-gradient(160deg, ${alpha(C.violet, 0.16 * l)} 0%, ${alpha(C.violetGlow, 0.08 * l)} 60%, rgba(0,0,0,0) 100%)`,
            'linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.03) 100%)',
            'rgba(8,11,20,0.8)',
          ].join(', '),
          boxShadow: [
            l > 0.02 ? SHADOW.lifted : SHADOW.glass,
            l > 0.02 ? `0 0 ${Math.round(50 * l)}px ${alpha(C.violetGlow, 0.35 * l)}` : null,
          ]
            .filter(Boolean)
            .join(', '),
        }}
      >
        <Hairline radius={18} />
        {l > 0.01 ? (
          <Hairline
            radius={18}
            width={1.5}
            opacity={l}
            color={`linear-gradient(120deg, #E4DAFF 0%, ${C.violet} 40%, ${alpha(C.violetGlow, 0.6)} 100%)`}
          />
        ) : null}
      </div>
      {/* line 1 */}
      <div
        style={{
          position: 'absolute',
          left: 26,
          top: 0,
          height: SKILL_SHELF.cardH,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          whiteSpace: 'nowrap',
        }}
      >
        <MiniFolder size={28} color={folderCol} />
        <span
          style={{
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: fs,
            color: C.frost,
            letterSpacing: '-0.01em',
            fontFeatureSettings: '"liga" 0, "calt" 0',
          }}
        >
          {name}
        </span>
        <span style={{fontFamily: FONT.display, fontWeight: 500, fontSize: fs, color: C.dim}}>{'·'}</span>
        <span
          style={{
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: fs,
            letterSpacing: '-0.01em',
            color: descGlow > 0 ? `color-mix(in srgb, ${C.slate} ${Math.round((1 - descGlow) * 100)}%, ${C.frost})` : C.slate,
            textShadow: descGlow > 0 ? `0 0 ${Math.round(18 * descGlow)}px ${alpha(C.violet, 0.8 * descGlow)}` : undefined,
          }}
        >
          {description}
        </span>
      </div>
      {/* matched tag */}
      {matched > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            right: 18,
            top: -16,
            transform: `scale(${Math.max(0, matched).toFixed(3)})`,
            transformOrigin: '80% 50%',
            opacity: Math.min(1, matched * 1.6),
          }}
        >
          <Pill label="matched" tone="violet" icon="dot" size={15} solid glow={0.9} />
        </div>
      ) : null}
      {/* icon row */}
      {iconsRow > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: SKILL_SHELF.cardH - 8,
            height: rowH,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: clamp01(iconsRow * 1.4 - 0.3),
          }}
        >
          <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 1, background: alpha('#FFFFFF', 0.08)}} />
          {SKILL_PARTS.map((part) => {
            const on = clamp01(lit[part.key] ?? 0);
            const col = on > 0 ? `color-mix(in srgb, ${C.dim} ${Math.round((1 - on) * 100)}%, ${C.violet})` : C.dim;
            return (
              <div
                key={part.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 14px 0 8px',
                  marginTop: 4,
                  borderRadius: 12,
                  background: alpha(C.violet, 0.1 * on),
                  boxShadow: `inset 0 0 0 1px ${alpha(on > 0 ? C.violet : '#FFFFFF', on > 0 ? 0.45 * on + 0.08 : 0.08)}, 0 0 ${Math.round(20 * on)}px ${alpha(C.violetGlow, 0.35 * on)}`,
                }}
              >
                <SkillIcon kind={part.key} size={24} color={col} strokeWidth={3} glow={on} />
                <span style={{fontFamily: FONT.display, fontWeight: 600, fontSize: 19, color: col, letterSpacing: '0.01em'}}>{part.title}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
