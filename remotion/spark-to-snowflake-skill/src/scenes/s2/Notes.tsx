import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT, TONES, alpha, softRadial} from '../../theme';
import {bell, clamp01, ramp, velocity2D} from '../../motion';
import {DirectionalBlur, measureWidth} from '../../components';
import {
  FOLDER,
  LID_REST,
  NOTES,
  NOTE_FROM,
  NOTE_SIZE,
  NOTE_TO,
  NoteDef,
  Path,
  boardCam,
  chipScaleOnBoard,
  crossFrame,
  flightS,
  flightU,
  lidTop,
  mixHex,
  notePath,
  notePos,
  pointAt,
  violetMix,
} from './timing';

/**
 * The S2 chip notes: the 8 repeated fixes lifted off the S1 tiles and flown into the folder.
 * Scene-local because a note's colour is interpolated (ember -> violet) frame by frame; the look mirrors the
 * shared solid <Chip> (same fill, inset ring, highlight and shadow) so the hand-off from the tile is seamless.
 * Everything takes `paths` = NOTES.map(notePath), computed once per frame by the scene.
 */

export const notePaths = (): Path[] => NOTES.map((n) => notePath(n));

/** Peak in-flight scale (the note floats toward the camera, so the labels read mid-air). */
const PEAK = 1.45;

/** Fixed box of a note (same metrics as the shared Chip at NOTE_SIZE), so it centres exactly on its anchor. */
const NOTE_H = Math.round(NOTE_SIZE * 1.75);
const NOTE_PAD = Math.round(NOTE_SIZE * 0.72);
const noteW = (label: string): number => Math.ceil(measureWidth(label, `600 ${NOTE_SIZE}px ${FONT.display}`, -0.005 * NOTE_SIZE)) + 2 * NOTE_PAD;

const NoteChip: React.FC<{label: string; mix: number; glow: number}> = ({label, mix, glow}) => {
  const main = mixHex(NOTE_FROM.main, NOTE_TO.main, mix);
  const text = mixHex(NOTE_FROM.text, NOTE_TO.text, mix);
  const base = mixHex(C.codeBg, TONES.violet.deep, 0.75 * mix);
  const h = NOTE_H;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: h,
        boxSizing: 'border-box',
        borderRadius: Math.round(h * 0.36),
        background: `linear-gradient(180deg, ${alpha(main, 0.24 + 0.08 * mix)} 0%, ${alpha(main, 0.13)} 100%), ${alpha(base, 0.88)}`,
        boxShadow: [
          `inset 0 0 0 1px ${alpha(main, 0.45 + 0.25 * glow)}`,
          `inset 0 1px 0 ${alpha('#FFFFFF', 0.14)}`,
          glow > 0.01 ? `0 0 ${Math.round(26 * glow)}px ${alpha(main, 0.45 * glow)}` : null,
          '0 8px 18px -8px rgba(0,0,0,0.8)',
        ]
          .filter(Boolean)
          .join(', '),
        color: text,
        fontFamily: FONT.display,
        fontWeight: 600,
        fontSize: NOTE_SIZE,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
      }}
    >
      <span style={{transform: 'translateY(0.03em)'}}>{label}</span>
    </div>
  );
};

type NoteFrame = {
  n: NoteDef;
  x: number;
  y: number;
  scale: number;
  rx: number;
  rz: number;
  z: number;
  opacity: number;
  mix: number;
  glow: number;
  blur: number;
  angle: number;
  u: number;
  flying: boolean;
};

const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

