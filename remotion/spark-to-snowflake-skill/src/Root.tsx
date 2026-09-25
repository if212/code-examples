import './fonts';
import React from 'react';
import {Composition, Freeze, Still} from 'remotion';
import {Main, ScenePreview} from './Main';
import {Kit} from './Kit';
import {KitMotion, KitBoard, KitTeam, KitShelf, KIT_MOTION_FRAMES} from './KitMotion';
import {SCENES, TOTAL, FPS} from './timeline';
import {W, H} from './layout';

/**
 * Thumbnail = Main frozen at global frame 606 (mid-wave). Registered with the full duration because
 * useCurrentFrame() is clamped to the composition length; every frame of it shows frame 606.
 */
export const THUMBNAIL_FRAME = 606;
const Thumbnail: React.FC = () => (
  <Freeze frame={THUMBNAIL_FRAME}>
    <Main />
  </Freeze>
);

export const Root: React.FC = () => {
  return (
    <>
      <Composition id="Main" component={Main} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
      {SCENES.map((s) => (
        <Composition
          key={s.id}
          id={s.id}
          component={ScenePreview}
          defaultProps={{id: s.id}}
          durationInFrames={s.duration}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
      <Still id="Kit" component={Kit} width={W} height={H} />
      <Composition id="Thumbnail" component={Thumbnail} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
      {/* dev benches for the shared components */}
      <Composition id="KitMotion" component={KitMotion} durationInFrames={KIT_MOTION_FRAMES} fps={FPS} width={W} height={H} />
      <Still id="KitBoardPain" component={KitBoard} defaultProps={{mode: 'pain' as const}} width={W} height={H} />
      <Still id="KitBoardWave" component={KitBoard} defaultProps={{mode: 'wave' as const}} width={W} height={H} />
      <Still id="KitTeam" component={KitTeam} width={W} height={H} />
      <Still id="KitShelf" component={KitShelf} width={W} height={H} />
    </>
  );
};
