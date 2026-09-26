import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Caption, Headline, SkillDock, Spotlight} from '../components';
import {C} from '../theme';
import {SKILL_DOCK} from '../layout';
import {COPY} from '../demoData';
import {bell, ramp} from '../motion';
import {PushIn} from './s6/PushIn';
import {PanelShot} from './s6/PanelShot';
import {DOCK_MAPPINGS} from './s6/geometry';
import {T6} from './s6/timing';

/**
 * S6 — WHY IT'S TRUSTWORTHY: "It knows the traps." Global f750-885 (135f).
 * S5's reviewed board continues, latest_customers.sql comes into focus with a violet ring and the camera
 * accelerates into it (log-space zoom with an ease-in head). The tile flattens into a code panel with one line
 * of SQL, ONE label chip ('Spark SQL') and a quiet 'missed by hand' callback to S1 on the filename. On the right
 * a 3-pill stack shows which row wins: on Spark the newest date ('right row'). The sub-caption says why BEFORE
 * anything changes; then one change: copied as-is to Snowflake the NULL row rises to the top ('wrong row') and
 * holds. A violet 'from Mappings' chip slides in from the skill dock, ' NULLS LAST' types in mint, the NULL row
 * drops back down ('right row'), the chip settles on a check + 'on Snowflake' and the header tag turns to a mint
 * 'caught'. The fixed state holds from lf88 (~1.6s). Timings: s6/timing.ts.
 */

const LIT_ALL = {playbook: 1, mappings: 1, checks: 1};

export const S6: React.FC = () => {
  const f = useCurrentFrame();
  const dockGlow = bell(ramp(f, T6.mappings - 4, T6.mappings + 20));

  return (
    <AbsoluteFill>
      {/* hero 1: S5's board, pushed into (its own nested cameras continue S5's shot camera) */}
      <PushIn f={f} />

      {/* the skill dock stays put from S5; its Mappings cell pulses as the chip leaves */}
      {dockGlow > 0.001 ? (
        <Spotlight cx={SKILL_DOCK.x1 - 10} cy={DOCK_MAPPINGS.y} rx={240} ry={200} color={C.violet} intensity={0.4 * dockGlow} />
      ) : null}
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        <SkillDock lit={LIT_ALL} pulse={{mappings: ramp(f, T6.mappings, T6.mappings + 16)}} />
      </AbsoluteFill>

      {/* hero 2: the flat code panel, the result stack and the 'from Mappings' chip */}
      <PanelShot f={f} />

      {/* headlines + sub-caption (outside every camera) */}
      {f < 12 ? <Headline text={COPY.s5b} keyWord="review" enterAt={-100} exitAt={0} /> : null}
      <Headline text={COPY.s6} keyWord="traps" enterAt={T6.headline} />
      <Caption text={COPY.s6Sub} enterAt={T6.sub} keyWord="NULLs" keyGradient="frost" />
    </AbsoluteFill>
  );
};
