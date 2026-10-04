import { describe, expect, test } from 'bun:test'
import {
  clampSurfaceFraction,
  normalizedSurfacePoint,
} from '../src/components/ui/annotation-surface/geometry'

describe('annotation surface normalized points', () => {
  test('clamps points at the viewport edges', () => {
    expect(normalizedSurfacePoint(240, 120, { left: 40, top: 20, width: 100, height: 50 })).toEqual(
      { x: 1, y: 1 }
    )
    expect(normalizedSurfacePoint(0, 0, { left: 40, top: 20, width: 100, height: 50 })).toEqual({
      x: 0,
      y: 0,
    })
  })

  test('resolves zero bounds and non-finite coordinates to a finite origin', () => {
    expect(
      normalizedSurfacePoint(Number.NaN, Number.POSITIVE_INFINITY, {
        left: 0,
        top: 0,
        width: 0,
        height: Number.POSITIVE_INFINITY,
      })
    ).toEqual({ x: 0, y: 0 })
    expect(clampSurfaceFraction(Number.NaN)).toBe(0)
  })
})
