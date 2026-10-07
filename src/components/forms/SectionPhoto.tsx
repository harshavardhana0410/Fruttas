import { useState } from 'react'
import { Camera, X } from '@phosphor-icons/react'
import { cx } from '../../lib/cx'
import { CameraSheet } from './CameraSheet'

/**
 * One photo for a main heading, taken on the spot. Shooting again replaces it —
 * the record holds a single photo per heading, so there is nothing to choose
 * between.
 */
export function SectionPhoto({
  section,
  url,
  required,
  invalid,
  onChange,
}: {
  section: string
  url?: string
  /** True once something under this heading is marked No. */
  required: boolean
  invalid: boolean
  onChange: (url: string | null) => void
}) {
  const [shooting, setShooting] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline py-3">
      <button
        type="button"
        id={`section-photo-${section.replace(/\s+/g, '-')}`}
        onClick={() => setShooting(true)}
        className={cx(
          'flex h-11 scroll-mt-32 items-center gap-2 rounded-control border px-3 text-[13px]',
          'transition-colors hover:bg-sunken',
          invalid ? 'border-fail-fg text-fail-fg' : 'border-hairline text-ink-soft',
        )}
      >
        <Camera size={16} />
        {url ? 'Retake photo' : 'Take photo'}
      </button>

      {url ? (
        <span className="flex h-11 items-center gap-2 rounded-control border border-hairline bg-sunken pl-2 pr-1 text-[12px]">
          <img src={url} alt="" className="h-8 w-8 rounded-chip object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove the photo for ${section}`}
            className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-soft hover:bg-hairline"
          >
            <X size={13} />
          </button>
        </span>
      ) : (
        <p className={cx('text-[12px]', invalid ? 'text-fail-fg' : 'text-ink-soft')}>
          {required
            ? 'A photo is required — something here was marked No.'
            : 'One photo for this section. Optional until a point is marked No.'}
        </p>
      )}

      <CameraSheet
        open={shooting}
        section={section}
        onClose={() => setShooting(false)}
        onCapture={onChange}
      />
    </div>
  )
}
