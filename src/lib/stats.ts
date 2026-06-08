import type { Activity, Category, Exercise, WorkoutSet } from './types'
import { ACTIVITY_INFO } from './types'
import { addDaysIso, daysBetween, isoDate, startOfWeekIso } from './date'

/** Every day on which *something* was trained — lift sets or an activity. */
export function trainingDays(
  sets: WorkoutSet[],
  activities: Activity[],
): Set<string> {
  const days = new Set<string>()
  for (const s of sets) days.add(s.date)
  for (const a of activities) days.add(a.date)
  return days
}

/** Distinct training days inside the current (Monday-start) week. */
export function daysThisWeek(days: Set<string>): number {
  const start = startOfWeekIso(isoDate())
  let n = 0
  for (let i = 0; i < 7; i++) if (days.has(addDaysIso(start, i))) n++
  return n
}

/**
 * Consecutive weeks (Monday-start) with at least one training day, counting
 * back from now. The current week not having a session yet doesn't break the
 * streak — we just start counting from last week instead.
 */
export function weekStreak(days: Set<string>): number {
  const weeks = new Set<string>()
  for (const d of days) weeks.add(startOfWeekIso(d))
  let cursor = startOfWeekIso(isoDate())
  if (!weeks.has(cursor)) cursor = addDaysIso(cursor, -7)
  let streak = 0
  while (weeks.has(cursor)) {
    streak++
    cursor = addDaysIso(cursor, -7)
  }
  return streak
}

export interface HeatCell {
  date: string
  sets: number
  bouldering: boolean
  isFuture: boolean
  isToday: boolean
}

/**
 * A calendar grid: one column per week (oldest → current), each column 7 cells
 * Monday → Sunday. Shade reflects lift volume; bouldering-only days still show.
 */
export function buildHeatmap(
  sets: WorkoutSet[],
  activities: Activity[],
  weeks = 12,
): HeatCell[][] {
  const setCount = new Map<string, number>()
  for (const s of sets) setCount.set(s.date, (setCount.get(s.date) ?? 0) + 1)
  const boulderDays = new Set(activities.map((a) => a.date))

  const today = isoDate()
  const firstWeek = addDaysIso(startOfWeekIso(today), -7 * (weeks - 1))
  const cols: HeatCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const colStart = addDaysIso(firstWeek, w * 7)
    const col: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDaysIso(colStart, d)
      const sc = setCount.get(date) ?? 0
      const bouldering = boulderDays.has(date)
      col.push({
        date,
        sets: sc,
        bouldering,
        isFuture: date > today,
        isToday: date === today,
      })
    }
    cols.push(col)
  }
  return cols
}

export interface CoverageRow {
  category: Category
  /** Distinct training days for this group inside the window. */
  days: number
  /** Sessions per week over the window. */
  perWeek: number
  /** Days since last trained (any time, not just the window); undefined if never. */
  daysSince?: number
  /** Whether bouldering contributes to this group. */
  fromBouldering: boolean
}

/**
 * Muscle-group coverage by *frequency* over a trailing window. Bouldering days
 * count toward the groups it trains (Back/Arms/Core), so a coverage view never
 * makes climbers look like they skip back. Shows every group that has an active
 * exercise or any data — so neglected groups surface as a visible zero.
 */
export function coverage(
  sets: WorkoutSet[],
  activities: Activity[],
  exercises: Exercise[],
  windowDays = 28,
): CoverageRow[] {
  const today = isoDate()
  const cutoff = addDaysIso(today, -(windowDays - 1))
  const exCat = new Map<number, Category>()
  for (const e of exercises) if (e.id != null) exCat.set(e.id, e.category as Category)

  const daysByCat = new Map<Category, Set<string>>()
  const lastByCat = new Map<Category, string>()
  const boulderingCats = new Set<Category>(ACTIVITY_INFO.bouldering.categories)

  const touch = (cat: Category, date: string) => {
    if (date >= cutoff) {
      let set = daysByCat.get(cat)
      if (!set) daysByCat.set(cat, (set = new Set()))
      set.add(date)
    }
    const prev = lastByCat.get(cat)
    if (!prev || date > prev) lastByCat.set(cat, date)
  }

  for (const s of sets) {
    const cat = exCat.get(s.exerciseId)
    if (cat) touch(cat, s.date)
  }
  for (const a of activities) {
    for (const cat of ACTIVITY_INFO[a.type].categories) touch(cat, a.date)
  }

  const cats = new Set<Category>()
  for (const e of exercises) if (e.archived !== 1) cats.add(e.category as Category)
  for (const c of daysByCat.keys()) cats.add(c)

  const weeks = windowDays / 7
  return [...cats]
    .map((category): CoverageRow => {
      const days = daysByCat.get(category)?.size ?? 0
      const last = lastByCat.get(category)
      return {
        category,
        days,
        perWeek: Math.round((days / weeks) * 10) / 10,
        daysSince: last ? Math.max(0, daysBetween(today, last)) : undefined,
        fromBouldering: boulderingCats.has(category),
      }
    })
    .sort((a, b) => b.perWeek - a.perWeek || a.category.localeCompare(b.category))
}
