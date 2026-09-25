import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setConcurrency(4);
// Proper yuv420p / tv-range / bt709 tags (default output was yuvj420p full-range bt470bg).
Config.setColorSpace('bt709');
