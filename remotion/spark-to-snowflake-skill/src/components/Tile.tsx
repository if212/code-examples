import React from 'react';
import {C, FONT, SHADOW, TONES, Tone, alpha} from '../theme';
import {BOARD} from '../layout';
import {bell, clamp01} from '../motion';
import {Hairline, Pill, Chip} from './Glass';
import {CheckDisc, HexBadge} from './Icons';

/**
 * A glass job tile (300x170, radius 18) with a true 3D rotateY flip:
 *   front = ember 'SPARK' face, back = ice 'SNOWFLAKE' face (or amber 'NEEDS YOU' when outcome='needYou').
 * Everything is driven by props so scenes own the timing. Filters (blur) are applied to the faces only
 * (never to the preserve-3d flipper).
 */

export type TileChip = {
  label: string;
  /** appear progress 0..1 (spring values ok: >1 overshoots). Scale 1.3 -> 1 stamp is built in. */
  p: number;
  /** solid (default) | ghost (lingering 30%) | missing (empty dashed slot, label only sizes it) */
  state?: 'solid' | 'ghost' | 'missing';
};

export type TileState = {
  file: string;
  /** 0 = ember front, 1 = ice back. Spring values welcome (overshoot rotates past 180 and settles). */
  flip?: number;
  /** what the back face shows */
  outcome?: 'converted' | 'needYou';
  /** 0..1 mint check draw on the back face (converted tiles) */
  check?: number;
  /** 0..1 amber reveal on the back face (needYou tiles): amber rim + glow + hex '!' badge pop */
  needYou?: number;
  /** 0..1 violet sparkle burst over the tile (latest_customers.sql landing in S5) */
  sparkle?: number;
  /** chip row on the front face (S1 'Rewrite' 'Fix' 'Test') */
  chips?: TileChip[];
  /** tilted stamp over the front face (S1 'again'); p = 0..1 (spring ok) */
  stamp?: {label: string; p: number; tone?: Tone};
  /** tag riding on the tile's top edge (S1 'missed one'); p = pop progress, shake = x offset px */
  tag?: {label: string; p: number; tone: Tone; shake?: number};
  /** 0..1 ember progress bar under the tile (S1 'working on it') */
  progress?: number;
  /** 0..1 cursor-hover highlight (brighter rim + slight lift) */
  highlight?: number;
  /** 0..1 float forward (scale 1.12 + deep shadow + above neighbours) */
  lift?: number;
  opacity?: number;
  /** depth-of-field blur in px (applied to faces = leaves) */
  blur?: number;
  /** extra offsets (jitter, flights) */
  dx?: number;
  dy?: number;
  /** translateZ in px (entry from -200) */
  z?: number;
  /** extra uniform scale */
  scale?: number;
  /** extra rotateX / rotateZ deg of the whole tile (peel, fly) */
  rotateX?: number;
  rotateZ?: number;
  /** simplified faces for tiny mini boards (no filename text) */
  mini?: boolean;
  /** hide the front chip row (e.g. after its chips peel off as flying notes in S2) */
  hideChips?: boolean;
};

const W = BOARD.tileW;
const Hh = BOARD.tileH;
const R = BOARD.radius;

const CodeBars: React.FC<{tone: Tone; mini?: boolean; opacity?: number}> = ({tone, mini, opacity = 1}) => {
  const t = TONES[tone];
  const rows = [
    {tok: 34, w: 0.62},
    {tok: 22, w: 0.44},
    {tok: 40, w: 0.54},
  ];
  const h = mini ? 9 : 6;
  return (
    <div style={{position: 'absolute', left: 22, top: mini ? 78 : 104, width: W - 44, opacity}}>
      {rows.map((r, k) => (
        <div key={k} style={{display: 'flex', gap: 6, marginBottom: mini ? 9 : 7, marginLeft: k === 1 ? 18 : 0}}>
          <div style={{width: r.tok, height: h, borderRadius: h / 2, background: alpha(t.main, 0.3)}} />
          <div style={{width: (W - 44) * r.w - r.tok, height: h, borderRadius: h / 2, background: alpha(C.frost, 0.13)}} />
        </div>
      ))}
    </div>
  );
};

const faceBase = (tone: Tone, strength: number): string => {
  const t = TONES[tone];
  return [
    'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%)',
    `radial-gradient(120% 90% at 0% 0%, ${alpha(t.main, 0.16 * strength)} 0%, ${alpha(t.main, 0.05 * strength)} 45%, rgba(0,0,0,0) 75%)`,
    `linear-gradient(160deg, ${alpha(t.main, 0.07 * strength)} 0%, ${alpha(t.deep, 0.22 * strength)} 100%)`,
    'linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.03) 100%)',
    'rgba(8,11,20,0.74)',
  ].join(', ');
};

