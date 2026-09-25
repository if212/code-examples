import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Caption, Headline} from '../components';
import {C} from '../theme';
import {COPY} from '../demoData';
import {END_STACK} from '../layout';
import {ramp} from '../motion';

/**
 * S8 PLACEHOLDER (foundation). Replace with the real scene: render ONLY the scene foreground using
 * useCurrentFrame() as the LOCAL frame. Background, light axis, grain, specks, DEMO chip and light-wipes
 * are drawn by Main.
 */
export const S8: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Headline text={COPY.s8} accentWord="skill" enterAt={16} y={END_STACK.headlineCapY} sweep={ramp(frame, 30, 60)} />
      <Caption text="S8 placeholder" font="mono" fontSize={24} color={C.dim} y={920} />
    </AbsoluteFill>
  );
};
