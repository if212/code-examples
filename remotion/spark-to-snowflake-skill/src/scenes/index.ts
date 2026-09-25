import React from 'react';
import type {SceneId} from '../timeline';
import {S1} from './S1';
import {S2} from './S2';
import {S3} from './S3';
import {S4} from './S4';
import {S5} from './S5';
import {S6} from './S6';
import {S7} from './S7';
import {S8} from './S8';

export const SCENE_COMPONENTS: Record<SceneId, React.FC> = {S1, S2, S3, S4, S5, S6, S7, S8};
