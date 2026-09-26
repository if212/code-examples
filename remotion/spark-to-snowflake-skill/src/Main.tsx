import React from 'react';
import {AbsoluteFill, Easing, Freeze, Sequence, interpolate, spring, useCurrentFrame} from 'remotion';
import {C, SPRING} from './theme';
import {SCENES, DEMO_CHIP, FPS, SceneId, SceneSpan, TOTAL, sceneAt, sceneById} from './timeline';
import {BOARD, PROMPT_PILL} from './layout';
import {clamp01, glide, reveal} from './motion';
import {SCENE_COMPONENTS} from './scenes';
import {Background, Grain} from './components/Background';
import {AxisOccluder, LightAxis, axisYAt} from './components/LightAxis';
import {Specks} from './components/Specks';
import {LightWipe, wipeAt, wipeMask} from './components/LightWipe';
import {DemoChip} from './components/DemoChip';

/**
 * The film. Layer order (each its own AbsoluteFill):
 *   Background (orbs + grid, global colour arc) -> LightAxis -> scenes (hero, cursors, headlines)
 *   -> Specks (1.3x bokeh) -> DEMO PROJECT chip (S1-S7) -> light-wipe band (S4->S5, S7->S8) -> Grain (topmost).
 *
 * Light-wipes are REVEALS: while a band is on screen (global 565-575 and 985-995) the outgoing scene is drawn
 * only ahead of the band (frozen at its last frame once its time is up) and the incoming scene only behind it
 * (frozen at its lf0 until its time starts), each through a feathered mask whose edge sits under the band core.
 * The same applies to the light axis (600 -> 340 at the S7->S8 wipe) and the DEMO chip (ends with S7).
 */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const maskStyle = (mask: string | null): React.CSSProperties | undefined =>
  mask ? {WebkitMaskImage: mask, maskImage: mask} : undefined;

type SceneSlot = {s: SceneSpan; lf: number; mask: string | null};

/** Which scene(s) are on screen at global frame g, at which (clamped) local frame, and through which mask. */
export const sceneSlotsAt = (g: number): SceneSlot[] => {
  const gg = clamp(g, 0, TOTAL - 1);
  const w = wipeAt(gg);
  if (w) {
    const out = SCENES.find((s) => s.from + s.duration === w.wipe.cut);
    const inc = SCENES.find((s) => s.from === w.wipe.cut);
    if (out && inc) {
      return [
        {s: out, lf: clamp(gg - out.from, 0, out.duration - 1), mask: wipeMask('ahead', w.centre)},
        {s: inc, lf: clamp(gg - inc.from, 0, inc.duration - 1), mask: wipeMask('behind', w.centre)},
      ];
    }
  }
  const cur = SCENES.find((s) => gg >= s.from && gg < s.from + s.duration) ?? SCENES[SCENES.length - 1];
  return [{s: cur, lf: gg - cur.from, mask: null}];
};

/** One scene at an explicit local frame (Freeze sets the frame, the inner Sequence gives it its own duration). */
const SceneLayer: React.FC<SceneSlot> = ({s, lf, mask}) => {
  const Comp = SCENE_COMPONENTS[s.id];
  return (
    <AbsoluteFill style={maskStyle(mask)}>
      <Freeze frame={lf}>
        <Sequence durationInFrames={s.duration} name={s.id}>
          <Comp />
        </Sequence>
      </Freeze>
    </AbsoluteFill>
  );
};

const Scenes: React.FC<{frameOffset?: number}> = ({frameOffset = 0}) => {
  const g = useCurrentFrame() + frameOffset;
  return (
    <>
      {sceneSlotsAt(g).map((slot) => (
        <SceneLayer key={slot.s.id} {...slot} />
      ))}
    </>
  );
};

/**
 * Where hero glass sits ON the light axis (y=600), per global frame, so the axis dims behind it instead of
 * striking through tile text (see LightAxis `occlude`). Mirrors the scenes' own hero timing:
 *  - S1: the 4x3 board; each column occludes as its middle-row tile lands (lf4 + (1+col)*2, SNAP).
 *  - S2: the board dims to 35% (lf0-15) and fades out (lf84-114): occlusion follows its opacity.
 *  - S4: the prompt pill glides in at lf12 (the shelf cards sit above/below the axis).
 *  - S5, S6: the board (S6 pushes into a tile, then the code panel covers the same 320-1600 span).
 *  - S7: the board pulls back to the top-left mini board (lf0-10): occlusion releases.
 */
// The fade sits just outside the board's outer tile edges, so the axis runs up to the glass and dims under its
// rim (the shot drift, scale <= 1.03, moves those edges by <= 20px: still inside the feather).
const BOARD_X0 = BOARD.left;
const BOARD_X1 = BOARD.left + BOARD.width;
const BOARD_FEATHER = 24;
const boardSpan = (strength: number): AxisOccluder[] =>
  strength > 0.001 ? [{x0: BOARD_X0, x1: BOARD_X1, strength, feather: BOARD_FEATHER}] : [];