const Sheen: React.FC<{p: number; side: 'front' | 'back'}> = ({p, side}) => {
  // visible just before (front) / after (back) the edge-on moment
  const local = side === 'front' ? clamp01((p - 0.1) / 0.4) : clamp01((p - 0.5) / 0.4);
  const o = bell(local);
  if (o <= 0.01) return null;
  const pos = side === 'front' ? -40 + 140 * local : -40 + 140 * local;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: R,
        opacity: o,
        background: `linear-gradient(112deg, rgba(255,255,255,0) ${pos - 30}%, ${alpha(C.emberGlow, 0.25)} ${pos - 12}%, ${alpha(C.whiteHot, 0.55)} ${pos}%, ${alpha(C.iceGlow, 0.3)} ${pos + 12}%, rgba(255,255,255,0) ${pos + 30}%)`,
        mixBlendMode: 'screen',
      }}
    />
  );
};

const FrontFace: React.FC<{s: TileState; flip: number; blur: number; highlight: number}> = ({s, flip, blur, highlight}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: R,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        background: faceBase('ember', 1),
        boxShadow: SHADOW.glass,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <Hairline
        radius={R}
        color={`linear-gradient(160deg, ${alpha('#FFFFFF', 0.3 + 0.3 * highlight)} 0%, ${alpha(C.ember, 0.28 + 0.2 * highlight)} 35%, rgba(255,255,255,0.06) 65%, ${alpha(C.ember, 0.18)} 100%)`}
      />
      <div style={{position: 'absolute', left: 18, top: 18}}>
        {s.mini ? (
          <div style={{width: 96, height: 22, borderRadius: 11, background: alpha(C.ember, 0.55), boxShadow: `0 0 16px ${alpha(C.ember, 0.5)}`}} />
        ) : (
          <Pill label="Spark" tone="ember" icon="dot" size={14} />
        )}
      </div>
      {s.mini ? (
        <div style={{position: 'absolute', left: 22, top: 56, width: 170, height: 10, borderRadius: 5, background: alpha(C.frost, 0.35)}} />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 21,
            top: 62,
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: 22,
            color: alpha(C.frost, 0.92),
            letterSpacing: '-0.01em',
            fontFeatureSettings: '"liga" 0, "calt" 0',
            whiteSpace: 'nowrap',
          }}
        >
          {s.file}
        </div>
      )}
      <CodeBars tone="ember" mini={s.mini} opacity={s.chips && s.chips.some((c) => c.p > 0.01) ? 0.45 : 1} />
      {s.chips && !s.hideChips ? (
        <div style={{position: 'absolute', left: 16, bottom: 14, display: 'flex', gap: 6}}>
          {s.chips.map((c, k) => {
            const p = Math.max(0, c.p);
            const st = c.state ?? 'solid';
            if (p <= 0.001 && st !== 'missing') {
              return (
                <div key={k} style={{visibility: 'hidden'}}>
                  <Chip label={c.label} size={15} />
                </div>
              );
            }
            const scale = st === 'missing' ? 1 : 1.3 - 0.3 * Math.min(1, p) + (p > 1 ? (p - 1) * 0.3 : 0);
            return (
              <div
                key={k}
                style={{
                  transform: `scale(${scale.toFixed(3)})`,
                  opacity: st === 'ghost' ? 0.3 * Math.min(1, p) : st === 'missing' ? Math.min(1, p) : Math.min(1, p * 1.6),
                }}
              >
                <Chip label={c.label} size={15} tone={st === 'missing' ? 'neutral' : 'ember'} variant={st === 'missing' ? 'dashed' : 'solid'} />
              </div>
            );
          })}
        </div>
      ) : null}
      {s.stamp && s.stamp.p > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: 14,
            transform: `rotate(-9deg) scale(${(1.35 - 0.35 * Math.min(1, s.stamp.p)).toFixed(3)})`,
            opacity: Math.min(1, s.stamp.p * 1.5),
            padding: '5px 12px 4px',
            borderRadius: 8,
            border: `2px solid ${alpha(TONES[s.stamp.tone ?? 'ember'].glow, 0.9)}`,
            color: TONES[s.stamp.tone ?? 'ember'].glow,
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: alpha(TONES[s.stamp.tone ?? 'ember'].main, 0.12),
            boxShadow: `0 0 18px ${alpha(TONES[s.stamp.tone ?? 'ember'].main, 0.35)}`,
          }}
        >
          {s.stamp.label}
        </div>
      ) : null}
      <Sheen p={flip} side="front" />
    </div>
  );
};

