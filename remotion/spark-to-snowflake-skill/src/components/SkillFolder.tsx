import React from 'react';
import {C, FONT, alpha, softRadial} from '../theme';
import {Hairline} from './Glass';
import {SkillIcon} from './Icons';

/**
 * The skill as an object: a violet glass folder with a tab label (typed), a front lid hinged at its bottom
 * edge, paper sheets inside, a violet core glow and a signature-gradient rim. (cx, cy) = centre of the whole
 * folder (tab included). Size scales with `width` (S2 hero ~520, S7 hub ~300, S8 end ~160).
 */
export type SkillFolderProps = {
  cx: number;
  cy: number;
  width?: number;
  /** lid: 0 = closed, 1 = open (front panel tilted ~62deg toward the viewer). Spring values ok. */
  open?: number;
  /** tab label (mono). Omit for no label. */
  label?: string;
  /** typed character count of the label (default: all) */
  labelChars?: number;
  /** show a caret after the typed label (pass a blink boolean) */
  caret?: boolean;
  /** violet core glow 0..1 */
  glow?: number;
  /** white-hot flash over the folder 0..1 (lid snap) */
  flash?: number;
  /** conic edge light orbiting the rim (S8): angle in deg, strength 0..1 */
  edgeLight?: {angle: number; strength: number};
  opacity?: number;
  /** extra transform after centring (e.g. rotateY for the S3 turn, breathing translate) */
  transform?: string;
  /** hide paper sheets */
  noSheets?: boolean;
  /** engraved Playbook / Mappings / Checks icons on the lid (default true) */
  emblem?: boolean;
};

export const folderMetrics = (width = 520) => {
  const tabH = Math.round(width * 0.095);
  const bodyH = Math.round(width * 0.62);
  const height = tabH + bodyH;
  const r = Math.max(6, width * 0.045);
  const frontTop = tabH + Math.round(bodyH * 0.17);
  const labelSize = Math.max(10, width * 0.05);
  return {width, tabH, bodyH, height, r, frontTop, labelSize};
};

