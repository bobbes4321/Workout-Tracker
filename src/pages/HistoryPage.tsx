import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Exercise, WorkoutSet } from '../lib/types'
import { setStats } from '../lib/calc'
import { relativeDay } from '../lib/date'
import { Card, EmptyState, PageHeader } from '../components/ui'

export function HistoryPage() {
  const sets = useLiveQuery(() => db.sets.toArray(), [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])

  const exMap = useMemo(() => {
    const m = new Map<number, Exercise>()
    for (const e of exercises ?? []) m.set(e.id!, e)
    return m
  }, [exercises])

  const sessions = useMemo(() => {
    const byDate = new Map<string, WorkoutSet[]>()
    for (const s of sets ?? []) {
      const arr = byDate.get(s.date)
      if (arr) arr.push(s)
      else byDate.set(s.date, [s])
    }
    return [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [sets])

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
          {sessions.map(([date, daySets]) => (
            <SessionCard
              key={date}
              date={date}
              sets={daySets}
              exMap={exMap}
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
  exMap,
}: {
  date: string
  sets: WorkoutSet[]
  exMap: Map<number, Exercise>
}) {
  const [open, setOpen] = useState(false)

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

  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0)

  return (
    <Card>
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="font-bold">{relativeDay(date)}</p>
          <p className="text-xs text-muted">
            {byExercise.length} exercise{byExercise.length === 1 ? '' : 's'} ·{' '}
            {sets.length} set{sets.length === 1 ? '' : 's'} ·{' '}
            {Math.round(volume).toLocaleString()} kg volume
          </p>
        </div>
        <span
          className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {byExercise.map(([exId, exSets]) => (
            <div key={exId}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  {exMap.get(exId)?.name ?? 'Unknown'}
                </p>
                <span className="text-xs text-muted">
                  {exMap.get(exId)?.category}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exSets.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs tabular-nums"
                    title={`e1RM ${setStats(s).e1rm}`}
                  >
                    {s.weight}×{s.reps}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              if (confirm(`Delete all sets from ${relativeDay(date)}?`)) {
                db.sets.bulkDelete(sets.map((s) => s.id!))
              }
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
