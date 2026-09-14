import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Storefront } from '@phosphor-icons/react'
import { getKitchenById, getKitchens } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { useRecordStream } from '../lib/useRealtime'
import { pct, stamp } from '../lib/format'
import { PageTitle, SectionLabel } from '../components/ui/Card'
import { MetricTile } from '../components/data/MetricTile'
import { ComplianceStrip } from '../components/data/Compliance'
import { RecordRow } from '../components/data/RecordRow'
import { RoleBadge } from '../components/ui/Badge'
import { EmptyState, Skeleton, SkeletonRows } from '../components/ui/Feedback'

export default function KitchenDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()

  const { data, loading, reload } = useAsync(() => getKitchenById(id), [id])
  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])

  useRecordStream(() => {
    reload()
    reloadKitchens()
  })

  if (loading) {
    return (
      <>
        <Skeleton className="h-9 w-64" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
        <div className="mt-8">
          <SkeletonRows count={4} />
        </div>
      </>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={<Storefront size={24} />}
        title="Kitchen not found"
        body="This kitchen may have been removed, or the link is wrong."
        action={{ label: 'Back to kitchens', onClick: () => nav('/kitchens') }}
      />
    )
  }

  const { kitchen, staff } = data

  return (
    <>
      <button
        onClick={() => nav('/kitchens')}
        className="-ml-1 mb-2 flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={14} />
        Kitchens
      </button>

      <PageTitle
        sub={
          <>
            <span className="font-mono tabular">{kitchen.clientId}</span> · {kitchen.location}
          </>
        }
      >
        {kitchen.name}
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile index={0} label="Compliance" value={pct(data.compliance)} />
        <MetricTile index={1} label="Audits this month" value={data.auditsThisMonth} />
        <MetricTile
          index={2}
          label="Open issues"
          value={data.openIssues}
          tone={data.openIssues > 0 ? 'fail' : 'pass'}
        />
        <MetricTile
          index={3}
          label="Last submission"
          value={data.lastSubmission ? stamp(data.lastSubmission).split(',')[0] : '—'}
          delta={data.lastSubmission ? stamp(data.lastSubmission).split(', ')[1] : 'never'}
        />
      </div>

      <section className="mt-8">
        <SectionLabel>Last 30 days</SectionLabel>
        <p className="mb-3 mt-1 text-[13px] text-ink-soft">
          One square per day, oldest first. Gaps are days with no audit.
        </p>
        <ComplianceStrip days={data.strip} />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionLabel>Submissions</SectionLabel>
          <div className="mt-2 border-t border-hairline">
            {data.submissions.length === 0 ? (
              <p className="py-6 text-[13px] text-ink-soft">Nothing submitted from this kitchen.</p>
            ) : (
              data.submissions.map((s, i) => (
                <RecordRow
                  key={s.id}
                  submission={s}
                  kitchens={kitchens ?? []}
                  showKitchen={false}
                  showCompliance
                  index={i}
                />
              ))
            )}
          </div>
        </section>

        <section>
          <SectionLabel>Assigned staff</SectionLabel>
          <ul className="mt-2 border-t border-hairline">
            {staff.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 border-b border-hairline py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px]">{u.name}</p>
                  <p className="font-mono tabular text-[12px] text-ink-soft">{u.staffId}</p>
                </div>
                <RoleBadge role={u.role} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}
