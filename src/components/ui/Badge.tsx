import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

export type Tone = 'pass' | 'fail' | 'warn' | 'info' | 'neutral'

const TONES: Record<Tone, string> = {
  pass: 'bg-pass-bg text-pass-fg',
  fail: 'bg-fail-bg text-fail-fg',
  warn: 'bg-warn-bg text-warn-fg',
  info: 'bg-info-bg text-info-fg',
  neutral: 'bg-sunken text-ink-soft',
}

export function Badge({
  tone = 'neutral',
  plain = false,
  children,
  className,
}: {
  tone?: Tone
  /** Keeps the label as written. Use for values with units, e.g. "-1.6 kg". */
  plain?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-[3px]',
        'text-[10px] font-medium tracking-[0.05em] leading-none',
        plain ? 'normal-case' : 'uppercase',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Status wording is always paired with the colour — never colour alone. */
export function StatusBadge({ status }: { status: 'not-started' | 'in-progress' | 'submitted' }) {
  if (status === 'submitted') return <Badge tone="pass">Submitted</Badge>
  if (status === 'in-progress') return <Badge tone="warn">In progress</Badge>
  return <Badge tone="neutral">Not started</Badge>
}

export function IssueBadge({ count }: { count: number }) {
  if (count === 0) return <Badge tone="pass">Clear</Badge>
  return (
    <Badge tone="fail">
      {count} {count === 1 ? 'issue' : 'issues'}
    </Badge>
  )
}