export const SkillFolder: React.FC<SkillFolderProps> = ({
  cx,
  cy,
  width = 520,
  open = 0,
  label,
  labelChars,
  caret,
  glow = 0.6,
  flash = 0,
  edgeLight,
  opacity = 1,
  transform,
  noSheets,
  emblem = true,
}) => {
  const m = folderMetrics(width);
  const {tabH, height, r, frontTop, labelSize} = m;
  const W = width;
  const showLabel = label !== undefined && width >= 260;
  const labelW = showLabel ? (label as string).length * 0.6 * labelSize : 0;
  const tabW = Math.min(W * 0.78, Math.max(W * 0.4, labelW + labelSize * 2.2));
  const s = tabH * 1.05; // slant run
  const path = [
    `M ${r} ${height}`,
    `Q 0 ${height} 0 ${height - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    `L ${tabW - s} 0`,
    `C ${tabW - s * 0.45} 0 ${tabW - s * 0.55} ${tabH} ${tabW} ${tabH}`,
    `L ${W - r} ${tabH}`,
    `Q ${W} ${tabH} ${W} ${tabH + r}`,
    `L ${W} ${height - r}`,
    `Q ${W} ${height} ${W - r} ${height}`,
    'Z',
  ].join(' ');
  const gid = `fold-${Math.round(W)}`;
  const openDeg = -62 * open;
  const typed = showLabel ? (label as string).slice(0, labelChars ?? (label as string).length) : '';
  const frontH = height - frontTop;
  return (
    <div
      style={{
        position: 'absolute',
        left: cx - W / 2,
        top: cy - height / 2,
        width: W,
        height,
        opacity,
        transform,
        transformStyle: 'flat',
      }}
    >
      {/* bloom behind (screen) */}
      <div
        style={{
          position: 'absolute',
          left: -W * 0.55,
          top: -height * 0.6,
          width: W * 2.1,
          height: height * 2.2,
          background: softRadial('ellipse 50% 50% at 50% 55%', C.violetGlow, 0.42 * glow + 0.08, 14, 2.4),
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* back plate with tab */}
      <svg width={W} height={height} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        <defs>
          <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" stopColor={alpha(C.violet, 0.34)} />
            <stop offset="0.45" stopColor={alpha(C.violetGlow, 0.2)} />
            <stop offset="1" stopColor={alpha('#1A1240', 0.55)} />
          </linearGradient>
          <linearGradient id={`${gid}-rim`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={alpha('#FFFFFF', 0.5)} />
            <stop offset="0.4" stopColor={alpha(C.violet, 0.45)} />
            <stop offset="1" stopColor={alpha(C.violet, 0.2)} />
          </linearGradient>
        </defs>
        <path d={path} fill="rgba(10,8,24,0.55)" />
        <path d={path} fill={`url(#${gid}-fill)`} stroke={`url(#${gid}-rim)`} strokeWidth={1.2} />
      </svg>
      {/* tab label */}
      {showLabel ? (
        <div
          style={{
            position: 'absolute',
            left: labelSize * 0.95,
            top: 0,
            height: tabH,
            display: 'flex',
            alignItems: 'center',
            fontFamily: FONT.mono,
            fontWeight: 500,
            fontSize: labelSize,
            color: '#EDE6FF',
            letterSpacing: 0,
            whiteSpace: 'pre',
            fontFeatureSettings: '"liga" 0, "calt" 0',
            textShadow: `0 0 14px ${alpha(C.violet, 0.6)}`,
          }}
        >
          {typed}
          {caret ? (
            <span
              style={{
                display: 'inline-block',
                width: labelSize * 0.55,
                height: labelSize * 1.05,
                marginLeft: 2,
                background: C.violet,
                boxShadow: `0 0 10px ${C.violet}`,
                transform: 'translateY(1px)',
              }}
            />
          ) : null}
        </div>
      ) : null}
      {/* inner core glow */}
      <div
        style={{
          position: 'absolute',
          left: W * 0.06,
          top: tabH + 6,
          width: W * 0.88,
          height: height - tabH - 12,
          borderRadius: r,
          background: softRadial('ellipse 60% 55% at 50% 30%', C.violet, 0.55 * glow + 0.05, 12, 2.2),
          mixBlendMode: 'screen',
        }}
      />
      {/* floor shadow */}
      <div
        style={{
          position: 'absolute',
          left: W * 0.08,
          top: height - height * 0.08,
          width: W * 0.84,
          height: height * 0.22,
          background: softRadial('ellipse 50% 50% at 50% 50%', '#000000', 0.55, 10, 2.2),
          pointerEvents: 'none',
        }}
      />
      {/* paper sheets */}
      {noSheets ? null : (
        <>
          <div
            style={{
              position: 'absolute',
              left: W * 0.1,
              top: frontTop - height * 0.1,
              width: W * 0.74,
              height: height * 0.5,
              borderRadius: r * 0.6,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.06))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 -2px 12px rgba(0,0,0,0.25)',
              transform: 'rotate(-2.2deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: W * 0.16,
              top: frontTop - height * 0.065,
              width: W * 0.72,
              height: height * 0.5,
              borderRadius: r * 0.6,
              background: 'linear-gradient(180deg, rgba(236,230,255,0.26), rgba(236,230,255,0.08))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
              transform: 'rotate(1.4deg)',
            }}
          >
            {width >= 260
              ? [0.55, 0.38, 0.47].map((w, k) => (
                  <div
                    key={k}
                    style={{
                      position: 'absolute',
                      left: W * 0.05,
                      top: height * 0.028 + k * height * 0.028,
                      width: W * 0.72 * w,
                      height: Math.max(2, height * 0.011),
                      borderRadius: 3,
                      background: alpha(C.violet, 0.55),
                    }}
                  />
                ))
              : null}
          </div>
        </>
      )}
      {/* bloom at the opening: light from inside, brighter as the lid opens */}
      <div
        style={{
          position: 'absolute',
          left: W * 0.02,
          top: frontTop - height * 0.26,
          width: W * 0.96,
          height: height * 0.46,
          background: softRadial('ellipse 50% 50% at 50% 55%', C.violet, (0.28 + 0.4 * Math.min(1, Math.max(0, open))) * glow, 12, 2.4),
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* front lid, hinged at the bottom edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: frontTop,
          width: W,
          height: frontH,
          transformOrigin: '50% 100%',
          transform: `perspective(${Math.round(W * 2.6)}px) rotateX(${openDeg.toFixed(2)}deg)`,
          borderRadius: r,
          background: [
            'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 22%, rgba(255,255,255,0.0) 60%)',
            `linear-gradient(172deg, ${alpha(C.violet, 0.36)} 0%, ${alpha(C.violetGlow, 0.22)} 38%, ${alpha('#1A1045', 0.8)} 100%)`,
            'rgba(10,8,26,0.62)',
          ].join(', '),
          boxShadow: `0 -1px 0 ${alpha('#FFFFFF', 0.08)}, inset 0 1px 0 ${alpha('#FFFFFF', 0.28)}, 0 30px 60px -20px rgba(0,0,0,0.8), 0 0 ${Math.round(W * 0.08)}px ${alpha(C.violetGlow, 0.25 * glow)}`,
        }}
      >
        {/* diagonal specular band */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: r,
            background: 'linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(255,255,255,0.07) 30%, rgba(255,255,255,0.015) 42%, rgba(255,255,255,0) 60%)',
          }}
        />
        {/* light escaping from inside along the lid's top edge */}
        <div
          style={{
            position: 'absolute',
            left: W * 0.06,
            right: W * 0.06,
            top: -1,
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, ${alpha(C.violet, 0)} 0%, ${alpha('#E9E1FF', 0.95)} 30%, #FFFFFF 50%, ${alpha('#E9E1FF', 0.95)} 70%, ${alpha(C.violet, 0)} 100%)`,
            boxShadow: `0 0 ${Math.round(W * 0.03)}px ${alpha(C.violet, 0.9 * (0.4 + 0.6 * glow))}, 0 0 ${Math.round(W * 0.08)}px ${alpha(C.violetGlow, 0.6 * (0.4 + 0.6 * glow))}`,
          }}
        />
        <Hairline
          radius={r}
          width={Math.max(1.2, W / 260)}
          color={`linear-gradient(115deg, ${C.ember} 0%, ${C.emberGlow} 28%, ${C.whiteHot} 50%, ${C.iceGlow} 72%, ${C.ice} 100%)`}
          opacity={0.95}
        />
        {emblem ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '58%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              gap: W * 0.05,
              opacity: 0.85,
            }}
          >
            {(['playbook', 'mappings', 'checks'] as const).map((k) => (
              <SkillIcon key={k} kind={k} size={W * 0.085} color={alpha('#D9CCFF', 0.8)} strokeWidth={W < 240 ? 4.5 : 3} glow={0.9} />
            ))}
          </div>
        ) : null}
        {edgeLight && edgeLight.strength > 0 ? (
          <>
            <Hairline
              radius={r}
              width={Math.max(1.5, W / 90)}
              opacity={edgeLight.strength}
              color={`conic-gradient(from ${edgeLight.angle}deg at 50% 50%, rgba(255,255,255,0) 0deg, ${alpha(C.whiteHot, 0.2)} 20deg, ${C.whiteHot} 44deg, ${alpha(C.iceGlow, 0.5)} 60deg, rgba(255,255,255,0) 90deg, rgba(255,255,255,0) 360deg)`}
            />
            <div
              style={{
                position: 'absolute',
                inset: -W * 0.06,
                borderRadius: r * 2,
                opacity: 0.55 * edgeLight.strength,
                background: `conic-gradient(from ${edgeLight.angle}deg at 50% 50%, rgba(0,0,0,0) 0deg, ${alpha(C.whiteHot, 0.0)} 10deg, ${alpha(C.iceGlow, 0.5)} 44deg, rgba(0,0,0,0) 80deg, rgba(0,0,0,0) 360deg)`,
                WebkitMaskImage: `radial-gradient(closest-side, transparent 78%, #000 92%, transparent 100%)`,
                maskImage: `radial-gradient(closest-side, transparent 78%, #000 92%, transparent 100%)`,
                pointerEvents: 'none',
              }}
            />
          </>
        ) : null}
      </div>
      {/* flash */}
      {flash > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: -W * 0.4,
            top: -height * 0.5,
            width: W * 1.8,
            height: height * 2,
            background: softRadial('ellipse 50% 50% at 50% 55%', C.whiteHot, 0.95 * flash, 12, 2.8),
            mixBlendMode: 'screen',
          }}
        />
      ) : null}
    </div>
  );
};
