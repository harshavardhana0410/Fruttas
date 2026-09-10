import type { ReactNode } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { pad2 } from '../../lib/format'
import { cx } from '../../lib/cx'

/**
 * Chrome shared by both form flows: a sticky header carrying the hairline
 * progress bar, and a sticky action bar within thumb reach.
 */
export function FormShell({
  title,
  progress,
  actions,
  children,
  wide,
}: {
  title: string
  progress?: { done: number; total: number }
  actions: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  const nav = useNavigate()

  return (
    <div className="-mx-5 -my-6 lg:-mx-8 lg:-my-8">
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/95 backdrop-blur-sm no-print">
        <div className={cx('mx-auto flex h-14 items-center gap-3 px-5 lg:px-8', wide ? 'max-w-[1280px]' : 'max-w-[900px]')}>
          <button
            onClick={() => nav(-1)}
            aria-label="Go back"
            className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-ink-soft hover:bg-sunken"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 truncate text-[15px] font-medium">{title}</h1>
          {progress && (
            <span className="shrink-0 font-mono tabular text-[12px] text-ink-soft">
              {pad2(progress.done)} / {pad2(progress.total)}
            </span>
          )}
        </div>
        {progress && (
          <div
            className="h-0.5 w-full bg-hairline"
            role="progressbar"
            aria-valuenow={progress.done}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Inspection progress"
          >
            <div
              className="h-full bg-ink transition-transform duration-300 origin-left"
              style={{ transform: `scaleX(${progress.total ? progress.done / progress.total : 0})` }}
            />
          </div>
        )}
      </header>

      <div className={cx('mx-auto px-5 pb-32 pt-6 lg:px-8', wide ? 'max-w-[1280px]' : 'max-w-[900px]')}>
        {children}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface no-print lg:pl-60"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className={cx('mx-auto flex h-16 items-center justify-between gap-3 px-5 lg:px-8', wide ? 'max-w-[1280px]' : 'max-w-[900px]')}>
          {actions}
        </div>
      </div>
    </div>
  )
}
