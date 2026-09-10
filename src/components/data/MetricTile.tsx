import { cx } from '../../lib/cx'

/**
 * Label, then the figure in serif, then a plain-language delta.
 * No arrows, no coloured tile backgrounds, no count-up animation.
 */
export function MetricTile({
  label,
  value,
  delta,
  tone = 'neutral',
  index = 0,
}: {
  label: string
  value: string | number
  delta?: string
  tone?: 'neutral' | 'pass' | 'fail' | 'warn'
  index?: number
}) {
  const deltaTone = {
    neutral: 'text-ink-soft',
    pass: 'text-pass-fg',
    fail: 'text-fail-fg',
    warn: 'text-warn-fg',
  }[tone]

  return (
    <div
      className="animate-enter rounded-card border border-hairline bg-surface p-5"
      style={{ '--i': index } as React.CSSProperties}
    >
      <p className="label-section">{label}</p>
      <p className="title-editorial mt-2 text-[40px] tabular">{value}</p>
      {delta && <p className={cx('mt-1 font-mono tabular text-[12px]', deltaTone)}>{delta}</p>}
    </div>
  )
}
