import type {
  AuditAnswer,
  InspectionPoint,
  ItemEntry,
  Kitchen,
  PhotoMap,
  YesNo,
} from '../../lib/types'
import { Badge } from '../ui/Badge'
import { Notice } from '../ui/Feedback'
import { DefRow } from '../ui/Field'
import { auditStatus, longDate, measuringLabel, pad2, pct } from '../../lib/format'

interface Meta {
  formName: string
  kitchen?: Kitchen
  clientId: string
  date: string
  submittedByName: string
}

/**
 * The record as a document. Used both before submitting and after,
 * so what a person reviews is exactly what gets filed.
 */
export function SubmissionDocument({
  meta,
  points,
  answers,
  items,
  sectionPhotos,
  pointPhotos,
}: {
  meta: Meta
  points?: InspectionPoint[]
  answers?: AuditAnswer[]
  items?: ItemEntry[]
  /** One photo per main heading, keyed by heading name. */
  sectionPhotos?: PhotoMap
  /** One photo per failed point, keyed by point id. */
  pointPhotos?: PhotoMap
}) {
  const failures =
    answers && points
      ? answers
          .map((a) => ({ a, p: points.find((p) => p.id === a.pointId) }))
          .filter((x): x is { a: AuditAnswer; p: InspectionPoint } => Boolean(x.p) && x.a.value === 'no')
      : []

  const notOk = items?.filter((i) => i.value === 'no') ?? []
  const issueCount = failures.length + notOk.length

  // Scored out of however many points the checklist holds, so the totals
  // follow the template rather than a fixed number.
  const checks: { value: YesNo | null }[] = answers ?? items ?? []
  const total = checks.length
  const completed = checks.filter((c) => c.value === 'yes').length
  const score = total ? Math.round((completed / total) * 100) : 0
  const status = auditStatus(score)

  return (
    <div className="print-full">
      <dl className="mb-6 rounded-card border border-hairline bg-surface px-4 py-1 print-block">
        <DefRow term="Form">{meta.formName}</DefRow>
        <DefRow term="Kitchen">{meta.kitchen?.name ?? '—'}</DefRow>
        <DefRow term="Client ID">
          <span className="font-mono tabular">{meta.clientId}</span>
        </DefRow>
        <DefRow term="Date">{longDate(meta.date)}</DefRow>
        <DefRow term="Submitted by">{meta.submittedByName}</DefRow>
      </dl>

      {total > 0 && (
        <div className="mb-6 rounded-card border border-hairline bg-surface p-5 print-block">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label-section">Overall status</p>
              <p className="title-editorial mt-1 text-[30px]">{status.label}</p>
            </div>
            <Badge tone={status.tone}>{pct(score)}</Badge>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-hairline pt-3 sm:grid-cols-4">
            <Figure label="Points checked" value={total} />
            <Figure label="Completed" value={completed} />
            <Figure label="Not completed" value={total - completed} />
            <Figure label="Marks" value={`${completed} / ${total}`} />
          </dl>
        </div>
      )}

      <div className="mb-6 print-block">
        {issueCount === 0 ? (
          <Notice tone="pass">No issues recorded.</Notice>
        ) : (
          <Notice
            tone="fail"
            title={`${issueCount} ${issueCount === 1 ? 'issue' : 'issues'} recorded`}
          >
            <ul className="mt-1 flex flex-col gap-1">
              {failures.map(({ p }) => (
                <li key={p.id}>
                  <span className="font-mono tabular">{pad2(p.serial)}</span> · {p.text}
                </li>
              ))}
              {notOk.map((i) => (
                <li key={i.id}>{i.name} · marked No{i.remarks ? ` (${i.remarks})` : ''}</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>

      {answers && points && (
        <AuditBody
          points={points}
          answers={answers}
          sectionPhotos={sectionPhotos ?? {}}
          pointPhotos={pointPhotos ?? {}}
        />
      )}
      {items && <ItemsBody items={items} />}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="label-section">{label}</dt>
      <dd className="mt-0.5 font-mono tabular text-[17px]">{value}</dd>
    </div>
  )
}

function AuditBody({
  points,
  answers,
  sectionPhotos,
  pointPhotos,
}: {
  points: InspectionPoint[]
  answers: AuditAnswer[]
  sectionPhotos: PhotoMap
  pointPhotos: PhotoMap
}) {
  let section = ''
  return (
    <div>
      {points.map((p) => {
        const a = answers.find((x) => x.pointId === p.id)
        const header = p.section !== section ? ((section = p.section), p.section) : null
        return (
          <div key={p.id}>
            {header && (
              <>
                <h3 className="label-section border-b border-hairline pb-2 pt-5 first:pt-0">
                  {header}
                </h3>
                {sectionPhotos[header] && (
                  <div className="border-b border-hairline py-3 print-block">
                    <img
                      src={sectionPhotos[header]}
                      alt={`Evidence for ${header}`}
                      className="h-28 w-28 rounded-chip border border-hairline object-cover"
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex gap-3 border-b border-hairline py-3 print-block">
              <span className="w-6 shrink-0 font-mono tabular text-[12px] text-ink-soft">
                {pad2(p.serial)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] leading-[1.5]">{p.text}</p>
                {a?.remarks && (
                  <p className="mt-1.5 border-l-2 border-hairline pl-3 text-[13px] text-ink-soft">
                    {a.remarks}
                  </p>
                )}
                {pointPhotos[p.id] && (
                  <img
                    src={pointPhotos[p.id]}
                    alt={`Evidence for point ${p.serial}`}
                    className="mt-2 h-20 w-20 rounded-chip border border-hairline object-cover"
                  />
                )}
              </div>
              <div className="shrink-0">
                {a?.value === 'yes' && <Badge tone="pass">Yes</Badge>}
                {a?.value === 'no' && <Badge tone="fail">No</Badge>}
                {!a?.value && <Badge tone="neutral">Not answered</Badge>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ItemsBody({ items }: { items: ItemEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline bg-sunken">
            {['No', 'Item', 'Quantity', 'Measuring', 'Check', 'Note'].map((h) => (
              <th key={h} scope="col" className="label-section px-2 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} className="border-b border-hairline print-block">
              <td className="px-2 py-2.5 font-mono tabular text-[13px] text-ink-soft">{pad2(i + 1)}</td>
              <td className="px-2 py-2.5 text-[14px]">{item.name}</td>
              <td className="px-2 py-2.5 font-mono tabular text-[13px]">
                {item.quantity} {item.unit}
              </td>
              <td className="px-2 py-2.5 text-[13px] text-ink-soft">{measuringLabel(item.measuring)}</td>
              <td className="px-2 py-2.5">
                <Badge tone={item.value === 'no' ? 'fail' : 'pass'}>{item.value === 'no' ? 'No' : 'Yes'}</Badge>
              </td>
              <td className="px-2 py-2.5 text-[13px] text-ink-soft">{item.remarks || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
