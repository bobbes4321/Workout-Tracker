import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { db } from '../lib/db'
import type { GoalMetric, Exercise, WorkoutSet } from '../lib/types'
import { e1rm, markPRs, setStats } from '../lib/calc'
import { isoDate, relativeDay } from '../lib/date'
import { celebrateGoal, celebratePR } from '../lib/celebrate'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { useDialog } from '../components/Dialog'
import { ExercisePicker } from '../components/ExercisePicker'
import { Stepper } from '../components/Stepper'
import { ActivityCard } from '../components/ActivityCard'

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
  const volume = (daySets ?? []).reduce((s, x) => s + x.weight * x.reps, 0)

  return (
    <div>
      <PageHeader
        title="Log"
        subtitle={`${relativeDay(date)} · ${totalSets} set${totalSets === 1 ? '' : 's'}${
          volume > 0 ? ` · ${Math.round(volume).toLocaleString()} kg` : ''
        }`}
        right={
          <label className="relative cursor-pointer rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium text-muted active:bg-border">
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

      <div className="mb-4">
        <ActivityCard date={date} />
      </div>

      {sessionExerciseIds.length === 0 ? (
        <EmptyState
          title="No lifts logged yet"
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
              onRemove={(exId) =>
                setPendingIds((p) => p.filter((x) => x !== exId))
              }
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

const STEP_OPTIONS = [1, 2, 5]

/** Best value of a goal metric across prior sets plus the one just added. */
function bestForMetric(
  metric: GoalMetric,
  prior: WorkoutSet[],
  w: number,
  r: number,
): number {
  switch (metric) {
    case 'e1rm':
      return Math.max(e1rm(w, r), ...prior.map((s) => e1rm(s.weight, s.reps)))
    case 'weight':
      return Math.max(w, ...prior.map((s) => s.weight))
    case 'reps':
      return Math.max(r, ...prior.map((s) => s.reps))
  }
}

function ExerciseLogCard({
  exercise,
  date,
  onRemove,
}: {
  exercise?: Exercise
  date: string
  onRemove: (exerciseId: number) => void
}) {
  const allSets = useLiveQuery(
    () =>
      exercise?.id
        ? db.sets.where('exerciseId').equals(exercise.id).toArray()
        : [],
    [exercise?.id],
  )

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const touched = useRef(false)
  const [showSetup, setShowSetup] = useState(false)
  const [editingSetup, setEditingSetup] = useState(false)
  const [setupDraft, setSetupDraft] = useState('')
  const { confirm } = useDialog()

  const today = useMemo(
    () =>
      (allSets ?? [])
        .filter((s) => s.date === date)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [allSets, date],
  )

  const prev = useMemo(() => {
    const past = (allSets ?? []).filter((s) => s.date < date)
    if (past.length === 0) return null
    const lastDate = past.reduce((m, s) => (s.date > m ? s.date : m), past[0].date)
    return {
      date: lastDate,
      sets: past
        .filter((s) => s.date === lastDate)
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    }
  }, [allSets, date])

  const prMap = useMemo(() => markPRs(allSets ?? []), [allSets])

  // Smart prefill: start the inputs at the most recent set's numbers.
  const refSet = today[today.length - 1] ?? prev?.sets[prev.sets.length - 1]
  useEffect(() => {
    if (touched.current || !refSet) return
    setWeight(String(refSet.weight))
    setReps(String(refSet.reps))
  }, [refSet])

  if (!exercise) return null
  const step = exercise.weightStep ?? 1
  const unit = exercise.unit

  async function addSet(w: number, r: number) {
    if (!Number.isFinite(w) || !Number.isInteger(r) || w <= 0 || r <= 0) return
    const exId = exercise!.id!
    const prior = allSets ?? []
    const prevBestE = prior.reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0)
    const prevBestW = prior.reduce((m, s) => Math.max(m, s.weight), 0)

    await db.sets.add({ exerciseId: exId, date, weight: w, reps: r, createdAt: Date.now() })

    // Celebrate only a genuine improvement (not the first-ever baseline set).
    const isPR =
      prior.length > 0 && (e1rm(w, r) > prevBestE + 1e-9 || w > prevBestW)
    if (isPR) celebratePR()

    // Did this set just complete a not-yet-achieved goal for this exercise?
    const goals = await db.goals.where('exerciseId').equals(exId).toArray()
    for (const g of goals) {
      if (g.achievedAt) continue
      if (bestForMetric(g.metric, prior, w, r) >= g.target) {
        await db.goals.update(g.id!, { achievedAt: Date.now() })
        celebrateGoal()
      }
    }
  }

  function cycleStep() {
    const idx = STEP_OPTIONS.indexOf(step)
    const next = STEP_OPTIONS[(idx + 1) % STEP_OPTIONS.length]
    db.exercises.update(exercise!.id!, { weightStep: next })
  }

  async function saveSetup() {
    await db.exercises.update(exercise!.id!, { setup: setupDraft.trim() })
    setEditingSetup(false)
    if (!setupDraft.trim()) setShowSetup(false)
  }

  async function removeExercise() {
    if (today.length > 0) {
      const n = today.length
      const ok = await confirm({
        title: `Remove ${exercise!.name}?`,
        message: `This deletes its ${n} set${n === 1 ? '' : 's'} from ${relativeDay(date)}.`,
        confirmLabel: 'Remove',
        danger: true,
      })
      if (!ok) return
      await db.sets.bulkDelete(today.map((s) => s.id!))
    }
    onRemove(exercise!.id!)
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-bold">{exercise.name}</h2>
          <button
            onClick={() => {
              setShowSetup((v) => !v)
              setSetupDraft(exercise.setup ?? '')
              setEditingSetup(false)
            }}
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted active:text-text"
          >
            <span className="text-accent">ⓘ</span>
            {exercise.setup ? 'Setup' : 'Add setup'}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
            {exercise.category}
          </span>
          <button
            onClick={removeExercise}
            aria-label="Remove exercise from session"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted active:bg-surface-2 active:text-danger"
          >
            ✕
          </button>
        </div>
      </div>

      {showSetup && (
        <div className="mt-3 rounded-xl border border-border/70 bg-surface-2 p-3">
          {editingSetup ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={setupDraft}
                onChange={(e) => setSetupDraft(e.target.value)}
                rows={2}
                placeholder="e.g. Safety pins: hole 6 · Seat: 3 · Stance: shoulder-width"
                className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button onClick={saveSetup} className="px-3 py-1.5 text-xs">
                  Save
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditingSetup(false)}
                  className="px-3 py-1.5 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-wrap text-sm text-muted">
                {exercise.setup || 'No setup notes yet.'}
              </p>
              <button
                onClick={() => {
                  setSetupDraft(exercise.setup ?? '')
                  setEditingSetup(true)
                }}
                className="shrink-0 text-xs text-accent active:opacity-70"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {prev && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="font-medium text-text/80">
            Last ({relativeDay(prev.date)}):
          </span>
          {prev.sets.map((s) => (
            <span key={s.id} className="tabular-nums">
              {s.weight}×{s.reps}
            </span>
          ))}
        </div>
      )}

      {today.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {today.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', damping: 26, stiffness: 360 }}
              >
                <SetRow
                  index={i + 1}
                  set={s}
                  unit={unit}
                  isPR={prMap.get(s.id!)?.e1rmPR || prMap.get(s.id!)?.weightPR}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-muted">
              Weight ({unit})
            </span>
            <button
              onClick={cycleStep}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted active:text-text"
            >
              ±{step}
            </button>
          </div>
          <Stepper
            value={weight}
            onChange={(v) => {
              touched.current = true
              setWeight(v)
            }}
            step={step}
          />
        </div>
        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Reps</span>
          <Stepper
            value={reps}
            onChange={(v) => {
              touched.current = true
              setReps(v)
            }}
            step={1}
            inputMode="numeric"
          />
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button
          className="flex-1"
          disabled={!weight || !reps}
          onClick={() => addSet(parseFloat(weight), parseInt(reps, 10))}
        >
          Add set
        </Button>
        <Button
          variant="surface"
          disabled={!refSet}
          onClick={() => refSet && addSet(refSet.weight, refSet.reps)}
          className="px-4"
        >
          ⟳ Repeat
        </Button>
      </div>
    </div>
  )
}

function SetRow({
  index,
  set,
  unit,
  isPR,
}: {
  index: number
  set: WorkoutSet
  unit: string
  isPR?: boolean
}) {
  const { e1rm } = setStats(set)
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
        isPR ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-surface-2'
      }`}
    >
      <span className="w-5 text-xs font-semibold text-muted">{index}</span>
      <span className="font-semibold tabular-nums">
        {set.weight}
        <span className="text-muted"> {unit}</span>
      </span>
      <span className="text-muted">×</span>
      <span className="font-semibold tabular-nums">{set.reps}</span>
      {isPR && (
        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.6rem] font-bold text-black">
          🏆 PR
        </span>
      )}
      <span className="ml-auto text-xs text-muted">e1RM {e1rm}</span>
      <button
        onClick={() => db.sets.delete(set.id!)}
        className="text-muted active:text-danger"
        aria-label="Delete set"
      >
        ✕
      </button>
    </div>
  )
}
