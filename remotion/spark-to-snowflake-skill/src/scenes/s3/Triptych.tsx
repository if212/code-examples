import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Hairline, SkillIcon} from '../../components';
import {C, FONT, SHADOW, TONES, TYPE, alpha, softRadial} from '../../theme';
import {TRIPTYCH} from '../../layout';
import {SKILL_FOLDER_LABEL, SKILL_PARTS} from '../../demoData';
import {bell, clamp01, reveal} from '../../motion';
import {HINGE_L, HINGE_R, PANEL_R, PERSPECTIVE} from './timing';

/**
 * The skill as a triptych: Playbook (left wing) / Mappings (centre) / Checks (right wing, smoked glass).
 * Each panel shows an icon well, a title and a short gloss (review r1 dropped the mono file hints as
 * implementation detail, per the 'high level' direction).
 * Wings are true 3D hinges: rotateY about the middle of each 16px gap, preserve-3d, backface-visibility hidden.
 * No CSS filter is ever applied to the preserve-3d group or wings (only to leaf text inside faces).
 * Exported so S4 can close the same object (openL/openR back to 0) for a seamless match cut.
 */

const PW = TRIPTYCH.panelW;
const PH = TRIPTYCH.panelH;
const PAD = 36;
const WELL = 74;

export type PanelIndex = 0 | 1 | 2;

/* ------------------------------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------------------------------- */

