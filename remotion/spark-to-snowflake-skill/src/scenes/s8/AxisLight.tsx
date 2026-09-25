import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {C, SIGNATURE_STOPS, softRadial} from '../../theme';
import {END_STACK, W} from '../../layout';
import {clamp01, ramp, reveal} from '../../motion';
import {T8} from './timing';

const AY = END_STACK.folder.cy; // the light axis runs at y=340 in S8, under the folder
const FX = END_STACK.folder.cx;

/**
 * The light runner: a warm-to-cool glint that travels along the axis exactly above the headline's
 * gradient-sweep band, so one light visibly passes over the title and THROUGH the skill at the same time.
 * Headline.tsx puts the band centre at (-0.3 + 1.6 * sweep) of the line width, and the line is centred on x960,
 * so with span = the measured headline width the runner x = 960 + (pos - 0.5) * span.
 */
export const runnerX = (f: number, span: number): number => {
  const s = ramp(f, T8.sweepFrom, T8.sweepTo);
  const pos = -0.3 + 1.6 * s;
  return FX + (pos - 0.5) * span;
};

/** 0..1: how strongly the runner is currently passing through the folder (peaks when x = 960). */
export const runnerPass = (f: number, span: number): number => {
  if (f < T8.sweepFrom || f > T8.sweepTo) return 0;
  const d = Math.abs(runnerX(f, span) - FX);
  const p = clamp01(1 - d / 240);
  return p * p * (3 - 2 * p);
};

/** Signature colour at canvas x (ember left -> white-hot centre -> ice right), as #RRGGBB for softRadial. */
const hexRgb = (h: string): number[] => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
const STOP_X = [0, W * 0.3, W * 0.5, W * 0.7, W];
const signatureAt = (x: number): string => {
  const cx = Math.max(0, Math.min(W, x));
  let i = 0;
  while (i < STOP_X.length - 2 && cx > STOP_X[i + 1]) i++;
  const t = (cx - STOP_X[i]) / (STOP_X[i + 1] - STOP_X[i]);
  const a = hexRgb(SIGNATURE_STOPS[i]);
  const b = hexRgb(SIGNATURE_STOPS[i + 1]);
  return `#${a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};

/** Axis glint under the folder + the travelling runner. Drawn BEHIND the folder (seen through its glass). */
export const AxisLight: React.FC<{f: number; span: number}> = ({f, span}) => {
  // steady glint where the folder sits on the axis, with a soft bloom as it settles
  const base = reveal(f, T8.folderIn + 2, 24);
  const pulse = interpolate(f, [T8.folderIn + 4, T8.glintPeak, T8.glintPeak + 26], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const breathe = 0.92 + 0.08 * Math.sin((f - T8.holdFrom) / 14);
  const glint = (0.34 * base * breathe + 0.5 * pulse) * (1 + 0.6 * runnerPass(f, span));

  // runner
  const s = ramp(f, T8.sweepFrom, T8.sweepTo);
  const runOn = s > 0 && s < 1;
  const rx = runnerX(f, span);
  const runA = Math.min(1, s * 5, (1 - s) * 5);
  const rc = signatureAt(rx);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* wide, low bloom on the axis around the folder (ice-leaning: the stage is cooling) */}
      <div
        style={{
          position: 'absolute',
          left: FX - 620,
          top: AY - 70,
          width: 1240,
          height: 140,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.iceGlow, 0.14 * glint, 14, 2.6),
          mixBlendMode: 'screen',
        }}
      />
      {/* tight anamorphic streak */}
      <div
        style={{
          position: 'absolute',
          left: FX - 460,
          top: AY - 7,
          width: 920,
          height: 14,
          background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.55 * glint, 14, 3.2),
          mixBlendMode: 'screen',
        }}
      />
      {runOn ? (
        <>
          {/* runner: elongated streak (reads as motion-blurred at ~75px/f) */}
          <div
            style={{
              position: 'absolute',
              left: rx - 300,
              top: AY - 30,
              width: 600,
              height: 60,
              background: softRadial('ellipse 50% 50% at 50% 50%', rc, 0.5 * runA, 14, 2.8),
              mixBlendMode: 'screen',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: rx - 130,
              top: AY - 5,
              width: 260,
              height: 10,
              background: softRadial('ellipse 50% 50% at 50% 50%', C.whiteHot, 0.95 * runA, 12, 3),
              mixBlendMode: 'screen',
            }}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
