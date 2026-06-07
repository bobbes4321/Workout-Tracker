import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Exercise, Goal, GoalMetric, WorkoutSet } from '../lib/types'
import { computePRs, e1rm } from '../lib/calc'
import { Button, Card, EmptyState, PageHeader, Pill } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'

export function RecordsPage() {
  const [tab, setTab] = useState<'prs' | 'goals'>('prs')

  return (
    <div>
      <PageHeader title="Records" subtitle="Personal bests & targets" />
      <div className="mb-4 flex gap-2">
        <Pill active={tab === 'prs'} onClick={() => setTab('prs')}>
          🏆 PRs
        </Pill>
        <Pill active={tab === 'goals'} onClick={() => setTab('goals')}>
          🎯 Goals
        </Pill>
      </div>
      {tab === 'prs' ? <PRList /> : <GoalList />}
    </div>
  )
}

function useExerciseSets() {
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
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
  return { exMap, byExercise }
}

function PRList() {
  const { exMap, byExercise } = useExerciseSets()

  const rows = useMemo(() => {
    return [...byExercise.entries()]
      .map(([exId, sets]) => ({
        exercise: exMap.get(exId),
        prs: computePRs(sets),
      }))
      .filter((r) => r.exercise)
      .sort(
        (a, b) =>
          (b.prs.bestE1rm?.value ?? 0) - (a.prs.bestE1rm?.value ?? 0),
      )
  }, [byExercise, exMap])

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No PRs yet"
        hint="Log some sets and your personal bests will appear here automatically."
      />
    )
  }

  return (
    <div className="space-y-3">
      {rows.map(({ exercise, prs }) => (
        <Card key={exercise!.id}>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-bold">{exercise!.name}</h2>
            <span className="text-xs text-muted">{exercise!.category}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <PRCell
              label="Best e1RM"
              value={prs.bestE1rm?.value}
              unit={exercise!.unit}
            />
            <PRCell
              label="Top weight"
              value={prs.bestWeight?.weight}
              unit={exercise!.unit}
              sub={prs.bestWeight ? `×${prs.bestWeight.reps}` : undefined}
            />
            <PRCell label="Most reps" value={prs.bestReps?.reps} />
          </div>
        </Card>
      ))}
    </div>
  )
}

function PRCell({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value?: number
  unit?: string
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-surface-2 py-2.5">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums">
        {value ?? '–'}
        {value != null && unit && (
          <span className="text-xs font-medium text-muted"> {unit}</span>
        )}
      </p>
      {sub && <p className="text-[0.65rem] text-muted">{sub}</p>}
    </div>
  )
}

const GOAL_METRICS: { key: GoalMetric; label: string }[] = [
  { key: 'e1rm', label: 'Est. 1RM' },
  { key: 'weight', label: 'Top weight' },
  { key: 'reps', label: 'Max reps' },
]

function currentFor(metric: GoalMetric, sets: WorkoutSet[]): number {
  if (sets.length === 0) return 0
  switch (metric) {
    case 'e1rm':
      return Math.round(Math.max(...sets.map((s) => e1rm(s.weight, s.reps))) * 10) / 10
    case 'weight':
      return Math.max(...sets.map((s) => s.weight))
    case 'reps':
      return Math.max(...sets.map((s) => s.reps))
  }
}

function GoalList() {
  const { exMap, byExercise } = useExerciseSets()
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [adding, setAdding] = useState(false)

  return (
    <div>
      {(goals ?? []).length === 0 ? (
        <EmptyState
          title="No goals set"
          hint="Set a target to track how close you are."
          action={<Button onClick={() => setAdding(true)}>+ Add goal</Button>}
        />
      ) : (
        <div className="space-y-3">
          {(goals ?? [])
            .map((g) => {
              const sets = byExercise.get(g.exerciseId) ?? []
              const current = currentFor(g.metric, sets)
              return { g, current, exercise: exMap.get(g.exerciseId) }
            })
            .sort((a, b) => {
              const ap = a.current / a.g.target
              const bp = b.current / b.g.target
              return bp - ap
            })
            .map(({ g, current, exercise }) => (
              <GoalCard
                key={g.id}
                goal={g}
                current={current}
                exerciseName={exercise?.name ?? 'Unknown'}
                unit={exercise?.unit ?? 'kg'}
              />
            ))}
          <Button
            variant="surface"
            className="w-full"
            onClick={() => setAdding(true)}
          >
            + Add goal
          </Button>
        </div>
      )}

      {adding && <AddGoal onClose={() => setAdding(false)} />}
    </div>
  )
}

function GoalCard({
  goal,
  current,
  exerciseName,
  unit,
}: {
  goal: Goal
  current: number
  exerciseName: string
  unit: string
}) {
  const pct = Math.min(100, goal.target > 0 ? (current / goal.target) * 100 : 0)
  const reached = current >= goal.target && goal.target > 0
  const metricLabel = GOAL_METRICS.find((m) => m.key === goal.metric)?.label
  const showUnit = goal.metric !== 'reps'

  return (
    <Card>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">{exerciseName}</h2>
          <p className="text-xs text-muted">{metricLabel}</p>
        </div>
        <button
          onClick={() => db.goals.delete(goal.id!)}
          className="text-sm text-muted hover:text-danger"
          aria-label="Delete goal"
        >
          ✕
        </button>
      </div>

      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold tabular-nums">
          {current}
          {showUnit && ` ${unit}`}
        </span>
        <span className="text-muted tabular-nums">
          / {goal.target}
          {showUnit && ` ${unit}`}
        </span>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all ${
            reached ? 'bg-accent' : 'bg-accent-dim'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs font-medium">
        {reached ? (
          <span className="text-accent">🎉 Goal reached!</span>
        ) : (
          <span className="text-muted">
            {Math.round(goal.target - current > 0 ? goal.target - current : 0)}
            {showUnit ? ` ${unit}` : ''} to go
          </span>
        )}
      </p>
    </Card>
  )
}

function AddGoal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'exercise' | 'details'>('exercise')
  const [exerciseId, setExerciseId] = useState<number | null>(null)
  const [metric, setMetric] = useState<GoalMetric>('e1rm')
  const [target, setTarget] = useState('')

  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId],
  )

  if (step === 'exercise') {
    return (
      <ExercisePicker
        onClose={onClose}
        allowCreate={false}
        onPick={(id) => {
          setExerciseId(id)
          setStep('details')
        }}
      />
    )
  }

  async function save() {
    const t = parseFloat(target)
    if (!exerciseId || !Number.isFinite(t) || t <= 0) return
    await db.goals.add({
      exerciseId,
      metric,
      target: t,
      createdAt: Date.now(),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-t-3xl border border-border bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">New goal</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted">
            ×
          </button>
        </div>

        <p className="text-sm text-muted">
          {exercise?.name} — set a target to chase.
        </p>

        <div className="flex gap-2">
          {GOAL_METRICS.map((m) => (
            <Pill
              key={m.key}
              active={metric === m.key}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </Pill>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Target {metric === 'reps' ? '(reps)' : `(${exercise?.unit ?? 'kg'})`}
          </span>
          <input
            autoFocus
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 90"
            className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-base tabular-nums outline-none focus:border-accent"
          />
        </label>

        <Button className="w-full" onClick={save} disabled={!target}>
          Save goal
        </Button>
      </div>
    </div>
  )
}
