import type { AuditAnswer, InspectionPoint, ItemEntry, Kitchen } from '../../lib/types'
import { Badge } from '../ui/Badge'
import { Notice } from '../ui/Feedback'
import { DefRow } from '../ui/Field'
import { longDate, pad2, variance } from '../../lib/format'

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
}: {
  meta: Meta
  points?: InspectionPoint[]
  answers?: AuditAnswer[]
  items?: ItemEntry[]
}) {
  const failures =
    answers && points
      ? answers
          .map((a) => ({ a, p: points.find((p) => p.id === a.pointId) }))
          .filter((x): x is { a: AuditAnswer; p: InspectionPoint } => Boolean(x.p) && x.a.value === 'no')
      : []

  const notOk = items?.filter((i) => i.taste === 'notok') ?? []
  const issueCount = failures.length + notOk.length

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
                <li key={i.id}>{i.name} · taste marked Not Ok</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>

      {answers && points && <AuditBody points={points} answers={answers} />}
      {items && <ItemsBody items={items} />}
    </div>
  )
}

function AuditBody({ points, answers }: { points: InspectionPoint[]; answers: AuditAnswer[] }) {
  let section = ''
  return (
    <div>
      {points.map((p) => {
        const a = answers.find((x) => x.pointId === p.id)
        const header = p.section !== section ? ((section = p.section), p.section) : null
        return (
          <div key={p.id}>
            {header && (
              <h3 className="label-section border-b border-hairline pb-2 pt-5 first:pt-0">
                {header}
              </h3>
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
                {a?.photos && a.photos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.photos.map((url, i) => (
                      <img
                        key={url}
                        src={url}
                        alt={`Evidence ${i + 1} for point ${p.serial}`}
                        className="h-14 w-14 rounded-chip border border-hairline object-cover"
                      />
                    ))}
                  </div>
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
            {['No', 'Item', 'Planned', 'Actual', 'Variance', 'Taste', 'Measuring'].map((h) => (
              <th key={h} scope="col" className="label-section px-2 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const v = variance(item.plannedQty, item.actualQty)
            return (
              <tr key={item.id} className="border-b border-hairline print-block">
                <td className="px-2 py-2.5 font-mono tabular text-[13px] text-ink-soft">
                  {pad2(i + 1)}
                </td>
                <td className="px-2 py-2.5 text-[14px]">{item.name}</td>
                <td className="px-2 py-2.5 font-mono tabular text-[13px]">
                  {item.plannedQty} {item.unit}
                </td>
                <td className="px-2 py-2.5 font-mono tabular text-[13px]">
                  {item.actualQty} {item.unit}
                </td>
                <td className="px-2 py-2.5">
                  {v ? (
                    <Badge
                      plain
                      tone={v.level === 'major' ? 'fail' : 'warn'}
                      className="font-mono tabular"
                    >
                      {v.label} {item.unit}
                    </Badge>
                  ) : (
                    <span className="text-[13px] text-ink-mute">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  <Badge tone={item.taste === 'notok' ? 'fail' : 'pass'}>
                    {item.taste === 'notok' ? 'Not Ok' : 'Ok'}
                  </Badge>
                </td>
                <td className="px-2 py-2.5 text-[13px] text-ink-soft">
                  {item.measuring === 'tare' ? 'Tare' : 'Non-Tare'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