/** Rise (leaf only): opacity, a short rise and a blur that clears. */
const Rise: React.FC<{p: number; dy?: number; blur?: number; style?: React.CSSProperties; children: React.ReactNode}> = ({
  p,
  dy = 18,
  blur = 8,
  style,
  children,
}) => {
  if (p <= 0.001) return null;
  const q = clamp01(p);
  return (
    <div
      style={{
        ...style,
        opacity: clamp01(q * 1.25),
        transform: `translateY(${((1 - q) * dy).toFixed(2)}px)`,
        filter: q < 0.985 ? `blur(${((1 - q) * blur).toFixed(2)}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** Thin two-tone arrow for 'Spark → Snowflake' (ember -> ice), so it never depends on a fallback glyph. */
const GlossArrow: React.FC<{size: number}> = ({size}) => {
  const w = size * 1.15;
  const h = size * 0.6;
  return (
    <svg width={w} height={h} viewBox="0 0 32 17" style={{overflow: 'visible', margin: `0 ${(size * 0.3).toFixed(1)}px`, transform: 'translateY(1px)'}}>
      <defs>
        <linearGradient id="s3-gloss-arrow" gradientUnits="userSpaceOnUse" x1="2" y1="8.5" x2="30" y2="8.5">
          <stop offset="0" stopColor={C.emberGlow} />
          <stop offset="0.5" stopColor={C.whiteHot} />
          <stop offset="1" stopColor={C.iceGlow} />
        </linearGradient>
      </defs>
      <path d="M2 8.5 H29" stroke="url(#s3-gloss-arrow)" strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <path d="M23.5 3 L29.5 8.5 L23.5 14" stroke={C.iceGlow} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
};

/** Gloss text. 'Spark → Snowflake' gets ember / ice words and a drawn arrow. */
const Gloss: React.FC<{text: string}> = ({text}) => {
  const parts = text.split('→');
  if (parts.length !== 2) return <>{text}</>;
  const [a, b] = parts.map((s) => s.trim());
  return (
    <>
      <span style={{color: TONES.ember.text}}>{a}</span>
      <GlossArrow size={TYPE.gloss} />
      <span style={{color: TONES.ice.text}}>{b}</span>
    </>
  );
};

/** Signature gradient laid across the whole triptych, sliced for panel k (warm on the left, cool on the right). */
const signatureSlice = (k: PanelIndex, a = 1): string => {
  const off = TRIPTYCH.panelX(k) - TRIPTYCH.left;
  return `linear-gradient(90deg, ${alpha(C.ember, a)} 0px, ${alpha(C.emberGlow, a)} 380px, ${alpha(C.whiteHot, a)} 676px, ${alpha(C.iceGlow, a)} 972px, ${alpha(C.ice, a)} ${TRIPTYCH.width}px) ${-off}px 0 / ${TRIPTYCH.width}px 100% no-repeat`;
};

/* ------------------------------------------------------------------------------------------------
 * Faces
 * ---------------------------------------------------------------------------------------------- */

export type PanelFaceProps = {
  k: PanelIndex;
  frame: number;
  /** local frame the content reveal starts (Infinity = empty glass, -Infinity = fully shown) */
  start: number;
  /** 0.7..1 brightness */
  bright?: number;
  /** interior light pouring out of the hinges 0..1 */
  light?: number;
  /** specular sheen band centre in triptych-local x (0..1352), or null */
  sheenX?: number | null;
  /** sheen while the wing swings (0..1) */
  swing?: number;
  /** Checks only: slot glow as the ticket leaves 0..1 */
  slot?: number;
};

const Well: React.FC<{k: PanelIndex; p: number; draw: number; pulse?: number}> = ({k, p, draw, pulse = 0}) => {
  const t = k === 2 ? TONES.mint : TONES.violet;
  const q = clamp01(p);
  return (
    <div
      style={{
        position: 'absolute',
        left: PAD,
        top: PAD,
        width: WELL,
        height: WELL,
        borderRadius: 21,
        opacity: q,
        transform: `scale(${(0.86 + 0.14 * q).toFixed(4)})`,
        background: `linear-gradient(160deg, ${alpha(t.main, 0.26)} 0%, ${alpha(t.main, 0.09)} 55%, ${alpha(t.deep, 0.34)} 100%), rgba(8,10,18,0.7)`,
        boxShadow: [
          `inset 0 0 0 1px ${alpha(t.main, 0.42)}`,
          `inset 0 1px 0 ${alpha('#FFFFFF', 0.2)}`,
          `0 0 ${Math.round(30 + 24 * pulse)}px ${alpha(t.main, 0.3 * q + 0.4 * pulse)}`,
          '0 10px 20px -10px rgba(0,0,0,0.8)',
        ].join(', '),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SkillIcon kind={SKILL_PARTS[k].key} size={46} color={k === 2 ? C.mint : C.violet} strokeWidth={2.8} draw={draw} glow={0.9} />
    </div>
  );
};

/** Glass body of a panel (violet glass, or smoked black glass for Checks). */
const PanelGlass: React.FC<{k: PanelIndex; accent: number; children?: React.ReactNode}> = ({k, accent, children}) => {
  const smoked = k === 2;
  const edge = smoked ? C.mint : C.violet;
  const fills = smoked
    ? [
        'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 38%)',
        softRadial('ellipse 45% 40% at 50% 100%', C.mint, 0.06 + 0.1 * accent, 10, 2.2),
        'linear-gradient(165deg, rgba(22,24,32,0.95) 0%, rgba(9,10,14,0.96) 45%, rgba(3,4,7,0.97) 100%)',
      ]
    : [
        'linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0) 40%)',
        softRadial('ellipse 55% 34% at 50% 0%', '#FFFFFF', 0.045, 10, 2.2),
        softRadial('ellipse 62% 58% at 16% 10%', C.violet, 0.22, 12, 2.3),
        `linear-gradient(155deg, ${alpha(C.violet, 0.15)} 0%, ${alpha(C.violetGlow, 0.07)} 48%, ${alpha('#1B1450', 0.35)} 100%)`,
        'rgba(9,10,22,0.97)',
      ];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: PANEL_R,
        background: fills.join(', '),
        boxShadow: [
          SHADOW.lifted,
          `0 0 70px ${alpha(smoked ? C.mint : C.violetGlow, smoked ? 0.05 : 0.14)}`,
        ].join(', '),
        overflow: 'hidden',
      }}
    >
      {/* engraved watermark of the panel's icon */}
      <div style={{position: 'absolute', right: -30, bottom: -40, opacity: smoked ? 0.045 : 0.05}}>
        <SkillIcon kind={SKILL_PARTS[k].key} size={160} color="#FFFFFF" strokeWidth={1.8} />
      </div>
      {children}
      {/* rim: signature gradient flowing warm -> cool across the triptych + a white top highlight */}
      <Hairline
        radius={PANEL_R}
        width={1.2}
        color={`linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.1) 100%), ${signatureSlice(k, 0.5)}`}
      />
      {/* light escaping along the top edge (brighter while the panel is active) */}
      <div
        style={{
          position: 'absolute',
          left: PW * 0.1,
          right: PW * 0.1,
          top: 0,
          height: 1.5,
          borderRadius: 1,
          opacity: 0.5 + 0.5 * accent,
          background: `linear-gradient(90deg, ${alpha(edge, 0)} 0%, ${alpha('#F1ECFF', 0.9)} 35%, #FFFFFF 50%, ${alpha('#F1ECFF', 0.9)} 65%, ${alpha(edge, 0)} 100%)`,
          boxShadow: `0 0 12px ${alpha(edge, 0.8)}, 0 0 30px ${alpha(smoked ? C.mint : C.violetGlow, 0.5)}`,
        }}
      />
    </div>
  );
};

