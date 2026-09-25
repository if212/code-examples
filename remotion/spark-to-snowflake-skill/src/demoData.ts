import {C} from './theme';

/**
 * Every count in the film comes from here (storyboard terminalTranscript / accuracyNotes).
 * Never type a number into a scene: derive it from these constants.
 */

export type JobOutcome = 'converted' | 'needYou';

export type Job = {
  index: number;
  file: string;
  outcome: JobOutcome;
  /** true only for latest_customers.sql: missed in S1, caught by the skill in S5/S6 */
  trap?: boolean;
};

/** 12 job filenames in row-major board order (index 0 = top-left). */
export const JOB_FILES = [
  'daily_sales.py',
  'orders_clean.py',
  'latest_customers.sql',
  'events_stream.py',
  'fx_rates.py',
  'refunds.py',
  'inventory.py',
  'churn_model.py',
  'sessions_daily.py',
  'top_products.py',
  'returns_weekly.py',
  'revenue_by_region.py',
] as const;

/** Tile index of latest_customers.sql: the S1 'missed one' tile and the S6 NULLS LAST trap. */
export const TRAP_INDEX = 2;
/** The tile the S1 cursor leaves with an empty dashed slot + coral 'missed one' tag. */
export const MISSED_INDEX = TRAP_INDEX;
/** Tiles that land amber with 'Needs you' in S5: events_stream.py (3), churn_model.py (7). */
export const NEED_YOU_INDICES = [3, 7] as const;

export const JOBS: Job[] = JOB_FILES.map((file, index) => ({
  index,
  file,
  outcome: (NEED_YOU_INDICES as readonly number[]).includes(index) ? 'needYou' : 'converted',
  trap: index === TRAP_INDEX ? true : undefined,
}));

/** Indices of the 10 converted tiles, row-major. */
export const CONVERTED_INDICES = JOBS.filter((j) => j.outcome === 'converted').map((j) => j.index);

export const COUNTS = {
  jobs: JOBS.length, // 12
  converted: CONVERTED_INDICES.length, // 10
  needYou: NEED_YOU_INDICES.length, // 2
  checksPassed: CONVERTED_INDICES.length, // 10
  checksTotal: CONVERTED_INDICES.length, // 10  -> "10/10 match · test data"
} as const;

/** S1 chips stamped on each tile by hand. */
export const FIX_CHIPS = ['Rewrite', 'Fix', 'Test'] as const;
/** On the missed tile, this slot stays an empty dashed outline. */
export const MISSED_CHIP_SLOT = 1;

/** The skill. */
export const SKILL_NAME = 'spark-to-snowflake';
export const SKILL_FOLDER_LABEL = 'spark-to-snowflake/';
export const SKILL_DESCRIPTION = 'Migrate Spark jobs to Snowflake';

/** S3 triptych panels (also the micro-icon row on the shelf card and the S5 dock). */
export const SKILL_PARTS = [
  {key: 'playbook', title: 'Playbook', gloss: 'Steps to follow', hint: 'SKILL.md'},
  {key: 'mappings', title: 'Mappings', gloss: 'Spark → Snowflake', hint: 'references/'},
  {key: 'checks', title: 'Checks', gloss: 'Old vs new must match', hint: 'scripts/'},
] as const;
export type SkillPartKey = (typeof SKILL_PARTS)[number]['key'];

/** S4 shelf: 4 installed skills, one-line each. Slot 2 is ours. */
export const SHELF = [
  {name: 'pdf-reports', description: 'Build PDF reports'},
  {name: 'api-tests', description: 'Write API tests'},
  {name: SKILL_NAME, description: SKILL_DESCRIPTION},
  {name: 'release-notes', description: 'Draft release notes'},
] as const;
export const MATCHED_SHELF_INDEX = 2;

/** S4 prompt + status line. */
export const PROMPT_TEXT = 'Migrate ./jobs to Snowflake'; // 27 chars
export const PROMPT_GLYPH = '›'; // static '›'
export const PROMPT_GLOW_WORDS = ['Migrate', 'Snowflake'] as const;
export const STATUS_LINE = `Loaded skill: ${SKILL_NAME}`;

/** S6 code moment. */
export const CODE_BEFORE = 'ORDER BY updated_at DESC';
export const CODE_INSERT = ' NULLS LAST';
export const CODE_TOKENS = [
  {text: 'ORDER BY', color: C.sqlKeyword},
  {text: ' ', color: C.identifier},
  {text: 'updated_at', color: C.identifier},
  {text: ' ', color: C.identifier},
  {text: 'DESC', color: C.sqlKeyword},
] as const;
/** Pill stack order on Spark (newest dated row wins). */
export const ROW_PILLS = ['Sep 01', 'Aug 15', 'NULL'] as const;

/** S7 team. Each teammate board lands exactly one amber tile (seeded, fixed here). */
export const TEAMMATES = [
  {name: 'You', color: C.frost, board: 'you', amberTiles: [...NEED_YOU_INDICES] as number[]},
  {name: 'Leo', color: C.pink, board: 'leo', amberTiles: [5]},
  {name: 'Priya', color: C.lime, board: 'priya', amberTiles: [9]},
  {name: 'Sam', color: C.silver, board: 'sam', amberTiles: [1]},
] as const;

/** Text strings used on screen (single source). */
export const COPY = {
  s1a: '12 Spark jobs.',
  s1b: 'Same fixes. Every job.',
  s1Stamp: 'again',
  s1Missed: 'missed one',
  s2: 'Write the know-how once.',
  s3: "That's an agent skill.",
  s3Ticket: '✓ match',
  s4: 'Just ask.',
  s4Sub: 'Only the matching skill opens.',
  s4Tag: 'matched',
  s5a: 'Converted. And checked.',
  s5b: 'It converts. You review.',
  needYou: 'Needs you',
  s6: 'It knows the traps.',
  s6Sub: 'Spark and Snowflake sort NULLs differently.',
  s6LabelBefore: 'Spark SQL',
  s6LabelAfter: 'as-is on Snowflake',
  s6StackBefore: 'on Spark',
  s6StackAfter: 'as-is on Snowflake',
  s6Wrong: 'wrong row',
  s6Right: 'right row',
  s6Chip: 'from Mappings',
  s7: 'Same playbook. Whole team.',
  s7Chip: 'shared in your repo',
  s8: 'Migration, as a skill.',
  s8Sub: 'Write once. Reuse on every job.',
  s8Mono: 'spark-to-snowflake/ · playbook · mappings · checks',
  s8Footnote: 'Illustrative demo. Some Spark code needs a redesign, not a conversion. Validate on your own workload.',
  demoChip: 'DEMO PROJECT',
} as const;

/** Stat chips (S5). */
export const STATS = [
  {tone: 'ice' as const, value: COUNTS.converted, label: 'converted'},
  {tone: 'mint' as const, value: COUNTS.checksPassed, of: COUNTS.checksTotal, label: 'match', note: 'test data'},
  {tone: 'amber' as const, value: COUNTS.needYou, label: 'need you'},
];
