import { describe, expect, test } from 'bun:test'
import {
  resolveFloatingPreviewFrame,
  resizeFloatingPreview,
} from '../src/components/layout/floating-preview/model'

describe('floating preview geometry', () => {
  test('fits a default frame to the top-right without exceeding narrow bounds', () => {
    expect(
      resolveFloatingPreviewFrame({
        width: null,
        position: null,
        source: { width: 1600, height: 1000 },
        container: { width: 320, height: 240 },
      })
    ).toEqual({ x: 12, y: 12, width: 296, height: 185 })
  })

  test('moves and resizes within the host bounds while preserving aspect', () => {
    const start = { x: 200, y: 80, width: 320, height: 200 }
    expect(
      resizeFloatingPreview({
        start,
        direction: 'east',
        delta: { x: 900, y: 0 },
        source: { width: 1600, height: 1000 },
        container: { width: 640, height: 480 },
      })
    ).toEqual({ x: 200, y: 80, width: 428, height: 268 })
  })
})
