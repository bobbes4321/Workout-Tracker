import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { db } from '../lib/db'
import {
  METRIC_LABEL,
  buildSeries,
  buildSetPoints,
  computePRs,
  type ProgressMetric,
} from '../lib/calc'
import { shortDateMs, prettyDateMs } from '../lib/date'
import { Button, Card, EmptyState, PageHeader, Pill, Stat } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'

const METRICS: ProgressMetric[] = ['e1rm', 'topWeight', 'volume']
const LAST_KEY = 'wt:lastExercise'
const DAY = 86400000

const RANGES = [
  { key: '4w', label: '4W', days: 28 },
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 182 },
  { key: 'all', label: 'All', days: Infinity },
] as const
type RangeKey = (typeof RANGES)[number]['key']

export function ProgressPage() {
  const [exerciseId, setExerciseId] = useState<number | null>(() => {
    const v = localStorage.getItem(LAST_KEY)
    return v ? Number(v) : null
  })
  const [metric, setMetric] = useState<ProgressMetric>('e1rm')
  const [range, setRange] = useState<RangeKey>('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId],
  )
  const allSets = useLiveQuery(
    () =>
      exerciseId
        ? db.sets.where('exerciseId').equals(exerciseId).toArray()
        : [],
    [exerciseId],
  )
  const goals = useLiveQuery(
    () =>
      exerciseId
        ? db.goals.where('exerciseId').equals(exerciseId).toArray()
        : [],
    [exerciseId],
  )

  // Range cutoff anchored to the most recent session.
  const cutoff = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days
    if (!Number.isFinite(days) || !allSets?.length) return -Infinity
    const lastT = Math.max(...allSets.map((s) => Date.parse(`${s.date}T12:00:00`)))
    return lastT - days * DAY
  }, [range, allSets])

  const rangedSets = useMemo(
    () =>
      (allSets ?? []).filter(
        (s) => Date.parse(`${s.date}T12:00:00`) >= cutoff,
      ),
    [allSets, cutoff],
  )

  const series = useMemo(
    () => buildSeries(rangedSets, metric),
    [rangedSets, metric],
  )
  const setPoints = useMemo(
    () => (metric === 'volume' ? [] : buildSetPoints(rangedSets, metric)),
    [rangedSets, metric],
  )
  const prsAll = useMemo(() => computePRs(allSets ?? []), [allSets])

  // Highlight the best point currently visible.
  const peak = useMemo(() => {
    if (series.length === 0) return null
    return series.reduce((m, p) => (p.value > m.value ? p : m), series[0])
  }, [series])

  const goal = useMemo(() => {
    if (metric === 'volume') return undefined
    return (goals ?? []).find(
      (g) =>
        (metric === 'e1rm' && g.metric === 'e1rm') ||
        (metric === 'topWeight' && g.metric === 'weight'),
    )
  }, [goals, metric])

  function pick(id: number) {
    setExerciseId(id)
    localStorage.setItem(LAST_KEY, String(id))
    setPickerOpen(false)
  }

  const unit = exercise?.unit ?? 'kg'
  const hasData = series.length > 0

  return (
    <div>
      <PageHeader title="Progress" subtitle="Trend over time" />

      <button
        onClick={() => setPickerOpen(true)}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left active:bg-surface-2"
      >
        <span className="truncate font-semibold">
          {exercise?.name ?? 'Choose an exercise'}
        </span>
        <span className="shrink-0 text-sm text-muted">Change ›</span>
      </button>

      {!exerciseId ? (
        <EmptyState
          title="Pick an exercise"
          hint="See how your estimated 1RM is trending."
          action={<Button onClick={() => setPickerOpen(true)}>Choose</Button>}
        />
      ) : !hasData ? (
        <EmptyState
          title="No data in this range"
          hint={`Log some sets of ${exercise?.name ?? 'this exercise'}, or widen the date range.`}
        />
      ) : (
        <>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {METRICS.map((m) => (
              <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
                {METRIC_LABEL[m]}
              </Pill>
            ))}
          </div>

          <Card className="mb-3 overflow-hidden">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted">
                  {METRIC_LABEL[metric]} {metric !== 'volume' && `(${unit})`}
                </p>
                <p className="text-2xl font-extrabold tabular-nums">
                  {series[series.length - 1].value}
                  <span className="ml-1 text-sm font-medium text-muted">{unit}</span>
                </p>
              </div>
              {series.length >= 2 && <TrendBadge series={series} />}
            </div>

            <Chart
              series={series}
              setPoints={setPoints}
              goal={goal?.target}
              peak={peak}
            />

            <div className="mt-2 flex justify-end gap-1.5">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    range === r.key
                      ? 'bg-accent text-black'
                      : 'bg-surface-2 text-muted active:text-text'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Card>

          {goal && (
            <GoalStrip
              current={
                metric === 'e1rm'
                  ? prsAll.bestE1rm?.value ?? 0
                  : prsAll.bestWeight?.weight ?? 0
              }
              target={goal.target}
              unit={unit}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Best weight"
              value={prsAll.bestWeight?.weight ?? '–'}
              unit={unit}
              sub={prsAll.bestWeight ? `×${prsAll.bestWeight.reps}` : undefined}
            />
            <Stat
              label="Best e1RM"
              value={prsAll.bestE1rm?.value ?? '–'}
              unit={unit}
            />
            <Stat label="Sessions" value={series.length} sub={`in ${RANGES.find((r) => r.key === range)!.label}`} />
          </div>
        </>
      )}

      {pickerOpen && (
        <ExercisePicker
          onClose={() => setPickerOpen(false)}
          onPick={pick}
          allowCreate={false}
        />
      )}
    </div>
  )
}

function TrendBadge({ series }: { series: { value: number }[] }) {
  const first = series[0].value
  const last = series[series.length - 1].value
  const diff = last - first
  const pct = first > 0 ? (diff / first) * 100 : 0
  const up = diff >= 0
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
        up ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function GoalStrip({
  current,
  target,
  unit,
}: {
  current: number
  target: number
  unit: string
}) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0)
  const reached = current >= target
  return (
    <Card className="mb-3">
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold">🎯 Goal</span>
        <span className="text-muted tabular-nums">
          {current} / {target} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!reached && (
        <p className="mt-1.5 text-xs text-muted">
          {Math.round((target - current) * 10) / 10} {unit} to go
        </p>
      )}
      {reached && <p className="mt-1.5 text-xs font-medium text-accent">Reached 🎉</p>}
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const point = payload.find((p: any) => p.dataKey === 'value') ?? payload[0]
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 text-muted">{prettyDateMs(Number(label))}</p>
      <p className="text-sm font-bold tabular-nums">{point.value}</p>
    </div>
  )
}

