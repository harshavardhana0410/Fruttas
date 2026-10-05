import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check } from '@phosphor-icons/react'
import { getRecordById, getTodayStatus } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { auditStatus, pct, stamp } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Feedback'

export default function Success() {
  const { id = '' } = useParams()
  const user = useUser()
  const nav = useNavigate()

  const { data: record } = useAsync(() => getRecordById(id), [id])
  const { data: today } = useAsync(() => getTodayStatus(user.kitchenId), [user.kitchenId])

  // Scored out of this checklist's own length, whatever it holds today.
  const total = record ? (record.type === 'audit' ? record.answers.length : record.items.length) : 0
  const completed = total - (record?.issues ?? 0)
  const status = auditStatus(record?.compliance ?? 0)

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

      {record && total > 0 && (
        <div className="mt-5 w-full rounded-card border border-hairline bg-surface p-4 text-left">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-medium">{status.label}</p>
            <Badge tone={status.tone}>{pct(record.compliance)}</Badge>
          </div>
          <p className="mt-1 font-mono tabular text-[13px] text-ink-soft">
            {completed} of {total} completed · {record.issues} not completed
          </p>
        </div>
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