export const PanelFace: React.FC<PanelFaceProps & {accent?: number}> = ({
  k,
  frame,
  start,
  bright = 1,
  light = 0,
  sheenX = null,
  swing = 0,
  slot = 0,
  accent = 0,
}) => {
  const part = SKILL_PARTS[k];
  const smoked = k === 2;
  const shown = start === -Infinity;
  const at = (d: number, dur = 18) => (shown ? 1 : Number.isFinite(start) ? reveal(frame, start + d, dur) : 0);
  const wellP = at(0, 14);
  const iconP = at(1, 18);
  const titleP = at(3);
  const glossP = at(6);
  const pulse = smoked ? slot : 0;
  const sx = sheenX === null ? 0 : sheenX - (TRIPTYCH.panelX(k) - TRIPTYCH.left);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: PW, height: PH}}>
      <PanelGlass k={k} accent={Math.max(accent, smoked ? slot : 0)}>
        {/* smoked glass: sealed seam (an inset gasket all round) + the slot the ticket leaves from */}
        {smoked ? (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 10,
                borderRadius: PANEL_R - 8,
                boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.75), 0 0 0 1px ${alpha('#FFFFFF', 0.075)}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: PW / 2 - 108,
                width: 216,
                bottom: 0,
                height: 3,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${alpha(C.mint, 0)} 0%, ${alpha(C.mint, 0.14 + 0.86 * slot)} 20%, ${alpha('#E9FFF6', 0.18 + 0.82 * slot)} 50%, ${alpha(C.mint, 0.14 + 0.86 * slot)} 80%, ${alpha(C.mint, 0)} 100%)`,
                boxShadow: `0 0 ${Math.round(6 + 20 * slot)}px ${alpha(C.mint, 0.15 + 0.7 * slot)}`,
              }}
            />
          </>
        ) : null}
        <Well k={k} p={wellP} draw={iconP} pulse={pulse} />
        <Rise
          p={titleP}
          style={{
            position: 'absolute',
            left: PAD,
            bottom: PAD + 46,
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: TYPE.triptychTitle,
            color: C.frost,
            letterSpacing: '-0.025em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {part.title}
        </Rise>
        <Rise
          p={glossP}
          dy={14}
          blur={6}
          style={{
            position: 'absolute',
            left: PAD,
            bottom: PAD,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            fontFamily: FONT.display,
            fontWeight: 500,
            fontSize: TYPE.gloss,
            color: C.slate,
            letterSpacing: '-0.01em',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          <Gloss text={part.gloss} />
        </Rise>
        {/* light pouring in from the hinge side */}
        {light > 0.004 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: [
                softRadial(`ellipse 38% 85% at ${k === 0 ? 100 : k === 2 ? 0 : 50}% 50%`, C.whiteHot, 0.3 * light, 12, 2.4),
                softRadial(`ellipse 70% 90% at ${k === 0 ? 100 : k === 2 ? 0 : 50}% 50%`, C.violet, 0.16 * light, 10, 2),
              ].join(', '),
              mixBlendMode: 'screen',
            }}
          />
        ) : null}
        {/* sheen while swinging */}
        {swing > 0.01 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${k === 0 ? 100 : 80}deg, rgba(255,255,255,0) 22%, ${alpha(C.whiteHot, 0.16 * swing)} 50%, rgba(255,255,255,0) 78%)`,
            }}
          />
        ) : null}
        {/* hold: one specular sheen across the glass */}
        {sheenX !== null ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(104deg, rgba(255,255,255,0) ${(sx - 170).toFixed(1)}px, ${alpha('#FFFFFF', smoked ? 0.06 : 0.075)} ${sx.toFixed(1)}px, rgba(255,255,255,0) ${(sx + 170).toFixed(1)}px)`,
            }}
          />
        ) : null}
        {bright < 0.999 ? <div style={{position: 'absolute', inset: 0, background: `rgba(5,7,13,${(1 - bright).toFixed(3)})`}} /> : null}
      </PanelGlass>
    </div>
  );
};

/** Outer cover of the closed slab (back of the Playbook wing): the folder lid, grown up. */
/**
 * Where the S2 folder's tab label and lid emblem land in Cover coordinates when the folder (520 wide) and the
 * slab (440 wide) are drawn at the same width during the S3 turn (ratio 440/520 about both centres). Cover
 * `morph` = 1 puts its label and icons exactly there, so the cross-dissolve never shows doubled text.
 */
const FOLDER_MATCH = {labelX: 20.9, labelCy: 23.8, labelSize: 22, iconCy: 222.1, iconSize: 37.4, iconGap: 22} as const;
const COVER_REST = {labelX: PAD - 6, labelCy: 37.2, labelSize: 20, iconCy: 0.56 * PH, iconSize: 42, iconGap: 30} as const;

export const Cover: React.FC<{swing?: number; sheen?: {pos: number; strength: number} | null; morph?: number}> = ({
  swing = 0,
  sheen = null,
  morph = 0,
}) => {
  const m = clamp01(morph);
  const mix = (k: keyof typeof COVER_REST) => COVER_REST[k] + (FOLDER_MATCH[k] - COVER_REST[k]) * m;
  const iconSize = mix('iconSize');
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: PANEL_R,
        background: [
          'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0.0) 60%)',
          `linear-gradient(172deg, ${alpha(C.violet, 0.4)} 0%, ${alpha(C.violetGlow, 0.24)} 40%, ${alpha('#1A1045', 0.86)} 100%)`,
          'rgba(10,8,26,0.92)',
        ].join(', '),
        boxShadow: `${SHADOW.lifted}, 0 0 60px ${alpha(C.violetGlow, 0.28)}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: PANEL_R,
          background: 'linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0.015) 42%, rgba(255,255,255,0) 60%)',
        }}
      />
      {/* light escaping along the top edge */}
      <div
        style={{
          position: 'absolute',
          left: PW * 0.08,
          right: PW * 0.08,
          top: -1,
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(90deg, ${alpha(C.violet, 0)} 0%, ${alpha('#E9E1FF', 0.95)} 30%, #FFFFFF 50%, ${alpha('#E9E1FF', 0.95)} 70%, ${alpha(C.violet, 0)} 100%)`,
          boxShadow: `0 0 14px ${alpha(C.violet, 0.9)}, 0 0 36px ${alpha(C.violetGlow, 0.6)}`,
        }}
      />
      <Hairline
        radius={PANEL_R}
        width={1.6}
        color={`linear-gradient(115deg, ${C.ember} 0%, ${C.emberGlow} 28%, ${C.whiteHot} 50%, ${C.iceGlow} 72%, ${C.ice} 100%)`}
        opacity={0.95}
      />
      <div
        style={{
          position: 'absolute',
          left: mix('labelX'),
          top: mix('labelCy') - 15,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          fontFamily: FONT.mono,
          fontWeight: 500,
          fontSize: mix('labelSize'),
          color: '#EDE6FF',
          letterSpacing: 0,
          whiteSpace: 'pre',
          fontFeatureSettings: '"liga" 0, "calt" 0',
          textShadow: `0 0 14px ${alpha(C.violet, 0.6)}`,
        }}
      >
        {SKILL_FOLDER_LABEL}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: mix('iconCy'),
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          gap: mix('iconGap'),
          opacity: 0.9,
        }}
      >
        {SKILL_PARTS.map((p) => (
          <SkillIcon key={p.key} kind={p.key} size={iconSize} color={alpha('#D9CCFF', 0.85)} strokeWidth={3} glow={0.9} />
        ))}
      </div>
      {swing > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: PANEL_R,
            background: `linear-gradient(80deg, rgba(255,255,255,0) 20%, ${alpha(C.whiteHot, 0.22 * swing)} 50%, rgba(255,255,255,0) 80%)`,
          }}
        />
      ) : null}
      {sheen && sheen.strength > 0.01 ? <SheenBand pos={sheen.pos} strength={sheen.strength} radius={PANEL_R} /> : null}
    </div>
  );
};

