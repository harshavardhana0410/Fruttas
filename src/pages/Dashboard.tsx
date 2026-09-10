import { getDashboardMetrics, getKitchens } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { useSubmissionStream } from '../lib/useRealtime'
import { longDate, isoDate, pad2, pct, signed } from '../lib/format'
import { PageTitle, SectionLabel } from '../components/ui/Card'
import { MetricTile } from '../components/data/MetricTile'
import { ComplianceBar } from '../components/data/Compliance'
import { RecordRow } from '../components/data/RecordRow'
import { Skeleton, SkeletonRows } from '../components/ui/Feedback'

export default function Dashboard() {
  const { data, loading, reload } = useAsync(() => getDashboardMetrics(), [])
  const { data: kitchens } = useAsync(() => getKitchens(), [])

  // A kitchen reporting in should appear without anyone pressing refresh.
  useSubmissionStream(reload)

  if (loading || !data) {
    return (
      <>
        <Skeleton className="h-9 w-56" />
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

  return (
    <>
      <PageTitle sub={longDate(isoDate())}>Dashboard</PageTitle>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          index={0}
          label="Audits completed today"
          value={pad2(data.auditsToday)}
          delta={signed(data.auditsTodayDelta)}
          tone={data.auditsTodayDelta < 0 ? 'fail' : 'neutral'}
        />
        <MetricTile
          index={1}
          label="Compliance rate"
          value={pct(data.complianceRate)}
          delta={signed(data.complianceDelta, ' pts')}
          tone={data.complianceDelta < 0 ? 'fail' : data.complianceDelta > 0 ? 'pass' : 'neutral'}
        />
        <MetricTile
          index={2}
          label="Open issues"
          value={data.openIssues}
          delta={signed(data.openIssuesDelta)}
          tone={data.openIssuesDelta > 0 ? 'fail' : 'neutral'}
        />
        <MetricTile
          index={3}
          label="Kitchens reporting"
          value={`${data.kitchensReporting}/${data.kitchensTotal}`}
          delta={
            data.kitchensReporting < data.kitchensTotal
              ? `${data.kitchensTotal - data.kitchensReporting} not yet reported`
              : 'all reported'
          }
          tone={data.kitchensReporting < data.kitchensTotal ? 'warn' : 'pass'}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <section className="rounded-card border border-hairline bg-surface p-5 lg:col-span-2">
          <SectionLabel>Compliance by kitchen</SectionLabel>
          <p className="mb-3 mt-1 text-[13px] text-ink-soft">Average across the last seven days.</p>
          <ComplianceBar rows={data.byKitchen} />
        </section>

        <section className="rounded-card border border-hairline bg-surface p-5">
          <SectionLabel>Most failed checks</SectionLabel>
          <p className="mb-3 mt-1 text-[13px] text-ink-soft">Last seven days.</p>
          {data.topFailures.length === 0 ? (
            <p className="py-4 text-[13px] text-ink-soft">No failed checks in this period.</p>
          ) : (
            <ul>
              {data.topFailures.map(({ point, count }, i) => (
                <li
                  key={point.id}
                  style={{ '--i': i } as React.CSSProperties}
                  className="animate-enter flex items-start gap-3 border-b border-hairline py-2.5 last:border-0"
                >
                  <span className="font-mono tabular text-[12px] text-ink-soft">
                    {pad2(point.serial)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]" title={point.text}>
                    {point.text}
                  </span>
                  <span className="font-mono tabular text-[13px]">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-8">
        <SectionLabel>Recent activity</SectionLabel>
        <div className="mt-2 border-t border-hairline">
          {data.recent.map((s, i) => (
            <RecordRow key={s.id} submission={s} kitchens={kitchens ?? []} showCompliance index={i} />
          ))}
        </div>
      </section>
    </>
  )
}
