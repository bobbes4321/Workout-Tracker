export interface Exercise {
  id?: number
  name: string
  /** Muscle group / category, e.g. "Chest", "Back", "Legs". */
  category: string
  /** Default unit for this exercise. */
  unit: 'kg' | 'lb'
  createdAt: number
  /** Soft-archive instead of deleting so historical sets keep their name. */
  archived?: 0 | 1
  /** Free-text setup notes — safety-bar heights, seat/pin positions, stance, etc. */
  setup?: string
  /** Preferred weight increment for the +/- steppers (default 2.5). */
  weightStep?: number
  /**
   * If 1, the logged `weight` is *added* load on top of bodyweight (e.g. a
   * weighted pull-up; 0 = pure bodyweight). Metrics (e1RM, PRs, goals, charts)
   * use the effective load — added + your bodyweight on that date — so reps at
   * bodyweight still count as progress. Non-indexed; no migration needed.
   */
  bodyweightBased?: 0 | 1
}

export interface WorkoutSet {
  id?: number
  exerciseId: number
  /** Session date as YYYY-MM-DD (local). Sets are grouped into a session by date. */
  date: string
  weight: number
  reps: number
  /** Optional per-set note, e.g. "felt strong", "to failure". */
  note?: string
  createdAt: number
}

export type GoalMetric = 'weight' | 'e1rm' | 'reps'

export interface Goal {
  id?: number
  exerciseId: number
  metric: GoalMetric
  target: number
  /** Optional rep context for a "reps" goal or weight context. */
  atWeight?: number
  createdAt: number
  achievedAt?: number
}

/** A non-lift training activity (no weight×reps), e.g. a bouldering session. */
export interface Activity {
  id?: number
  type: ActivityType
  /** YYYY-MM-DD (local). Grouped into a day like sets are. */
  date: string
  /** Optional session length in minutes. */
  durationMin?: number
  note?: string
  createdAt: number
}

export type ActivityType = 'bouldering'

/** A bodyweight measurement on a given day. */
export interface BodyweightEntry {
  id?: number
  /** YYYY-MM-DD (local). At most one entry per day (latest wins). */
  date: string
  weight: number
  createdAt: number
}

/** Tiny key/value store for app preferences (kept in Dexie so backups carry it). */
export interface Setting {
  key: string
  value: number | string | boolean
}

/** What triggered an automatic snapshot — drives its label and is not pruned differently. */
export type SnapshotReason =
  | 'daily'
  | 'manual'
  | 'pre-import'
  | 'pre-clear'
  | 'pre-restore'

export interface SnapshotCounts {
  exercises: number
  sets: number
  goals: number
  activities: number
  bodyweights: number
}

/**
 * A point-in-time on-device backup (see lib/backup.ts). Lives in its own Dexie
 * table so it survives an import/restore of the data tables. `data` is a whole
 * serialized backup file restored verbatim; `counts` is cached for display.
 */
export interface Snapshot {
  id?: number
  createdAt: number
  reason: SnapshotReason
  data: string
  counts: SnapshotCounts
}

/** How many automatic snapshots to retain on-device (newest win). */
export const MAX_SNAPSHOTS = 10

export const SETTING_WEEKLY_TARGET = 'weeklyTarget'
export const DEFAULT_WEEKLY_TARGET = 4

export const CATEGORIES = [
  'Chest',
  'Back',
  'Shoulders',
  'Legs',
  'Arms',
  'Core',
  'Other',
] as const

export type Category = (typeof CATEGORIES)[number]

/** Per-activity metadata: how it's labelled and which muscle groups it covers. */
export const ACTIVITY_INFO: Record<
  ActivityType,
  { label: string; icon: string; categories: Category[] }
> = {
  bouldering: {
    label: 'Bouldering',
    icon: '🧗',
    // Counts as pulling/back, arm and core work for muscle-group coverage.
    categories: ['Back', 'Arms', 'Core'],
  },
}
