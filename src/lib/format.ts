const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** ISO date (YYYY-MM-DD) for a Date, in local time. */
export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "Monday, 7 September" */
export function longDate(iso: string): string {
  const d = parseIso(iso)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** "07 Sep 2026" */
export function shortDate(iso: string): string {
  const d = parseIso(iso)
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

/** "14:32" */
export function time(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "07 Sep 2026, 14:32" */
export function stamp(isoTimestamp: string): string {
  const d = new Date(isoTimestamp)
  return `${shortDate(isoDate(d))}, ${time(isoTimestamp)}`
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDate(d)
}

export interface Variance {
  delta: number
  percent: number
  level: 'none' | 'minor' | 'major'
  label: string
}

/**
 * Difference between planned and actual quantity.
 * Under 10% is minor, 10% or more is major.
 */
export function variance(planned: string, actual: string): Variance | null {
  const p = parseFloat(planned)
  const a = parseFloat(actual)
  if (!isFinite(p) || !isFinite(a) || p === 0) return null

  const delta = a - p
  if (delta === 0) return null

  const percent = Math.abs(delta / p) * 100
  const rounded = Math.round(delta * 100) / 100
  return {
    delta: rounded,
    percent,
    level: percent >= 10 ? 'major' : 'minor',
    label: `${rounded > 0 ? '+' : ''}${rounded}`,
  }
}

export function pct(n: number): string {
  return `${Math.round(n)}%`
}

export function signed(n: number, suffix = ''): string {
  if (n === 0) return `no change`
  return `${n > 0 ? '+' : ''}${n}${suffix} vs yesterday`
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