/**
 * A diagonal specular band crossing a face (used for the S3 folder -> slab turn). pos 0..1 is the band centre
 * across the face's width (it enters from < 0 and leaves at > 1). Clipped to the face by the radius.
 */
export const SheenBand: React.FC<{pos: number; strength: number; radius: number; style?: React.CSSProperties}> = ({pos, strength, radius, style}) => {
  const c = (pos * 100).toFixed(2);
  const a = (pos * 100 - 22).toFixed(2);
  const b = (pos * 100 + 22).toFixed(2);
  const a2 = (pos * 100 - 7).toFixed(2);
  const b2 = (pos * 100 + 7).toFixed(2);
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            `linear-gradient(104deg, rgba(255,255,255,0) ${a2}%, ${alpha('#FFFFFF', 0.2 * strength)} ${c}%, rgba(255,255,255,0) ${b2}%)`,
            `linear-gradient(104deg, rgba(255,255,255,0) ${a}%, ${alpha(C.whiteHot, 0.14 * strength)} ${c}%, rgba(255,255,255,0) ${b}%)`,
          ].join(', '),
        }}
      />
    </div>
  );
};

/**
 * Back of the Checks wing: the violet outer skin of the closed slab (same glass as Playbook), seen while the
 * Playbook wing lifts and until the Checks wing passes 90deg. Review r1: the old smoked back read as a dead
 * black slab in the centre slot, so the opening now reads as glass opening.
 */
