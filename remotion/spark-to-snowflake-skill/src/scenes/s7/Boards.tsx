import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Board, Camera, DirectionalBlur, Spotlight} from '../../components';
import type {TileState} from '../../components';
import {C, EASE, SHADOW, alpha} from '../../theme';
import {CODE_PANEL, CX, CY, tileRect, tileRowCol} from '../../layout';
import {JOBS, TRAP_INDEX} from '../../demoData';
import {bell, clamp01, glide, lerp, ramp, reveal, snap} from '../../motion';
import {S6EndPanel, S6_DURATION, panelCamAt} from '../s6/PanelShot';
import {
  BOARDS,
  MATES,
  MINI,
  Mate,
  PUSH_SCALE,
  T2,
  YOU_MATE,
  boardScaleAt,
  onScreen,
  plateRect,
  pullP,
  toScreen,
  worldCamAt,
} from './geometry';
import {Plate} from './Plate';
import {T7, mateLandAt, mateWaveAt} from './timing';

/**
 * The world layer: the You board pulling back out of S6's code panel, and the three teammate boards the
 * pull-back reveals, each on its glass plate. Velocity-driven directional blur during the move (no tile is
 * mid-flip then: the You board is settled at flip 1 and the teammate boards wait at flip 0).
 */

/* ----------------------------------------------------------------------------------------- tile states */

const youTile =
  (f: number, recedeBlur: number) =>
  (i: number): Partial<TileState> => {
    const job = JOBS[i];
    const amber = job.outcome === 'needYou';
    const o = i === TRAP_INDEX ? ramp(f, T7.trapIn[0], T7.trapIn[1]) : ramp(f, T7.othersIn[0], T7.othersIn[1]);
    return {
      flip: 1,
      outcome: job.outcome,
      check: amber ? 0 : 1,
      needYou: amber ? 1 : 0,
      lift: amber ? 0.5 : 0,
      opacity: o,
      blur: recedeBlur,
    };
  };

const mateTile =
  (f: number, m: Mate, recedeBlur: number) =>
  (i: number): Partial<TileState> => {
    const {row, col} = tileRowCol(i);
    const start = mateWaveAt(m.k) + (row + col) * T7.tileDelay;
    const amber = m.amberTiles.includes(i);
    const landed = start + T7.flipLand;
    return {
      flip: snap(f, start),
      outcome: amber ? 'needYou' : 'converted',
      check: amber ? 0 : reveal(f, landed + 2, 8),
      needYou: amber ? snap(f, landed) : 0,
      lift: amber ? 0.5 * glide(f, m.amberLand + 8) : 0,
      blur: recedeBlur,
    };
  };

/** soft amber light over a board's 'Needs you' tile (S5's spotlight language, at mini scale) */
const AmberGlow: React.FC<{i: number; cx: number; cy: number; level: number}> = ({i, cx, cy, level}) => {
  if (level <= 0.001) return null;
  const r = tileRect(i, cx, cy, MINI);
  return <Spotlight cx={r.cx} cy={r.cy} rx={r.w * 1.25} ry={r.h * 1.5} color={C.amber} intensity={0.2 * level} />;
};

/* ----------------------------------------------------------------------------- S6 panel -> tile 2 morph */

const PANEL_R = 26;

/** S6's final panel rect on screen (S6 keeps a gentle drift camera on it). */
const S6_PANEL = (() => {
  const c = panelCamAt(S6_DURATION);
  const s = c.scale;
  const x = CX + c.x + s * (CODE_PANEL.left - CX);
  const y = CY + c.y + s * (CODE_PANEL.top - CY);
  return {x, y, w: CODE_PANEL.w * s, h: CODE_PANEL.h * s, r: PANEL_R * s};
})();

/** pull-back applied to things that live in S6's pushed-in frame: (960,600) -> tile 2's screen centre */
const pushedFrameAt = (f: number) => {
  const cam = worldCamAt(f);
  const a = toScreen(cam, T2.cx, T2.cy);
  return {ax: a.x, ay: a.y, k: boardScaleAt(f) / PUSH_SCALE};
};

