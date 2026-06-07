/**
 * Numeric input flanked by −/+ buttons for quick thumb entry.
 * Holding a button repeats (accelerating) for fast large changes.
 */
import { useRef } from 'react'

export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  max,
  inputMode = 'decimal',
}: {
  value: string
  onChange: (v: string) => void
  step: number
  min?: number
  max?: number
  inputMode?: 'decimal' | 'numeric'
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const interval = useRef<ReturnType<typeof setInterval> | null>(null)

  const clamp = (n: number) => {
    let v = Math.max(min, n)
    if (max != null) v = Math.min(max, v)
    // Avoid float dust like 7.500000001
    return Math.round(v * 100) / 100
  }

  const bump = (dir: 1 | -1) => {
    const cur = parseFloat(value)
    const base = Number.isFinite(cur) ? cur : 0
    onChange(String(clamp(base + dir * step)))
  }

  const startHold = (dir: 1 | -1) => {
    bump(dir)
    timer.current = setTimeout(() => {
      interval.current = setInterval(() => bump(dir), 80)
    }, 400)
  }
  const stopHold = () => {
    if (timer.current) clearTimeout(timer.current)
    if (interval.current) clearInterval(interval.current)
    timer.current = null
    interval.current = null
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface-2 focus-within:border-accent">
      <button
        type="button"
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        className="flex w-11 shrink-0 items-center justify-center text-xl font-semibold text-muted transition-colors active:bg-border active:text-text"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        type="text"
        className="w-full min-w-0 bg-transparent py-3 text-center text-lg font-bold tabular-nums outline-none"
      />
      <button
        type="button"
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        className="flex w-11 shrink-0 items-center justify-center text-xl font-semibold text-accent transition-colors active:bg-border"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}
