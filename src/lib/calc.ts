import type { WorkoutSet } from './types'

/**
 * Estimated one-rep max using the Epley formula.
 * For 1 rep this returns the weight itself.
 */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface SetStats {
  e1rm: number
}

export function setStats(s: Pick<WorkoutSet, 'weight' | 'reps'>): SetStats {
  return { e1rm: round1(e1rm(s.weight, s.reps)) }
}

export type ProgressMetric = 'e1rm' | 'topWeight' | 'volume'

export const METRIC_LABEL: Record<ProgressMetric, string> = {
  e1rm: 'Est. 1RM',
  topWeight: 'Top weight',
  volume: 'Total volume',
}

/** Aggregate the sets of a single session (one date) into one data point. */
export function metricForSession(
  sets: WorkoutSet[],
  metric: ProgressMetric,
): number {
  if (sets.length === 0) return 0
  switch (metric) {
    case 'e1rm':
      return round1(Math.max(...sets.map((s) => e1rm(s.weight, s.reps))))
    case 'topWeight':
      return Math.max(...sets.map((s) => s.weight))
    case 'volume':
      return round1(sets.reduce((sum, s) => sum + s.weight * s.reps, 0))
  }
}

export interface ProgressPoint {
  date: string
  value: number
}

/** Build a time series for one exercise, one point per session date. */
export function buildSeries(
  sets: WorkoutSet[],
  metric: ProgressMetric,
): ProgressPoint[] {
  const byDate = new Map<string, WorkoutSet[]>()
  for (const s of sets) {
    const arr = byDate.get(s.date)
    if (arr) arr.push(s)
    else byDate.set(s.date, [s])
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, daySets]) => ({
      date,
      value: metricForSession(daySets, metric),
    }))
}

export interface PRs {
  bestWeight?: WorkoutSet
  bestE1rm?: { set: WorkoutSet; value: number }
  bestReps?: WorkoutSet
  totalSets: number
}

/** Compute personal records for one exercise from all its sets. */
export function computePRs(sets: WorkoutSet[]): PRs {
  if (sets.length === 0) return { totalSets: 0 }
  let bestWeight = sets[0]
  let bestReps = sets[0]
  let bestE1rm = { set: sets[0], value: e1rm(sets[0].weight, sets[0].reps) }
  for (const s of sets) {
    if (s.weight > bestWeight.weight) bestWeight = s
    if (s.reps > bestReps.reps) bestReps = s
    const v = e1rm(s.weight, s.reps)
    if (v > bestE1rm.value) bestE1rm = { set: s, value: v }
  }
  return {
    bestWeight,
    bestReps,
    bestE1rm: { set: bestE1rm.set, value: round1(bestE1rm.value) },
    totalSets: sets.length,
  }
}
