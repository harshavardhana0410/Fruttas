import { Link } from 'react-router-dom'
import type { Kitchen } from '../../lib/types'
import { pct, shortDate } from '../../lib/format'
import { cx } from '../../lib/cx'

/** Bars are ink at full compliance and shade to pastel only when below target. */
export function ComplianceBar({
  rows,
}: {
  rows: { kitchen: Kitchen; compliance: number }[]
}) {
  return (
    <ul className="flex flex-col">
      {rows.map(({ kitchen, compliance }, i) => (
        <li
          key={kitchen.id}
          className="animate-enter flex items-center gap-4 border-b border-hairline py-3 last:border-0"
          style={{ '--i': i } as React.CSSProperties}
        >
          <Link
            to={`/kitchens/${kitchen.id}`}
            className="w-[132px] shrink-0 truncate text-[14px] hover:underline"
          >
            {kitchen.name}
          </Link>
          <div className="h-1.5 flex-1 rounded-full bg-sunken">
            <div
              className={cx(
                'h-full rounded-full transition-[width] duration-500',
                compliance >= 95 ? 'bg-ink' : compliance >= 85 ? 'bg-warn-fg' : 'bg-fail-fg',
              )}
              style={{ width: `${Math.max(compliance, 2)}%` }}
            />
          </div>
          <span className="w-11 shrink-0 text-right font-mono tabular text-[13px]">
            {pct(compliance)}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Thirty days at a glance. The clearest possible read of whether a
 * kitchen is actually doing its checks.
 */
export function ComplianceStrip({
  days,
}: {
  days: { date: string; result: 'pass' | 'fail' | 'none' }[]
}) {
  const fill = {
    pass: 'bg-pass-bg border-pass-fg/30',
    fail: 'bg-fail-bg border-fail-fg/30',
    none: 'bg-sunken border-hairline',
  }
  const word = { pass: 'Clear', fail: 'Issues recorded', none: 'No submission' }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {days.map((d) => (
          <span
            key={d.date}
            title={`${shortDate(d.date)} — ${word[d.result]}`}
            className={cx('h-6 w-6 rounded-chip border', fill[d.result])}
          >
            <span className="sr-only">
              {shortDate(d.date)}: {word[d.result]}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
        <Key className="bg-pass-bg border-pass-fg/30">Clear</Key>
        <Key className="bg-fail-bg border-fail-fg/30">Issues</Key>
        <Key className="bg-sunken border-hairline">No submission</Key>
      </div>
    </div>
  )
}

function Key({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('h-3 w-3 rounded-[2px] border', className)} />
      {children}
    </span>
  )
}
