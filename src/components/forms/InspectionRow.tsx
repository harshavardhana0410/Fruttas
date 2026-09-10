import { useRef } from 'react'
import { Camera, X, Warning } from '@phosphor-icons/react'
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
  const fileRef = useRef<HTMLInputElement>(null)

  const failed = answer.value === 'no'
  const missingAnswer = showErrors && answer.value === null
  const missingRemarks = showErrors && failed && answer.remarks.trim() === ''
  const missingPhoto = showErrors && failed && point.requirePhotoOnFail && answer.photos.length === 0

  function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const urls = Array.from(files).map((f) => URL.createObjectURL(f))
    onChange({ ...answer, photos: [...answer.photos, ...urls] })
  }

  function removePhoto(url: string) {
    URL.revokeObjectURL(url)
    onChange({ ...answer, photos: answer.photos.filter((p) => p !== url) })
  }

  return (
    <div
      id={`point-${point.id}`}
      className={cx('scroll-mt-32 border-b border-hairline py-5', missingAnswer && 'bg-fail-bg/30')}
    >
      <div className="flex gap-3">
        <span className="w-6 shrink-0 pt-0.5 font-mono tabular text-[12px] text-ink-soft">
          {pad2(point.serial)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1.5">
            <p className="flex-1 text-[15px] leading-[1.5]">{point.text}</p>
            {point.critical && <Badge tone="warn">Critical</Badge>}
          </div>

          <Segmented
            className="mt-3.5"
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
                  Remarks {point.requirePhotoOnFail ? 'and photo' : ''}
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    tabIndex={failed ? 0 : -1}
                    onClick={() => fileRef.current?.click()}
                    className={cx(
                      'flex h-11 items-center gap-2 rounded-control border px-3 text-[13px]',
                      'transition-colors hover:bg-sunken',
                      missingPhoto ? 'border-fail-fg text-fail-fg' : 'border-hairline text-ink-soft',
                    )}
                  >
                    <Camera size={16} />
                    Add photo
                  </button>

                  {answer.photos.map((url, i) => (
                    <span
                      key={url}
                      className="flex h-11 items-center gap-2 rounded-control border border-hairline bg-sunken pl-2 pr-1 text-[12px]"
                    >
                      <img src={url} alt="" className="h-8 w-8 rounded-chip object-cover" />
                      <span className="font-mono tabular text-ink-soft">{pad2(i + 1)}</span>
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        aria-label={`Remove photo ${i + 1}`}
                        className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-soft hover:bg-hairline"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addPhotos(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </div>

                {missingPhoto && (
                  <p className="mt-1.5 text-[12px] text-fail-fg">
                    A photo is required for this point when marking No.
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
