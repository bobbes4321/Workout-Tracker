import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, putSetting } from '../lib/db'
import type { Exercise, Goal, WorkoutSet } from '../lib/types'
import {
  DEFAULT_WEEKLY_TARGET,
  SETTING_WEEKLY_TARGET,
} from '../lib/types'
import { e1rm, markPRs, round1 } from '../lib/calc'
import {
  buildHeatmap,
  coverage,
  daysThisWeek,
  trainingDays,
  weekStreak,
} from '../lib/stats'
import { isoDate, fromNow, relativeDay, startOfWeekIso } from '../lib/date'
import { Card, EmptyState, PageHeader } from '../components/ui'
import { useDialog } from '../components/Dialog'
import { CountUp } from '../components/CountUp'
import { DashboardSkeleton } from '../components/Skeleton'
import { WeeklyRing } from '../components/WeeklyRing'
import { Heatmap } from '../components/Heatmap'
import { CoverageBars } from '../components/CoverageBars'
import { BodyweightCard } from '../components/BodyweightCard'

const DAY = 86400000

function diffDays(iso: string): number {
  const [ty, tm, td] = isoDate().split('-').map(Number)
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(y, m - 1, d).getTime()) / DAY,
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const targetSetting = useLiveQuery(
    () => db.settings.get(SETTING_WEEKLY_TARGET),
    [],
  )
  const target = Number(targetSetting?.value ?? DEFAULT_WEEKLY_TARGET)
  const { prompt } = useDialog()

  const exMap = useMemo(() => {
    const m = new Map<number, Exercise>()
    for (const e of exercises ?? []) m.set(e.id!, e)
    return m
  }, [exercises])

  const byExercise = useMemo(() => {
    const m = new Map<number, WorkoutSet[]>()
    for (const s of sets ?? []) {
      const arr = m.get(s.exerciseId)
      if (arr) arr.push(s)
      else m.set(s.exerciseId, [s])
    }
    return m
  }, [sets])

  // Distinct training days (lifts + bouldering), newest first.
  const trainDays = useMemo(
    () => trainingDays(sets ?? [], activities ?? []),
    [sets, activities],
  )
  const recentDays = useMemo(
    () => [...trainDays].sort((a, b) => b.localeCompare(a)),
    [trainDays],
  )
  const boulderDays = useMemo(
    () => new Set((activities ?? []).map((a) => a.date)),
    [activities],
  )

  const streak = useMemo(() => weekStreak(trainDays), [trainDays])
  const thisWeek = useMemo(() => daysThisWeek(trainDays), [trainDays])
  const heatmap = useMemo(
    () => buildHeatmap(sets ?? [], activities ?? [], 12),
    [sets, activities],
  )
  const coverageRows = useMemo(
    () => coverage(sets ?? [], activities ?? [], exercises ?? [], 28),
    [sets, activities, exercises],
  )

  // Volume for the current (Monday-start) week, matching the ring/streak above.
  const weekVolume = useMemo(() => {
    const weekStart = startOfWeekIso(isoDate())
    let v = 0
    for (const s of sets ?? []) {
      if (s.date >= weekStart) v += s.weight * s.reps
    }
    return v
  }, [sets])

  const recentPRs = useMemo(() => {
    const events: {
      set: WorkoutSet
      ex?: Exercise
      kind: 'e1rm' | 'weight'
      value: string
    }[] = []
    for (const [exId, exSets] of byExercise) {
      const sorted = [...exSets].sort(
        (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
      )
      const flags = markPRs(sorted)
      sorted.forEach((s, i) => {
        if (i === 0) return // baseline, not an achievement
        if (diffDays(s.date) > 45) return
        const f = flags.get(s.id!)
        if (!f) return
        const ex = exMap.get(exId)
        if (f.e1rmPR) {
          events.push({
            set: s,
            ex,
            kind: 'e1rm',
            value: `${round1(e1rm(s.weight, s.reps))} ${ex?.unit ?? 'kg'} e1RM`,
          })
        } else if (f.weightPR) {
          events.push({
            set: s,
            ex,
            kind: 'weight',
            value: `${s.weight} ${ex?.unit ?? 'kg'} × ${s.reps}`,
          })
        }
      })
    }
    return events
      .sort((a, b) => (b.set.createdAt ?? 0) - (a.set.createdAt ?? 0))
      .slice(0, 4)
  }, [byExercise, exMap])

  const goalProgress = useMemo(() => {
    return (goals ?? [])
      .map((g) => {
        const exSets = byExercise.get(g.exerciseId) ?? []
        const current = currentForGoal(g, exSets)
        return {
          goal: g,
          ex: exMap.get(g.exerciseId),
          current,
          pct: g.target > 0 ? Math.min(100, (current / g.target) * 100) : 0,
        }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3)
  }, [goals, byExercise, exMap])

  async function editTarget() {
    const input = await prompt({
      title: 'Weekly target',
      label: 'Training days per week',
      initial: String(target),
      inputMode: 'numeric',
    })
    if (input == null) return
    const n = parseInt(input, 10)
    if (Number.isFinite(n) && n > 0 && n <= 14)
      putSetting(SETTING_WEEKLY_TARGET, n)
  }

  const loading = sets === undefined || activities === undefined
  const hasData = trainDays.size > 0
  const todayCount = (sets ?? []).filter((s) => s.date === isoDate()).length

  return (
    <div>
      <PageHeader
        title={`${greeting()} 👋`}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        right={
          trainDays.size > 0 ? (
            <div className="rounded-xl bg-surface-2 px-3 py-2 text-center">
              <p className="text-lg font-bold leading-none tabular-nums">
                <CountUp value={trainDays.size} />
              </p>
              <p className="text-[0.6rem] text-muted">days trained</p>
            </div>
          ) : undefined
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : !hasData ? (
        <EmptyState
          title="Let's get started"
          hint="Log your first workout and your progress will start showing up here."
          action={
            <button
              onClick={() => navigate('/log')}
              className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-black"
            >
              Log a workout
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          {/* Quick action */}
          <button
            onClick={() => navigate('/log')}
            className="flex w-full items-center justify-between rounded-2xl bg-accent px-5 py-4 text-left text-black transition-transform active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-medium opacity-70">
                {todayCount > 0 ? "Today's session" : 'Ready to train?'}
              </p>
              <p className="text-lg font-extrabold">
                {todayCount > 0
                  ? `${todayCount} set${todayCount === 1 ? '' : 's'} logged`
                  : 'Start logging'}
              </p>
            </div>
            <span className="text-2xl font-bold">
              {todayCount > 0 ? '→' : '+'}
            </span>
          </button>

          {/* This week: target ring + streak */}
          <section>
            <SectionHeader title="This week" />
            <Card className="flex items-center gap-4">
              <WeeklyRing value={thisWeek} target={target} onEdit={editTarget} />
              <div className="grid flex-1 grid-cols-3 gap-2">
                <Fact label="Streak" value={streak} unit={streak === 1 ? 'wk' : 'wks'} />
                <Fact label="Volume" value={Math.round(weekVolume)} unit="kg" />
                <Fact label="Days left" value={Math.max(0, target - thisWeek)} />
              </div>
            </Card>
            <p className="mt-1.5 px-1 text-[0.65rem] text-muted">
              Tap the ring to change your weekly target.
            </p>
          </section>

          {/* Consistency calendar */}
          <section>
            <SectionHeader title="Consistency · last 12 weeks" />
            <Card>
              <Heatmap weeks={heatmap} />
            </Card>
          </section>

          {/* Muscle-group coverage */}
          <section>
            <SectionHeader title="Muscle-group balance · last 4 weeks" />
            <Card>
              <CoverageBars rows={coverageRows} />
            </Card>
          </section>

          {/* Bodyweight */}
          <section>
            <SectionHeader title="Bodyweight" />
            <BodyweightCard />
          </section>

          {/* Recent PRs */}
          <section>
            <SectionHeader title="Recent PRs 🏆" />
            {recentPRs.length === 0 ? (
              <Card>
                <p className="text-sm text-muted">
                  No new PRs in the last 6 weeks — they'll pop up here when you
                  hit one.
                </p>
              </Card>
            ) : (
              <Card className="divide-y divide-border/60 !p-0">
                {recentPRs.map((pr) => (
                  <div
                    key={pr.set.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      ▲
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {pr.value}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {pr.ex?.name ?? 'Unknown'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">
                      {fromNow(pr.set.date)}
                    </span>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* Goals */}
          {goalProgress.length > 0 && (
            <section>
              <SectionHeader title="Goals 🎯" to="/records" linkLabel="All" />
              <Card className="space-y-3">
                {goalProgress.map(({ goal, ex, current, pct }) => (
                  <div key={goal.id}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="truncate font-medium">{ex?.name}</span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">
                        {current} / {goal.target}
                        {goal.metric !== 'reps' && ` ${ex?.unit ?? 'kg'}`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${pct >= 100 ? 'bg-accent' : 'bg-accent-dim'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          )}

          {/* Recent sessions */}
          <section>
            <SectionHeader title="Recent sessions" to="/history" linkLabel="History" />
            <div className="space-y-2">
              {recentDays.slice(0, 3).map((date) => (
                <SessionRow
                  key={date}
                  date={date}
                  sets={(sets ?? []).filter((s) => s.date === date)}
                  bouldering={boulderDays.has(date)}
                  exMap={exMap}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function currentForGoal(g: Goal, sets: WorkoutSet[]): number {
  if (sets.length === 0) return 0
  switch (g.metric) {
    case 'e1rm':
      return round1(Math.max(...sets.map((s) => e1rm(s.weight, s.reps))))
    case 'weight':
      return Math.max(...sets.map((s) => s.weight))
    case 'reps':
      return Math.max(...sets.map((s) => s.reps))
  }
}

function SectionHeader({
  title,
  to,
  linkLabel,
}: {
  title: string
  to?: string
  linkLabel?: string
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {to && (
        <Link to={to} className="text-xs font-medium text-accent active:opacity-70">
          {linkLabel} ›
        </Link>
      )}
    </div>
  )
}

function Fact({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit?: string
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <p className="text-lg font-bold leading-none tabular-nums">
        <CountUp value={value} />
        {unit && <span className="ml-0.5 text-[0.6rem] font-medium text-muted">{unit}</span>}
      </p>
      <p className="mt-1 text-[0.6rem] text-muted">{label}</p>
    </div>
  )
}

function SessionRow({
  date,
  sets,
  bouldering,
  exMap,
}: {
  date: string
  sets: WorkoutSet[]
  bouldering: boolean
  exMap: Map<number, Exercise>
}) {
  const exCount = new Set(sets.map((s) => s.exerciseId)).size
  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
  const names = [...new Set(sets.map((s) => exMap.get(s.exerciseId)?.name))]
    .filter(Boolean)
    .slice(0, 3)
  if (bouldering) names.unshift('🧗 Bouldering')
  return (
    <Link
      to="/history"
      className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 active:bg-surface-2"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{relativeDay(date)}</p>
        <p className="truncate text-xs text-muted">{names.join(', ')}</p>
      </div>
      <div className="shrink-0 text-right">
        {sets.length > 0 ? (
          <>
            <p className="text-xs font-medium tabular-nums">
              {exCount} ex · {sets.length} sets
            </p>
            <p className="text-[0.65rem] text-muted tabular-nums">
              {Math.round(volume).toLocaleString()} kg
            </p>
          </>
        ) : (
          <p className="text-xs font-medium text-muted">rest-day climb</p>
        )}
      </div>
    </Link>
  )
}
