/** Local YYYY-MM-DD for a Date (defaults to now). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** "Mon 26 Sep" style label from a YYYY-MM-DD string. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "26 Sep '25" compact label for chart axes. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function shortDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function prettyDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function relativeDay(iso: string): string {
  const today = isoDate()
  if (iso === today) return 'Today'
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (iso === isoDate(yest)) return 'Yesterday'
  return prettyDate(iso)
}

/** "Today" / "Yesterday" / "3 days ago" / "2 weeks ago" / date for older. */
export function fromNow(iso: string): string {
  const [ty, tm, td] = isoDate().split('-').map(Number)
  const [y, m, d] = iso.split('-').map(Number)
  const today = new Date(ty, tm - 1, td)
  const that = new Date(y, m - 1, d)
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 14) return 'Last week'
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`
  return prettyDate(iso)
}
