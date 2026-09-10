import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import type { Kitchen, Submission } from '../../lib/types'
import { IssueBadge } from '../ui/Badge'
import { pct, shortDate, time } from '../../lib/format'

export function formName(s: Submission): string {
  return s.type === 'audit' ? 'Kitchen Audit' : 'Item Check List'
}

/** One submission, rendered identically wherever a list of records appears. */
export function RecordRow({
  submission,
  kitchens,
  showKitchen = true,
  showCompliance = false,
  index = 0,
}: {
  submission: Submission
  kitchens: Kitchen[]
  showKitchen?: boolean
  showCompliance?: boolean
  index?: number
}) {
  const kitchen = kitchens.find((k) => k.id === submission.kitchenId)

  return (
    <Link
      to={`/records/${submission.id}`}
      style={{ '--i': index } as React.CSSProperties}
      className="animate-enter flex items-center gap-4 border-b border-hairline py-3 transition-colors last:border-0 hover:bg-sunken/60"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{formName(submission)}</p>
        <p className="truncate text-[13px] text-ink-soft">
          {showKitchen && kitchen ? `${kitchen.name} · ` : ''}
          {submission.submittedByName}
        </p>
        {/* Narrow screens have no date column, so carry it here instead —
            a record list without a date is not worth scanning. */}
        <p className="mt-0.5 font-mono tabular text-[12px] text-ink-soft sm:hidden">
          {shortDate(submission.date)} · {time(submission.submittedAt)}
        </p>
      </div>

      <div className="hidden shrink-0 text-right font-mono tabular text-[13px] text-ink-soft sm:block">
        <div>{shortDate(submission.date)}</div>
        <div>{time(submission.submittedAt)}</div>
      </div>

      {showCompliance && (
        <span className="hidden w-12 shrink-0 text-right font-mono tabular text-[13px] lg:block">
          {pct(submission.compliance)}
        </span>
      )}

      <IssueBadge count={submission.issues} />
      <CaretRight size={14} className="shrink-0 text-ink-mute" />
    </Link>
  )
}
