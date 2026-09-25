import React from 'react';
import {Camera, drift} from '../../components';
import {sceneById} from '../../timeline';
import {CodeColumn, PanelBox} from './CodePanel';
import {RowStack} from './RowStack';
import {MappingsChip} from './MappingsChip';

/**
 * The S6 panel shot: morph box, code column, result stack and the 'from Mappings' chip under one gentle
 * drift camera. Pure function of the S6 local frame `f`.
 *
 * S6EndPanel renders the exact state S6 hands off at the cut to S7 (all settled, caret gone), so S7 can
 * start its pull-back from the same picture (e.g. fade/shrink it over its first frames).
 */

export const S6_DURATION = sceneById('S6').duration;

/** gentle shot drift (no rotation: everything here must stay crisp), zeroed at lf0 */
export const panelCamAt = (f: number) => {
  const d0 = drift(0, S6_DURATION, 'S6', 0.012);
  const d = drift(f, S6_DURATION, 'S6', 0.012);
  return {scale: d.scale, rotate: 0, x: 0.5 * (d.x - d0.x), y: 0.5 * (d.y - d0.y)};
};

export const PanelShot: React.FC<{f: number}> = ({f}) => (
  <Camera drift={panelCamAt(f)}>
    <PanelBox f={f} />
    <CodeColumn f={f} />
    <RowStack f={f} />
    <MappingsChip f={f} />
  </Camera>
);

/** S6's final picture (the frame right after S6's last frame), for S7's first frames. */
export const S6EndPanel: React.FC = () => <PanelShot f={S6_DURATION} />;