const noteFrame = (n: NoteDef, path: Path, f: number): NoteFrame => {
  const pos = notePos(n, path, f);
  const flying = f >= n.start;
  const u = flightU(n, path, f);
  const cam = boardCam(f);
  if (!flying) {
    // still on the tile: rides the dimming board, warms up just before it peels
    const pre = ramp(f, n.start - 8, n.start);
    return {
      n,
      x: pos.x,
      y: pos.y,
      scale: chipScaleOnBoard(f),
      rx: 0,
      rz: cam.rotate,
      z: 0,
      opacity: n.ghost ? 0.3 + 0.2 * pre : 1,
      mix: 0,
      glow: 0.4 * pre,
      blur: 0,
      angle: 0,
      u: 0,
      flying: false,
    };
  }
  const v = velocity2D((fr) => notePos(n, path, fr), f);
  const s0 = chipScaleOnBoard(n.start);
  const scale = s0 + (PEAK - s0) * smooth(u / 0.42) - (PEAK - 0.92) * smooth((u - 0.5) / 0.5);
  const mix = violetMix(pos);
  return {
    n,
    x: pos.x,
    y: pos.y,
    scale,
    rx: -25 * bell(clamp01(u * 2.2)),
    rz: Math.max(-10, Math.min(10, v.vx * 0.22)) + cam.rotate * (1 - smooth(u / 0.2)),
    z: 80 * bell(clamp01(u * 1.25)),
    opacity: (n.ghost ? 0.5 + 0.5 * smooth(u / 0.16) : 1) * (1 - smooth((u - 0.94) / 0.06)),
    mix,
    glow: 0.4 + 0.5 * mix,
    blur: Math.min(6, v.speed * 0.12),
    angle: v.angle,
    u,
    flying: true,
  };
};

const FlyingNote: React.FC<{nf: NoteFrame}> = ({nf}) => {
  const w = noteW(nf.n.label);
  return (
    <div style={{position: 'absolute', left: nf.x, top: nf.y, width: 0, height: 0, opacity: nf.opacity}}>
      <DirectionalBlur id={`s2-note-${nf.n.k}`} amount={nf.blur} angle={nf.angle} style={{position: 'absolute', left: -w / 2, top: -NOTE_H / 2, width: w, height: NOTE_H}}>
        <div
          style={{
            width: w,
            height: NOTE_H,
            // translateZ before rotateX (rightmost applies first): tilt about the note's centre, then lift it
            transform: `perspective(800px) translateZ(${nf.z.toFixed(1)}px) rotateX(${nf.rx.toFixed(2)}deg) rotate(${nf.rz.toFixed(3)}deg) scale(${nf.scale.toFixed(4)})`,
          }}
        >
          <NoteChip label={nf.n.label} mix={nf.mix} glow={nf.glow} />
        </div>
      </DirectionalBlur>
    </div>
  );
};

