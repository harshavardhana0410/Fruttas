import { useRef } from 'react'
import { cx } from '../../lib/cx'
import type { Tone } from './Badge'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  tone?: Tone
}

interface Props<T extends string> {
  label: string
  value: T | null
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md' | 'lg'
  className?: string
  invalid?: boolean
}

const SIZES = {
  sm: 'h-9 text-[13px]',
  md: 'h-11 text-[14px]',
  lg: 'h-[52px] text-[15px]',
}

const SELECTED: Record<Tone, string> = {
  pass: 'bg-pass-bg text-pass-fg border-pass-fg',
  fail: 'bg-fail-bg text-fail-fg border-fail-fg',
  warn: 'bg-warn-bg text-warn-fg border-warn-fg',
  info: 'bg-info-bg text-info-fg border-info-fg',
  neutral: 'bg-ink text-white border-ink',
}

/**
 * A radio group rendered as a split control.
 * Roving tabindex, arrow keys move and select — as a radio group should.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  size = 'md',
  className,
  invalid,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const next = (index + (forward ? 1 : -1) + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  const selectedIndex = options.findIndex((o) => o.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(
        'grid overflow-hidden rounded-control border',
        invalid ? 'border-fail-fg' : 'border-hairline',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, i) => {
        const active = option.value === value
        const tone = option.tone ?? 'neutral'
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={selectedIndex === -1 ? (i === 0 ? 0 : -1) : active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              'relative -m-px flex items-center justify-center border font-medium',
              'transition-colors duration-150',
              SIZES[size],
              active
                ? cx(SELECTED[tone], 'z-10')
                : 'border-transparent bg-transparent text-ink-soft hover:bg-sunken',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
