import {COPY} from '../../demoData';

/**
 * S3 on-screen copy that differs from demoData.COPY (which scene builders may not edit).
 *
 * Headline: review round 1 asked for a typographic apostrophe ("That’s", U+2019) instead of the straight
 * typewriter one, which looks unfinished at 120px next to the serif-italic 'skill'. The conversion is a no-op
 * once COPY.s3 itself is fixed. S4 re-renders this headline for its lf0-10 exit, so it should use S3_HEADLINE
 * (or COPY.s3 should be fixed) to keep the glyph identical across the cut.
 */
export const S3_HEADLINE = COPY.s3.replace(/'/g, '’');

/**
 * Sub-caption: the film has no audio, so nothing on screen said that an AI agent is the one who uses the
 * folder. This names the actor in plain words and calls back to S2's 'Write the know-how once.'
 * Promote it to COPY.s3Sub when the shared data is next edited (it is picked up from there if present).
 */
const FALLBACK_SUB = 'Know-how your AI agent follows.';
export const S3_SUB: string = (COPY as unknown as Record<string, string | undefined>).s3Sub ?? FALLBACK_SUB;
/** Words in S3_SUB drawn in the violet key gradient (same treatment as S4's sub-caption). */
export const S3_SUB_KEY = ['AI', 'agent'];
