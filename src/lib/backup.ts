import { db } from './db'
import { isoDate } from './date'
import type {
  Exercise,
  WorkoutSet,
  Goal,
  Activity,
  BodyweightEntry,
  Setting,
  Snapshot,
  SnapshotReason,
  SnapshotCounts,
} from './types'
import { MAX_SNAPSHOTS } from './types'

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

/**
 * Snapshot the whole database into a self-contained backup object. Used by both
 * file export and on-device snapshots, so the two formats can never drift.
 * Deliberately does NOT include the `snapshots` table (we don't back up backups).
 */
async function buildBackup(): Promise<Backup> {
  const [exercises, sets, goals, activities, bodyweights, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.sets.toArray(),
      db.goals.toArray(),
      db.activities.toArray(),
      db.bodyweights.toArray(),
      db.settings.toArray(),
    ])
  return {
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
}

export async function exportData(): Promise<void> {
  const backup = await buildBackup()
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
 * Replace every data table with the contents of a backup payload. Tolerates v1
 * payloads (no activities/bodyweights/settings). Leaves the `snapshots` table
 * untouched, so snapshot history survives a restore. Returns imported counts.
 */
async function restoreBackup(data: Partial<Backup>): Promise<ImportResult> {
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

/**
 * Replace the whole database with the contents of a backup file. Captures a
 * pre-import snapshot first so the import itself can be undone.
 */
export async function importData(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<Backup>
  await takeSnapshot('pre-import')
  return restoreBackup(data)
}

// ── Automatic on-device snapshots ──────────────────────────────────────────

/**
 * Capture the current database as a snapshot row and prune to the newest
 * MAX_SNAPSHOTS. Returns the new snapshot's id.
 */
export async function takeSnapshot(reason: SnapshotReason): Promise<number> {
  const backup = await buildBackup()
  const counts: SnapshotCounts = {
    exercises: backup.exercises.length,
    sets: backup.sets.length,
    goals: backup.goals.length,
    activities: backup.activities?.length ?? 0,
    bodyweights: backup.bodyweights?.length ?? 0,
  }
  const id = (await db.snapshots.add({
    createdAt: Date.now(),
    reason,
    data: JSON.stringify(backup),
    counts,
  })) as number
  await pruneSnapshots()
  return id
}

/** Drop everything older than the newest `max` snapshots. */
export async function pruneSnapshots(max = MAX_SNAPSHOTS): Promise<void> {
  const stale = await db.snapshots
    .orderBy('createdAt')
    .reverse()
    .offset(max)
    .primaryKeys()
  if (stale.length) await db.snapshots.bulkDelete(stale)
}

/**
 * Take one automatic snapshot per local day, on startup. No-ops if we already
 * snapshotted today, or if the user hasn't logged anything yet (fresh install).
 */
export async function maybeDailySnapshot(): Promise<void> {
  const latest = await db.snapshots.orderBy('createdAt').last()
  if (latest && isoDate(new Date(latest.createdAt)) === isoDate()) return
  const [sets, activities, bodyweights] = await Promise.all([
    db.sets.count(),
    db.activities.count(),
    db.bodyweights.count(),
  ])
  if (sets === 0 && activities === 0 && bodyweights === 0) return
  await takeSnapshot('daily')
}

/** Newest-first list for the Settings restore UI. */
export function listSnapshots(): Promise<Snapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray()
}

export function deleteSnapshot(id: number): Promise<void> {
  return db.snapshots.delete(id)
}

/**
 * Restore the database from a stored snapshot. Captures a pre-restore snapshot
 * first so the restore itself can be undone.
 */
export async function restoreSnapshot(id: number): Promise<ImportResult> {
  const snap = await db.snapshots.get(id)
  if (!snap) throw new Error('Snapshot not found.')
  await takeSnapshot('pre-restore')
  return restoreBackup(JSON.parse(snap.data) as Partial<Backup>)
}
