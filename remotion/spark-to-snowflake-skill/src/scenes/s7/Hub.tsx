import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Chip, SkillFolder, Spotlight} from '../../components';
import {C, alpha} from '../../theme';
import {COPY, SKILL_FOLDER_LABEL} from '../../demoData';
import {clamp01, glide, snap, wobble} from '../../motion';
import {CHIP_Y, HUB, HUB_W} from './geometry';
import {T7} from './timing';

/**
 * The skill as the team's hub: the folder rises (GLIDE) to (960,630) with a violet core glow, and the
 * 'shared in your repo' chip pops in under it (SNAP).
 */

const RISE = 120;

/** small folder glyph for the chip (same drawing as the skill dock's) */
const FolderGlyph: React.FC<{size: number}> = ({size}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{overflow: 'visible', flex: 'none'}}>
    <path
      d="M3 7.2 A1.6 1.6 0 0 1 4.6 5.6 H9.4 L11.4 7.6 H19.4 A1.6 1.6 0 0 1 21 9.2 V17.4 A1.6 1.6 0 0 1 19.4 19 H4.6 A1.6 1.6 0 0 1 3 17.4 Z"
      fill={alpha(C.violet, 0.25)}
      stroke={C.violet}
      strokeWidth={1.7}
      strokeLinejoin="round"
    />
  </svg>
);

export const hubRise = (f: number): number => glide(f, T7.folder);

export const Hub: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const g = hubRise(f);
  if (g <= 0.001) return null;
  const breathe = 0.5 + 0.5 * wobble('s7-hub', f, 0.05);
  const y = HUB.cy + RISE * (1 - g);
  const o = clamp01(g * 1.5) * (1 - 0.3 * recede);
  const sc = 0.9 + 0.1 * g;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <Spotlight cx={HUB.cx} cy={y + 10} rx={420} ry={330} color={C.violetGlow} intensity={(0.28 + 0.05 * breathe) * clamp01(g)} />
      <Spotlight cx={HUB.cx} cy={y - 10} rx={230} ry={170} color={C.violet} intensity={0.14 * clamp01(g)} />
      <SkillFolder
        cx={HUB.cx}
        cy={y}
        width={HUB_W}
        label={SKILL_FOLDER_LABEL}
        glow={(0.55 + 0.4 * clamp01(g) + 0.08 * breathe) * (1 - 0.4 * recede)}
        opacity={o}
        transform={`scale(${sc.toFixed(4)})`}
      />
    </AbsoluteFill>
  );
};

export const HubChip: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const p = snap(f, T7.chip);
  if (p <= 0.001) return null;
  const rise = hubRise(f);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: HUB.cx,
          top: CHIP_Y + RISE * (1 - rise) * 0.6,
          transform: `translate(-50%, -50%) translateY(${(12 * (1 - Math.min(1, p))).toFixed(2)}px) scale(${(0.82 + 0.18 * p).toFixed(4)})`,
          opacity: clamp01(p * 1.6) * (1 - 0.3 * recede),
        }}
      >
        <Chip label={COPY.s7Chip} tone="violet" icon={<FolderGlyph size={22} />} size={21} glow={0.45} />
      </div>
    </AbsoluteFill>
  );
};
