import Dexie, { type Table } from 'dexie'
import type {
  Exercise,
  WorkoutSet,
  Goal,
  Activity,
  BodyweightEntry,
  Setting,
  Snapshot,
} from './types'

export class WorkoutDB extends Dexie {
  exercises!: Table<Exercise, number>
  sets!: Table<WorkoutSet, number>
  goals!: Table<Goal, number>
  activities!: Table<Activity, number>
  bodyweights!: Table<BodyweightEntry, number>
  settings!: Table<Setting, string>
  snapshots!: Table<Snapshot, number>

  constructor() {
    super('workout-tracker')
    this.version(1).stores({
      // Indexes. '++id' = auto-increment primary key.
      exercises: '++id, name, category, archived',
      sets: '++id, exerciseId, date, [exerciseId+date]',
      goals: '++id, exerciseId, achievedAt',
    })
    // v2: bouldering/activity log, bodyweight log, and a key/value settings store.
    this.version(2).stores({
      exercises: '++id, name, category, archived',
      sets: '++id, exerciseId, date, [exerciseId+date]',
      goals: '++id, exerciseId, achievedAt',
      activities: '++id, date, type',
      bodyweights: '++id, date',
      settings: 'key',
    })
    // v3: automatic on-device snapshots (additive — new table only).
    this.version(3).stores({
      exercises: '++id, name, category, archived',
      sets: '++id, exerciseId, date, [exerciseId+date]',
      goals: '++id, exerciseId, achievedAt',
      activities: '++id, date, type',
      bodyweights: '++id, date',
      settings: 'key',
      snapshots: '++id, createdAt, reason',
    })
  }
}

export const db = new WorkoutDB()

/**
 * Ask the browser to keep our IndexedDB from being evicted under storage
 * pressure. For installed/engaged PWAs this is usually granted without a
 * prompt. Safe to call on every startup; resolves to whether storage is now
 * persistent (false if the API is unsupported, e.g. older Safari).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

/** Upsert a single preference. */
export function putSetting(key: string, value: number | string | boolean) {
  return db.settings.put({ key, value })
}

const STARTER_EXERCISES: Array<
  Pick<Exercise, 'name' | 'category'> & { bodyweightBased?: 0 | 1 }
> = [
  { name: 'Barbell Incline Bench', category: 'Chest' },
  { name: 'Dumbbell Neutral Bench', category: 'Chest' },
  { name: 'Dumbbell Incline Press', category: 'Chest' },
  { name: 'Shoulder Press', category: 'Shoulders' },
  { name: 'Lateral Raises (Dumbbell)', category: 'Shoulders' },
  { name: 'Lateral Raises (Cable)', category: 'Shoulders' },
  { name: 'Cable Rows', category: 'Back' },
  { name: 'Pull-ups', category: 'Back', bodyweightBased: 1 },
  { name: 'Deadlift', category: 'Legs' },
  { name: 'Squats', category: 'Legs' },
  { name: 'Tricep Pushdown', category: 'Arms' },
  { name: 'Preacher Curl', category: 'Arms' },
  { name: 'Lying Down Curl', category: 'Arms' },
  { name: 'Ab Cable Crunches', category: 'Core' },
]

/** Permanently delete all data and re-seed the starter exercise list. */
export async function clearAllData() {
  await db.transaction(
    'rw',
    [db.exercises, db.sets, db.goals, db.activities, db.bodyweights, db.settings],
    async () => {
      await Promise.all([
        db.sets.clear(),
        db.goals.clear(),
        db.exercises.clear(),
        db.activities.clear(),
        db.bodyweights.clear(),
        db.settings.clear(),
      ])
    },
  )
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
