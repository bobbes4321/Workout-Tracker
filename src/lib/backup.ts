import { db } from './db'
import type {
  Exercise,
  WorkoutSet,
  Goal,
  Activity,
  BodyweightEntry,
  Setting,
} from './types'

interface Backup {
  app: 'workout-tracker'
  /** 1 = original (exercises/sets/goals). 2 adds activities/bodyweights/settings. */
  version: 1 | 2
  exportedAt: string
  exercises: Exercise[]
  sets: WorkoutSet[]
  goals: Goal[]
  activities?: Activity[]
  bodyweights?: BodyweightEntry[]
  settings?: Setting[]
}

export async function exportData(): Promise<void> {
  const [exercises, sets, goals, activities, bodyweights, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.sets.toArray(),
      db.goals.toArray(),
      db.activities.toArray(),
      db.bodyweights.toArray(),
      db.settings.toArray(),
    ])
  const backup: Backup = {
    app: 'workout-tracker',
    version: 2,
    exportedAt: new Date().toISOString(),
    exercises,
    sets,
    goals,
    activities,
    bodyweights,
    settings,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = backup.exportedAt.slice(0, 10)
  a.href = url
  a.download = `workout-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  exercises: number
  sets: number
  goals: number
  activities: number
  bodyweights: number
}

/**
 * Replace the whole database with the contents of a backup file. Tolerates v1
 * files (no activities/bodyweights/settings). Returns counts of imported records.
 */
export async function importData(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<Backup>
  if (data.app !== 'workout-tracker' || !Array.isArray(data.exercises)) {
    throw new Error('This file does not look like a workout backup.')
  }
  await db.transaction(
    'rw',
    [db.exercises, db.sets, db.goals, db.activities, db.bodyweights, db.settings],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.sets.clear(),
        db.goals.clear(),
        db.activities.clear(),
        db.bodyweights.clear(),
        db.settings.clear(),
      ])
      await db.exercises.bulkAdd(data.exercises ?? [])
      await db.sets.bulkAdd(data.sets ?? [])
      await db.goals.bulkAdd(data.goals ?? [])
      await db.activities.bulkAdd(data.activities ?? [])
      await db.bodyweights.bulkAdd(data.bodyweights ?? [])
      if (data.settings?.length) await db.settings.bulkPut(data.settings)
    },
  )
  return {
    exercises: data.exercises?.length ?? 0,
    sets: data.sets?.length ?? 0,
    goals: data.goals?.length ?? 0,
    activities: data.activities?.length ?? 0,
    bodyweights: data.bodyweights?.length ?? 0,
  }
}
