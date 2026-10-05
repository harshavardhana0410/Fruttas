import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from '@phosphor-icons/react'
import { getAuditTemplate, getKitchens, getRecordById } from '../lib/data'
import { useAsync } from '../lib/useAsync'
import { useRecordStream } from '../lib/useRealtime'
import { stamp } from '../lib/format'
import { SubmissionDocument } from '../components/data/SubmissionDocument'
import { Button } from '../components/ui/Button'
import { EmptyState, Skeleton } from '../components/ui/Feedback'
import { formName } from '../components/data/RecordRow'

export default function RecordDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()

  const { data: record, loading, reload } = useAsync(() => getRecordById(id), [id])
  const { data: points } = useAsync(() => getAuditTemplate(), [])
  const { data: kitchens, reload: reloadKitchens } = useAsync(() => getKitchens(), [])
  useRecordStream(() => {
    reload()
    reloadKitchens()
  })

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px]">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-4 h-40" />
      </div>
    )
  }

  if (!record) {
    return (
      <EmptyState
        icon={<ArrowLeft size={24} />}
        title="Record not found"
        body="This submission may have been removed, or the link is wrong."
        action={{ label: 'Back to records', onClick: () => nav('/records') }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-[720px]">
      {/* Print-only letterhead. */}
      <div className="mb-6 hidden print:block">
        <p className="font-serif text-[20px] tracking-[0.16em]">FRUTTA</p>
        <p className="label-section mt-1">Kitchen Operations</p>
      </div>

      <div className="mb-5 flex flex-col gap-3 no-print sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <button
            onClick={() => nav(-1)}
            className="-ml-1 mb-2 flex items-center gap-1.5 text-[13px] text-ink-soft hover:text-ink"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <h1 className="title-editorial text-[30px]">{formName(record)}</h1>
        </div>

        <div className="-ml-2 flex shrink-0 gap-2 sm:ml-0">
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer size={15} />
            Print
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            Export PDF
          </Button>
        </div>
      </div>

      <p className="mb-5 font-mono tabular text-[12px] text-ink-soft">
        Submitted {stamp(record.submittedAt)} by {record.submittedByName} · Locked
      </p>

      <SubmissionDocument
        meta={{
          formName: formName(record),
          kitchen: kitchens?.find((k) => k.id === record.kitchenId),
          clientId: record.clientId,
          date: record.date,
          submittedByName: record.submittedByName,
        }}
        points={points ?? undefined}
        answers={record.type === 'audit' ? record.answers : undefined}
        sectionPhotos={record.type === 'audit' ? record.sectionPhotos : undefined}
        items={record.type === 'items' ? record.items : undefined}
      />
    </div>
  )
}