const WingBack: React.FC<{light?: number}> = ({light = 0}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: PANEL_R,
      background: [
        'linear-gradient(180deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0) 40%)',
        softRadial('ellipse 55% 34% at 50% 0%', '#FFFFFF', 0.05, 10, 2.2),
        softRadial('ellipse 62% 58% at 84% 12%', C.violet, 0.24, 12, 2.3),
        `linear-gradient(160deg, ${alpha(C.violet, 0.2)} 0%, ${alpha(C.violetGlow, 0.1)} 48%, ${alpha('#1B1450', 0.45)} 100%)`,
        'rgba(10,9,24,0.96)',
      ].join(', '),
      boxShadow: `${SHADOW.lifted}, 0 0 60px ${alpha(C.violetGlow, 0.2)}`,
      overflow: 'hidden',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(112deg, rgba(255,255,255,0) 20%, rgba(255,255,255,0.06) 34%, rgba(255,255,255,0.012) 46%, rgba(255,255,255,0) 62%)',
      }}
    />
    {/* light escaping along the top edge */}
    <div
      style={{
        position: 'absolute',
        left: PW * 0.1,
        right: PW * 0.1,
        top: 0,
        height: 1.5,
        borderRadius: 1,
        background: `linear-gradient(90deg, ${alpha(C.violet, 0)} 0%, ${alpha('#E9E1FF', 0.85)} 35%, #FFFFFF 50%, ${alpha('#E9E1FF', 0.85)} 65%, ${alpha(C.violet, 0)} 100%)`,
        boxShadow: `0 0 12px ${alpha(C.violet, 0.8)}, 0 0 30px ${alpha(C.violetGlow, 0.5)}`,
      }}
    />
    <Hairline
      radius={PANEL_R}
      width={1.2}
      color={`linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0.12) 100%), ${alpha(C.violet, 0.5)}`}
    />
    {light > 0.004 ? (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            softRadial('ellipse 45% 85% at 0% 50%', C.whiteHot, 0.32 * light, 12, 2.4),
            softRadial('ellipse 80% 95% at 0% 50%', C.violet, 0.16 * light, 10, 2),
          ].join(', '),
          mixBlendMode: 'screen',
        }}
      />
    ) : null}
  </div>
);

