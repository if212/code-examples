import React from 'react';
import {AbsoluteFill} from 'remotion';
import {SkillFolder, folderMetrics} from '../../components';
import {C, softRadial} from '../../theme';
import {END_STACK} from '../../layout';
import {clamp01, glide, ramp, reveal, wobble} from '../../motion';
import {sceneById} from '../../timeline';
import {EDGE_DEG_PER_FRAME, T8} from './timing';
import {runnerPass} from './AxisLight';

const F = END_STACK.folder;
const SCENE_LEN = sceneById('S8').duration;

/**
 * End-card folder width. END_STACK.folder.size (160) read as timid at 1920 (round-1 review), so the end emblem
 * is drawn ~1.44x larger. It stays centred on the light axis at (960,340): Main owns the axis at y340 in S8,
 * and the storyboard has the folder settle ON the axis, so only the size changes here.
 */
export const FOLDER_W = 230;

/** local box around the folder so the entry blur stays a small, cheap filter region */
const BOX_W = 560;
const BOX_H = 380;

/**
 * The folder's silhouette (back plate with its tab), identical to SkillFolder's path for an unlabelled folder,
 * in folder-local coordinates (0..W x 0..height). The rim light travels along it.
 */
const silhouette = (W: number): string => {
  const {tabH, height, r, labelSize} = folderMetrics(W);
  const tabW = Math.min(W * 0.78, Math.max(W * 0.4, labelSize * 2.2));
  const s = tabH * 1.05;
  return [
    `M ${r} ${height}`,
    `Q 0 ${height} 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    `L ${tabW - s} 0`,
    `C ${tabW - s * 0.45} 0 ${tabW - s * 0.55} ${tabH} ${tabW} ${tabH}`,
    `L ${W - r} ${tabH}`,
    `Q ${W} ${tabH} ${W} ${tabH + r}`,
    `L ${W} ${height - r}`,
    `Q ${W} ${height} ${W - r} ${height}`,
    'Z',
  ].join(' ');
};

/** normalised path length used for the dash maths (SVG pathLength) */
const PL = 1000;
/** arc length as a share of the perimeter: ~20% reads like a ~70deg conic sweep */
const ARC = 0.2 * PL;
/** the brightest point sits 70% of the way along the arc (a short bright head, a longer cooling tail) */
const HEAD_SHARE = 0.3;
const SEGMENTS = 11;

/**
 * Nested dash segments that all share the peak point: the shortest (innermost) are white-hot, the longer ones
 * ice. Their overlapping alphas build a smooth comet profile (transparent -> ice -> white-hot -> transparent)
 * along the rim, i.e. a conic-style arc that follows the folder's real silhouette, tab included.
 */
const arcSegments = (peak: number) =>
  Array.from({length: SEGMENTS}, (_, j) => {
    // outermost first, so the short white-hot core segments paint on top
    const i = SEGMENTS - 1 - j;
    const k = (i + 1) / SEGMENTS; // 1/N .. 1 (outermost)
    const fwd = ARC * HEAD_SHARE * k;
    const back = ARC * (1 - HEAD_SHARE) * k;
    const len = fwd + back;
    const start = (((peak - back) % PL) + PL) % PL;
    return {
      key: i,
      dash: `${len.toFixed(2)} ${(PL - len).toFixed(2)}`,
      offset: (-start).toFixed(2),
      color: k <= 0.3 ? C.whiteHot : k <= 0.62 ? C.iceGlow : C.ice,
      alpha: 0.34 * (1 - 0.8 * (k - 1 / SEGMENTS)),
    };
  });

/**
 * The orbiting rim light: a 2px arc riding the folder silhouette plus a ~14px screen bloom (SVG blur on a small
 * box), 1 revolution per 90f. Replaces the old single-point glint, which read as a stray speck.
 */
const RimLight: React.FC<{W: number; x: number; y: number; phase: number; strength: number}> = ({
  W,
  x,
  y,
  phase,
  strength,
}) => {
  const m = folderMetrics(W);
  const d = silhouette(W);
  const segs = arcSegments(phase * PL);
  const pad = 40;
  return (
    <svg
      width={W + pad * 2}
      height={m.height + pad * 2}
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${m.height + pad * 2}`}
      style={{position: 'absolute', left: x - pad, top: y - pad, overflow: 'visible', mixBlendMode: 'screen'}}
    >
      <defs>
        <filter id="s8-rim-bloom" filterUnits="userSpaceOnUse" x={-pad} y={-pad} width={W + pad * 2} height={m.height + pad * 2}>
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="s8-rim-soft" filterUnits="userSpaceOnUse" x={-pad} y={-pad} width={W + pad * 2} height={m.height + pad * 2}>
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      {/* 14px bloom */}
      <g filter="url(#s8-rim-bloom)" opacity={strength}>
        {segs.map((s) => (
          <path
            key={s.key}
            d={d}
            pathLength={PL}
            fill="none"
            stroke={s.color === C.whiteHot ? C.iceGlow : s.color}
            strokeOpacity={s.alpha}
            strokeWidth={8}
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
          />
        ))}
      </g>
      {/* soft 4px inner glow so the line has a body */}
      <g filter="url(#s8-rim-soft)" opacity={0.8 * strength}>
        {segs.map((s) => (
          <path
            key={s.key}
            d={d}
            pathLength={PL}
            fill="none"
            stroke={s.color}
            strokeOpacity={s.alpha}
            strokeWidth={3.5}
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
          />
        ))}
      </g>
      {/* the 2px rim arc */}
      <g opacity={strength}>
        {segs.map((s) => (
          <path
            key={s.key}
            d={d}
            pathLength={PL}
            fill="none"
            stroke={s.color}
            strokeOpacity={Math.min(1, s.alpha * 1.25)}
            strokeWidth={2}
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
          />
        ))}
      </g>
    </svg>
  );
};

