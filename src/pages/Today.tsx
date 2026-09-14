import { Link } from 'react-router-dom'
import { CaretRight, ClipboardText, ListChecks, Storefront } from '@phosphor-icons/react'
import { getTodayStatus } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useRecordStream } from '../lib/useRealtime'
import { isoDate, longDate } from '../lib/format'
import type { FormStatus } from '../lib/types'
import { PageTitle, SectionLabel } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { EmptyState, Notice, Skeleton, SkeletonRows } from '../components/ui/Feedback'
import { RecordRow } from '../components/data/RecordRow'
import { getKitchens } from '../lib/data'

export default function Today() {
  const user = useUser()
  // Not an error: the account just hasn't been given a kitchen yet.
  // Checked before any fetch, so it never reaches the database.
  return user.kitchenId ? <TodayContent /> : <NoKitchen />
}

function NoKitchen() {
  return (
    <>
      <PageTitle>{longDate(isoDate())}</PageTitle>
      <div className="rounded-card border border-dashed border-hairline">
        <EmptyState
          icon={<Storefront size={24} />}
          title="No kitchen assigned yet"
          body="Ask your admin to add you to a kitchen. Your daily checklists will appear here once that's done."
          // The profile is read once at sign-in, so pick up a new assignment by reloading.
          action={{ label: 'Check again', onClick: () => window.location.reload() }}
        />
      </div>
    </>
  )
}

function TodayContent() {
  const user = useUser()
  const { data, loading, reload } = useAsync(() => getTodayStatus(user.kitchenId), [user.kitchenId])
  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])
  useRecordStream(() => {
    reload()
    reloadKitchens()
  })

  if (loading || !data) {
    return (
      <>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[124px]" />
          <Skeleton className="h-[124px]" />
        </div>
        <div className="mt-8">
          <SkeletonRows count={3} />
        </div>
      </>
    )
  }

  const allDone = data.audit.status === 'submitted' && data.items.status === 'submitted'

  return (
    <>
      <PageTitle
        sub={
          <>
            {data.kitchen.name} · <span className="font-mono tabular">{data.kitchen.clientId}</span>
          </>
        }
      >
        {longDate(data.date)}
      </PageTitle>

      <div className="grid gap-3 lg:grid-cols-2">
        <TaskCard
          to="/audit/new"
          icon={<ListChecks size={20} />}
          title="Kitchen Audit"
          detail="16 inspection points"
          status={data.audit.status}
          submissionId={data.audit.submissionId}
          index={0}
        />
        <TaskCard
          to="/items/new"
          icon={<ClipboardText size={20} />}
          title="Item Check List"
          detail="Check the chef's items, Yes or No"
          status={data.items.status}
          submissionId={data.items.submissionId}
          index={1}
        />
      </div>

      {allDone && (
        <div className="mt-4">
          <Notice tone="pass">Both checklists complete for today.</Notice>
        </div>
      )}

      <section className="mt-8">
        <SectionLabel>Recent submissions</SectionLabel>
        <div className="mt-2">
          {data.recent.length === 0 ? (
            <p className="border-t border-hairline py-6 text-[13px] text-ink-soft">
              Nothing submitted from this kitchen yet.
            </p>
          ) : (
            <div className="border-t border-hairline">
              {data.recent.map((s, i) => (
                <RecordRow
                  key={s.id}
                  submission={s}
                  kitchens={kitchens ?? []}
                  showKitchen={false}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

function TaskCard({
  to,
  icon,
  title,
  detail,
  status,
  submissionId,
  index,
}: {
  to: string
  icon: React.ReactNode
  title: string
  detail: string
  status: FormStatus
  submissionId?: string
  index: number
}) {
  const done = status === 'submitted'
  const href = done && submissionId ? `/records/${submissionId}` : to

  return (
    <Link
      to={href}
      style={{ '--i': index } as React.CSSProperties}
      className="animate-enter flex min-h-[96px] flex-col justify-between rounded-card border border-hairline bg-surface p-6 transition-shadow duration-200 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-ink">{icon}</span>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[17px] font-medium">{title}</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {done ? 'View submitted record' : detail}
          </p>
        </div>
        <CaretRight size={16} className="mb-1 shrink-0 text-ink-mute" />
      </div>
    </Link>
  )
}
