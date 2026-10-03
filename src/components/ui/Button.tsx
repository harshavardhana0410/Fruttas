import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-canvas border border-ink hover:opacity-90',
  outline: 'bg-surface text-ink border border-hairline hover:bg-sunken',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-sunken',
  danger: 'bg-transparent text-fail-fg border border-transparent hover:bg-fail-bg',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px]',
  md: 'h-11 px-4 text-[14px]',
  lg: 'h-12 px-5 text-[15px]',
}

export function Button({
  variant = 'outline',
  size = 'md',
  full = false,
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium',
        'transition-[background-color,transform,border-color] duration-150',
        'active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