/* ------------------------------------------------------------------------------------------------
 * Wing + triptych
 * ---------------------------------------------------------------------------------------------- */

const Wing: React.FC<{side: 'L' | 'R'; p: number; z: number; front: React.ReactNode; back: React.ReactNode}> = ({
  side,
  p,
  z,
  front,
  back,
}) => {
  const k = side === 'L' ? 0 : 2;
  const origin = side === 'L' ? `${PW + TRIPTYCH.gap / 2}px 50%` : `${-TRIPTYCH.gap / 2}px 50%`;
  const theta = (side === 'L' ? 180 : -180) * (1 - p);
  const settled = Math.abs(theta) < 0.01 && Math.abs(z) < 0.01;
  return (
    <div
      style={{
        position: 'absolute',
        left: TRIPTYCH.panelX(k),
        top: TRIPTYCH.top,
        width: PW,
        height: PH,
        transformStyle: 'preserve-3d',
        transformOrigin: origin,
        transform: settled ? 'none' : `translateZ(${z.toFixed(2)}px) rotateY(${theta.toFixed(3)}deg)`,
      }}
    >
      <div style={{position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden'}}>{front}</div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
        }}
      >
        {back}
      </div>
    </div>
  );
};

export type TriptychProps = {
  frame: number;
  /** wing open progress, 0 = folded over the centre panel, 1 = open (spring overshoot ok) */
  openL: number;
  openR: number;
  /** rotateY of the whole slab in deg (S3 turn: a shallow swing that ends at 0) */
  turn?: number;
  /** rotateX of the whole slab in deg (S3 turn) */
  tilt?: number;
  /** extra scale of the whole slab about (960,600) (S3 turn: matches the folder's width) */
  turnScale?: number;
  /** specular sweep over the closed slab's cover (S3 turn) */
  coverSheen?: {pos: number; strength: number} | null;
  /** 1 = cover label / icons sit where the S2 folder's are (S3 turn), 0 = the cover's own layout */
  coverMorph?: number;
  /** content reveal start frames per panel (Infinity = empty, -Infinity = fully shown) */
  starts?: readonly [number, number, number];
  bright?: readonly [number, number, number];
  /** top-edge light per panel 0..1 (active panel) */
  accent?: readonly [number, number, number];
  light?: number;
  sheenX?: number | null;
  slot?: number;
  opacity?: number;
};

