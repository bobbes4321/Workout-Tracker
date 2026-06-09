/**
 * Fixed display locale so dates render the same on every device — day-first,
 * English month/day names — regardless of the browser's UI language. (We're a
 * single-user, European app; this avoids US month-first ordering.)
 */
const LOCALE = 'en-GB'

/** "09/06/2026" — explicit day-first numeric, fully locale-independent. */
export function formatDmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Today as e.g. "Tuesday, 9 June" for page headers. */
export function longToday(): string {
  return new Date().toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Local YYYY-MM-DD for a Date (defaults to now). */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Add n days to a YYYY-MM-DD string, returning a YYYY-MM-DD string (local). */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}

/** Start of the week (Monday by default) for a YYYY-MM-DD string. */
export function startOfWeekIso(iso: string, weekStartsOn = 1): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(y, m - 1, d).getDay() // 0=Sun … 6=Sat
  const diff = (day - weekStartsOn + 7) % 7
  return isoDate(new Date(y, m - 1, d - diff))
}

/** Whole days between two YYYY-MM-DD strings (a - b), local-safe. */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round(
    (new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) /
      86400000,
  )
}

/** "Mon 26 Sep" style label from a YYYY-MM-DD string. */
export function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "26 Sep '25" compact label for chart axes. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

export function shortDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
  })
}

export function prettyDateMs(ms: number): string {
  return new Date(ms).toLocaleDateString(LOCALE, {
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
