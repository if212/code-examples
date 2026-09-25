import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Caption, Headline} from '../components';
import {C} from '../theme';
import {COPY} from '../demoData';

/**
 * S6 PLACEHOLDER (foundation). Replace with the real scene: render ONLY the scene foreground using
 * useCurrentFrame() as the LOCAL frame. Background, light axis, grain, specks, DEMO chip and light-wipes
 * are drawn by Main.
 */
export const S6: React.FC = () => {
  return (
    <AbsoluteFill>
      <Headline text={COPY.s6} keyWord="traps" enterAt={10} />
      <Caption text="S6 placeholder" font="mono" fontSize={24} color={C.dim} y={920} />
    </AbsoluteFill>
  );
};
