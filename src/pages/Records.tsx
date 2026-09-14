import { useState } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { getKitchens, getRecords, toCsv } from '../lib/data'
import { useUser } from '../lib/session'
import { useAsync } from '../lib/useAsync'
import { useRecordStream } from '../lib/useRealtime'
import { daysAgo } from '../lib/format'
import type { RecordFilters } from '../lib/types'
import { PageTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState, SkeletonRows } from '../components/ui/Feedback'
import { RecordRow } from '../components/data/RecordRow'
import { cx } from '../lib/cx'

const RANGES = [
  { value: '', label: 'All time' },
  { value: daysAgo(7), label: 'Last 7 days' },
  { value: daysAgo(30), label: 'Last 30 days' },
]

const SELECT =
  'h-9 rounded-control border border-hairline bg-surface px-2.5 text-[13px] text-ink ' +
  'outline-none transition-colors hover:bg-sunken cursor-pointer'

export default function Records() {
  const user = useUser()
  const canSeeAll = user.role === 'manager' || user.role === 'admin'

  const [filters, setFilters] = useState<RecordFilters>({ type: 'all', status: 'all' })
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)

  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])

  const effective: RecordFilters = {
    ...filters,
    query: query || undefined,
    limit,
    kitchenId: canSeeAll ? filters.kitchenId : user.kitchenId,
  }

  const { data: rows, loading, reload } = useAsync(
    () => getRecords(effective),
    [JSON.stringify(effective)],
  )

  useRecordStream(() => {
    reload()
    reloadKitchens()
  })

  function set<K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) {
    setLimit(20)
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const pills = [
    filters.from && { key: 'from', label: RANGES.find((r) => r.value === filters.from)?.label },
    filters.kitchenId && {
      key: 'kitchenId',
      label: kitchens?.find((k) => k.id === filters.kitchenId)?.name,
    },
    filters.type !== 'all' && {
      key: 'type',
      label: filters.type === 'audit' ? 'Kitchen Audit' : 'Item Check List',
    },
    filters.status !== 'all' && {
      key: 'status',
      label: filters.status === 'issues' ? 'With issues' : 'Clear',
    },
  ].filter(Boolean) as { key: keyof RecordFilters; label: string }[]

  function exportCsv() {
    if (!rows || !kitchens) return
    const blob = new Blob([toCsv(rows, kitchens)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `frutta-records-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageTitle sub={canSeeAll ? 'All kitchens' : 'Submissions from your kitchen'}>
          Records
        </PageTitle>
        {canSeeAll && (
          <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!rows?.length}>
            Export CSV
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          className={SELECT}
          aria-label="Date range"
          value={filters.from ?? ''}
          onChange={(e) => set('from', e.target.value || undefined)}
        >
          {RANGES.map((r) => (
            <option key={r.label} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {canSeeAll && (
          <select
            className={SELECT}
            aria-label="Kitchen"
            value={filters.kitchenId ?? ''}
            onChange={(e) => set('kitchenId', e.target.value || undefined)}
          >
            <option value="">All kitchens</option>
            {kitchens?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        )}

        <select
          className={SELECT}
          aria-label="Form type"
          value={filters.type}
          onChange={(e) => set('type', e.target.value as RecordFilters['type'])}
        >
          <option value="all">All forms</option>
          <option value="audit">Kitchen Audit</option>
          <option value="items">Item Check List</option>
        </select>

        <select
          className={SELECT}
          aria-label="Status"
          value={filters.status}
          onChange={(e) => set('status', e.target.value as RecordFilters['status'])}
        >
          <option value="all">Any status</option>
          <option value="issues">With issues</option>
          <option value="clear">Clear</option>
        </select>

        <div className="relative min-w-[180px] flex-1">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mute"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(20)
            }}
            placeholder="Search by person, kitchen or client ID"
            aria-label="Search records"
            className="h-9 w-full rounded-control bg-sunken pl-8 pr-3 text-[13px] outline-none transition-shadow focus-visible:outline-2"
          />
        </div>
      </div>

      {pills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pills.map((p) => (
            <button
              key={p.key}
              onClick={() => set(p.key, p.key === 'type' || p.key === 'status' ? ('all' as never) : undefined)}
              className="flex items-center gap-1.5 rounded-full bg-info-bg px-2.5 py-1 text-[11px] text-info-fg transition-opacity hover:opacity-80"
            >
              {p.label}
              <X size={11} weight="bold" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        <div className="hidden border-b border-hairline bg-sunken lg:flex lg:items-center lg:gap-4 lg:px-0 lg:py-2">
          <span className="label-section flex-1">Submission</span>
          <span className="label-section w-[86px] text-right">Date</span>
          <span className="label-section w-12 text-right">Score</span>
          <span className="label-section w-[86px] text-right">Findings</span>
          <span className="w-3.5" />
        </div>

        {loading && !rows ? (
          <SkeletonRows count={6} />
        ) : !rows || rows.length === 0 ? (
          <EmptyState
            icon={<MagnifyingGlass size={24} />}
            title="No records match these filters"
            body="Try widening the date range or clearing the search."
            action={{
              label: 'Clear filters',
              onClick: () => {
                setFilters({ type: 'all', status: 'all' })
                setQuery('')
              },
            }}
          />
        ) : (
          <>
            <div className={cx(!rows.length && 'hidden')}>
              {rows.map((s, i) => (
                <RecordRow
                  key={s.id}
                  submission={s}
                  kitchens={kitchens ?? []}
                  showCompliance
                  index={i}
                />
              ))}
            </div>

            {rows.length >= limit && (
              <div className="flex justify-center pt-5">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 20)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
