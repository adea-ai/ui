export type AnnotationSurfacePoint = Readonly<{ x: number; y: number }>

type SurfaceBounds = Readonly<Pick<DOMRectReadOnly, 'left' | 'top' | 'width' | 'height'>>

function fraction(client: number, start: number, length: number): number {
  if (
    !Number.isFinite(client) ||
    !Number.isFinite(start) ||
    !Number.isFinite(length) ||
    length <= 0
  )
    return 0

  return Math.min(1, Math.max(0, (client - start) / length))
}

/** Pointer coordinates normalized to the surface; degenerate bounds resolve to the origin. */
export function normalizedSurfacePoint(
  clientX: number,
  clientY: number,
  bounds: SurfaceBounds
): AnnotationSurfacePoint {
  return {
    x: fraction(clientX, bounds.left, bounds.width),
    y: fraction(clientY, bounds.top, bounds.height),
  }
}

export function clampSurfaceFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
