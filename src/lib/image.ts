/** The ceiling a filed photo has to fit under. */
export const MAX_PHOTO_BYTES = 150 * 1024

/** Longest edge. Enough to read a label or see a spill; not a print master. */
const MAX_EDGE = 1600

const QUALITIES = [0.82, 0.65, 0.5, 0.38, 0.28, 0.2]

/**
 * A phone photo straight from a 12MP camera is 3–5 MB, and kitchen Wi-Fi is
 * what it is. Re-encode to JPEG under 150 KB: drop the quality first, and only
 * shrink the pixels when quality alone will not get there.
 *
 * Takes a camera frame (the live <video>) or a file, and always returns the
 * smallest JPEG it managed — never the original.
 */
export async function compressToJpeg(source: Blob | HTMLVideoElement): Promise<Blob> {
  let image: CanvasImageSource
  let width: number
  let height: number

  if (source instanceof Blob) {
    // from-image so a photo taken sideways is not filed sideways.
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' })
    image = bitmap
    width = bitmap.width
    height = bitmap.height
  } else {
    image = source
    width = source.videoWidth
    height = source.videoHeight
  }

  let scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  let smallest: Blob | null = null

  for (let pass = 0; pass < 3; pass++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of QUALITIES) {
      const blob = await encode(canvas, quality)
      if (!smallest || blob.size < smallest.size) smallest = blob
      if (blob.size <= MAX_PHOTO_BYTES) return blob
    }
    scale *= 0.7
  }

  // Three passes of shrinking never leaves a camera frame this big, but the
  // caller still gets a JPEG rather than an exception.
  return smallest!
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the photo'))),
      'image/jpeg',
      quality,
    )
  })
}
