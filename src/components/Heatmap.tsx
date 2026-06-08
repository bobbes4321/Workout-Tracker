import type { HeatCell } from '../lib/stats'
import { prettyDate } from '../lib/date'

// Distinct hues so the kind of day is legible at a glance.
const LIFT = '194,245,60' // lime — lifting
const BOULDER = '45,212,191' // teal — bouldering
const BOTH = '192,132,252' // violet — both in one day

// Lift days shade by how much was logged; bouldering is a single tone.
function liftOpacity(sets: number): number {
  if (sets <= 3) return 0.4
  if (sets <= 6) return 0.6
  if (sets <= 10) return 0.8
  return 1
}

function cellColor(c: HeatCell): string {
  const hasLift = c.sets > 0
  if (hasLift && c.bouldering) return `rgba(${BOTH},${liftOpacity(c.sets)})`
  if (hasLift) return `rgba(${LIFT},${liftOpacity(c.sets)})`
  if (c.bouldering) return `rgba(${BOULDER},0.85)`
  return 'var(--color-surface-2)'
}

function cellTitle(c: HeatCell): string {
  if (c.isFuture) return prettyDate(c.date)
  const parts: string[] = []
  if (c.sets > 0) parts.push(`${c.sets} set${c.sets === 1 ? '' : 's'}`)
  if (c.bouldering) parts.push('bouldering 🧗')
  return `${prettyDate(c.date)} — ${parts.length ? parts.join(' + ') : 'rest'}`
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className="h-2.5 w-2.5 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}

export function Heatmap({ weeks }: { weeks: HeatCell[][] }) {
  return (
    <div>
      <div className="flex gap-[3px]">
        {weeks.map((col, i) => (
          <div key={i} className="flex flex-1 flex-col gap-[3px]">
            {col.map((c) => (
              <div
                key={c.date}
                title={cellTitle(c)}
                className={`aspect-square rounded-[3px] ${
                  c.isFuture ? 'opacity-0' : ''
                } ${c.isToday ? 'ring-1 ring-text/70' : ''}`}
                style={{ backgroundColor: cellColor(c) }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-muted">
        <Swatch color={`rgba(${LIFT},1)`} label="Lift" />
        <Swatch color={`rgba(${BOULDER},0.85)`} label="Boulder" />
        <Swatch color={`rgba(${BOTH},1)`} label="Both" />
      </div>
    </div>
  )
}