/** Emblem state at local frame f (exported so the scene can align other layers to it). */
export const emblemState = (f: number, fps: number) => {
  const p = glide(f, T8.folderIn, fps, T8.folderDur);
  const settled = clamp01((f - T8.folderIn - T8.folderDur + 6) / 24);
  // slow float once settled (noise, +/-2.5px) so the hold is alive but calm
  const float = 2.5 * settled * wobble('s8-float', f, 0.018);
  return {
    p,
    y: F.cy + 56 * (1 - p) + float,
    // entry scale x the shot's slow drift (1.00 -> 1.03 over the scene, storyboard camera language)
    scale: (0.86 + 0.14 * p) * (1 + 0.03 * ramp(f, T8.folderIn, SCENE_LEN)),
    // front-loaded focus pull: ~3px at lf6 as the wipe clears, sharp by ~lf14 (the rise itself runs to ~lf26)
    blur: 12 * (1 - clamp01(p)) ** 2,
    opacity: clamp01(p * 1.8),
  };
};

/**
 * The end-card emblem: the skill folder on the light axis at (960,340), with a sized violet/ice halo and a
 * rim light orbiting its silhouette (1 revolution per 90f). It rises out of the light-wipe (GLIDE) with a
 * focus pull, and catches the runner light as it passes through.
 */
export const EndEmblem: React.FC<{f: number; fps: number; span: number}> = ({f, fps, span}) => {
  const e = emblemState(f, fps);
  const m = folderMetrics(FOLDER_W);
  const pass = runnerPass(f, span);
  const edge = reveal(f, T8.edgeLightAt, T8.edgeLightDur);
  const breathe = 0.9 + 0.1 * Math.sin((f - T8.holdFrom) / 16);
  const halo = clamp01(e.p) * breathe;
  // start the orbit at the top-left of the silhouette so the first sweep runs across the top (towards the tab)
  const phase = ((f * EDGE_DEG_PER_FRAME) / 360 + 0.24) % 1;
  const edgeStrength = Math.min(1, edge * (0.85 + 0.15 * breathe) + 0.3 * pass);
  const fx = BOX_W / 2 - FOLDER_W / 2;
  const fy = BOX_H / 2 - m.height / 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* halo: soft violet core + wider ice veil, sized to its own box (screen) */}
      <div
        style={{
          position: 'absolute',
          left: F.cx - 440,
          top: e.y - 270,
          width: 880,
          height: 540,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.violetGlow, 0.2 * halo + 0.12 * pass, 14, 2.6),
          mixBlendMode: 'screen',
          opacity: e.opacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: F.cx - 370,
          top: e.y - 180,
          width: 740,
          height: 360,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.ice, 0.07 * halo, 14, 2.4),
          mixBlendMode: 'screen',
          opacity: e.opacity,
        }}
      />
      {/* the folder, in a small local box so the focus-pull blur stays cheap */}
      <div
        style={{
          position: 'absolute',
          left: F.cx - BOX_W / 2,
          top: e.y - BOX_H / 2,
          width: BOX_W,
          height: BOX_H,
          opacity: e.opacity,
          transform: `scale(${e.scale.toFixed(4)})`,
          filter: e.blur > 0.3 ? `blur(${e.blur.toFixed(2)}px)` : undefined,
        }}
      >
        <SkillFolder
          cx={BOX_W / 2}
          cy={BOX_H / 2}
          width={FOLDER_W}
          glow={0.75 + 0.25 * pass}
          flash={0.32 * pass}
        />
        {edgeStrength > 0.01 ? <RimLight W={FOLDER_W} x={fx} y={fy} phase={phase} strength={edgeStrength} /> : null}
      </div>
    </AbsoluteFill>
  );
};
