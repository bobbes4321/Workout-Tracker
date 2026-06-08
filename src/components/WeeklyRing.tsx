import { motion } from 'motion/react'

/** Circular progress ring for "training days this week vs target". */
export function WeeklyRing({
  value,
  target,
  onEdit,
}: {
  value: number
  target: number
  onEdit?: () => void
}) {
  const r = 30
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const hit = target > 0 && value >= target

  return (
    <button
      type="button"
      onClick={onEdit}
      className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center"
      aria-label="Edit weekly target"
    >
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="7"
        />
        <motion.circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - pct) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-extrabold tabular-nums">
          {value}
          <span className="text-muted">/{target}</span>
        </span>
        <span className="mt-0.5 text-[0.6rem] text-muted">
          {hit ? 'hit ✓' : 'days'}
        </span>
      </div>
    </button>
  )
}
