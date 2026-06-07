import { db } from './db'
import type { Exercise, WorkoutSet, Goal } from './types'

interface Backup {
  app: 'workout-tracker'
  version: 1
  exportedAt: string
  exercises: Exercise[]
  sets: WorkoutSet[]
  goals: Goal[]
}

export async function exportData(): Promise<void> {
  const [exercises, sets, goals] = await Promise.all([
    db.exercises.toArray(),
    db.sets.toArray(),
    db.goals.toArray(),
  ])
  const backup: Backup = {
    app: 'workout-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    sets,
    goals,
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
}

/**
 * Replace the whole database with the contents of a backup file.
 * Returns counts of imported records.
 */
export async function importData(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<Backup>
  if (data.app !== 'workout-tracker' || !Array.isArray(data.exercises)) {
    throw new Error('This file does not look like a workout backup.')
  }
  await db.transaction('rw', db.exercises, db.sets, db.goals, async () => {
    await Promise.all([db.exercises.clear(), db.sets.clear(), db.goals.clear()])
    await db.exercises.bulkAdd(data.exercises ?? [])
    await db.sets.bulkAdd(data.sets ?? [])
    await db.goals.bulkAdd(data.goals ?? [])
  })
  return {
    exercises: data.exercises?.length ?? 0,
    sets: data.sets?.length ?? 0,
    goals: data.goals?.length ?? 0,
  }
}
