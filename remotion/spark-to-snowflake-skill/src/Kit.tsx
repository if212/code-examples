import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT} from './theme';
import {tileRect} from './layout';
import {JOB_FILES, SHELF, MATCHED_SHELF_INDEX, SKILL_FOLDER_LABEL, SKILL_PARTS, STATS, FIX_CHIPS} from './demoData';
import {Background, Grain} from './components/Background';
import {LightAxis} from './components/LightAxis';
import {Specks} from './components/Specks';
import {Headline} from './components/Headline';
import {Board} from './components/Board';
import {Cursor} from './components/Cursor';
import {SkillFolder} from './components/SkillFolder';
import {SkillCard} from './components/SkillCard';
import {Pill, Chip, StatChip, Tag} from './components/Glass';
import {SkillIcon} from './components/Icons';
import {DemoChip} from './components/DemoChip';
import type {TileState} from './components/Tile';

/**
 * Style-kit still: every shared building block on one launch-film frame.
 */
const KIT_BOARD = {cx: 560, cy: 528, scale: 0.56};

const tileStates: Record<number, Partial<TileState>> = {
  0: {flip: 1, outcome: 'converted', check: 1},
  1: {flip: 1, outcome: 'converted', check: 1},
  2: {flip: 1, outcome: 'converted', check: 1, sparkle: 0.38},
  3: {flip: 1, outcome: 'needYou', needYou: 1, lift: 0.35},
  4: {flip: 1, outcome: 'converted', check: 0.55},
  5: {flip: 0.74, outcome: 'converted'},
  6: {flip: 0.44, outcome: 'converted'},
  7: {
    stamp: {label: 'again', p: 1},
    chips: FIX_CHIPS.map((label) => ({label, p: 1})),
  },
  8: {flip: 0.6, outcome: 'converted'},
  9: {flip: 0.28, outcome: 'converted'},
  10: {
    chips: FIX_CHIPS.map((label, k) => ({label, p: 1, state: k === 1 ? ('missing' as const) : ('solid' as const)})),
    tag: {label: 'missed one', p: 1, tone: 'coral'},
  },
  11: {chips: [{label: 'Rewrite', p: 1}, {label: 'Fix', p: 0.6}, {label: 'Test', p: 0}], progress: 0.55},
};

export const Kit: React.FC = () => {
  const amber = tileRect(3, KIT_BOARD.cx, KIT_BOARD.cy, KIT_BOARD.scale);
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Background globalFrame={620} />
      <LightAxis frameOffset={620} />
      <Headline text="Write the know-how once." keyWord="know-how" accentWord="once" enterAt={-100} />
      <Board cx={KIT_BOARD.cx} cy={KIT_BOARD.cy} scale={KIT_BOARD.scale} tile={(i) => ({file: JOB_FILES[i], ...(tileStates[i] ?? {})})} />
      {/* right column: folder + parts */}
      <AbsoluteFill>
        <SkillFolder cx={1190} cy={452} width={380} label={SKILL_FOLDER_LABEL} glow={0.85} />
        <div style={{position: 'absolute', left: 1450, top: 318, display: 'flex', flexDirection: 'column', gap: 26}}>
          {SKILL_PARTS.map((p, k) => (
            <div key={p.key} style={{display: 'flex', alignItems: 'center', gap: 18}}>
              <SkillIcon kind={p.key} size={52} color={k === 2 ? C.mint : C.violet} glow={0.8} />
              <div>
                <div style={{fontFamily: FONT.display, fontWeight: 700, fontSize: 32, color: C.frost, letterSpacing: '-0.02em', lineHeight: 1.05}}>{p.title}</div>
                <div style={{fontFamily: FONT.display, fontWeight: 500, fontSize: 20, color: C.slate, marginTop: 4}}>
                  {p.gloss} <span style={{fontFamily: FONT.mono, color: C.dim, fontSize: 17, marginLeft: 6}}>{p.hint}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <SkillCard
          x={1030}
          y={636}
          name={SHELF[MATCHED_SHELF_INDEX].name}
          description={SHELF[MATCHED_SHELF_INDEX].description}
          lift={1}
          matched={1}
          iconsRow={1}
          accent={1}
          lit={{playbook: 1, mappings: 0.6, checks: 0}}
          descGlow={0.5}
        />
      </AbsoluteFill>
      {/* pills + chips row */}
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 200, top: 780, display: 'flex', gap: 14, alignItems: 'center'}}>
          <Pill label="Spark" tone="ember" icon="dot" />
          <Pill label="Snowflake" tone="ice" icon="hex" />
          <Tag label="Needs you" tone="amber" />
          <Tag label="matched" tone="violet" />
          <Tag label="wrong row" tone="coral" />
          <Tag label="right row" tone="mint" />
        </div>
        <div style={{position: 'absolute', left: 200, top: 846, display: 'flex', gap: 12, alignItems: 'center'}}>
          <Chip label="Rewrite" tone="ember" variant="solid" size={20} />
          <Chip label="Fix" tone="ember" variant="solid" size={20} />
          <Chip label="Test" tone="ember" variant="solid" size={20} />
          <Chip label="Fix" variant="dashed" size={20} />
          <Chip label="Spark SQL" tone="ember" icon="dot" size={20} />
          <Chip label="from Mappings" tone="violet" icon={<SkillIcon kind="mappings" size={22} color={C.violet} strokeWidth={3.4} />} size={20} glow={0.6} />
          <Chip label="shared in your repo" tone="neutral" size={20} />
        </div>
      </AbsoluteFill>
      {/* stat chips */}
      <AbsoluteFill>
        <div style={{position: 'absolute', left: 960, top: 908, transform: 'translateX(-50%)', display: 'flex', gap: 16}}>
          {STATS.map((s) => (
            <StatChip key={s.label} tone={s.tone} value={s.value} of={'of' in s ? s.of : undefined} label={s.label} note={'note' in s ? s.note : undefined} size={24} />
          ))}
        </div>
      </AbsoluteFill>
      {/* cursors */}
      <AbsoluteFill>
        <Cursor x={amber.cx + 34} y={amber.cy + 10} label="you" />
        <Cursor x={1402} y={560} label="Leo" color={C.pink} />
      </AbsoluteFill>
      <Specks frameOffset={620} />
      <DemoChip fadeInAt={-100} />
      <Grain />
    </AbsoluteFill>
  );
};
