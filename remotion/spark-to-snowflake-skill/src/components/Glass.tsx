import React from 'react';
import {C, FONT, SHADOW, TONES, Tone, TYPE, alpha} from '../theme';
import {DotGlyph, HexGlyph, CheckMark, HexBadge} from './Icons';

/**
 * Glass language: translucent fill (#FFFFFF0D-ish vertical gradient) + 1px hairline (gradient, brighter at
 * the top-left) + inset top highlight + soft drop shadow. No backdrop-filter.
 */

/** 1px gradient hairline overlay (works on translucent fills, via mask-composite). */
export const Hairline: React.FC<{
  radius: number | string;
  color?: string; // CSS background for the ring (gradient ok)
  width?: number;
  opacity?: number;
}> = ({radius, color, width = 1, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      borderRadius: radius,
      padding: width,
      background:
        color ??
        'linear-gradient(160deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.07) 60%, rgba(255,255,255,0.16) 100%)',
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
      opacity,
      pointerEvents: 'none',
    }}
  />
);

export type GlassPanelProps = {
  width?: number | string;
  height?: number | string;
  /** absolute position (top-left). Omit both to flow normally. */
  x?: number;
  y?: number;
  radius?: number;
  /** colour tint of fill + rim */
  tint?: Tone;
  tintStrength?: number;
  /** outer glow in the tint colour (0..1) */
  glow?: number;
  /** ring style: default white hairline, 'signature' gradient rim, or a tone colour */
  rim?: 'hairline' | 'signature' | Tone;
  rimOpacity?: number;
  rimWidth?: number;
  /** smoked black glass (S3 Checks panel) */
  smoked?: boolean;
  /** lifted shadow */
  lifted?: boolean;
  /**
   * dark ink backing under the glass (0..1, default 0.72) so the light axis / orbs behind do not show
   * through text. 0 = fully see-through glass (only for panels with nothing behind them).
   */
  backing?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export const GlassPanel: React.FC<GlassPanelProps> = ({
  width,
  height,
  x,
  y,
  radius = 18,
  tint,
  tintStrength = 1,
  glow = 0,
  rim = 'hairline',
  rimOpacity = 1,
  rimWidth = 1,
  smoked,
  lifted,
  backing = 0.72,
  style,
  children,
}) => {
  const t = tint ? TONES[tint] : null;
  const fills: string[] = [];
  // top sheen
  fills.push('linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0) 42%)');
  if (t) {
    fills.push(
      `linear-gradient(155deg, ${alpha(t.main, 0.15 * tintStrength)} 0%, ${alpha(t.main, 0.06 * tintStrength)} 45%, ${alpha(t.deep, 0.16 * tintStrength)} 100%)`,
    );
  }
  fills.push(
    smoked
      ? 'linear-gradient(180deg, rgba(8,10,16,0.88) 0%, rgba(4,5,9,0.92) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.035) 100%)',
  );
  if (!smoked && backing > 0) fills.push(`rgba(8,11,20,${backing})`);
  const rimBg =
    rim === 'signature'
      ? `linear-gradient(115deg, ${C.ember} 0%, ${C.emberGlow} 30%, ${C.whiteHot} 50%, ${C.iceGlow} 70%, ${C.ice} 100%)`
      : rim === 'hairline'
        ? undefined
        : `linear-gradient(160deg, ${alpha(TONES[rim].glow, 0.95)} 0%, ${alpha(TONES[rim].main, 0.55)} 45%, ${alpha(TONES[rim].main, 0.3)} 100%)`;
  const glowCol = t ? t.main : rim !== 'hairline' && rim !== 'signature' ? TONES[rim].main : C.whiteHot;
  return (
    <div
      style={{
        position: x !== undefined || y !== undefined ? 'absolute' : 'relative',
        left: x,
        top: y,
        width,
        height,
        borderRadius: radius,
        background: fills.join(', '),
        boxShadow: [
          lifted ? SHADOW.lifted : SHADOW.glass,
          glow > 0 ? `0 0 ${Math.round(46 * glow + 10)}px ${alpha(glowCol, 0.32 * glow)}` : null,
          glow > 0 ? `0 0 ${Math.round(120 * glow)}px ${alpha(glowCol, 0.14 * glow)}` : null,
        ]
          .filter(Boolean)
          .join(', '),
        ...style,
      }}
    >
      <Hairline radius={radius} color={rimBg} opacity={rimOpacity} width={rimWidth} />
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Pill: uppercase label pill (SPARK, SNOWFLAKE, NEEDS YOU, MATCHED, MISSED ONE, DEMO PROJECT)
 * ---------------------------------------------------------------------------------------------- */

export type PillIcon = 'dot' | 'hex' | 'check' | 'alert' | 'none';

export type PillProps = {
  label: string;
  tone?: Tone;
  icon?: PillIcon;
  /** font size px (18-20 per spec; tiles use 15) */
  size?: number;
  /** solid pills sit over busy content (tags on tiles) */
  solid?: boolean;
  /** outer glow 0..1 */
  glow?: number;
  uppercase?: boolean;
  style?: React.CSSProperties;
};

const PillIconEl: React.FC<{icon: PillIcon; color: string; size: number}> = ({icon, color, size}) => {
  if (icon === 'dot') return <DotGlyph size={Math.round(size * 0.5)} color={color} />;
  if (icon === 'hex') return <HexGlyph size={Math.round(size * 0.72)} color={color} />;
  if (icon === 'check') return <CheckMark size={Math.round(size * 1.05)} color={color} strokeWidth={2.8} />;
  if (icon === 'alert') return <HexBadge size={Math.round(size * 0.95)} color={color} mark="!" />;
  return null;
};

export const Pill: React.FC<PillProps> = ({label, tone = 'neutral', icon = 'none', size = TYPE.pill, solid, glow = 0, uppercase = true, style}) => {
  const t = TONES[tone];
  const h = Math.round(size * 1.85);
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.5),
        height: h,
        padding: `0 ${Math.round(size * 0.78)}px 0 ${Math.round(size * (icon === 'none' ? 0.78 : 0.62))}px`,
        borderRadius: h / 2,
        background: solid
          ? `linear-gradient(180deg, ${alpha(t.main, 0.26)} 0%, ${alpha(t.main, 0.16)} 100%), rgba(8,10,16,0.82)`
          : `linear-gradient(180deg, ${alpha(t.main, 0.18)} 0%, ${alpha(t.main, 0.09)} 100%)`,
        boxShadow: [
          `inset 0 0 0 1px ${alpha(t.main, solid ? 0.6 : 0.42)}`,
          `inset 0 1px 0 ${alpha('#FFFFFF', 0.12)}`,
          glow > 0 ? `0 0 ${Math.round(24 * glow)}px ${alpha(t.main, 0.4 * glow)}` : null,
          solid ? '0 6px 16px -6px rgba(0,0,0,0.7)' : null,
        ]
          .filter(Boolean)
          .join(', '),
        color: t.text,
        fontFamily: FONT.display,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: uppercase ? TYPE.pillTracking : '0.01em',
        textTransform: uppercase ? 'uppercase' : undefined,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...style,
      }}
    >
      {icon !== 'none' ? <PillIconEl icon={icon} color={t.main} size={size} /> : null}
      <span style={{transform: 'translateY(0.04em)'}}>{label}</span>
    </div>
  );
};

