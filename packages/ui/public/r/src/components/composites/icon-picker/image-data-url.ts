/**
 * Turning an uploaded picture into the small square mark a workspace stores.
 *
 * The mark travels with the workspace record (it is shown in every list the
 * workspace appears in), so it is resized to a fixed square and re-encoded
 * before it leaves the browser rather than stored as the user's original file.
 * Re-encoding also drops metadata and any embedded script an SVG could carry:
 * only raster images are accepted and the result is always a `data:image/webp`
 * or `data:image/png` URL.
 */

/** The edge, in pixels, of the stored square. 2x the largest tile the apps draw. */
export const MARK_IMAGE_SIZE = 128
/** The largest source file read, before resizing. */
export const MARK_IMAGE_MAX_SOURCE_BYTES = 8 * 1024 * 1024
/** The largest encoded result kept; a stored mark never exceeds this many characters. */
export const MARK_IMAGE_MAX_DATA_URL_LENGTH = 48 * 1024

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

export type MarkImageProblem = 'type' | 'size' | 'unreadable' | 'too-large'

/** Thrown by {@link markImageFromFile}; `problem` keys {@link markImageProblemCopy}. */
export class MarkImageError extends Error {
  readonly problem: MarkImageProblem
  constructor(problem: MarkImageProblem) {
    super(problem)
    this.name = 'MarkImageError'
    this.problem = problem
  }
}

export const markImageProblemCopy: Readonly<Record<MarkImageProblem, string>> = {
  type: 'Choose a PNG, JPEG, WebP or GIF image.',
  size: 'That image is larger than 8 MB. Choose a smaller one.',
  unreadable: 'That image could not be read. Try a different file.',
  'too-large': 'That image is too detailed to store as a mark. Try a simpler one.',
}

/** Whether a stored value is a mark image this module could have produced. */
export function isMarkImageDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MARK_IMAGE_MAX_DATA_URL_LENGTH &&
    /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
}

/** Pre-flight checks that need no decoding; `undefined` means the file may be read. */
export function checkMarkImageFile(
  file: Readonly<{ type: string; size: number }>
): MarkImageProblem | undefined {
  if (!ACCEPTED_TYPES.has(file.type)) return 'type'
  if (file.size > MARK_IMAGE_MAX_SOURCE_BYTES) return 'size'
  return undefined
}

/** The source rectangle of the largest centred square, so the mark is a cover crop. */
export function centredSquare(
  width: number,
  height: number
): Readonly<{ x: number; y: number; side: number }> {
  const side = Math.min(width, height)
  return { x: Math.floor((width - side) / 2), y: Math.floor((height - side) / 2), side }
}

/**
 * Resize an image file to the stored mark. Rejects with a {@link MarkImageError}
 * so the caller can show `markImageProblemCopy[error.problem]`.
 */
export async function markImageFromFile(file: File): Promise<string> {
  const problem = checkMarkImageFile(file)
  if (problem) throw new MarkImageError(problem)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new MarkImageError('unreadable')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = MARK_IMAGE_SIZE
    canvas.height = MARK_IMAGE_SIZE
    const context = canvas.getContext('2d')
    if (!context) throw new MarkImageError('unreadable')
    const crop = centredSquare(bitmap.width, bitmap.height)
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.side,
      crop.side,
      0,
      0,
      MARK_IMAGE_SIZE,
      MARK_IMAGE_SIZE
    )
    // WebP where the browser can encode it; PNG is the always-available fallback.
    for (const type of ['image/webp', 'image/png']) {
      const url = canvas.toDataURL(type, 0.85)
      if (url.startsWith(`data:${type}`) && isMarkImageDataUrl(url)) return url
    }
    throw new MarkImageError('too-large')
  } finally {
    bitmap.close()
  }
}
