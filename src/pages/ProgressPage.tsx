import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../lib/db'
import {
  METRIC_LABEL,
  buildSeries,
  computePRs,
  type ProgressMetric,
} from '../lib/calc'
import { shortDate, prettyDate } from '../lib/date'
import { Button, Card, EmptyState, PageHeader, Pill, Stat } from '../components/ui'
import { ExercisePicker } from '../components/ExercisePicker'

const METRICS: ProgressMetric[] = ['e1rm', 'topWeight', 'volume']
const LAST_KEY = 'wt:lastExercise'

export function ProgressPage() {
  const [exerciseId, setExerciseId] = useState<number | null>(() => {
    const v = localStorage.getItem(LAST_KEY)
    return v ? Number(v) : null
  })
  const [metric, setMetric] = useState<ProgressMetric>('e1rm')
  const [pickerOpen, setPickerOpen] = useState(false)

  const exercise = useLiveQuery(
    () => (exerciseId ? db.exercises.get(exerciseId) : undefined),
    [exerciseId],
  )
  const sets = useLiveQuery(
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

  const series = useMemo(
    () => buildSeries(sets ?? [], metric),
    [sets, metric],
  )
  const prs = useMemo(() => computePRs(sets ?? []), [sets])

  const goalLine = useMemo(() => {
    if (metric === 'volume') return undefined
    const g = (goals ?? []).find(
      (x) =>
        !x.achievedAt &&
        ((metric === 'e1rm' && x.metric === 'e1rm') ||
          (metric === 'topWeight' && x.metric === 'weight')),
    )
    return g?.target
  }, [goals, metric])

  function pick(id: number) {
    setExerciseId(id)
    localStorage.setItem(LAST_KEY, String(id))
    setPickerOpen(false)
  }

  const unit = exercise?.unit ?? 'kg'

  return (
    <div>
      <PageHeader title="Progress" subtitle="Trend over time" />

      <button
        onClick={() => setPickerOpen(true)}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-left"
      >
        <span className="font-semibold">
          {exercise?.name ?? 'Choose an exercise'}
        </span>
        <span className="text-sm text-muted">Change ›</span>
      </button>

      {!exerciseId ? (
        <EmptyState
          title="Pick an exercise"
          hint="See how your estimated 1RM is trending."
          action={<Button onClick={() => setPickerOpen(true)}>Choose</Button>}
        />
      ) : series.length === 0 ? (
        <EmptyState
          title="No data yet"
          hint={`Log a few sets of ${exercise?.name ?? 'this exercise'} to see your trend.`}
        />
      ) : (
        <>
          <div className="mb-4 flex gap-2">
            {METRICS.map((m) => (
              <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>
                {METRIC_LABEL[m]}
              </Pill>
            ))}
          </div>

          <Card className="mb-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-sm font-medium text-muted">
                {METRIC_LABEL[metric]} {metric !== 'volume' && `(${unit})`}
              </p>
              {series.length >= 2 && <TrendBadge series={series} />}
            </div>
            <Chart series={series} goalLine={goalLine} />
          </Card>

          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="Best weight"
              value={prs.bestWeight?.weight ?? '–'}
              unit={unit}
              sub={prs.bestWeight ? `×${prs.bestWeight.reps}` : undefined}
            />
            <Stat
              label="Best e1RM"
              value={prs.bestE1rm?.value ?? '–'}
              unit={unit}
            />
            <Stat label="Sessions" value={series.length} />
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
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

function Chart({
  series,
  goalLine,
}: {
  series: { date: string; value: number }[]
  goalLine?: number
}) {
  const values = series.map((s) => s.value)
  if (goalLine) values.push(goalLine)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, 2)

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={series}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid stroke="#2a2a31" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: '#8b8b96', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a31' }}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: '#8b8b96', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            contentStyle={{
              background: '#1d1d22',
              border: '1px solid #2a2a31',
              borderRadius: 12,
              color: '#f4f4f6',
              fontSize: 13,
            }}
            labelFormatter={(l) => prettyDate(String(l))}
            labelStyle={{ color: '#8b8b96', marginBottom: 4 }}
            formatter={(v) => [v as number, 'Value']}
          />
          {goalLine && (
            <ReferenceLine
              y={goalLine}
              stroke="#c2f53c"
              strokeDasharray="5 4"
              strokeOpacity={0.6}
              label={{
                value: `Goal ${goalLine}`,
                fill: '#c2f53c',
                fontSize: 11,
                position: 'insideTopRight',
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#c2f53c"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#c2f53c', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
