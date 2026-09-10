import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'

const BASE =
  'w-full rounded-control border bg-sunken px-3 text-[15px] text-ink ' +
  'transition-colors duration-150 outline-none ' +
  'focus-visible:border-ink disabled:opacity-50'

/** Labels are real <label> elements. Placeholders are never labels. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string
  hint?: string
  error?: string
  children: (id: string) => ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] text-ink-soft">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[12px] text-fail-fg">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-ink-soft">{hint}</p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  align?: 'left' | 'right'
  mono?: boolean
}

export function Input({ invalid, align = 'left', mono, className, ...rest }: InputProps) {
  return (
    <input
      className={cx(
        BASE,
        'h-11',
        invalid ? 'border-fail-fg' : 'border-hairline',
        align === 'right' && 'text-right',
        mono && 'font-mono tabular',
        className,
      )}
      {...rest}
    />
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cx(
        BASE,
        'min-h-[76px] resize-y py-2.5 leading-[1.5]',
        invalid ? 'border-fail-fg' : 'border-hairline',
        className,
      )}
      {...rest}
    />
  )
}

/** A read-only definition row, used across Review, Detail and Settings. */
export function DefRow({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-0">
      <dt className="shrink-0 text-[13px] text-ink-soft">{term}</dt>
      <dd className="text-right text-[14px]">{children}</dd>
    </div>
  )
}
