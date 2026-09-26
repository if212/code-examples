import React from 'react';
import {C, EASE, FONT, TONES, Tone} from '../../theme';
import {CheckMark, DotGlyph, HexGlyph, measureWidth, useFontsLoaded} from '../../components';
import {clamp01, lerp} from '../../motion';

/**
 * The S6 label chip, built as ONE element that changes state in place (round-2 review: no double exposure and
 * no gap after the icon):
 *   'Spark SQL' (ember dot) -> 'as-is on Snowflake' (ice hex) -> 'on Snowflake' (mint check).
 * The text sits in a clipped window (the chip's full height) right after the icon. On each change the old label
 * rolls up and out, THEN the new one rolls up in from below (one left edge, one baseline, never both at once),
 * the window width eases between the MEASURED text widths, the icon cross-fades in a fixed box and the tone
 * blends. Nothing ever reflows.
 */

/** '#RRGGBB' -> [r, g, b] */
const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};

type RGB = [number, number, number];
const mixRGB = (p: RGB, q: RGB, t: number): RGB => {
  const k = clamp01(t);
  return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
};
const rgba = (c: RGB, a: number): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

/** blend two hex colours by t and return rgba() with alpha a */
export const mixA = (a: string, b: string, t: number, al = 1): string => rgba(mixRGB(rgb(a), rgb(b), t), al);

export type ChipStage = {label: string; tone: Tone; icon: 'dot' | 'hex' | 'check'};

const IconFor: React.FC<{icon: ChipStage['icon']; tone: Tone; size: number; draw: number}> = ({icon, tone, size, draw}) => {
  if (icon === 'hex') return <HexGlyph size={Math.round(size * 0.72)} color={TONES[tone].main} />;
  if (icon === 'check') return <CheckMark size={Math.round(size * 1.05)} color={C.mint} strokeWidth={3} draw={draw} />;
  return <DotGlyph size={Math.round(size * 0.5)} color={TONES[tone].main} />;
};

/**
 * `t` = [t01, t12]: eased 0..1 progress of the change stage0 -> stage1 and stage1 -> stage2.
 * `glow` = extra outer glow (flash on each change).
 */
export const StateChip: React.FC<{stages: readonly [ChipStage, ChipStage, ChipStage]; t: readonly [number, number]; size: number; glow?: number}> = ({
  stages,
  t,
  size,
  glow = 0,
}) => {
  useFontsLoaded();
  const [a, b] = [clamp01(t[0]), clamp01(t[1])];
  const font = `600 ${size}px "Inter Tight"`;
  const track = -0.005 * size;
  const widths = stages.map((s) => measureWidth(s.label, font, track));
  // the window never clips a visible label: it GROWS while the old label leaves (first part of the change) and
  // SHRINKS only once the old label is gone (second part)
  const wT = (p: number, grow: boolean) => EASE.IN_OUT(grow ? clamp01(p / 0.6) : clamp01((p - 0.5) / 0.5));
  const wa = wT(a, widths[1] >= widths[0]);
  const wb = wT(b, widths[2] >= widths[1]);
  const textW = lerp(lerp(widths[0], widths[1], wa), widths[2], wb);

  // tone blend across the three stages
  const main = mixRGB(mixRGB(rgb(TONES[stages[0].tone].main), rgb(TONES[stages[1].tone].main), a), rgb(TONES[stages[2].tone].main), b);
  const text = mixRGB(mixRGB(rgb(TONES[stages[0].tone].text), rgb(TONES[stages[1].tone].text), a), rgb(TONES[stages[2].tone].text), b);

  const h = Math.round(size * 1.75);
  const roll = h * 0.62;
  const box = Math.round(size * 0.9);

  // SEQUENTIAL roll (never two labels at once): the old label rolls up and out in the first half of a change,
  // the new one rolls up in from below in the second half. The window spans the chip's full height, so the
  // clip happens at the chip's own edges.
  const outP = (p: number) => clamp01(p / 0.5);
  const inP = (p: number) => clamp01((p - 0.5) / 0.5);
  const leave = (p: number) => ({y: -roll * EASE.EXIT(outP(p)), o: 1 - outP(p)});
  const enter = (p: number) => ({y: roll * (1 - EASE.EXPO_OUT(inP(p))), o: clamp01(inP(p) * 1.4)});
  const l0 = leave(a);
  const l1in = enter(a);
  const l1out = leave(b);
  const l2 = enter(b);
  const labels = [l0, {y: l1in.y + l1out.y, o: Math.min(l1in.o, l1out.o)}, l2];
  const icons = [clamp01(1 - a * 1.6), Math.min(clamp01(a * 1.6), clamp01(1 - b * 1.6)), clamp01(b * 1.6)];

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(size * 0.42),
        height: h,
        padding: `0 ${Math.round(size * 0.66)}px 0 ${Math.round(size * 0.56)}px`,
        borderRadius: Math.round(h * 0.36),
        background: `linear-gradient(180deg, ${rgba(main, 0.18)} 0%, ${rgba(main, 0.07)} 100%), rgba(10,14,22,0.55)`,
        boxShadow: [
          `inset 0 0 0 1px ${rgba(main, 0.5)}`,
          `inset 0 1px 0 rgba(255,255,255,0.12)`,
          glow > 0 ? `0 0 ${Math.round(28 * glow)}px ${rgba(main, Math.min(0.6, 0.42 * glow))}` : null,
        ]
          .filter(Boolean)
          .join(', '),
        color: rgba(text, 1),
        fontFamily: FONT.display,
        fontWeight: 600,
        fontSize: size,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        lineHeight: `${h}px`,
      }}
    >
      {/* icon: fixed box, the three glyphs cross-fade in place */}
      <span style={{position: 'relative', display: 'inline-block', width: box, height: box, flex: 'none'}}>
        {stages.map((s, i) =>
          icons[i] > 0.001 ? (
            <span
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: icons[i],
                transform: `scale(${(0.6 + 0.4 * icons[i]).toFixed(3)})`,
              }}
            >
              <IconFor icon={s.icon} tone={s.tone} size={size} draw={i === 2 ? clamp01(b * 1.3) : 1} />
            </span>
          ) : null,
        )}
      </span>
      {/* text window: measured width, clipped, labels roll through it on one left edge */}
      <span style={{position: 'relative', display: 'inline-block', width: Math.ceil(textW) + 2, height: h, overflow: 'hidden', flex: 'none'}}>
        {stages.map((s, i) =>
          labels[i].o > 0.001 ? (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: h,
                transform: `translateY(${(labels[i].y + size * 0.03).toFixed(2)}px)`,
                opacity: labels[i].o,
              }}
            >
              {s.label}
            </span>
          ) : null,
        )}
      </span>
    </div>
  );
};
