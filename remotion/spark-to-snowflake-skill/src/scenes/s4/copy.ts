/**
 * S4 on-screen copy that differs from demoData.COPY (which scene builders may not edit).
 *
 * Sub-caption: review round 1 found 'Only the matching skill opens.' (COPY.s4Sub) too abstract for a newcomer: it
 * has no actor. Review round 2 found the 7-word r1 line ('Your AI agent picks the matching skill.') too long for
 * its screen time. This 6-word line keeps the actor (S3's sub-caption already said 'your AI agent', so 'AI' can
 * go; a bare 'It' would be ambiguous right after 'Just ask.') and the storyboard VO's meaning ("Your agent opens
 * the skill that matches"). Promote it to COPY.s4Sub when the shared data is next edited.
 */
export const S4_SUB = 'Your agent picks the matching skill.';
/** Word in S4_SUB drawn in the violet key gradient (ties it to the violet 'matched' tag). */
export const S4_SUB_KEY = 'matching';

/**
 * Small uppercase label over the shelf (review r2): without it a newcomer does not know the four one-line cards
 * are the skills the agent has installed. Promote it to COPY when the shared data is next edited.
 */
export const SHELF_LABEL = 'Your skills';
