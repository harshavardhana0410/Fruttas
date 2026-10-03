import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from './Button'

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
}

function useAutoFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const el = ref.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([data-close])',
    )
    el?.focus()
  }, [open])
  return ref
}

/**
 * Right drawer on desktop, bottom sheet on mobile.
 * Data entry never happens in a centred modal.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useDismiss(open, onClose)
  const ref = useAutoFocus(open)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 no-print">
      <div
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          'absolute flex flex-col bg-surface ' +
          'inset-x-0 bottom-0 max-h-[88vh] rounded-t-card border-t border-hairline shadow-sheet ' +
          'lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:max-h-none lg:w-[400px] ' +
          'lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none'
        }
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-5">
          <h2 className="text-[15px] font-medium">{title}</h2>
          <button
            data-close
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-control text-ink-soft hover:bg-sunken"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/**
 * Confirmation only — plain, hairline-bordered, no icon, no colour.
 * Never used for data entry or for validation errors.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  busy,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel?: string
  busy?: boolean
}) {
  useDismiss(open, onClose)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 no-print">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[380px] rounded-card border border-hairline bg-surface p-5"
      >
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-soft">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Submitting' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
