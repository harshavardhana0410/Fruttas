import { useEffect, useRef, useState } from 'react'
import { Camera } from '@phosphor-icons/react'
import { compressToJpeg } from '../../lib/image'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { Notice } from '../ui/Feedback'

/**
 * Evidence is taken here, not chosen from a gallery: the camera opens in the
 * sheet, the frame is shot, compressed and confirmed. The file input only
 * appears if the browser will not hand over a camera at all — a desktop
 * reviewer, or a staff member who declined the permission.
 */
export function CameraSheet({
  open,
  section,
  onClose,
  onCapture,
}: {
  open: boolean
  section: string
  onClose: () => void
  onCapture: (url: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [live, setLive] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shot, setShot] = useState<{ url: string; size: number } | null>(null)
  const [attempt, setAttempt] = useState(0)

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLive(false)
  }

  useEffect(() => {
    if (!open || shot) return
    let cancelled = false
    setBlocked(false)

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setLive(true)
      })
      .catch(() => {
        if (!cancelled) setBlocked(true)
      })

    return () => {
      cancelled = true
      stopCamera()
    }
    // attempt re-runs this after a retake.
  }, [open, shot, attempt])

  // Nothing holds the camera open behind a closed sheet.
  useEffect(() => {
    if (!open) {
      stopCamera()
      discard()
    }
  }, [open])

  function discard() {
    setShot((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return null
    })
  }

  async function take(source: Blob | HTMLVideoElement) {
    setBusy(true)
    try {
      const blob = await compressToJpeg(source)
      stopCamera()
      setShot({ url: URL.createObjectURL(blob), size: blob.size })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={shot ? 'Use this photo?' : `Photo — ${section}`}
      footer={
        shot ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                discard()
                setAttempt((a) => a + 1)
              }}
            >
              Retake
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onCapture(shot.url)
                setShot(null)
                onClose()
              }}
            >
              Use photo
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={!live || busy}
            onClick={() => videoRef.current && take(videoRef.current)}
          >
            <Camera size={16} />
            {busy ? 'Compressing' : 'Take photo'}
          </Button>
        )
      }
    >
      {shot ? (
        <>
          <img
            src={shot.url}
            alt={`Photo for ${section}`}
            className="w-full rounded-card border border-hairline object-contain"
          />
          <p className="mt-3 font-mono tabular text-[12px] text-ink-soft">
            {Math.round(shot.size / 1024)} KB · compressed for upload
          </p>
        </>
      ) : (
        <>
          <div className="aspect-[3/4] w-full overflow-hidden rounded-card border border-hairline bg-sunken">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          </div>

          {!live && !blocked && (
            <p className="mt-3 text-[13px] text-ink-soft">Starting the camera…</p>
          )}

          {blocked && (
            <div className="mt-3">
              <Notice
                tone="warn"
                title="This device will not open its camera here."
                action={
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    Use the camera app
                  </Button>
                }
              >
                Allow camera access for this site, or take the photo with the device camera app
                instead.
              </Notice>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                aria-label={`Photo for ${section}`}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void take(file)
                }}
              />
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}
