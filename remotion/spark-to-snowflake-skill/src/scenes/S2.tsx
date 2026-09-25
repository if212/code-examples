import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Board, Camera, Cursor, Headline, Shockwave, SkillFolder, Spotlight, caretOn, typedCount, useFontsLoaded} from '../components';
import {C} from '../theme';
import {tileRect} from '../layout';
import {COPY, MISSED_CHIP_SLOT, MISSED_INDEX, SKILL_FOLDER_LABEL} from '../demoData';
import {ramp, reveal} from '../motion';
import {S1_HEADLINE_B, s1ActiveTile, s1Cursor, s1MissP, s1TileState} from './s1/state';
import {MissedSlotOnBoard} from './s1/MissedSlotMark';
import {
  FOLDER,
  LABEL_LEN,
  S1_LAST,
  SEAM_Y,
  T,
  boardCam,
  boardOpacity,
  boardScale,
  dimP,
  flashP,
  folderCy,
  folderOpacity,
  impact,
  labelDoneAt,
  lidOpen,
  outP,
  shock,
  tileBlur,
  tileJitter,
} from './s2/timing';
import {NotesLayer, RimFlashes, landedFraction, landingGlow, notePaths} from './s2/Notes';
import {SnapStreak} from './s2/SnapStreak';

/**
 * S2 - THE IDEA (global f150-270): those repeated fixes become know-how written once, in one folder.
 * Starts on S1's exact end state (board, chips, 'again' stamp, missed slot + tag, cursor, shot drift), dims
 * the board, lifts the 8 chip notes off the tiles and swirls them into a rising glass folder; the lid snaps
 * shut with a white-hot flash + shockwave, the tab types 'spark-to-snowflake/', and the folder hands off to S3
 * at exactly (960,620), lid shut, glow 0.6. All timing lives in ./s2/timing.ts.
 */
export const S2: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  useFontsLoaded(); // chip-slot geometry (note start points) is measured from the loaded font

  const end = S1_LAST;
  const r = dimP(f);
  const out = outP(f);
  const bOpacity = boardOpacity(f);
  const cam = boardCam(f);

  // S1 end-state pieces, fading
  const cur = s1Cursor(end);
  const curO = 1 - reveal(f, 0, T.cursorOutDur);
  const active = s1ActiveTile(end);
  const activeRect = active >= 0 ? tileRect(active) : null;
  const missRect = tileRect(MISSED_INDEX);
  const miss = s1MissP(end);
  const mj = tileJitter(MISSED_INDEX, f);

  // note flight paths (fixed per note; measured from the loaded font)
  const paths = notePaths();

  // folder
  const cy = folderCy(f, fps);
  const open = lidOpen(f, fps);
  const flash = flashP(f);
  const snapped = f >= T.snap;
  const glowBase = 0.6 + 0.1 * landedFraction(f, paths) * (1 - ramp(f, T.snap + 2, T.snap + 26));
  const snapGlow = snapped ? 0.45 * Math.exp(-(f - T.snap) / 8) : 0;
  const glow = Math.min(1.15, glowBase + landingGlow(f, paths) + snapGlow);
  const labelChars = f >= T.typeFrom ? typedCount(f, T.typeFrom, LABEL_LEN, 1) : 0;
  const typing = f >= T.typeFrom && f < labelDoneAt;
  const sw = shock(f);
  const swOpacity = sw.opacity * ramp(f, T.snap - 1, T.snap + 1); // eases in under the flash

  return (
    <AbsoluteFill>
      {/* hero 1: the S1 board, dimming into the background (its shot drift continues) */}
      {bOpacity > 0.002 ? (
        <Camera drift={cam}>
          {activeRect && r < 1 ? <Spotlight cx={activeRect.cx} cy={activeRect.cy + 10} rx={300} ry={190} color={C.ember} intensity={0.16 * (1 - r)} /> : null}
          <Spotlight cx={missRect.cx} cy={missRect.cy} rx={330} ry={210} color={C.coral} intensity={0.22 * miss * (1 - 0.55 * r) * (1 - out)} />
          <Board
            scale={boardScale(f)}
            opacity={bOpacity}
            tile={(i) => {
              const base = s1TileState(i, end, fps);
              const chips = base.chips;
              return {
                ...base,
                blur: tileBlur(f),
                highlight: (base.highlight ?? 0) * (1 - r),
                dx: tileJitter(i, f).x,
                dy: tileJitter(i, f).y,
                // the chips now fly as notes; only the missed tile keeps its empty dashed slot
                hideChips: i !== MISSED_INDEX && !!chips,
                chips: i === MISSED_INDEX && chips ? chips.map((c, k) => (k === MISSED_CHIP_SLOT ? c : {...c, p: 0})) : chips,
                tag: base.tag ? {...base.tag, shake: 0} : undefined,
              };
            }}
          >
            <MissedSlotOnBoard p={miss} dx={mj.x} dy={mj.y} />
          </Board>
          {curO > 0.002 ? (
            <AbsoluteFill>
              <Cursor x={cur.x} y={cur.y + 10 * r} label="you" opacity={curO} scale={1 - 0.08 * r} tilt={-4} />
            </AbsoluteFill>
          ) : null}
        </Camera>
      ) : null}

      {/* hero 2: the skill folder rising to (960,620) */}
      <AbsoluteFill>
        <SkillFolder
          cx={FOLDER.cx}
          cy={cy}
          width={FOLDER.width}
          open={open}
          label={SKILL_FOLDER_LABEL}
          labelChars={labelChars}
          caret={f >= T.typeFrom && caretOn(f, labelDoneAt, typing)}
          glow={glow}
          flash={flash}
          opacity={folderOpacity(f)}
          transform={impact(f) > 0 ? `scale(${(1 + impact(f)).toFixed(4)})` : undefined}
        />
      </AbsoluteFill>

      {/* the notes (clipped behind the lid) + their rim flashes */}
      <NotesLayer f={f} paths={paths} cy={cy} open={open} />
      <RimFlashes f={f} paths={paths} />

      {/* snap: seam streak + shockwave ring */}
      <SnapStreak p={ramp(f, T.snap, T.snap + 14)} cx={FOLDER.cx} y={SEAM_Y} />
      <Shockwave id="s2-shock" cx={FOLDER.cx} cy={FOLDER.cy} r={sw.r} opacity={swOpacity} />

      {/* headlines (outside every camera) */}
      {f < 12 ? <Headline {...S1_HEADLINE_B} enterAt={-100} exitAt={0} /> : null}
      <Headline text={COPY.s2} accentWord="once" enterAt={T.headline} />
    </AbsoluteFill>
  );
};