const BackFace: React.FC<{s: TileState; flip: number; blur: number; highlight: number}> = ({s, flip, blur, highlight}) => {
  const needYou = s.outcome === 'needYou';
  const ny = clamp01(s.needYou ?? 0);
  const tone: Tone = needYou ? 'amber' : 'ice';
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: R,
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
        background: faceBase(tone, needYou ? 0.6 + 0.6 * ny : 1),
        boxShadow: [
          SHADOW.glass,
          needYou ? `0 0 ${Math.round(34 * ny)}px ${alpha(C.amber, 0.35 * ny)}` : `0 0 26px ${alpha(C.ice, 0.1)}`,
        ].join(', '),
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      <Hairline
        radius={R}
        color={
          needYou
            ? `linear-gradient(160deg, ${alpha(C.amber, 0.35 + 0.6 * ny)} 0%, ${alpha(C.amber, 0.25 + 0.45 * ny)} 40%, ${alpha(C.amber, 0.12 + 0.4 * ny)} 100%)`
            : `linear-gradient(160deg, ${alpha('#FFFFFF', 0.32 + 0.3 * highlight)} 0%, ${alpha(C.ice, 0.32 + 0.2 * highlight)} 35%, rgba(255,255,255,0.06) 65%, ${alpha(C.ice, 0.2)} 100%)`
        }
        width={needYou ? 1 + ny : 1}
      />
      <div style={{position: 'absolute', left: 18, top: 18}}>
        {s.mini ? (
          <div
            style={{
              width: needYou ? 120 : 132,
              height: 22,
              borderRadius: 11,
              background: alpha(needYou ? C.amber : C.ice, 0.6),
              boxShadow: `0 0 16px ${alpha(needYou ? C.amber : C.ice, 0.5)}`,
            }}
          />
        ) : needYou ? (
          <Pill label="Needs you" tone="amber" icon="dot" size={14} solid glow={ny} />
        ) : (
          <Pill label="Snowflake" tone="ice" icon="hex" size={14} />
        )}
      </div>
      {s.mini ? (
        <div style={{position: 'absolute', left: 22, top: 56, width: 170, height: 10, borderRadius: 5, background: alpha(C.frost, 0.35)}} />
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 21,
            top: 62,
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: 22,
            color: alpha(C.frost, 0.92),
            letterSpacing: '-0.01em',
            fontFeatureSettings: '"liga" 0, "calt" 0',
            whiteSpace: 'nowrap',
          }}
        >
          {s.file}
        </div>
      )}
      <CodeBars tone={tone} mini={s.mini} opacity={needYou ? 0.7 : 1} />
      {/* status slot top-right */}
      <div style={{position: 'absolute', right: 16, top: 16, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {needYou ? (
          ny > 0.001 ? (
            <div style={{transform: `scale(${(0.4 + 0.6 * Math.min(1.15, s.needYou ?? 0)).toFixed(3)})`, opacity: Math.min(1, ny * 2)}}>
              <HexBadge size={s.mini ? 40 : 32} color={C.amber} mark="!" />
            </div>
          ) : null
        ) : (s.check ?? 0) > 0.001 ? (
          <CheckDisc size={s.mini ? 40 : 32} draw={s.check} />
        ) : null}
      </div>
      <Sheen p={flip} side="back" />
    </div>
  );
};

/** Violet sparkle: expanding ring + round particles (no star glyphs). */
const Sparkle: React.FC<{p: number}> = ({p}) => {
  if (p <= 0 || p >= 1) return null;
  const ring = 30 + 150 * p;
  const o = 1 - p;
  return (
    <div style={{position: 'absolute', left: W / 2, top: Hh / 2, width: 0, height: 0, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: -ring,
          top: -ring * 0.62,
          width: ring * 2,
          height: ring * 1.24,
          borderRadius: '50%',
          boxShadow: `0 0 0 ${2 * o}px ${alpha(C.violet, 0.9 * o)}, 0 0 ${24 * o}px ${alpha(C.violetGlow, 0.8 * o)}`,
        }}
      />
      {new Array(8).fill(0).map((_, k) => {
        const a = (k / 8) * Math.PI * 2 + 0.3;
        const d = 60 + 120 * p;
        const sz = 7 * (1 - p) + 2;
        return (
          <div
            key={k}
            style={{
              position: 'absolute',
              left: Math.cos(a) * d * 1.3 - sz / 2,
              top: Math.sin(a) * d * 0.7 - sz / 2,
              width: sz,
              height: sz,
              borderRadius: '50%',
              background: k % 2 ? C.violet : '#E4DAFF',
              boxShadow: `0 0 10px ${alpha(C.violetGlow, 0.9)}`,
              opacity: o,
            }}
          />
        );
      })}
    </div>
  );
};