function Chart({
  series,
  setPoints,
  goal,
  peak,
}: {
  series: { t: number; value: number }[]
  setPoints: { t: number; value: number }[]
  goal?: number
  peak: { t: number; value: number } | null
}) {
  const values = [...series.map((s) => s.value), ...setPoints.map((s) => s.value)]
  if (goal) values.push(goal)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, 2)
  const tMin = series[0].t
  const tMax = series[series.length - 1].t

  return (
    <div className="-mx-1 h-60 w-[calc(100%+0.5rem)]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={series}
          margin={{ top: 12, right: 10, left: -14, bottom: 0 }}
        >
          <defs>
            <linearGradient id="fillAccent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c2f53c" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#c2f53c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#23232a" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[tMin, tMax]}
            tickFormatter={shortDateMs}
            tick={{ fill: '#8b8b96', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a31' }}
            minTickGap={28}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: '#8b8b96', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={42}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: '#3a3a44', strokeWidth: 1 }}
          />
          {goal && (
            <ReferenceLine
              y={goal}
              stroke="#c2f53c"
              strokeDasharray="5 4"
              strokeOpacity={0.5}
              label={{
                value: `Goal ${goal}`,
                fill: '#c2f53c',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke="none"
            fill="url(#fillAccent)"
            isAnimationActive={false}
          />
          <ZAxis range={[14, 14]} />
          {setPoints.length > 0 && (
            <Scatter
              data={setPoints}
              dataKey="value"
              fill="#c2f53c"
              fillOpacity={0.25}
              shape="circle"
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#c2f53c"
            strokeWidth={2.5}
            dot={{ r: 2, fill: '#c2f53c', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#c2f53c', stroke: '#0a0a0b', strokeWidth: 2 }}
          />
          {peak && (
            <ReferenceDot
              x={peak.t}
              y={peak.value}
              r={4}
              fill="#c2f53c"
              stroke="#0a0a0b"
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