/** The 3D triptych in canvas coordinates at the TRIPTYCH constants. Wrap in a <Camera> for scale / pull-back. */
export const Triptych: React.FC<TriptychProps> = ({
  frame,
  openL,
  openR,
  turn = 0,
  tilt = 0,
  turnScale = 1,
  coverSheen = null,
  coverMorph = 0,
  starts = [-Infinity, -Infinity, -Infinity],
  bright = [1, 1, 1],
  accent = [0, 0, 0],
  light = 0,
  sheenX = null,
  slot = 0,
  opacity = 1,
}) => {
  const swingL = openL < 0.999 ? bell(clamp01(openL)) : 0;
  const swingR = openR < 0.999 ? bell(clamp01(openR)) : 0;
  // stacking while folded: centre z0, Checks wing z+3, Playbook wing z+6 (on top)
  const zR = 3 * (1 - clamp01(openR));
  const zL = 6 * (1 - clamp01(openL));
  return (
    <AbsoluteFill style={{perspective: `${PERSPECTIVE}px`, perspectiveOrigin: '960px 600px', opacity}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformStyle: 'preserve-3d',
          transformOrigin: '960px 600px',
          transform:
            Math.abs(turn) > 0.001 || Math.abs(tilt) > 0.001 || Math.abs(turnScale - 1) > 0.0001
              ? `rotateX(${tilt.toFixed(3)}deg) rotateY(${turn.toFixed(3)}deg) scale(${turnScale.toFixed(5)})`
              : 'none',
        }}
      >
        <div style={{position: 'absolute', left: TRIPTYCH.panelX(1), top: TRIPTYCH.top, width: PW, height: PH}}>
          <PanelFace k={1} frame={frame} start={starts[1]} bright={bright[1]} accent={accent[1]} light={light} sheenX={sheenX} />
        </div>
        <Wing
          side="R"
          p={openR}
          z={zR}
          front={
            <PanelFace k={2} frame={frame} start={starts[2]} bright={bright[2]} accent={accent[2]} light={light} sheenX={sheenX} swing={swingR} slot={slot} />
          }
          back={<WingBack light={light * (1 - clamp01(openR))} />}
        />
        <Wing
          side="L"
          p={openL}
          z={zL}
          front={<PanelFace k={0} frame={frame} start={starts[0]} bright={bright[0]} accent={accent[0]} light={light} sheenX={sheenX} swing={swingL} />}
          back={<Cover swing={swingL} sheen={coverSheen} morph={coverMorph} />}
        />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Core glow + hinge light (2D, camera space)
 * ---------------------------------------------------------------------------------------------- */

/** Soft violet core glow behind the object (sized to its box, screen-blended). */
export const CoreGlow: React.FC<{strength: number}> = ({strength}) => {
  if (strength <= 0.002) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 960 - 820,
          top: 600 - 380,
          width: 1640,
          height: 760,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.violetGlow, 0.3 * strength, 14, 2.4),
          mixBlendMode: 'screen',
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Hinge light: seams + bloom spilling through the hinges
 * ---------------------------------------------------------------------------------------------- */

export const HingeLights: React.FC<{level: number; flareL: number; flareR: number; appear: number}> = ({level, flareL, flareR, appear}) => {
  if (level <= 0.002 && flareL <= 0.002 && flareR <= 0.002) return null;
  const a = clamp01(appear);
  const lineH = PH + 44;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {[
        {x: HINGE_L, flare: flareL, key: 'l'},
        {x: HINGE_R, flare: flareR, key: 'r'},
      ].map(({x, flare, key}) => {
        const lv = clamp01(level + 0.8 * flare);
        return (
          <React.Fragment key={key}>
            <div
              style={{
                position: 'absolute',
                left: x - 170,
                top: 600 - 300,
                width: 340,
                height: 600,
                background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.06 * level + 0.3 * flare, 14, 2.8),
                mixBlendMode: 'screen',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: x - 80,
                top: 600 - 240,
                width: 160,
                height: 480,
                background: softRadial('ellipse 50% 50% at 50% 50%', C.violet, 0.12 * level + 0.24 * flare, 12, 2.2),
                mixBlendMode: 'screen',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: x - 1.25,
                top: 600 - lineH / 2,
                width: 2.5,
                height: lineH,
                borderRadius: 2,
                transform: `scaleY(${a.toFixed(4)})`,
                opacity: lv,
                background: `linear-gradient(180deg, ${alpha(C.whiteHot, 0)} 0%, ${alpha(C.whiteHot, 0.85)} 14%, #FFFFFF 50%, ${alpha(C.whiteHot, 0.85)} 86%, ${alpha(C.whiteHot, 0)} 100%)`,
                boxShadow: `0 0 8px ${alpha(C.whiteHot, 0.9)}, 0 0 22px ${alpha(C.violet, 0.75)}`,
              }}
            />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