/** Tag = small solid Pill used on/over tiles and cards ('missed one', 'Needs you', 'matched', 'wrong row'). */
export const Tag: React.FC<Omit<PillProps, 'solid'>> = (p) => <Pill size={15} icon="dot" solid {...p} />;

/* ------------------------------------------------------------------------------------------------
 * Chip: sentence-case glass chip ('Rewrite', 'Fix', 'Test', 'from Mappings', 'shared in your repo', 'Spark SQL')
 * ---------------------------------------------------------------------------------------------- */

export type ChipProps = {
  label: string;
  tone?: Tone;
  /** leading glyph */
  icon?: PillIcon | React.ReactNode;
  size?: number; // font px
  mono?: boolean;
  /** 'glass' (default), 'solid' (over busy content), 'dashed' (empty slot) */
  variant?: 'glass' | 'solid' | 'dashed';
  glow?: number;
  style?: React.CSSProperties;
};

export const Chip: React.FC<ChipProps> = ({label, tone = 'neutral', icon, size = 22, mono, variant = 'glass', glow = 0, style}) => {
  const t = TONES[tone];
  const h = Math.round(size * 1.75);
  const isDashed = variant === 'dashed';
  const iconEl =
    icon === undefined || icon === 'none' ? null : typeof icon === 'string' ? (
      <PillIconEl icon={icon as PillIcon} color={t.main} size={size} />
    ) : (
      icon
    );
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.45),
        height: h,
        padding: `0 ${Math.round(size * 0.72)}px`,
        borderRadius: Math.round(h * 0.36),
        background: isDashed
          ? 'transparent'
          : variant === 'solid'
            ? `linear-gradient(180deg, ${alpha(t.main, 0.24)} 0%, ${alpha(t.main, 0.13)} 100%), rgba(10,12,20,0.86)`
            : `linear-gradient(180deg, ${alpha(t.main, tone === 'neutral' ? 0.1 : 0.16)} 0%, ${alpha(t.main, tone === 'neutral' ? 0.05 : 0.07)} 100%)`,
        border: isDashed ? `1.5px dashed ${alpha(t.main, 0.75)}` : undefined,
        boxShadow: isDashed
          ? undefined
          : [
              `inset 0 0 0 1px ${alpha(t.main, tone === 'neutral' ? 0.28 : 0.45)}`,
              `inset 0 1px 0 ${alpha('#FFFFFF', 0.12)}`,
              glow > 0 ? `0 0 ${Math.round(26 * glow)}px ${alpha(t.main, 0.42 * glow)}` : null,
              variant === 'solid' ? '0 8px 18px -8px rgba(0,0,0,0.8)' : null,
            ]
              .filter(Boolean)
              .join(', '),
        color: isDashed ? 'transparent' : tone === 'neutral' ? C.frost : t.text,
        fontFamily: mono ? FONT.mono : FONT.display,
        fontWeight: mono ? 500 : 600,
        fontSize: size,
        letterSpacing: mono ? 0 : '-0.005em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        fontFeatureSettings: mono ? '"liga" 0, "calt" 0' : undefined,
        ...style,
      }}
    >
      {iconEl}
      <span style={{transform: 'translateY(0.03em)'}}>{label}</span>
    </div>
  );
};

