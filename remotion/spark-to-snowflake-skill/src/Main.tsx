import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {C} from './theme';
import {SCENES, WIPES, DEMO_CHIP, SceneId, sceneById} from './timeline';
import {SCENE_COMPONENTS} from './scenes';
import {Background, Grain} from './components/Background';
import {LightAxis} from './components/LightAxis';
import {Specks} from './components/Specks';
import {LightWipe} from './components/LightWipe';
import {DemoChip} from './components/DemoChip';

/**
 * The film. Layer order (each its own AbsoluteFill):
 *   Background (orbs + grid, global colour arc) -> LightAxis -> scenes (hero, cursors, headlines)
 *   -> Specks (1.3x bokeh) -> DEMO PROJECT chip (S1-S7) -> light-wipes (S4->S5, S7->S8) -> Grain (topmost).
 */
export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background />
      <LightAxis />
      {SCENES.map((s) => {
        const Comp = SCENE_COMPONENTS[s.id];
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.duration} name={s.id}>
            <Comp />
          </Sequence>
        );
      })}
      <Specks />
      <Sequence from={DEMO_CHIP.from} durationInFrames={DEMO_CHIP.until - DEMO_CHIP.from} name="DEMO chip">
        <DemoChip fadeInAt={0} opacity={DEMO_CHIP.opacity} />
      </Sequence>
      {WIPES.map((w) => (
        <Sequence key={w.cut} from={w.from} durationInFrames={w.duration} name={`wipe@${w.cut}`}>
          <LightWipe />
        </Sequence>
      ))}
      <Grain />
    </AbsoluteFill>
  );
};

/**
 * One scene alone over the global stage, with the background/axis/specks/grain driven by the scene's GLOBAL
 * frame (frameOffset = scene.from) so the colour arc matches Main. Also draws the parts of any light-wipe
 * and the DEMO chip that overlap the scene, exactly as Main would.
 */
export const ScenePreview: React.FC<{id: SceneId}> = ({id}) => {
  const s = sceneById(id);
  const Comp = SCENE_COMPONENTS[id];
  const chipFrom = DEMO_CHIP.from - s.from;
  const chipUntil = DEMO_CHIP.until - s.from;
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background frameOffset={s.from} />
      <LightAxis frameOffset={s.from} />
      <Comp />
      <Specks frameOffset={s.from} />
      {chipUntil > 0 ? (
        <Sequence from={Math.max(chipFrom, -100000)} durationInFrames={chipUntil - chipFrom} name="DEMO chip">
          <DemoChip fadeInAt={chipFrom < 0 ? -1000 : 0} opacity={DEMO_CHIP.opacity} />
        </Sequence>
      ) : null}
      {WIPES.filter((w) => w.from < s.from + s.duration && w.from + w.duration > s.from).map((w) => (
        <Sequence key={w.cut} from={w.from - s.from} durationInFrames={w.duration} name={`wipe@${w.cut}`}>
          <LightWipe />
        </Sequence>
      ))}
      <Grain frameOffset={s.from} />
    </AbsoluteFill>
  );
};
