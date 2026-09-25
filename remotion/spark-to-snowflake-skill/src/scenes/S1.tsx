import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Caption, Headline} from '../components';
import {C} from '../theme';
import {COPY} from '../demoData';

/**
 * S1 PLACEHOLDER (foundation). Replace with the real scene: render ONLY the scene foreground using
 * useCurrentFrame() as the LOCAL frame. Background, light axis, grain, specks, DEMO chip and light-wipes
 * are drawn by Main.
 */
export const S1: React.FC = () => {
  return (
    <AbsoluteFill>
      <Headline text={COPY.s1a} keyWord="Spark" keyGradient="ember" enterAt={8} exitAt={84} />
      <Headline text={COPY.s1b} enterAt={94} />
      <Caption text="S1 placeholder" font="mono" fontSize={24} color={C.dim} y={920} />
    </AbsoluteFill>
  );
};
