import type { CoverageRow } from '../lib/stats'

/** Horizontal frequency bars: sessions/week per muscle group over the window. */
export function CoverageBars({ rows }: { rows: CoverageRow[] }) {
  if (rows.length === 0) return null
  const max = Math.max(1, ...rows.map((r) => r.perWeek))

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const stale = row.daysSince == null || row.daysSince > 10
        return (
          <div key={row.category}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium">
                {row.category}
                {row.fromBouldering && (
                  <span className="ml-1 text-muted" title="includes bouldering">
                    🧗
                  </span>
                )}
              </span>
              <span className="tabular-nums text-muted">
                {row.perWeek}×/wk
                <span className="mx-1.5 opacity-40">·</span>
                {row.daysSince == null
                  ? 'never'
                  : row.daysSince === 0
                    ? 'today'
                    : `${row.daysSince}d ago`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full ${stale ? 'bg-accent-dim/60' : 'bg-accent'}`}
                style={{ width: `${(row.perWeek / max) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
