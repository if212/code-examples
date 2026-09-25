import React from 'react';
import {AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, EASE, SPRING} from './theme';
import {BOARD, tileRowCol, tileRect, PROMPT_PILL, MINI_BOARDS, SKILL_SHELF} from './layout';
import {JOB_FILES, JOBS, NEED_YOU_INDICES, TRAP_INDEX, STATS, PROMPT_TEXT, SKILL_FOLDER_LABEL, SHELF, MATCHED_SHELF_INDEX, STATUS_LINE} from './demoData';
import {SkillCard} from './components/SkillCard';
import {SkillDock} from './components/SkillDock';
import {DemoChip} from './components/DemoChip';
import {Background, Grain} from './components/Background';
import {LightAxis} from './components/LightAxis';
import {Headline, Caption} from './components/Headline';
import {Board} from './components/Board';
import {Cursor} from './components/Cursor';
import {SkillFolder} from './components/SkillFolder';
import {StatChip, GlassPanel} from './components/Glass';
import {LightWipe} from './components/LightWipe';
import {Beam, Shockwave, arcPath} from './components/Fx';
import {DirectionalBlur} from './components/DirectionalBlur';
import {typed, caretOn, Caret} from './components/Typing';
import {bezierPoint, clamp01, reveal, velocity2D} from './motion';
import {FONT} from './theme';

/**
 * Motion test bench (120f) exercising the shared components with real timing. Reference for scene builders.
 * f0-60: headline reveal/exit, board flip wave (smooth), checks, needs-you; folder lid hinge + flash + ring;
 * cursor flight with directional blur; prompt typing; stat chips roll-up; f100-112 light-wipe.
 */
const BOARD_POS = {cx: 620, cy: 560, scale: 0.6};