/** Short light trail behind each flying note: its path over the last 5 frames, fading to the tail. */
const Trails: React.FC<{frames: NoteFrame[]; paths: Path[]; f: number}> = ({frames, paths, f}) => {
  const trails = frames
    .filter((nf) => nf.flying && nf.u < 1)
    .map((nf) => {
      const path = paths[nf.n.k];
      const sHead = flightS(nf.n, path, f);
      const sTail = flightS(nf.n, path, f - 5);
      if (sHead - sTail < 0.004) return null;
      const pts: string[] = [];
      const N = 10;
      for (let i = 0; i <= N; i++) {
        const p = pointAt(path, sTail + ((sHead - sTail) * i) / N);
        pts.push(`${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
      }
      const tail = pointAt(path, sTail);
      const color = mixHex(NOTE_FROM.main, NOTE_TO.main, nf.mix);
      // the trail fades in after the peel, so the lift-off hook never reads as a stray line
      const o = nf.opacity * clamp01((nf.u - 0.12) / 0.2);
      return {k: nf.n.k, d: pts.join(' '), tail, head: {x: nf.x, y: nf.y}, color, o, w: nf.scale};
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);
  if (!trails.length) return null;
  return (
    <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
      <defs>
        {trails.map((t) => (
          <linearGradient key={t.k} id={`s2-trail-${t.k}`} gradientUnits="userSpaceOnUse" x1={t.tail.x} y1={t.tail.y} x2={t.head.x} y2={t.head.y}>
            <stop offset="0" stopColor={t.color} stopOpacity={0} />
            <stop offset="0.75" stopColor={t.color} stopOpacity={0.4} />
            <stop offset="1" stopColor={C.whiteHot} stopOpacity={0.75} />
          </linearGradient>
        ))}
      </defs>
      {trails.map((t) => (
        <g key={t.k} opacity={t.o}>
          <path d={t.d} fill="none" stroke={`url(#s2-trail-${t.k})`} strokeWidth={14 * t.w} strokeLinecap="round" opacity={0.18} />
          <path d={t.d} fill="none" stroke={`url(#s2-trail-${t.k})`} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
};

/**
 * All notes + trails, clipped below the lid's top edge so each note drops in BEHIND the open lid.
 * cy / open = the folder's current centre and lid state (the clip follows the lid).
 */
export const NotesLayer: React.FC<{f: number; paths: Path[]; cy: number; open: number}> = ({f, paths, cy, open}) => {
  const frames = NOTES.map((n) => noteFrame(n, paths[n.k], f)).filter((nf) => nf.u < 1);
  if (!frames.length) return null;
  const lt = lidTop(cy, Math.max(0, open));
  const x0 = (FOLDER.cx - lt.halfW - 6).toFixed(1);
  const x1 = (FOLDER.cx + lt.halfW + 6).toFixed(1);
  const y = (lt.y + 1).toFixed(1);
  const clip = `polygon(0px 0px, 1920px 0px, 1920px 1080px, ${x1}px 1080px, ${x1}px ${y}px, ${x0}px ${y}px, ${x0}px 1080px, 0px 1080px)`;
  // draw order: notes in flight above the ones still resting on the board; later peels on top
  const ordered = [...frames].sort((a, b) => (a.flying === b.flying ? a.n.k - b.n.k : a.flying ? 1 : -1));
  return (
    <AbsoluteFill style={{clipPath: clip, WebkitClipPath: clip, pointerEvents: 'none'}}>
      <Trails frames={frames} paths={paths} f={f} />
      {ordered.map((nf) => (
        <FlyingNote key={nf.n.k} nf={nf} />
      ))}
    </AbsoluteFill>
  );
};

/** Rim-crossing frame and x of every note (the violet flashes and the folder glow pulses). */
export const noteCrossings = (paths: Path[]): Array<{k: number; at: number; x: number}> =>
  NOTES.map((n) => {
    const path = paths[n.k];
    const at = crossFrame(n, path);
    return {k: n.k, at, x: pointAt(path, flightS(n, path, at)).x};
  });

/** Small violet flashes where each note crosses the rim (screen-blended, box-sized). */
export const RimFlashes: React.FC<{f: number; paths: Path[]}> = ({f, paths}) => {
  const items = noteCrossings(paths)
    .map((c) => ({...c, p: bell(ramp(f, c.at - 3, c.at + 7))}))
    .filter((c) => c.p > 0.01);
  if (!items.length) return null;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {items.map((c) => (
        <React.Fragment key={c.k}>
          <div
            style={{
              position: 'absolute',
              left: c.x - 150,
              top: LID_REST.y - 70,
              width: 300,
              height: 140,
              opacity: c.p,
              background: softRadial('ellipse 50% 50% at 50% 50%', C.violet, 0.75, 12, 2.4),
              mixBlendMode: 'screen',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: c.x - 60,
              top: LID_REST.y - 14,
              width: 120,
              height: 28,
              opacity: c.p,
              background: softRadial('ellipse 50% 50% at 50% 50%', '#FFFFFF', 0.85, 10, 2.6),
              mixBlendMode: 'screen',
            }}
          />
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

/** Folder glow pulse from the landings (sum of decaying pulses). */
export const landingGlow = (f: number, paths: Path[]): number =>
  noteCrossings(paths).reduce((acc, c) => (f >= c.at ? acc + 0.26 * Math.exp(-(f - c.at) / 6) : acc), 0);

/** Fraction of notes already inside the folder. */
export const landedFraction = (f: number, paths: Path[]): number => noteCrossings(paths).filter((c) => f >= c.at).length / NOTES.length;
