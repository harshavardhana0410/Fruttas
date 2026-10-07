import { useState } from 'react'
import { Camera, X } from '@phosphor-icons/react'
import { cx } from '../../lib/cx'
import { CameraSheet } from './CameraSheet'

/**
 * One photo, taken on the spot. Used for a main heading's photo of the
 * station and for a point's photo of what was wrong — both hold a single
 * photo, so shooting again replaces it and there is nothing to choose between.
 */
export function PhotoSlot({
  anchorId,
  label,
  hint,
  url,
  invalid,
  tabIndex,
  onChange,
}: {
  /** Scroll target when a submit attempt stops here. */
  anchorId: string
  /** Names the slot in the camera sheet and to a screen reader. */
  label: string
  hint: string
  url?: string
  invalid: boolean
  tabIndex?: number
  onChange: (url: string | null) => void
}) {
  const [shooting, setShooting] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        id={anchorId}
        tabIndex={tabIndex}
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
            tabIndex={tabIndex}
            onClick={() => onChange(null)}
            aria-label={`Remove the photo for ${label}`}
            className="flex h-8 w-8 items-center justify-center rounded-chip text-ink-soft hover:bg-hairline"
          >
            <X size={13} />
          </button>
        </span>
      ) : (
        <p className={cx('text-[12px]', invalid ? 'text-fail-fg' : 'text-ink-soft')}>{hint}</p>
      )}

      <CameraSheet
        open={shooting}
        section={label}
        onClose={() => setShooting(false)}
        onCapture={onChange}
      />
    </div>
  )
}
