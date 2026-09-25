import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Board, Camera, Cursor, DirectionalBlur, Spotlight, StatChip} from '../../components';
import type {TileState} from '../../components';
import {C} from '../../theme';
import {BOARD, tileRect, tileRowCol} from '../../layout';
import {JOBS, NEED_YOU_INDICES, STATS, TRAP_INDEX} from '../../demoData';
import {clamp01, lerp, ramp, wobble} from '../../motion';
import {sceneById} from '../../timeline';
import {cursorAt} from '../s5/cursorPath';
import {innerCam, outerCam, pushP, trapScreen} from './geometry';
import {T6} from './timing';

/**
 * S6 lf0-12: S5's last frame (the reviewed board: ten ice tiles dimmed to 70%, the two amber tiles lifted
 * under a spotlight, the 'you' cursor resting on churn_model.py) continues seamlessly, then the camera pushes
 * into latest_customers.sql (scale 1 -> 3.4, EXPO_OUT) with a velocity-driven directional blur while every
 * other tile falls away. The trap tile itself hands over to the code panel's morph box (CodePanel.tsx).
 */

const S5_DUR = sceneById('S5').duration;

/** Tile state at the end of S5 (same formulas as S5.tsx, evaluated once everything has settled). */
const s5End = (i: number): Partial<TileState> => {
  const job = JOBS[i];
  const amber = job.outcome === 'needYou';
  const {row} = tileRowCol(i);
  return {
    flip: 1,
    outcome: job.outcome,
    check: amber ? 0 : 1,
    needYou: amber ? 1 : 0,
    lift: amber ? 1 : 0,
    dy: amber ? (row === 0 ? -7 : 7) : 0,
    highlight: amber ? 1 : 0,
    opacity: amber ? 1 : 0.7,
    blur: amber ? 0 : 1.2,
  };
};

const A0 = tileRect(NEED_YOU_INDICES[0]);
const A1 = tileRect(NEED_YOU_INDICES[NEED_YOU_INDICES.length - 1]);
const SPOT = {cx: (A0.cx + A1.cx) / 2, cy: (A0.cy + A1.cy) / 2};

const speedAt = (f: number): {speed: number; angle: number} => {
  const a = trapScreen(f - 1);
  const b = trapScreen(f);
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  return {speed: Math.hypot(dx, dy) + 0.3 * Math.abs(b.w - a.w), angle: (Math.atan2(dy, dx) * 180) / Math.PI};
};

export const PushIn: React.FC<{f: number}> = ({f}) => {
  if (f >= T6.boardGone) return null;
  const p = pushP(f);
  const fo = ramp(f, T6.othersFade[0], T6.othersFade[1]);
  const tile = (i: number): Partial<TileState> => {
    const s = s5End(i);
    if (i === TRAP_INDEX) {
      // comes into focus as the camera arrives, then dissolves under the morph box
      return {...s, opacity: lerp(0.7, 1, p) * (1 - ramp(f, 5, 11)), blur: 1.2 * (1 - p) + 5 * ramp(f, 5, 11), highlight: p};
    }
    return {...s, opacity: (s.opacity ?? 1) * (1 - fo), blur: (s.blur ?? 0) + 4 * p};
  };
  const oc = outerCam(f);
  const ic = innerCam(f);
  const v = speedAt(f);
  const blur = f > 0 ? Math.min(18, v.speed * 0.2) : 0;

  // the S5 cursor keeps its idle float and rides the push, fading as it goes
  const F = S5_DUR + f;
  const cp = cursorAt(S5_DUR);
  const cx = cp.x + 3 * wobble('s5-cx', F, 0.03);
  const cy = cp.y + 2 * wobble('s5-cy', F, 0.03, 1);
  const cursorO = 1 - ramp(f, 0, 5);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <DirectionalBlur id="s6-push" amount={blur} angle={v.angle} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080}}>
        <div style={{position: 'relative', width: 1920, height: 1080}}>
          <Camera origin={oc.origin} scale={oc.scale} rotate={oc.rotate} x={oc.x} y={oc.y}>
            <Camera origin={ic.origin} scale={ic.scale} x={ic.x} y={ic.y}>
              <Board tile={tile} />
              {fo < 0.999 ? (
                <>
                  <Spotlight cx={SPOT.cx} cy={SPOT.cy} rx={420} ry={430} color={C.amber} intensity={0.16 * (1 - fo)} />
                  <Spotlight cx={SPOT.cx} cy={SPOT.cy - 20} rx={300} ry={330} color={C.whiteHot} intensity={0.12 * (1 - fo)} />
                </>
              ) : null}
              {cursorO > 0.001 ? (
                <AbsoluteFill>
                  <div style={{position: 'absolute', left: cx - 60, top: cy - 60}}>
                    <div style={{position: 'relative', width: 220, height: 150}}>
                      <Cursor x={60} y={60} label="you" opacity={cursorO} tilt={-2} />
                    </div>
                  </div>
                </AbsoluteFill>
              ) : null}
            </Camera>
          </Camera>
        </div>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};

/** S5's stat chips (exactly as S5 leaves them), sliding down and out as the camera pushes in. */
const STAT_Y = 928;
const STAT_SIZE = 28;

export const StatsExit: React.FC<{f: number}> = ({f}) => {
  if (f >= T6.statsOut) return null;
  const q = ramp(f, 0, T6.statsOut - 1);
  const o = 1 - q;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: BOARD.cx,
          top: STAT_Y + 60 * clamp01(pushP(f)),
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          gap: 18,
          alignItems: 'center',
          opacity: o,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label} style={{position: 'relative'}}>
            <StatChip
              tone={s.tone}
              value={s.value}
              of={'of' in s ? s.of : undefined}
              label={s.label}
              note={'note' in s ? s.note : undefined}
              size={STAT_SIZE}
              glow={0.5}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