export const KitMotion: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();

  // flip wave: delay (row+col)*5 from f10, SNAP spring
  const tile = (i: number) => {
    const {row, col} = tileRowCol(i);
    const start = 10 + (row + col) * 5;
    const flip = spring({frame: f - start, fps, config: SPRING.SNAP});
    const landed = start + 14;
    const job = JOBS[i];
    return {
      file: JOB_FILES[i],
      flip,
      outcome: job.outcome,
      check: job.outcome === 'converted' ? reveal(f, landed + 6, 10) : 0,
      needYou: job.outcome === 'needYou' ? spring({frame: f - landed, fps, config: SPRING.SNAP}) : 0,
      sparkle: i === TRAP_INDEX ? clamp01((f - landed) / 20) : 0,
      lift: (NEED_YOU_INDICES as readonly number[]).includes(i) ? spring({frame: f - 70, fps, config: SPRING.GLIDE}) : 0,
    };
  };

  // folder lid: open until f40 then HINGE shut; flash + ring at f52
  const lid = 1 - spring({frame: f - 40, fps, config: SPRING.HINGE});
  const flash = interpolate(f, [52, 53, 56], [0, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ringP = interpolate(f, [52, 72], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.EXPO_OUT});

  // cursor flight along a bezier with directional blur
  const path = (fr: number) => {
    const t = interpolate(fr, [30, 54], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.EXPO_OUT});
    return bezierPoint(t, [1500, 900], [1300, 700], [1100, 400], [tileRect(3, BOARD_POS.cx, BOARD_POS.cy, BOARD_POS.scale).cx + 20, tileRect(3, BOARD_POS.cx, BOARD_POS.cy, BOARD_POS.scale).cy + 10]);
  };
  const pos = path(f);
  const v = velocity2D(path, f);

  const prompt = typed(PROMPT_TEXT, f, 20, 2);

  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background globalFrame={560 + f} />
      <LightAxis frameOffset={100} />
      <Headline text="Converted. And checked." keyWord="checked" keyGradient="ice" enterAt={4} exitAt={84} />
      <Headline text="It converts. You review." keyWord="review" enterAt={94} />
      <Board cx={BOARD_POS.cx} cy={BOARD_POS.cy} scale={BOARD_POS.scale} tile={tile} />
      <SkillFolder cx={1460} cy={470} width={420} open={lid} label={SKILL_FOLDER_LABEL} labelChars={Math.max(0, f - 52)} caret={f > 52 && caretOn(f, 72, f < 72)} glow={0.7 + 0.3 * flash} flash={flash} />
      <Shockwave cx={1460} cy={470} r={80 + 480 * ringP} opacity={f >= 52 ? 1 - ringP : 0} />
      <Beam id="kitbeam" d={arcPath([1250, 520], [900, 420], -80)} progress={reveal(f, 60, 20, EASE.EXPO_OUT)} />
      {/* prompt pill */}
      <AbsoluteFill>
        <GlassPanel x={1100} y={740} width={PROMPT_PILL.w * 0.9} height={80} radius={40} glow={0.2}>
          <div style={{position: 'absolute', left: 32, top: 0, height: 80, display: 'flex', alignItems: 'center', fontFamily: FONT.mono, fontSize: 32, color: C.frost, whiteSpace: 'pre'}}>
            <span style={{color: C.violet, marginRight: 18}}>{'›'}</span>
            {prompt.text}
            <Caret on={caretOn(f, prompt.doneAt, prompt.typing)} height={34} />
          </div>
        </GlassPanel>
      </AbsoluteFill>
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 960, top: 900, transform: 'translateX(-50%)', display: 'flex', gap: 16}}>
          {STATS.map((s, k) => {
            const p = spring({frame: f - (64 + k * 6), fps, config: SPRING.SNAP});
            return (
              <div key={s.label} style={{transform: `scale(${p.toFixed(3)})`, opacity: clamp01(p * 1.5)}}>
                <StatChip tone={s.tone} value={s.value} of={'of' in s ? s.of : undefined} label={s.label} note={'note' in s ? s.note : undefined} roll={clamp01((f - 64 - k * 6) / 12)} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <Caption text="Only the matching skill opens." enterAt={30} exitAt={90} y={990} />
      <AbsoluteFill>
        <DirectionalBlur id="kitcursor" amount={v.speed * 0.35} angle={v.angle} style={{position: 'absolute', left: 0, top: 0, width: 1920, height: 1080}}>
          <Cursor x={pos.x} y={pos.y} label="you" />
        </DirectionalBlur>
      </AbsoluteFill>
      <Sequence from={100} durationInFrames={12}>
        <LightWipe />
      </Sequence>
      <Grain />
    </AbsoluteFill>
  );
};

/** Full-scale board states (S1-style pain vs S5-style result) for inspecting tile craft. */
export const KitBoard: React.FC<{mode: 'pain' | 'wave'}> = ({mode}) => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background globalFrame={mode === 'pain' ? 110 : 606} />
      <LightAxis frameOffset={200} />
      {mode === 'pain' ? (
        <>
          <Headline text="Same fixes. Every job." enterAt={-100} />
          <Board
            jitterFrame={33}
            tile={(i) =>
              i === 0
                ? {chips: ['Rewrite', 'Fix', 'Test'].map((label) => ({label, p: 1, state: 'ghost' as const})), progress: 1}
                : i === 1
                  ? {chips: ['Rewrite', 'Fix', 'Test'].map((label) => ({label, p: 1})), stamp: {label: 'again', p: 1}, progress: 1}
                  : i === 2
                    ? {
                        chips: ['Rewrite', 'Fix', 'Test'].map((label, k) => ({label, p: 1, state: k === 1 ? ('missing' as const) : ('solid' as const)})),
                        tag: {label: 'missed one', p: 1, tone: 'coral'},
                        progress: 0.62,
                        highlight: 1,
                      }
                    : {}
            }
          />
          <AbsoluteFill>
            <Cursor x={tileRect(2).cx + 40} y={tileRect(2).cy + 30} label="you" />
          </AbsoluteFill>
        </>
      ) : (
        <>
          <Headline text="Converted. And checked." keyWord="checked" keyGradient="ice" enterAt={-100} />
          <AbsoluteFill>
            <SkillDock lit={{playbook: 1, mappings: 1, checks: 0.6}} pulse={{mappings: 0.35}} />
          </AbsoluteFill>
          <Board
            tile={(i) => {
              const {row, col} = tileRowCol(i);
              const d = row + col;
              const flip = d <= 1 ? 1 : d === 2 ? 0.78 : d === 3 ? 0.5 : d === 4 ? 0.2 : 0;
              const job = JOBS[i];
              return {
                flip,
                outcome: job.outcome,
                check: flip >= 1 && job.outcome === 'converted' ? 1 : 0,
                needYou: flip >= 1 && job.outcome === 'needYou' ? 1 : 0,
                sparkle: i === TRAP_INDEX ? 0.3 : 0,
              };
            }}
          />
        </>
      )}
      <Grain />
    </AbsoluteFill>
  );
};