/* ------------------------------------------------------------------------------------------------
 * StatChip: '10 converted' / '10/10 match · test data' / '2 need you'
 * ---------------------------------------------------------------------------------------------- */

export type StatChipProps = {
  tone: Tone;
  /** final number */
  value: number;
  /** optional denominator: renders value/of */
  of?: number;
  label: string;
  /** optional note after a middot ('test data') */
  note?: string;
  /** 0..1 roll-up of the number (12f in S5) */
  roll?: number;
  icon?: PillIcon;
  size?: number; // number font px (30)
  glow?: number;
  style?: React.CSSProperties;
};

export const StatChip: React.FC<StatChipProps> = ({tone, value, of, label, note, roll = 1, icon, size = TYPE.stat, glow = 0.5, style}) => {
  const t = TONES[tone];
  const shown = Math.round(value * Math.max(0, Math.min(1, roll)));
  const ic: PillIcon = icon ?? (tone === 'mint' ? 'check' : tone === 'amber' ? 'alert' : tone === 'ice' ? 'hex' : 'dot');
  const h = Math.round(size * 2.2);
  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.42),
        height: h,
        padding: `0 ${Math.round(size * 0.85)}px 0 ${Math.round(size * 0.62)}px`,
        borderRadius: h / 2,
        background: `linear-gradient(180deg, ${alpha(t.main, 0.13)} 0%, ${alpha(t.main, 0.05)} 100%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))`,
        boxShadow: [
          `inset 0 0 0 1px ${alpha(t.main, 0.38)}`,
          `inset 0 1px 0 ${alpha('#FFFFFF', 0.14)}`,
          SHADOW.soft,
          glow > 0 ? `0 0 ${Math.round(40 * glow)}px ${alpha(t.main, 0.26 * glow)}` : null,
        ]
          .filter(Boolean)
          .join(', '),
        whiteSpace: 'nowrap',
        lineHeight: 1,
        ...style,
      }}
    >
      <div style={{width: size * 1.05, height: size * 1.05, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <PillIconEl icon={ic} color={t.main} size={size * 0.95} />
      </div>
      <span
        style={{
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: size,
          fontVariantNumeric: 'tabular-nums',
          color: t.main,
          textShadow: `0 0 18px ${alpha(t.main, 0.45)}`,
          fontFeatureSettings: '"liga" 0, "calt" 0, "tnum" 1',
          letterSpacing: '-0.02em',
        }}
      >
        {of !== undefined ? `${shown}/${of}` : shown}
      </span>
      <span style={{fontFamily: FONT.display, fontWeight: 500, fontSize: size * 0.9, color: C.frost, letterSpacing: '-0.01em'}}>{label}</span>
      {note ? (
        <>
          <span style={{fontFamily: FONT.display, fontWeight: 500, fontSize: size * 0.9, color: C.dim}}>{'·'}</span>
          <span style={{fontFamily: FONT.display, fontWeight: 500, fontSize: size * 0.9, color: C.slate, letterSpacing: '-0.01em'}}>{note}</span>
        </>
      ) : null}
    </div>
  );
};
