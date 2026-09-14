import { Warning } from '@phosphor-icons/react'
import type { ItemEntry, YesNo } from '../../lib/types'
import { Segmented } from '../ui/Segmented'
import { Textarea } from '../ui/Field'
import { measuringLabel, pad2 } from '../../lib/format'
import { cx } from '../../lib/cx'

/**
 * One item from the chef's list, checked by staff with Yes or No.
 * Same shape as an audit point so both forms feel identical in the kitchen.
 */
export function ItemCheckRow({
  item,
  index,
  onChange,
  showErrors,
}: {
  item: ItemEntry
  index: number
  onChange: (next: ItemEntry) => void
  showErrors?: boolean
}) {
  const missing = showErrors && item.value === null

  return (
    <div
      id={`item-${item.id}`}
      className={cx('scroll-mt-32 border-b border-hairline py-4 sm:py-3', missing && 'bg-fail-bg/30')}
    >
      <div className="flex gap-3">
        <span className="w-6 shrink-0 pt-0.5 font-mono tabular text-[12px] text-ink-soft">
          {pad2(index + 1)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="sm:flex sm:items-center sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium leading-[1.5]">{item.name}</p>
              <p className="font-mono tabular text-[13px] text-ink-soft">
                {item.quantity} {item.unit} · {measuringLabel(item.measuring)}
              </p>
            </div>

            <Segmented
              className="mt-3 sm:mt-0 sm:w-[180px] sm:shrink-0"
              size="lg"
              label={`Item ${index + 1}: ${item.name}`}
              value={item.value}
              invalid={missing}
              onChange={(v: YesNo) => onChange({ ...item, value: v })}
              options={[
                { value: 'yes', label: 'Yes', tone: 'pass' },
                { value: 'no', label: 'No', tone: 'fail' },
              ]}
            />
          </div>

          {missing && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-fail-fg">
              <Warning size={13} weight="bold" />
              Answer required.
            </p>
          )}

          {item.value === 'no' && (
            <div className="mt-3">
              <label htmlFor={`item-note-${item.id}`} className="text-[13px] text-ink-soft">
                What was wrong (optional)
              </label>
              <Textarea
                id={`item-note-${item.id}`}
                className="mt-1.5"
                placeholder="Short by 2 kg, missing, wrong item…"
                value={item.remarks}
                onChange={(e) => onChange({ ...item, remarks: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
