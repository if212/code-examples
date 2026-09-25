import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CheckMark} from '../../components';
import {C, FONT, TONES, alpha, softRadial} from '../../theme';
import {TRIPTYCH} from '../../layout';
import {COPY} from '../../demoData';
import {clamp01} from '../../motion';

/**
 * The '✓ match' ticket that slides out of the Checks panel's bottom slot: the check script ran inside the
 * sealed panel and only this result comes back. Drawn as an SVG ticket (side notches, tear line) in camera
 * space, clipped at the panel's bottom edge so it appears to leave the slot.
 */

export const TICKET = {w: 196, h: 64, hide: 12, notch: 8} as const;

/** '✓ match' -> 'match' (the tick is drawn as a stroke icon, never a fallback glyph). */
const TICKET_WORD = COPY.s3Ticket.replace(/^\s*✓\s*/, '');

const ticketPath = (w: number, h: number, r: number, ny: number, nr: number): string =>
  [
    `M ${r} 0`,
    `H ${w - r}`,
    `Q ${w} 0 ${w} ${r}`,
    `V ${ny - nr}`,
    `A ${nr} ${nr} 0 0 0 ${w} ${ny + nr}`,
    `V ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `Q 0 ${h} 0 ${h - r}`,
    `V ${ny + nr}`,
    `A ${nr} ${nr} 0 0 0 0 ${ny - nr}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');

export const MatchTicket: React.FC<{
  /** slide 0..1 (SNAP spring ok) */
  p: number;
  /** check draw 0..1 */
  draw: number;
  /** extra glow 0..1 */
  glow?: number;
}> = ({p, draw, glow = 0}) => {
  if (p <= 0.001) return null;
  const {w, h, hide, notch} = TICKET;
  const top = -h + (h - hide) * p;
  const ny = hide + (h - hide) / 2;
  const d = ticketPath(w, h, 12, ny, notch);
  const mint = TONES.mint;
  const panelLeft = TRIPTYCH.panelX(2);
  const panelBottom = TRIPTYCH.top + TRIPTYCH.panelH;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* glow under the ticket */}
      <div
        style={{
          position: 'absolute',
          left: panelLeft + TRIPTYCH.panelW / 2 - 190,
          top: panelBottom + top + hide - 50,
          width: 380,
          height: h + 80,
          opacity: clamp01(p),
          background: softRadial('ellipse 50% 50% at 50% 50%', C.mint, 0.16 + 0.14 * glow, 12, 2.4),
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: panelLeft,
          top: panelBottom,
          width: TRIPTYCH.panelW,
          height: h + 40,
          overflow: 'hidden',
        }}
      >
        <div style={{position: 'absolute', left: (TRIPTYCH.panelW - w) / 2, top, width: w, height: h}}>
          <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
            <defs>
              <linearGradient id="s3-ticket-fill" x1="0" y1="0" x2="0.3" y2="1">
                <stop offset="0" stopColor={alpha(C.mint, 0.3)} />
                <stop offset="1" stopColor={alpha(C.mint, 0.12)} />
              </linearGradient>
              <linearGradient id="s3-ticket-rim" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={alpha(mint.glow, 0.95)} />
                <stop offset="0.5" stopColor={alpha(C.mint, 0.6)} />
                <stop offset="1" stopColor={alpha(C.mint, 0.35)} />
              </linearGradient>
            </defs>
            <path d={d} fill="rgba(6,14,12,0.9)" />
            <path d={d} fill="url(#s3-ticket-fill)" stroke="url(#s3-ticket-rim)" strokeWidth={1.3} />
            {/* tear line just under the slot */}
            <path d={`M ${notch + 10} ${hide + 7} H ${w - notch - 10}`} stroke={alpha(C.mint, 0.4)} strokeWidth={1.2} strokeDasharray="3 5" strokeLinecap="round" />
            {/* inset top highlight on the visible part */}
            <path d={`M 14 ${hide + 1.2} H ${w - 14}`} stroke={alpha('#FFFFFF', 0.1)} strokeWidth={1} />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: ny - 20 + 3,
              width: w,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <CheckMark size={30} color={C.mint} strokeWidth={2.8} draw={draw} style={{filter: `drop-shadow(0 0 6px ${alpha(C.mint, 0.7)})`}} />
            <span
              style={{
                fontFamily: FONT.display,
                fontWeight: 600,
                fontSize: 26,
                color: mint.text,
                letterSpacing: '-0.005em',
                lineHeight: 1,
                transform: 'translateY(0.02em)',
                textShadow: `0 0 16px ${alpha(C.mint, 0.45)}`,
              }}
            >
              {TICKET_WORD}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
