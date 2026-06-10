import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Activity, Exercise, WorkoutSet } from '../lib/types'
import { ACTIVITY_INFO } from '../lib/types'
import {
  bodyweightResolver,
  effectiveWeight,
  isBodyweight,
  setStats,
  type BodyweightAt,
} from '../lib/calc'
import { relativeDay } from '../lib/date'
import { Card, EmptyState, PageHeader } from '../components/ui'
import { useDialog } from '../components/Dialog'

export function HistoryPage() {
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const activities = useLiveQuery(() => db.activities.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const bodyweights = useLiveQuery(() => db.bodyweights.toArray(), [])

  const exMap = useMemo(() => {
    const m = new Map<number, Exercise>()
    for (const e of exercises ?? []) m.set(e.id!, e)
    return m
  }, [exercises])
  const bwAt = useMemo(() => bodyweightResolver(bodyweights ?? []), [bodyweights])

  const sessions = useMemo(() => {
    const byDate = new Map<string, { sets: WorkoutSet[]; activities: Activity[] }>()
    const day = (d: string) => {
      let e = byDate.get(d)
      if (!e) byDate.set(d, (e = { sets: [], activities: [] }))
      return e
    }
    for (const s of sets ?? []) day(s.date).sets.push(s)
    for (const a of activities ?? []) day(a.date).activities.push(a)
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [sets, activities])

  return (
    <div>
      <PageHeader
        title="History"
        subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'} logged`}
      />
      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions yet"
          hint="Your logged workouts will show up here, newest first."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map(([date, day]) => (
            <SessionCard
              key={date}
              date={date}
              sets={day.sets}
              activities={day.activities}
              exMap={exMap}
              bwAt={bwAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({
  date,
  sets,
  activities,
  exMap,
  bwAt,
}: {
  date: string
  sets: WorkoutSet[]
  activities: Activity[]
  exMap: Map<number, Exercise>
  bwAt: BodyweightAt
}) {
  const [open, setOpen] = useState(false)
  const { confirm } = useDialog()

  const byExercise = useMemo(() => {
    const m = new Map<number, WorkoutSet[]>()
    const sorted = [...sets].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )
    for (const s of sorted) {
      const arr = m.get(s.exerciseId)
      if (arr) arr.push(s)
      else m.set(s.exerciseId, [s])
    }
    return [...m.entries()]
  }, [sets])

  const volume = sets.reduce(
    (sum, s) =>
      sum + effectiveWeight(s, exMap.get(s.exerciseId), bwAt) * s.reps,
    0,
  )

  const summary =
    byExercise.length > 0
      ? `${byExercise.length} exercise${byExercise.length === 1 ? '' : 's'} · ${sets.length} set${sets.length === 1 ? '' : 's'} · ${Math.round(volume).toLocaleString()} kg volume`
      : activities.map((a) => ACTIVITY_INFO[a.type].label).join(', ')

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="font-bold">
            {relativeDay(date)}
            {activities.length > 0 && (
              <span className="ml-1.5" title="bouldering">
                {ACTIVITY_INFO.bouldering.icon}
              </span>
            )}
          </p>
          <p className="text-xs text-muted">{summary}</p>
        </div>
        <span
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {activities.map((a) => (
            <div key={a.id} className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {ACTIVITY_INFO[a.type].icon} {ACTIVITY_INFO[a.type].label}
              </p>
              <span className="text-xs text-muted">
                {a.durationMin ? `${a.durationMin} min` : 'logged'}
                {a.note ? ` · ${a.note}` : ''}
              </span>
            </div>
          ))}
          {byExercise.map(([exId, exSets]) => {
            const ex = exMap.get(exId)
            const added = isBodyweight(ex)
            return (
              <div key={exId}>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold">{ex?.name ?? 'Unknown'}</p>
                  <span className="text-xs text-muted">{ex?.category}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {exSets.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs tabular-nums"
                      title={`e1RM ${setStats({ weight: effectiveWeight(s, ex, bwAt), reps: s.reps }).e1rm}`}
                    >
                      {added ? '+' : ''}
                      {s.weight}×{s.reps}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
          <button
            onClick={async () => {
              const ok = await confirm({
                title: `Delete ${relativeDay(date)}?`,
                message: 'This removes every set and activity logged that day.',
                confirmLabel: 'Delete',
                danger: true,
              })
              if (!ok) return
              db.sets.bulkDelete(sets.map((s) => s.id!))
              db.activities.bulkDelete(activities.map((a) => a.id!))
            }}
            className="text-xs text-muted hover:text-danger"
          >
            Delete this session
          </button>
        </div>
      )}
    </Card>
  )
}