export const axisOccludersAt = (g: number, fps = FPS): AxisOccluder[] => {
  const gg = clamp(g, 0, TOTAL - 1);
  const id = sceneAt(gg);
  const lf = gg - sceneById(id).from;
  switch (id) {
    case 'S1':
      return [0, 1, 2, 3].map((col) => {
        const e = spring({frame: lf - 4 - (1 + col) * 2, fps, config: SPRING.SNAP});
        const left = BOARD.left + col * (BOARD.tileW + BOARD.gap);
        return {
          x0: col === 0 ? BOARD_X0 : left - BOARD.gap / 2,
          x1: col === BOARD.cols - 1 ? BOARD_X1 : left + BOARD.tileW + BOARD.gap / 2,
          strength: clamp01(e * 1.2),
          feather: BOARD_FEATHER,
        };
      });
    case 'S2': {
      const out = interpolate(lf, [84, 114], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.3, 0, 0.2, 1)});
      return boardSpan((1 - 0.65 * reveal(lf, 0, 15)) * (1 - out));
    }
    case 'S4': {
      // leads the pill's own fade-in (opacity = glide*1.3) so the line never reads through the arriving glass
      const p = clamp01(glide(lf, 12, fps) * 2.4);
      return p > 0.001 ? [{x0: PROMPT_PILL.x0, x1: PROMPT_PILL.x1, strength: p, feather: 24}] : [];
    }
    case 'S5':
    case 'S6':
      return boardSpan(1);
    case 'S7':
      return boardSpan(1 - reveal(lf, 0, 10));
    default:
      return [];
  }
};

const sameOccluders = (a: AxisOccluder[], b: AxisOccluder[]): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * The light axis. During a wipe, each side of the band keeps its own axis state (height 600 -> 340 at the
 * S7->S8 wipe; occluders of the outgoing scene's last frame vs the incoming scene's first frame).
 */
const Axis: React.FC<{frameOffset?: number}> = ({frameOffset = 0}) => {
  const g = useCurrentFrame() + frameOffset;
  const w = wipeAt(g);
  if (w) {
    const gOut = Math.min(g, w.wipe.cut - 1);
    const gIn = Math.max(g, w.wipe.cut);
    const yOut = axisYAt(gOut);
    const yIn = axisYAt(gIn);
    const oOut = axisOccludersAt(gOut);
    const oIn = axisOccludersAt(gIn);
    if (yOut !== yIn || !sameOccluders(oOut, oIn)) {
      return (
        <>
          <AbsoluteFill style={maskStyle(wipeMask('ahead', w.centre))}>
            <LightAxis frameOffset={frameOffset} y={yOut} occlude={oOut} />
          </AbsoluteFill>
          <AbsoluteFill style={maskStyle(wipeMask('behind', w.centre))}>
            <LightAxis frameOffset={frameOffset} y={yIn} occlude={oIn} />
          </AbsoluteFill>
        </>
      );
    }
  }
  return <LightAxis frameOffset={frameOffset} occlude={axisOccludersAt(g)} />;
};

/** DEMO PROJECT chip: from DEMO_CHIP.from, and carried away by the S7->S8 wipe (drawn ahead of the band). */
const Chip: React.FC<{frameOffset?: number}> = ({frameOffset = 0}) => {
  const g = useCurrentFrame() + frameOffset;
  if (g < DEMO_CHIP.from) return null;
  const w = wipeAt(g);
  const endWipe = w && w.wipe.cut === DEMO_CHIP.until ? w : null;
  if (g >= DEMO_CHIP.until && !endWipe) return null;
  return (
    <AbsoluteFill style={maskStyle(endWipe ? wipeMask('ahead', endWipe.centre) : null)}>
      <DemoChip fadeInAt={DEMO_CHIP.from - frameOffset} opacity={DEMO_CHIP.opacity} />
    </AbsoluteFill>
  );
};

const Wipe: React.FC<{frameOffset?: number}> = ({frameOffset = 0}) => {
  const g = useCurrentFrame() + frameOffset;
  const w = wipeAt(g);
  return w ? <LightWipe progress={w.p} /> : null;
};

/** Everything, driven by the global frame (= useCurrentFrame() + frameOffset). */
const Stage: React.FC<{frameOffset?: number}> = ({frameOffset = 0}) => (
  <AbsoluteFill style={{backgroundColor: C.ink}}>
    <Background frameOffset={frameOffset} />
    <Axis frameOffset={frameOffset} />
    <Scenes frameOffset={frameOffset} />
    <Specks frameOffset={frameOffset} />
    <Chip frameOffset={frameOffset} />
    <Wipe frameOffset={frameOffset} />
    <Grain frameOffset={frameOffset} />
  </AbsoluteFill>
);

export const Main: React.FC = () => <Stage />;

/**
 * One scene over the global stage, with background/axis/specks/grain driven by the scene's GLOBAL frame
 * (frameOffset = scene.from) so the colour arc matches Main. Wipe frames show exactly what Main shows,
 * including the neighbouring scene on its side of the band.
 */
export const ScenePreview: React.FC<{id: SceneId}> = ({id}) => <Stage frameOffset={sceneById(id).from} />;
