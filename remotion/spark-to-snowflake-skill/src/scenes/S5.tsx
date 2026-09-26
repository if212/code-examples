import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Board, Camera, Headline, Spotlight, StatChip, drift} from '../components';
import type {TileState} from '../components';
import {C, SPRING, alpha} from '../theme';
import {BOARD, SKILL_DOCK, tileRect, tileRowCol} from '../layout';
import {COPY, JOBS, NEED_YOU_INDICES, STATS, TRAP_INDEX} from '../demoData';
import {bell, clamp01, glide, ramp, reveal, snap, velocity2D, wobble} from '../motion';
import {DockMorph} from './s5/DockMorph';
import {WaveBand} from './s5/WaveBand';
import {ReviewCursor} from './s5/ReviewCursor';
import {REVIEW_TICKS, SKIM, cursorAt} from './s5/cursorPath';

/**
 * S5 — THE RESULT (signature shot), global f570-750 (180f).
 * The light-wipe (drawn by Main) is fully white at lf0 and clears by lf6, revealing the exact S1 board, all
 * ember. The matched shelf card collapses into the skill dock; a violet-white band leaves the dock and sweeps
 * the board while the tiles flip ember -> ice in a (row+col) wave; checks draw, two tiles land amber
 * 'Needs you', the S1 'missed one' tile lands ice with a violet sparkle; stat chips pop; then the 'you' cursor
 * skims every row smoothly and settles on the amber tiles, which float forward into a soft spotlight.
 */

const T = {
  /** the card collapses from lf0, under the wipe (the storyboard's cut at its lf6 is our lf0; see DockMorph) */
  morphFrom: 0,
  morphTo: 12,
  mappingsOn: 14,
  bandFrom: 16,
  bandOut: 52,
  bandTo: 60,
  waveStart: 20,
  waveStep: 5,
  /** storyboard 'about 18f per flip': a tile counts as landed 18f after it starts */
  landed: 18,
  checkDelay: 6,
  checkDur: 10,
  /** amber pops as the flip settles */
  amberDelay: 12,
  sparkleDelay: 8,
  checksOn: 40,
  /** storyboard lf26, advanced 6f so the thumbnail (global 606 = lf36) shows the whole line */
  headlineA: 20,
  headlineAExit: 86,
  headlineB: 96,
  stats: [64, 70, 76],
  statRoll: 12,
  liftAt: 128,
  press: 144,
  /** the returning cursor fades and scales in over this many frames from SKIM.from */
  cursorIn: 6,
} as const;

const CAM_ORIGIN: [number, number] = [BOARD.cx, BOARD.top + BOARD.height]; // grow upward, keep the stat band clear
const STAT_Y = 928;
const STAT_SIZE = 28;

/** Mint 'reviewed' ring over a converted tile's check disc as the cursor skims past (board-local coords). */
const ReviewRing: React.FC<{i: number; p: number}> = ({i, p}) => {
  if (p <= 0 || p >= 1) return null;
  const {row, col} = tileRowCol(i);
  const cx = col * (BOARD.tileW + BOARD.gap) + BOARD.tileW - 16 - 17;
  const cy = row * (BOARD.tileH + BOARD.gap) + 16 + 17;
  const r = 17 + 26 * p;
  const o = 1 - p;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        zIndex: 30,
        boxShadow: `0 0 0 ${(2 * o + 0.5).toFixed(2)}px ${alpha(C.mint, 0.85 * o)}, 0 0 ${Math.round(22 * o)}px ${alpha(C.mint, 0.5 * o)}`,
      }}
    />
  );
};

