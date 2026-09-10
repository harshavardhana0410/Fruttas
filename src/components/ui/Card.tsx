import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../../lib/cx'

interface CardProps {
  children: ReactNode
  className?: string
  /** Adds the single permitted hover lift. Only for genuinely clickable cards. */
  interactive?: boolean
  style?: React.CSSProperties
}

export function Card({ children, className, interactive, style }: CardProps) {
  return (
    <div
      style={style}
      className={cx(
        'rounded-card border border-hairline bg-surface',
        interactive && 'transition-shadow duration-200 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function LinkCard({
  to,
  children,
  className,
  style,
}: {
  to: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <Link
      to={to}
      style={style}
      className={cx(
        'block rounded-card border border-hairline bg-surface',
        'transition-shadow duration-200 hover:shadow-lift',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx('label-section', className)}>{children}</h2>
}

export function PageTitle({
  children,
  sub,
}: {
  children: ReactNode
  sub?: ReactNode
}) {
  return (
    <div className="mb-6">
      <h1 className="title-editorial text-[30px] sm:text-[36px]">{children}</h1>
      {sub && <p className="mt-1.5 text-[13px] text-ink-soft">{sub}</p>}
    </div>
  )
}
