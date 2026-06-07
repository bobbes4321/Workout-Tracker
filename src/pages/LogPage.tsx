import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Exercise, WorkoutSet } from '../lib/types'
import { setStats } from '../lib/calc'
import { isoDate, relativeDay } from '../lib/date'
import { Button, Card, EmptyState, PageHeader } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'

export function LogPage() {
  const [date, setDate] = useState(isoDate())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingIds, setPendingIds] = useState<number[]>([])

  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const exMap = useMemo(() => {
    const m = new Map<number, Exercise>()
    for (const e of exercises ?? []) m.set(e.id!, e)
    return m
  }, [exercises])

  const daySets = useLiveQuery(
    () => db.sets.where('date').equals(date).toArray(),
    [date],
  )

  // Exercise order in this session: those with sets (by first logged), then pending.
  const sessionExerciseIds = useMemo(() => {
    const order: number[] = []
    const seen = new Set<number>()
    const sorted = [...(daySets ?? [])].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0),
    )
    for (const s of sorted) {
      if (!seen.has(s.exerciseId)) {
        seen.add(s.exerciseId)
        order.push(s.exerciseId)
      }
    }
    for (const id of pendingIds) {
      if (!seen.has(id)) {
        seen.add(id)
        order.push(id)
      }
    }
    return order
  }, [daySets, pendingIds])

  const totalSets = daySets?.length ?? 0

  return (
    <div>
      <PageHeader
        title="Log"
        subtitle={`${relativeDay(date)} · ${totalSets} set${totalSets === 1 ? '' : 's'}`}
        right={
          <label className="relative cursor-pointer rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium text-muted hover:text-text">
            {relativeDay(date) === 'Today' ? '📅 Today' : '📅 ' + date}
            <input
              type="date"
              value={date}
              max={isoDate()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        }
      />

      {sessionExerciseIds.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          hint="Add an exercise and punch in your sets as you go."
          action={
            <Button onClick={() => setPickerOpen(true)}>+ Add exercise</Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {sessionExerciseIds.map((id) => (
            <ExerciseLogCard
              key={id}
              exercise={exMap.get(id)}
              date={date}
              sets={(daySets ?? []).filter((s) => s.exerciseId === id)}
            />
          ))}
          <Button
            variant="surface"
            className="w-full"
            onClick={() => setPickerOpen(true)}
          >
            + Add exercise
          </Button>
        </div>
      )}

      {pickerOpen && (
        <ExercisePicker
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            setPendingIds((p) => (p.includes(id) ? p : [...p, id]))
            setPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}

function ExerciseLogCard({
  exercise,
  date,
  sets,
}: {
  exercise?: Exercise
  date: string
  sets: WorkoutSet[]
}) {
  const lastSet = sets[sets.length - 1]
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')

  if (!exercise) return null

  async function addSet() {
    const w = parseFloat(weight)
    const r = parseInt(reps, 10)
    if (!Number.isFinite(w) || !Number.isInteger(r) || w <= 0 || r <= 0) return
    await db.sets.add({
      exerciseId: exercise!.id!,
      date,
      weight: w,
      reps: r,
      createdAt: Date.now(),
    })
    setReps('')
    // Keep weight — most people repeat the same weight across sets.
  }

  const placeholderW = lastSet ? String(lastSet.weight) : '0'
  const placeholderR = lastSet ? String(lastSet.reps) : '0'

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-bold">{exercise.name}</h2>
        <span className="text-xs text-muted">{exercise.category}</span>
      </div>

      {sets.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {sets.map((s, i) => (
            <SetRow key={s.id} index={i + 1} set={s} unit={exercise.unit} />
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Field
          label={`Weight (${exercise.unit})`}
          value={weight}
          onChange={setWeight}
          placeholder={placeholderW}
          inputMode="decimal"
        />
        <Field
          label="Reps"
          value={reps}
          onChange={setReps}
          placeholder={placeholderR}
          inputMode="numeric"
        />
        <Button
          onClick={addSet}
          className="mb-px h-[46px] px-5"
          disabled={!weight || !reps}
        >
          Add
        </Button>
      </div>
    </Card>
  )
}

function SetRow({
  index,
  set,
  unit,
}: {
  index: number
  set: WorkoutSet
  unit: string
}) {
  const { e1rm } = setStats(set)
  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <span className="w-5 text-xs font-semibold text-muted">{index}</span>
      <span className="font-semibold tabular-nums">
        {set.weight}
        <span className="text-muted"> {unit}</span>
      </span>
      <span className="text-muted">×</span>
      <span className="font-semibold tabular-nums">{set.reps}</span>
      <span className="ml-auto text-xs text-muted">e1RM {e1rm}</span>
      <button
        onClick={() => db.sets.delete(set.id!)}
        className="text-muted hover:text-danger"
        aria-label="Delete set"
      >
        ✕
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  inputMode: 'decimal' | 'numeric'
}) {
  return (
    <label className="flex-1">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        type="text"
        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-base tabular-nums outline-none focus:border-accent"
      />
    </label>
  )
}
