import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Caption, Headline} from '../components';
import {C} from '../theme';
import {COPY} from '../demoData';

/**
 * S5 PLACEHOLDER (foundation). Replace with the real scene: render ONLY the scene foreground using
 * useCurrentFrame() as the LOCAL frame. Background, light axis, grain, specks, DEMO chip and light-wipes
 * are drawn by Main.
 */
export const S5: React.FC = () => {
  return (
    <AbsoluteFill>
      <Headline text={COPY.s5a} keyWord="checked" keyGradient="ice" enterAt={26} exitAt={86} />
      <Headline text={COPY.s5b} keyWord="review" enterAt={96} />
      <Caption text="S5 placeholder" font="mono" fontSize={24} color={C.dim} y={920} />
    </AbsoluteFill>
  );
};