export type TileProps = TileState & {
  /** top-left canvas position (Board passes these) */
  x: number;
  y: number;
  zIndex?: number;
};

export const Tile: React.FC<TileProps> = (s) => {
  const flip = s.flip ?? 0;
  const b = bell(clamp01(flip));
  const lift = clamp01(s.lift ?? 0);
  const highlight = clamp01(s.highlight ?? 0);
  const blur = s.blur ?? 0;
  const scale = (s.scale ?? 1) * (1 + 0.12 * lift) * (1 + 0.015 * highlight);
  const outer: string[] = [];
  outer.push(`translate(${(s.dx ?? 0).toFixed(2)}px, ${((s.dy ?? 0) - 3 * highlight).toFixed(2)}px)`);
  if (s.z) outer.push(`perspective(1400px) translateZ(${s.z.toFixed(1)}px)`);
  if (s.rotateX) outer.push(`perspective(1200px) rotateX(${s.rotateX.toFixed(2)}deg)`);
  if (s.rotateZ) outer.push(`rotate(${s.rotateZ.toFixed(2)}deg)`);
  outer.push(`scale(${scale.toFixed(4)})`);
  const tag = s.tag;
  const progress = s.progress ?? 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: s.x,
        top: s.y,
        width: W,
        height: Hh,
        transform: outer.join(' '),
        opacity: s.opacity ?? 1,
        zIndex: s.zIndex ?? (lift > 0 ? 10 : flip > 0.02 && flip < 0.98 ? 5 : 1),
      }}
    >
      {/* lifted shadow under the tile */}
      {lift > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 30,
            bottom: -30,
            borderRadius: R + 10,
            background: 'rgba(0,0,0,0.6)',
            opacity: 0.8 * lift,
            filter: 'blur(26px)',
          }}
        />
      ) : null}
      {/* the flipper: preserve-3d, NO filter / opacity on it */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `perspective(1400px) translateZ(${(36 * b).toFixed(2)}px) rotateX(${(-6 * b).toFixed(2)}deg) rotateY(${(flip * 180).toFixed(3)}deg)`,
        }}
      >
        <FrontFace s={s} flip={flip} blur={blur} highlight={highlight} />
        <BackFace s={s} flip={flip} blur={blur} highlight={highlight} />
        {/* the tile's edge: a white-hot glint that faces the camera at mid-flip */}
        {b > 0.6 ? (
          <div
            style={{
              position: 'absolute',
              left: W / 2 - 2,
              top: 6,
              width: 4,
              height: Hh - 12,
              borderRadius: 2,
              transform: 'rotateY(90deg)',
              background: `linear-gradient(180deg, ${alpha(C.emberGlow, 0.2)} 0%, ${C.whiteHot} 30%, #FFFFFF 50%, ${C.iceGlow} 70%, ${alpha(C.ice, 0.2)} 100%)`,
              boxShadow: `0 0 14px ${alpha(C.whiteHot, 0.9)}`,
              opacity: (b - 0.6) / 0.4,
            }}
          />
        ) : null}
      </div>
      {progress > 0.001 ? (
        <div style={{position: 'absolute', left: 14, right: 14, top: Hh + 9, height: 3, borderRadius: 2, background: alpha(C.frost, 0.07)}}>
          <div
            style={{
              width: `${(clamp01(progress) * 100).toFixed(2)}%`,
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${C.emberDeep}, ${C.ember} 60%, ${C.emberGlow})`,
              boxShadow: `0 0 10px ${alpha(C.ember, 0.7)}`,
            }}
          />
        </div>
      ) : null}
      {tag && tag.p > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            right: 14,
            top: -15,
            transform: `translateX(${(tag.shake ?? 0).toFixed(2)}px) scale(${Math.max(0, tag.p).toFixed(3)})`,
            transformOrigin: '80% 50%',
            opacity: Math.min(1, tag.p * 1.6),
          }}
        >
          <Pill label={tag.label} tone={tag.tone} icon="dot" size={15} solid glow={0.8} />
        </div>
      ) : null}
      <Sparkle p={s.sparkle ?? 0} />
    </div>
  );
};
