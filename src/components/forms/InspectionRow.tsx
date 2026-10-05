import { Warning } from '@phosphor-icons/react'
import type { AuditAnswer, InspectionPoint, YesNo } from '../../lib/types'
import { Segmented } from '../ui/Segmented'
import { Textarea } from '../ui/Field'
import { Badge } from '../ui/Badge'
import { pad2 } from '../../lib/format'
import { cx } from '../../lib/cx'

interface Props {
  point: InspectionPoint
  answer: AuditAnswer
  onChange: (next: AuditAnswer) => void
  /** Set after a failed submit attempt so the row shows what is missing. */
  showErrors?: boolean
}

export function InspectionRow({ point, answer, onChange, showErrors }: Props) {
  const failed = answer.value === 'no'
  const missingAnswer = showErrors && answer.value === null
  const missingRemarks = showErrors && failed && answer.remarks.trim() === ''

  return (
    <div
      id={`point-${point.id}`}
      className={cx('scroll-mt-32 border-b border-hairline py-4 sm:py-3', missingAnswer && 'bg-fail-bg/30')}
    >
      <div className="flex gap-3">
        <span className="w-6 shrink-0 pt-0.5 font-mono tabular text-[12px] text-ink-soft">
          {pad2(point.serial)}
        </span>

        <div className="min-w-0 flex-1">
          {/* Question and answer share one row from sm up. Stacked, every
              point cost ~150px and only four fitted on a laptop screen.
              Phones keep the full-width 52px buttons for gloved hands. */}
          <div className="sm:flex sm:items-center sm:gap-5">
            <div className="flex flex-1 flex-wrap items-start gap-x-2 gap-y-1.5">
              <p className="flex-1 text-[15px] leading-[1.5]">{point.text}</p>
              {point.critical && <Badge tone="warn">Critical</Badge>}
            </div>

            <Segmented
              className="mt-3 sm:mt-0 sm:w-[180px] sm:shrink-0"
              size="lg"
              label={`Point ${point.serial}: ${point.text}`}
              value={answer.value}
              invalid={missingAnswer}
              onChange={(v: YesNo) => onChange({ ...answer, value: v })}
              options={[
                { value: 'yes', label: 'Yes', tone: 'pass' },
                { value: 'no', label: 'No', tone: 'fail' },
              ]}
            />
          </div>

          {missingAnswer && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fail-fg">
              <Warning size={13} weight="bold" />
              Answer required.
            </p>
          )}

          {/* Grid-rows reveal: the one place a size transition is worth it. */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out"
            style={{ gridTemplateRows: failed ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div className="pt-3">
                <label
                  htmlFor={`remarks-${point.id}`}
                  className="text-[13px] text-ink-soft"
                >
                  Remarks
                </label>
                <Textarea
                  id={`remarks-${point.id}`}
                  className="mt-1.5"
                  placeholder="What was found, and what was done about it."
                  value={answer.remarks}
                  invalid={missingRemarks}
                  tabIndex={failed ? 0 : -1}
                  onChange={(e) => onChange({ ...answer, remarks: e.target.value })}
                />
                {missingRemarks && (
                  <p className="mt-1.5 text-[12px] text-fail-fg">
                    Remarks required when marking No.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
