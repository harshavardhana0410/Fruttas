import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Button } from './Button'

/** Skeletons match the final layout's dimensions. Never a spinner. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-skeleton rounded-chip bg-sunken', className)} aria-hidden />
}

export function SkeletonRows({ count = 5, height = 'h-14' }: { count?: number; height?: string }) {
  return (
    <div className="divide-y divide-hairline" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx('flex items-center gap-4 py-3', height)}>
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-ink-mute">{icon}</div>
      <p className="mt-3 text-[15px]">{title}</p>
      <p className="mt-1 max-w-[36ch] text-[13px] text-ink-soft">{body}</p>
      {action && (
        <Button variant="outline" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

/** A quiet callout. Carries a text label so meaning never rests on colour. */
export function Notice({
  tone = 'neutral',
  title,
  children,
  action,
}: {
  tone?: 'pass' | 'fail' | 'warn' | 'neutral'
  title?: string
  children?: ReactNode
  action?: ReactNode
}) {
  const tones = {
    pass: 'border-pass-fg/25 bg-pass-bg text-pass-fg',
    fail: 'border-fail-fg/25 bg-fail-bg text-fail-fg',
    warn: 'border-warn-fg/25 bg-warn-bg text-warn-fg',
    neutral: 'border-hairline bg-surface text-ink',
  }
  return (
    <div className={cx('rounded-card border p-4', tones[tone])}>
      {title && <p className="text-[14px] font-medium">{title}</p>}
      {children && <div className={cx('text-[13px]', title && 'mt-1')}>{children}</div>}
      {action && <div className="mt-3 flex gap-2">{action}</div>}
    </div>
  )
}
