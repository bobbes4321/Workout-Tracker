import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../lib/db'
import { dateToTs } from '../lib/calc'
import { isoDate, prettyDateMs, relativeDay, shortDateMs } from '../lib/date'
import { Button, DateField } from './ui'
import { Stepper } from './Stepper'

const DAY = 86400000
const RANGES = [
  { key: '4w', label: '4W', days: 28 },
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 182 },
  { key: 'all', label: 'All', days: Infinity },
] as const
type RangeKey = (typeof RANGES)[number]['key']

interface Point {
  t: number
  value: number
}

export function BodyweightCard() {
  const entries = useLiveQuery(
    () => db.bodyweights.orderBy('date').toArray(),
    [],
  )
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<RangeKey>('3m')

  const all = useMemo<Point[]>(
    () => (entries ?? []).map((e) => ({ t: dateToTs(e.date), value: e.weight })),
    [entries],
  )

  const series = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days
    if (!Number.isFinite(days) || all.length === 0) return all
    const cutoff = all[all.length - 1].t - days * DAY
    return all.filter((p) => p.t >= cutoff)
  }, [all, range])

  const latest = entries && entries.length ? entries[entries.length - 1] : null
  const delta = useMemo(() => {
    if (series.length < 2) return null
    return Math.round((series[series.length - 1].value - series[0].value) * 10) / 10
  }, [series])

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Bodyweight
          </p>
          {latest ? (
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums">
              {latest.weight}
              <span className="ml-1 text-sm font-medium text-muted">kg</span>
              {delta != null && delta !== 0 && (
                <span
                  className={`ml-2 text-xs font-bold ${delta > 0 ? 'text-muted' : 'text-accent'}`}
                >
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} kg
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted">Not logged yet</p>
          )}
        </div>
        <Button variant="surface" className="px-3 py-2" onClick={() => setOpen(true)}>
          + Log
        </Button>
      </div>

      {series.length >= 2 ? (
        <>
          <div className="-mx-1 mt-3 h-44 w-[calc(100%+0.5rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={series}
                margin={{ top: 8, right: 10, left: -14, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c2f53c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#c2f53c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#23232a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={shortDateMs}
                  tick={{ fill: '#8b8b96', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2a2a31' }}
                  minTickGap={28}
                />
                <YAxis
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tick={{ fill: '#8b8b96', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  content={<BwTooltip />}
                  cursor={{ stroke: '#3a3a44', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="none"
                  fill="url(#bw-fill)"
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#c2f53c"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#c2f53c', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#c2f53c', stroke: '#0a0a0b', strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
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
        </>
      ) : (
        latest && (
          <p className="mt-3 text-sm text-muted">
            Log a few more to see your progression trend.
          </p>
        )
      )}

      {open && (
        <BodyweightModal initial={latest?.weight} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

function BwTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 text-muted">{prettyDateMs(Number(label))}</p>
      <p className="text-sm font-bold tabular-nums">{payload[0].value} kg</p>
    </div>
  )
}

function BodyweightModal({
  initial,
  onClose,
}: {
  initial?: number
  onClose: () => void
}) {
  const [date, setDate] = useState(isoDate())
  const [weight, setWeight] = useState(initial ? String(initial) : '')

  async function save() {
    const w = parseFloat(weight)
    if (!Number.isFinite(w) || w <= 0) return
    // One entry per day — replace if the day already has one.
    const existing = await db.bodyweights.where('date').equals(date).first()
    if (existing) await db.bodyweights.update(existing.id!, { weight: w })
    else await db.bodyweights.add({ date, weight: w, createdAt: Date.now() })
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
          <h2 className="text-lg font-bold">Log bodyweight</h2>
          <button onClick={onClose} className="text-2xl leading-none text-muted">
            ×
          </button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Date</span>
          <DateField value={date} max={isoDate()} onChange={setDate} />
          <span className="mt-1 block text-xs text-muted">{relativeDay(date)}</span>
        </label>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">
            Weight (kg)
          </span>
          <Stepper value={weight} onChange={setWeight} step={0.1} />
        </div>

        <Button className="w-full" onClick={save} disabled={!weight}>
          Save
        </Button>
      </div>
    </div>
  )
}
