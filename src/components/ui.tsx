import type { ReactNode } from 'react'
import { formatDmy } from '../lib/date'

/**
 * Date picker whose visible text we control (always day-first DD/MM/YYYY),
 * while a transparent native <input type="date"> overlaid on top still opens
 * the device's calendar. Native date inputs format themselves from the
 * browser's UI language, which on a Belgian device set to English shows
 * month-first — this sidesteps that.
 */
export function DateField({
  value,
  onChange,
  max,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  max?: string
  className?: string
}) {
  return (
    <label
      className={`relative flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 text-base ${className}`}
    >
      <span className="tabular-nums">{formatDmy(value)}</span>
      <span aria-hidden className="text-muted">
        📅
      </span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 ${className}`}
    >
      {children}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'surface'
  type?: 'button' | 'submit'
  className?: string
  disabled?: boolean
}) {
  const variants = {
    primary: 'bg-accent text-black font-semibold hover:bg-accent-dim',
    surface: 'bg-surface-2 text-text hover:bg-border',
    ghost: 'bg-transparent text-muted hover:text-text',
    danger: 'bg-transparent text-danger hover:bg-danger/10',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface text-2xl">
        💪
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Pill({
  children,
  active,
  onClick,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent text-black'
          : 'bg-surface-2 text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

export function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: ReactNode
  unit?: string
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}
