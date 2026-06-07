import Dexie, { type Table } from 'dexie'
import type { Exercise, WorkoutSet, Goal } from './types'

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, number>
  sets!: Table<WorkoutSet, number>
  goals!: Table<Goal, number>

  constructor() {
    super('workout-tracker')
    this.version(1).stores({
      // Indexes. '++id' = auto-increment primary key.
      exercises: '++id, name, category, archived',
      sets: '++id, exerciseId, date, [exerciseId+date]',
      goals: '++id, exerciseId, achievedAt',
    })
  }
}

export const db = new WorkoutDB()

const STARTER_EXERCISES: Array<Pick<Exercise, 'name' | 'category'>> = [
  { name: 'Barbell Incline Bench', category: 'Chest' },
  { name: 'Dumbbell Neutral Bench', category: 'Chest' },
  { name: 'Dumbbell Incline Press', category: 'Chest' },
  { name: 'Shoulder Press', category: 'Shoulders' },
  { name: 'Lateral Raises (Dumbbell)', category: 'Shoulders' },
  { name: 'Lateral Raises (Cable)', category: 'Shoulders' },
  { name: 'Cable Rows', category: 'Back' },
  { name: 'Pull-ups', category: 'Back' },
  { name: 'Deadlift', category: 'Legs' },
  { name: 'Squats', category: 'Legs' },
  { name: 'Tricep Pushdown', category: 'Arms' },
  { name: 'Preacher Curl', category: 'Arms' },
  { name: 'Lying Down Curl', category: 'Arms' },
  { name: 'Ab Cable Crunches', category: 'Core' },
]

/** Permanently delete all data and re-seed the starter exercise list. */
export async function clearAllData() {
  await db.transaction('rw', db.exercises, db.sets, db.goals, async () => {
    await Promise.all([db.sets.clear(), db.goals.clear(), db.exercises.clear()])
  })
  await seedIfEmpty()
}

/** Seed a fresh database with a sensible starter exercise list (runs once). */
export async function seedIfEmpty() {
  const count = await db.exercises.count()
  if (count > 0) return
  const now = Date.now()
  await db.exercises.bulkAdd(
    STARTER_EXERCISES.map((e) => ({
      ...e,
      unit: 'kg' as const,
      createdAt: now,
      archived: 0 as const,
    })),
  )
}
