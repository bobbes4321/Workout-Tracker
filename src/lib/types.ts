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