export const S5: React.FC = () => {
  const f = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // ---- dock -------------------------------------------------------------------------------------------
  const lit = {playbook: 1, mappings: reveal(f, T.mappingsOn, 8), checks: reveal(f, T.checksOn, 8)};
  const pulse = {mappings: ramp(f, T.mappingsOn, T.mappingsOn + 16), checks: ramp(f, T.checksOn, T.checksOn + 16)};
  const ignite = bell(ramp(f, T.bandFrom - 4, T.bandFrom + 18));

  // ---- review + float-forward -------------------------------------------------------------------------
  const liftP = glide(f, T.liftAt, fps, 26);

  const tile = (i: number): Partial<TileState> => {
    const {row, col} = tileRowCol(i);
    const s = T.waveStart + (row + col) * T.waveStep;
    const flip = spring({frame: f - s, fps, config: SPRING.SNAP});
    const job = JOBS[i];
    const amber = job.outcome === 'needYou';
    const landed = s + T.landed;
    const tick = REVIEW_TICKS[i];
    const hover = tick !== undefined ? clamp01(1 - Math.abs(f - tick) / 7) : 0;
    return {
      flip,
      outcome: job.outcome,
      check: amber ? 0 : reveal(f, landed + T.checkDelay, T.checkDur),
      needYou: amber ? snap(f, s + T.amberDelay) : 0,
      sparkle: i === TRAP_INDEX ? ramp(f, s + T.sparkleDelay, s + T.sparkleDelay + 22) : 0,
      lift: amber ? liftP : 0,
      // the two lifted tiles part slightly so their scaled edges never touch
      dy: amber ? (row === 0 ? -7 : 7) * liftP : 0,
      highlight: amber ? liftP : hover,
      opacity: amber ? 1 : 1 - 0.3 * liftP,
      blur: amber ? 0 : 1.2 * liftP,
    };
  };

  // ---- camera -----------------------------------------------------------------------------------------
  const d = drift(f, durationInFrames, 'S5', 0.025);
  const cam = {origin: CAM_ORIGIN, drift: {...d, y: Math.min(0, d.y), rotate: d.rotate * 0.6}};

  // ---- cursor -----------------------------------------------------------------------------------------
  const cursorVisible = f >= SKIM.from;
  const cIn = reveal(f, SKIM.from, T.cursorIn);
  const settle = ramp(f, SKIM.to, SKIM.to + 10);
  const pos = cursorAt(f);
  const idle = {x: 3 * settle * wobble('s5-cx', f, 0.03), y: 2 * settle * wobble('s5-cy', f, 0.03, 1)};
  const v = velocity2D(cursorAt, f);
  const press = bell(ramp(f, T.press, T.press + 12));

  // ---- amber spotlight ----------------------------------------------------------------------------------
  const a0 = tileRect(NEED_YOU_INDICES[0]);
  const a1 = tileRect(NEED_YOU_INDICES[NEED_YOU_INDICES.length - 1]);
  const spotCx = (a0.cx + a1.cx) / 2;
  const spotCy = (a0.cy + a1.cy) / 2;

  return (
    <AbsoluteFill>
      {/* hero: the board, the light band, the spotlight */}
      <Camera {...cam}>
        <Board tile={tile}>
          {Object.entries(REVIEW_TICKS).map(([k, at]) => (
            <ReviewRing key={k} i={Number(k)} p={ramp(f, at, at + 14)} />
          ))}
        </Board>
        <WaveBand
          frame={f}
          waveStart={T.waveStart}
          step={T.waveStep}
          intensity={ramp(f, T.bandFrom, T.bandFrom + 7) * (1 - ramp(f, T.bandOut, T.bandTo))}
          release={ramp(f, T.bandFrom + 4, T.bandFrom + 16)}
        />
        {liftP > 0.001 ? (
          <>
            <Spotlight cx={spotCx} cy={spotCy} rx={420} ry={430} color={C.amber} intensity={0.16 * liftP} />
            <Spotlight cx={spotCx} cy={spotCy - 20} rx={300} ry={330} color={C.whiteHot} intensity={0.12 * liftP} />
          </>
        ) : null}
      </Camera>

      {/* the skill: matched card -> dock, dock ignition glow */}
      {ignite > 0.001 ? (
        <Spotlight cx={SKILL_DOCK.x1 - 20} cy={SKILL_DOCK.cy} rx={300} ry={320} color={C.violet} intensity={0.5 * ignite} />
      ) : null}
      <DockMorph frame={f} from={T.morphFrom} to={T.morphTo} lit={lit} pulse={pulse} />

      {/* the 'you' cursor (same camera as the board so it stays on its tiles) */}
      {cursorVisible ? (
        <Camera {...cam}>
          <ReviewCursor
            id="s5-cursor"
            x={pos.x + idle.x}
            y={pos.y + idle.y}
            label="you"
            opacity={cIn}
            scale={0.85 + 0.15 * cIn}
            press={press}
            tilt={-2}
            speed={v.speed}
            angle={v.angle}
          />
        </Camera>
      ) : null}

      {/* stat chips under the board */}
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        <div
          style={{
            position: 'absolute',
            left: BOARD.cx,
            top: STAT_Y,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            gap: 18,
            alignItems: 'center',
          }}
        >
          {STATS.map((s, k) => {
            const at = T.stats[k];
            const p = snap(f, at);
            const of = 'of' in s ? s.of : undefined;
            const note = 'note' in s ? s.note : undefined;
            return (
              <div key={s.label} style={{position: 'relative'}}>
                {/* invisible final-state copy reserves the width so the roll-up never reflows the row */}
                <div style={{visibility: 'hidden'}}>
                  <StatChip tone={s.tone} value={s.value} of={of} label={s.label} note={note} size={STAT_SIZE} />
                </div>
                {p > 0.001 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      transform: `translateY(${(14 * (1 - Math.min(1, p))).toFixed(2)}px) scale(${(0.86 + 0.14 * p).toFixed(4)})`,
                      transformOrigin: '50% 50%',
                      opacity: clamp01(p * 1.6),
                    }}
                  >
                    <StatChip
                      tone={s.tone}
                      value={s.value}
                      of={of}
                      label={s.label}
                      note={note}
                      size={STAT_SIZE}
                      roll={reveal(f, at, T.statRoll)}
                      glow={0.5 + 0.5 * bell(ramp(f, at, at + 16))}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* headlines */}
      <Headline text={COPY.s5a} keyWord="checked" keyGradient="ice" enterAt={T.headlineA} exitAt={T.headlineAExit} />
      <Headline text={COPY.s5b} keyWord="review" enterAt={T.headlineB} />
    </AbsoluteFill>
  );
};
