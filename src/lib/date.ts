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

export function relativeDay(iso: string): string {
  const today = isoDate()
  if (iso === today) return 'Today'
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  if (iso === isoDate(yest)) return 'Yesterday'
  return prettyDate(iso)
}