const MorphBox: React.FC<{f: number}> = ({f}) => {
  const fade = ramp(f, T7.boxFade[0], T7.boxFade[1]);
  if (fade >= 1) return null;
  const m = interpolate(f, [T7.morph[0], T7.morph[1]], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.IN_OUT});
  const t = pushedFrameAt(f);
  // S6's panel carried by the pull-back
  const px = t.ax + t.k * (S6_PANEL.x - CX);
  const py = t.ay + t.k * (S6_PANEL.y - CY);
  const pw = S6_PANEL.w * t.k;
  const ph = S6_PANEL.h * t.k;
  // tile 2 on screen
  const s = boardScaleAt(f);
  const tw = 300 * s;
  const th = 170 * s;
  const tx = t.ax - tw / 2;
  const ty = t.ay - th / 2;
  const x = lerp(px, tx, m);
  const y = lerp(py, ty, m);
  const w = lerp(pw, tw, m);
  const h = lerp(ph, th, m);
  const r = lerp(S6_PANEL.r * t.k, 18 * s, m);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: r,
        opacity: 1 - fade,
        background: [
          'linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 22%)',
          `radial-gradient(120% 90% at 0% 0%, ${alpha(C.ice, 0.035 + 0.12 * m)} 0%, ${alpha(C.ice, 0)} 60%)`,
          // the dark code-panel body turns into translucent tile glass as it lands, so tile 2 never reads as a hole
          `linear-gradient(180deg, ${alpha(C.codeBg, lerp(0.94, 0.5, m))} 0%, ${alpha(C.codeBg, lerp(0.97, 0.6, m))} 100%)`,
        ].join(', '),
        boxShadow: [SHADOW.lifted, `0 0 90px ${alpha(C.ice, 0.09)}`, `0 0 0 1px ${alpha(C.ice, 0.05 + 0.2 * m)}`].join(', '),
      }}
    />
  );
};

