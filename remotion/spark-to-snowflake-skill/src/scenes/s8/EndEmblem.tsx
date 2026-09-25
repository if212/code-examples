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
 * Where the SkillFolder's conic edge light peaks on the front-lid rim, in folder-box coordinates.
 * The conic band peaks 44deg after its `from` angle (see SkillFolder); CSS conic angles are geometric,
 * 0deg = up, clockwise. The ray from the lid centre is intersected with the lid rectangle.
 */
const rimPoint = (angleDeg: number, lidCx: number, lidCy: number, hw: number, hh: number) => {
  const th = ((angleDeg + 44) * Math.PI) / 180;
  const sx = Math.sin(th);
  const sy = -Math.cos(th);
  const t = Math.min(Math.abs(sx) > 1e-4 ? hw / Math.abs(sx) : Infinity, Math.abs(sy) > 1e-4 ? hh / Math.abs(sy) : Infinity);
  return {x: lidCx + sx * t, y: lidCy + sy * t};
};
/** local box around the folder so the entry blur stays a small, cheap filter region */
const BOX_W = 520;
const BOX_H = 360;

/** Emblem state at local frame f (exported so the scene can align other layers to it). */
export const emblemState = (f: number, fps: number) => {
  const p = glide(f, T8.folderIn, fps, T8.folderDur);
  const settled = clamp01((f - T8.folderIn - T8.folderDur + 6) / 24);
  // slow float once settled (noise, +/-2.5px) so the hold is alive but calm
  const float = 2.5 * settled * wobble('s8-float', f, 0.018);
  return {
    p,
    y: F.cy + 46 * (1 - p) + float,
    // entry scale x the shot's slow drift (1.00 -> 1.03 over the scene, storyboard camera language)
    scale: (0.86 + 0.14 * p) * (1 + 0.03 * ramp(f, T8.folderIn, SCENE_LEN)),
    blur: 10 * (1 - clamp01(p)),
    opacity: clamp01(p * 1.6),
  };
};

/**
 * The end-card emblem: the skill folder (160px) on the light axis at (960,340), with a sized violet/ice halo
 * and a conic edge light orbiting its rim (1 revolution per 90f). It rises out of the light-wipe (GLIDE)
 * with a focus pull, and catches the runner light as it passes through.
 */
export const EndEmblem: React.FC<{f: number; fps: number; span: number}> = ({f, fps, span}) => {
  const e = emblemState(f, fps);
  const m = folderMetrics(F.size);
  const pass = runnerPass(f, span);
  const edge = reveal(f, T8.edgeLightAt, T8.edgeLightDur);
  const breathe = 0.9 + 0.1 * Math.sin((f - T8.holdFrom) / 16);
  const halo = clamp01(e.p) * breathe;
  const angle = (f * EDGE_DEG_PER_FRAME) % 360;
  const edgeStrength = Math.min(1, edge * (0.85 + 0.15 * breathe) + 0.3 * pass);
  // front lid geometry inside the local box (matches SkillFolder's folderMetrics)
  const lidCx = BOX_W / 2;
  const lidCy = BOX_H / 2 - m.height / 2 + m.frontTop + (m.height - m.frontTop) / 2;
  const rp = rimPoint(angle, lidCx, lidCy, m.width / 2 - 1, (m.height - m.frontTop) / 2 - 1);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* halo: soft violet core + wider ice veil, sized to its own box (screen) */}
      <div
        style={{
          position: 'absolute',
          left: F.cx - 360,
          top: e.y - 230,
          width: 720,
          height: 460,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.violetGlow, 0.2 * halo + 0.12 * pass, 14, 2.6),
          mixBlendMode: 'screen',
          opacity: e.opacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: F.cx - 300,
          top: e.y - 150,
          width: 600,
          height: 300,
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
          width={m.width}
          glow={0.75 + 0.25 * pass}
          flash={0.32 * pass}
          edgeLight={{angle, strength: edgeStrength}}
        />
        {/* the orbiting light's travelling glint: soft bloom + white-hot core riding the lid rim */}
        {edgeStrength > 0.01 ? (
          <>
            <div
              style={{
                position: 'absolute',
                left: rp.x - 46,
                top: rp.y - 46,
                width: 92,
                height: 92,
                background: softRadial('circle closest-side at 50% 50%', C.iceGlow, 0.42 * edgeStrength, 12, 2.8),
                mixBlendMode: 'screen',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: rp.x - 9,
                top: rp.y - 9,
                width: 18,
                height: 18,
                background: softRadial('circle closest-side at 50% 50%', C.whiteHot, 0.9 * edgeStrength, 10, 2.2),
                mixBlendMode: 'screen',
              }}
            />
          </>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
