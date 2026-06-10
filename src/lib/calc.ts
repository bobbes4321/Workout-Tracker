import type { BodyweightEntry, Exercise, WorkoutSet } from './types'

/**
 * Reps above this are clamped for the e1RM estimate. The Epley formula is only
 * meaningful in the low-rep, strength range — past ~12 reps it balloons (20 reps
 * → 1.67×), so high-rep accessory/cable sets would otherwise post fake strength
 * PRs. Clamping keeps e1RM honest as a *strength* signal across the whole app.
 */
export const E1RM_REP_CAP = 12

/**
 * Estimated one-rep max using the Epley formula, with reps capped (see
 * {@link E1RM_REP_CAP}). For 1 rep this returns the weight itself.
 */
export function e1rm(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  const r = Math.min(reps, E1RM_REP_CAP)
  return weight * (1 + r / 30)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ── Bodyweight-based exercises (e.g. weighted pull-ups) ─────────────────────
// The logged `weight` is *added* load; the effective load that drives every
// metric is `added + bodyweight on that date`. These helpers convert raw sets
// into "effective" sets so the existing calc functions need no special-casing.

/** Resolves the effective bodyweight for a given date. */
export type BodyweightAt = (date: string) => number | undefined

export function isBodyweight(ex?: Pick<Exercise, 'bodyweightBased'>): boolean {
  return ex?.bodyweightBased === 1
}

/**
 * Build a date→bodyweight resolver from the bodyweight log. Carries the most
 * recent prior entry forward (bodyweight drifts slowly); before the first
 * entry it uses the earliest known weight. Returns undefined only when the log
 * is empty, in which case effective load falls back to the added weight alone.
 */
export function bodyweightResolver(entries: BodyweightEntry[]): BodyweightAt {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  return (date: string) => {
    if (sorted.length === 0) return undefined
    let result = sorted[0].weight
    for (const b of sorted) {
      if (b.date <= date) result = b.weight
      else break
    }
    return result
  }
}

/** The load a set actually moved: added + bodyweight for BW exercises, else the logged weight. */
export function effectiveWeight(
  set: Pick<WorkoutSet, 'weight' | 'date'>,
  ex?: Pick<Exercise, 'bodyweightBased'>,
  bwAt?: BodyweightAt,
): number {
  if (isBodyweight(ex) && bwAt) {
    const bw = bwAt(set.date)
    if (bw != null) return set.weight + bw
  }
  return set.weight
}

/**
 * Clone sets with `weight` replaced by effective load, for feeding into the
 * metric functions. No-op (returns the same array) for non-bodyweight exercises.
 */
export function effectiveSets(
  sets: WorkoutSet[],
  ex?: Pick<Exercise, 'bodyweightBased'>,
  bwAt?: BodyweightAt,
): WorkoutSet[] {
  if (!isBodyweight(ex) || !bwAt) return sets
  return sets.map((s) => ({ ...s, weight: effectiveWeight(s, ex, bwAt) }))
}

/** Midday timestamp for a YYYY-MM-DD string (stable x-value for charts). */
export function dateToTs(date: string): number {
  return Date.parse(`${date}T12:00:00`)
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

/** The value of a single set under a given metric (volume is per-set load). */
export function setValue(
  s: Pick<WorkoutSet, 'weight' | 'reps'>,
  metric: ProgressMetric,
): number {
  switch (metric) {
    case 'e1rm':
      return round1(e1rm(s.weight, s.reps))
    case 'topWeight':
      return s.weight
    case 'volume':
      return s.weight * s.reps
  }
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
  t: number
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
      t: dateToTs(date),
      value: metricForSession(daySets, metric),
    }))
}

export interface SetPoint {
  t: number
  value: number
}

/** Every individual set as a scatter point (for the faint cloud behind the line). */
export function buildSetPoints(
  sets: WorkoutSet[],
  metric: ProgressMetric,
): SetPoint[] {
  return sets
    .map((s) => ({ t: dateToTs(s.date), value: setValue(s, metric) }))
    .sort((a, b) => a.t - b.t)
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

export interface PRFlags {
  weightPR: boolean
  e1rmPR: boolean
}

/**
 * Walk sets in chronological order and flag the ones that set a new best
 * (weight or estimated-1RM) at the moment they were logged.
 */
export function markPRs(sets: WorkoutSet[]): Map<number, PRFlags> {
  const sorted = [...sets].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  let bestW = 0
  let bestE = 0
  const map = new Map<number, PRFlags>()
  for (const s of sorted) {
    const v = e1rm(s.weight, s.reps)
    map.set(s.id!, { weightPR: s.weight > bestW, e1rmPR: v > bestE + 1e-9 })
    if (s.weight > bestW) bestW = s.weight
    if (v > bestE) bestE = v
  }
  return map
}