/** S6's last picture (code, stack, chips), riding the pull-back and fading out. */
const S6Panel: React.FC<{f: number}> = ({f}) => {
  const o = 1 - ramp(f, T7.panelFade[0], T7.panelFade[1]);
  if (o <= 0.001) return null;
  const t = pushedFrameAt(f);
  return (
    <AbsoluteFill
      style={{
        opacity: o,
        transformOrigin: `${CX}px ${CY}px`,
        transform: `translate(${(t.ax - CX).toFixed(2)}px, ${(t.ay - CY).toFixed(2)}px) scale(${t.k.toFixed(4)})`,
      }}
    >
      <S6EndPanel />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------ motion blur */

const blurFor = (fn: (f: number) => {x: number; y: number; w: number}, f: number, gain: number, cap: number) => {
  if (f <= T7.pull) return {amount: 0, angle: 0};
  const a = fn(f - 1);
  const b = fn(f);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const speed = Math.hypot(dx, dy) + 0.3 * Math.abs(b.w - a.w);
  // velocity already starts small (eased head); the ramp keeps the first frames after the cut crisp
  const rampIn = ramp(f, T7.pull, T7.pull + T7.blurRamp);
  return {amount: Math.min(cap, speed * gain) * rampIn, angle: (Math.atan2(dy, dx) * 180) / Math.PI};
};

/** tile 2 on screen: the You layer's motion */
const youMotion = (f: number) => {
  const c = worldCamAt(f);
  const p = toScreen(c, T2.cx, T2.cy);
  return {x: p.x, y: p.y, w: 300 * boardScaleAt(f)};
};

/** the teammate boards all converge toward the anchor; the diagonal (Sam) board carries the largest move */
const mateMotion = (f: number) => {
  const c = worldCamAt(f);
  const b = BOARDS.sam;
  const p = toScreen(c, b.cx, b.cy);
  return {x: p.x, y: p.y, w: 0};
};

const FULL = {position: 'absolute' as const, left: 0, top: 0, width: 1920, height: 1080};

/* -------------------------------------------------------------------------------------------- layers */

export const YouLayer: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  const cam = worldCamAt(f);
  const v = blurFor(youMotion, f, 0.16, 14);
  const miniO = ramp(f, T7.miniSwap[0], T7.miniSwap[1]);
  const plateO = ramp(f, T7.youPlate[0], T7.youPlate[1]);
  const rb = 8 * recede;
  const b = BOARDS.you;
  const pr = plateRect('you');
  const linkLit = reveal(f, T7.youLink + T7.youLinkDur - 4, 18);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <DirectionalBlur id="s7-you" amount={v.amount} angle={v.angle} style={FULL}>
        <div style={{position: 'relative', width: 1920, height: 1080}}>
          <Camera origin={cam.origin} scale={cam.scale} x={cam.x} y={cam.y}>
            <Plate
              id="you"
              rect={pr}
              side="right"
              portY={b.cy}
              lit={linkLit}
              flash={bell(ramp(f, T7.youLink + T7.youLinkDur - 6, T7.youLink + T7.youLinkDur + 14))}
              rimLevel={0.45}
              opacity={plateO}
              from={C.violet}
              to={C.iceGlow}
            />
            {miniO < 1 ? <Board cx={b.cx} cy={b.cy} scale={MINI} tile={youTile(f, rb)} opacity={1 - miniO} /> : null}
            {miniO > 0 ? <Board cx={b.cx} cy={b.cy} scale={MINI} mini tile={youTile(f, rb)} opacity={miniO} /> : null}
            {YOU_MATE.amberTiles.map((i) => (
              <AmberGlow key={i} i={i} cx={b.cx} cy={b.cy} level={ramp(f, T7.youPlate[0], T7.youPlate[1]) * (1 - 0.5 * recede)} />
            ))}
          </Camera>
          <MorphBox f={f} />
          <S6Panel f={f} />
        </div>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};

export const MatesLayer: React.FC<{f: number; recede: number}> = ({f, recede}) => {
  // hidden while the stage is still huge and streaking (only the You board and the folder read during the
  // fast part of the pull-back), then fading in as the camera settles
  const matesIn = interpolate(f, [T7.matesIn[0], T7.matesIn[1]], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.IN_OUT,
  });
  if (matesIn <= 0.001) return null;
  const cam = worldCamAt(f);
  const visible = MATES.filter((m) => onScreen(cam, plateRect(m.key)));
  if (visible.length === 0) return null;
  const v = blurFor(mateMotion, f, 0.14, 16);
  const rb = 8 * recede;
  const settled = pullP(f) > 0.999;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: matesIn}}>
      <DirectionalBlur id="s7-mates" amount={settled ? 0 : v.amount} angle={v.angle} style={FULL}>
        <div style={{position: 'relative', width: 1920, height: 1080}}>
          <Camera origin={cam.origin} scale={cam.scale} x={cam.x} y={cam.y}>
            {visible.map((m) => {
              const land = mateLandAt(m.k);
              const wake = glide(f, land - 2);
              const b = BOARDS[m.key];
              return (
                <React.Fragment key={m.key}>
                  <Plate
                    id={m.key}
                    rect={plateRect(m.key)}
                    side={m.side}
                    portY={m.platePort.y}
                    lit={reveal(f, land, 16)}
                    flash={bell(ramp(f, land, land + 18))}
                  />
                  <Board cx={b.cx} cy={b.cy} scale={MINI} mini tile={mateTile(f, m, rb)} opacity={0.42 + 0.58 * clamp01(wake)} />
                  {m.amberTiles.map((i) => (
                    <AmberGlow key={i} i={i} cx={b.cx} cy={b.cy} level={ramp(f, m.amberLand - 2, m.amberLand + 10) * (1 - 0.5 * recede)} />
                  ))}
                </React.Fragment>
              );
            })}
          </Camera>
        </div>
      </DirectionalBlur>
    </AbsoluteFill>
  );
};

export {YOU_MATE};
