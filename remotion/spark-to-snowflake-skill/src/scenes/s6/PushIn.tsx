import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Board, Camera, Cursor, DirectionalBlur, Spotlight, StatChip} from '../../components';
import type {TileState} from '../../components';
import {C, alpha} from '../../theme';
import {BOARD, tileRect, tileRowCol} from '../../layout';
import {JOBS, NEED_YOU_INDICES, STATS, TRAP_INDEX} from '../../demoData';
import {bell, clamp01, exitP, lerp, ramp, reveal, wobble} from '../../motion';
import {sceneById} from '../../timeline';
import {cursorAt} from '../s5/cursorPath';
import {innerCam, outerCam, pushP, trapScreen} from './geometry';
import {T6} from './timing';

/**
 * S6 lf0-15: S5's last frame (the reviewed board: ten ice tiles dimmed to 70%, the two amber tiles lifted
 * under a spotlight, the 'you' cursor resting on churn_model.py) continues seamlessly. Then the camera picks
 * its target: latest_customers.sql comes into focus and a violet focus ring pings around it, while the push
 * accelerates into it (log-space zoom 1 -> 3.4 with an
 * ease-in head) with a velocity-driven directional blur. Every other tile falls away and S5's stat chips
 * ride the same camera out of frame. The trap tile hands over to the code panel's morph box (CodePanel.tsx).
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

/** tile 2 in board-local coordinates (for the focus ring, drawn as a Board child) */
const TRAP_LOCAL = (() => {
  const {row, col} = tileRowCol(TRAP_INDEX);
  return {x: col * (BOARD.tileW + BOARD.gap), y: row * (BOARD.tileH + BOARD.gap), w: BOARD.tileW, h: BOARD.tileH};
})();

const speedAt = (f: number): {speed: number; angle: number} => {
  const a = trapScreen(f - 1);
  const b = trapScreen(f);
  const dx = b.x + b.w / 2 - (a.x + a.w / 2);
  const dy = b.y + b.h / 2 - (a.y + a.h / 2);
  return {speed: Math.hypot(dx, dy) + 0.3 * Math.abs(b.w - a.w), angle: (Math.atan2(dy, dx) * 180) / Math.PI};
};

/**
 * The target cue, drawn as Board children (board-local, above every tile): a violet focus ring around tile 2
 * with one expanding ping. No tag here (round-2 review): the tile already shows a mint check, so a 'missed'
 * tag on it would read as the skill's miss. The by-hand callback lives on the code panel header instead.
 */
const TargetCue: React.FC<{f: number}> = ({f}) => {
  const fade = ramp(f, T6.cueRingOut[0], T6.cueRingOut[1]);
  const on = reveal(f, T6.cueRing, 8) * (1 - fade);
  const ping = ramp(f, T6.cueRing + 1, T6.cueRing + 13);
  const pingO = bell(ping) * (1 - fade);
  const {x, y, w, h} = TRAP_LOCAL;
  const ring = (pad: number, r: number, stroke: string, glow: string, o: number) => (
    <div
      style={{
        position: 'absolute',
        left: x - pad,
        top: y - pad,
        width: w + pad * 2,
        height: h + pad * 2,
        borderRadius: r + pad,
        boxShadow: `0 0 0 2px ${stroke}, 0 0 26px ${glow}, inset 0 0 18px ${glow}`,
        opacity: o,
        zIndex: 30,
      }}
    />
  );
  return (
    <>
      {on > 0.001 ? ring(9, BOARD.radius, alpha(C.violet, 0.95), alpha(C.violetGlow, 0.55), on) : null}
      {pingO > 0.001 ? ring(9 + 34 * ping, BOARD.radius, alpha(C.violet, 0.7), alpha(C.violetGlow, 0.35), pingO) : null}
    </>
  );
};

/** S5's stat chips, exactly as S5 leaves them (they sit outside S5's shot camera). */
const STAT_Y = 928;
const STAT_SIZE = 28;
const Stats: React.FC<{opacity: number}> = ({opacity}) => (
  <div
    style={{
      position: 'absolute',
      left: BOARD.cx,
      top: STAT_Y,
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      gap: 18,
      alignItems: 'center',
      opacity,
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
);

export const PushIn: React.FC<{f: number}> = ({f}) => {
  if (f >= T6.boardGone) return null;
  const p = pushP(f);
  const fo = ramp(f, T6.othersFade[0], T6.othersFade[1]);
  const focus = reveal(f, T6.cueFocus[0], T6.cueFocus[1] - T6.cueFocus[0]);
  const dissolve = ramp(f, T6.tileDissolve[0], T6.tileDissolve[1]);
  const tile = (i: number): Partial<TileState> => {
    const s = s5End(i);
    if (i === TRAP_INDEX) {
      // the target: comes into focus, then dissolves under the morph box
      return {
        ...s,
        opacity: lerp(0.7, 1, focus) * (1 - dissolve),
        blur: 1.2 * (1 - focus) + 5 * dissolve,
        highlight: focus,
      };
    }
    return {...s, opacity: (s.opacity ?? 1) * (1 - fo), blur: (s.blur ?? 0) + 4 * p};
  };
  const oc = outerCam(f);
  const ic = innerCam(f);
  const v = speedAt(f);
  // velocity-driven, and eased in over the first frames so the move starts clean
  const blur = Math.min(14, v.speed * 0.14) * ramp(f, 1, 5);

  // the S5 cursor keeps its idle float and rides the push, fading as it goes
  const F = S5_DUR + f;
  const cp = cursorAt(S5_DUR);
  const cx = cp.x + 3 * wobble('s5-cx', F, 0.03);
  const cy = cp.y + 2 * wobble('s5-cy', F, 0.03, 1);
  const cursorO = 1 - ramp(f, 0, 6);

  // S5's stat chips: on the push camera (not S5's drift camera, which they never had), EXIT fade
  const statsO = 1 - exitP(f, 0, T6.statsOut);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <DirectionalBlur id="s6-push" amount={blur} angle={v.angle} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080}}>
        <div style={{position: 'relative', width: 1920, height: 1080}}>
          <Camera origin={oc.origin} scale={oc.scale} rotate={oc.rotate} x={oc.x} y={oc.y}>
            <Camera origin={ic.origin} scale={ic.scale} x={ic.x} y={ic.y}>
              <Board tile={tile}>
                <TargetCue f={f} />
              </Board>
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
          {statsO > 0.001 ? (
            <Camera origin={ic.origin} scale={ic.scale} x={ic.x} y={ic.y}>
              <Stats opacity={clamp01(statsO)} />
            </Camera>
          ) : null}
        </div>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};