/** S7-style team layout: four 0.34 mini boards around the folder hub (checks `mini` tiles + beams). */
export const KitTeam: React.FC = () => {
  const boards = [
    {key: 'you', name: 'You', color: C.frost, amber: [...NEED_YOU_INDICES] as number[], wave: 1},
    {key: 'leo', name: 'Leo', color: C.pink, amber: [5], wave: 0.7},
    {key: 'priya', name: 'Priya', color: C.lime, amber: [9], wave: 0.45},
    {key: 'sam', name: 'Sam', color: C.silver, amber: [1], wave: 0.2},
  ] as const;
  const pos = {you: MINI_BOARDS.you, leo: MINI_BOARDS.leo, priya: MINI_BOARDS.priya, sam: MINI_BOARDS.sam};
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background globalFrame={960} />
      <LightAxis frameOffset={960} />
      <Headline text="Same playbook. Whole team." keyWord="team" keyGradient="ice" enterAt={-100} />
      {boards.slice(1).map((b) => (
        <Beam key={b.key} id={`team-${b.key}`} d={arcPath([MINI_BOARDS.hub.cx, MINI_BOARDS.hub.cy], [pos[b.key].cx, pos[b.key].cy], b.key === 'priya' ? 80 : -80)} progress={1} head={false} opacity={0.8} />
      ))}
      {boards.map((b) => (
        <Board
          key={b.key}
          cx={pos[b.key].cx}
          cy={pos[b.key].cy}
          scale={MINI_BOARDS.scale}
          mini
          tile={(i) => {
            const {row, col} = tileRowCol(i);
            const flip = clamp01(b.wave * 7 - (row + col));
            const isAmber = (b.amber as readonly number[]).includes(i);
            return {flip, outcome: isAmber ? 'needYou' : 'converted', check: flip >= 1 && !isAmber ? 1 : 0, needYou: flip >= 1 && isAmber ? 1 : 0};
          }}
        />
      ))}
      <SkillFolder cx={MINI_BOARDS.hub.cx} cy={MINI_BOARDS.hub.cy} width={260} glow={1} />
      <AbsoluteFill>
        {boards.map((b) => (
          <Cursor key={b.key} x={pos[b.key].cx + 150} y={pos[b.key].cy + 60} label={b.name} color={b.color} />
        ))}
      </AbsoluteFill>
      <Grain />
    </AbsoluteFill>
  );
};

/** S4-style end state: prompt pill, matched shelf card with icon row, beam, status line. */
export const KitShelf: React.FC = () => {
  const words = PROMPT_TEXT.split(' ');
  const card = SKILL_SHELF.slotY(MATCHED_SHELF_INDEX);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background globalFrame={560} />
      <LightAxis frameOffset={560} />
      <Headline text="Just ask." fontSize={160} enterAt={-100} />
      <AbsoluteFill>
        <GlassPanel x={PROMPT_PILL.x0} y={PROMPT_PILL.y0} width={PROMPT_PILL.w} height={PROMPT_PILL.h} radius={PROMPT_PILL.radius} glow={0.25} rim="hairline">
          <div style={{position: 'absolute', left: 40, top: 0, height: PROMPT_PILL.h, display: 'flex', alignItems: 'center', gap: 18, fontFamily: FONT.mono, fontWeight: 500, fontSize: 40, color: C.frost, whiteSpace: 'pre', fontFeatureSettings: '"liga" 0, "calt" 0'}}>
            <span style={{color: C.violet}}>{'\u203a'}</span>
            <span>
              {words.map((w, k) => {
                const glow = w === 'Migrate' || w === 'Snowflake';
                return (
                  <span key={k} style={glow ? {color: C.iceGlow, textShadow: `0 0 18px ${C.ice}, 0 0 36px rgba(56,225,255,0.5)`} : undefined}>
                    {w}
                    {k < words.length - 1 ? ' ' : ''}
                  </span>
                );
              })}
            </span>
          </div>
        </GlassPanel>
        <div style={{position: 'absolute', left: PROMPT_PILL.x0 + 44, top: PROMPT_PILL.y1 + 26, fontFamily: FONT.mono, fontWeight: 500, fontSize: 26, color: C.slate, whiteSpace: 'pre'}}>
          <span style={{color: C.mint}}>{'\u2713'} </span>
          {STATUS_LINE}
        </div>
      </AbsoluteFill>
      <Beam id="shelfbeam" d={arcPath([PROMPT_PILL.x1 - 60, PROMPT_PILL.y0], [SKILL_SHELF.x0 + 330, card + 38], -90)} progress={1} from={C.violet} to={C.violet} head={false} />
      <AbsoluteFill>
        {SHELF.map((sk, k) => (
          <SkillCard
            key={sk.name}
            y={SKILL_SHELF.slotY(k)}
            name={sk.name}
            description={sk.description}
            opacity={k === MATCHED_SHELF_INDEX ? 1 : 0.3}
            blur={k === MATCHED_SHELF_INDEX ? 0 : 2}
            lift={k === MATCHED_SHELF_INDEX ? 1 : 0}
            matched={k === MATCHED_SHELF_INDEX ? 1 : 0}
            iconsRow={k === MATCHED_SHELF_INDEX ? 1 : 0}
            accent={k === MATCHED_SHELF_INDEX ? 1 : 0}
            lit={{playbook: 1}}
            descGlow={k === MATCHED_SHELF_INDEX ? 0.6 : 0}
          />
        ))}
      </AbsoluteFill>
      <Caption text="Only the matching skill opens." enterAt={-100} />
      <DemoChip fadeInAt={-100} />
      <Grain />
    </AbsoluteFill>
  );
};

export const KIT_MOTION_FRAMES = 120;
export const BOARD_W = BOARD.width;
