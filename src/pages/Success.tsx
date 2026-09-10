import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check } from '@phosphor-icons/react'
import { getRecordById, getTodayStatus } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { stamp } from '../lib/format'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Feedback'

export default function Success() {
  const { id = '' } = useParams()
  const user = useUser()
  const nav = useNavigate()

  const { data: record } = useAsync(() => getRecordById(id), [id])
  const { data: today } = useAsync(() => getTodayStatus(user.kitchenId), [user.kitchenId])

  const pending =
    today && today.audit.status !== 'submitted'
      ? { label: 'Kitchen Audit', to: '/audit/new' }
      : today && today.items.status !== 'submitted'
        ? { label: 'Item Check List', to: '/items/new' }
        : null

  return (
    <div className="mx-auto flex max-w-[400px] flex-col items-center py-16 text-center">
      <Check size={32} className="text-pass-fg" />

      <h1 className="title-editorial mt-5 text-[28px]">Checklist submitted</h1>

      {record ? (
        <p className="mt-2 font-mono tabular text-[12px] text-ink-soft">
          {record.id} · {stamp(record.submittedAt)}
        </p>
      ) : (
        <Skeleton className="mt-3 h-4 w-48" />
      )}

      <div className="mt-7 flex w-full flex-col gap-2">
        <Button variant="primary" size="lg" full onClick={() => nav('/')}>
          Back to today
        </Button>
        <Button variant="ghost" size="lg" full onClick={() => nav(`/records/${id}`)}>
          View submission
        </Button>
      </div>

      {pending && (
        <Link
          to={pending.to}
          className="mt-6 w-full rounded-card border border-hairline bg-surface p-4 text-left transition-shadow hover:shadow-lift"
        >
          <p className="text-[14px] font-medium">{pending.label} still pending</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">Open it now to finish today.</p>
        </Link>
      )}
    </div>
  )
}
