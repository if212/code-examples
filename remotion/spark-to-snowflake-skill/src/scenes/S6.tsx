import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Caption, Headline, SkillDock, Spotlight} from '../components';
import {C} from '../theme';
import {SKILL_DOCK} from '../layout';
import {COPY} from '../demoData';
import {bell, ramp} from '../motion';
import {PushIn, StatsExit} from './s6/PushIn';
import {PanelShot} from './s6/PanelShot';
import {DOCK_MAPPINGS} from './s6/geometry';
import {T6} from './s6/timing';

/**
 * S6 — WHY IT'S TRUSTWORTHY: "It knows the traps." Global f750-885 (135f).
 * S5's reviewed board continues for one frame, then the camera pushes into latest_customers.sql (the S1
 * 'missed one'). The tile comes into focus, then flattens into a code panel with one line of SQL. On the
 * right a 3-pill stack shows which row wins: on Spark the newest date; copied as-is to Snowflake the NULL
 * row jumps to the top ('wrong row'). A violet 'from Mappings' chip slides in from the skill dock,
 * ' NULLS LAST' types in mint, and the NULL row drops back down ('right row'). Hold from lf110.
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

      {/* S5's stat chips leave with the push */}
      <StatsExit f={f} />

      {/* headlines + sub-caption (outside every camera) */}
      {f < 12 ? <Headline text={COPY.s5b} keyWord="review" enterAt={-100} exitAt={0} /> : null}
      <Headline text={COPY.s6} keyWord="traps" enterAt={T6.headline} />
      <Caption text={COPY.s6Sub} enterAt={T6.sub} keyWord="NULLs" keyGradient="frost" />
    </AbsoluteFill>
  );
};
