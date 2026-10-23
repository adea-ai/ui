import { afterEach, describe, expect, test } from 'bun:test'

import {
  MARK_IMAGE_MAX_DATA_URL_LENGTH,
  MARK_IMAGE_MAX_SOURCE_BYTES,
  MARK_IMAGE_SIZE,
  MarkImageError,
  centredSquare,
  checkMarkImageFile,
  isMarkImageDataUrl,
  markImageFromFile,
  markImageProblemCopy,
} from '../src/components/composites/icon-picker/image-data-url'
import { preserveGlobals } from './helpers/globals'

const g = globalThis as Record<string, unknown>
const restoreGlobals = preserveGlobals('document', 'createImageBitmap')
afterEach(restoreGlobals)

const PNG = `data:image/png;base64,${'A'.repeat(40)}`

describe('isMarkImageDataUrl', () => {
  test('accepts only base64 webp and png data URLs', () => {
    expect(isMarkImageDataUrl(PNG)).toBe(true)
    expect(isMarkImageDataUrl('data:image/webp;base64,QUJD')).toBe(true)
    expect(isMarkImageDataUrl('data:image/webp;base64,QQ==')).toBe(true)
  })

  test('refuses anything an SVG, a script or another type could ride in on', () => {
    expect(isMarkImageDataUrl('data:image/svg+xml;base64,QUJD')).toBe(false)
    expect(isMarkImageDataUrl('data:image/jpeg;base64,QUJD')).toBe(false)
    expect(isMarkImageDataUrl('data:image/png;base64,QUJD" onload="x')).toBe(false)
    expect(isMarkImageDataUrl('data:image/png;base64,')).toBe(false)
    expect(isMarkImageDataUrl('https://example.com/a.png')).toBe(false)
    expect(isMarkImageDataUrl(42)).toBe(false)
    expect(isMarkImageDataUrl(undefined)).toBe(false)
  })

  test('refuses a value longer than a stored mark may be', () => {
    const body = 'A'.repeat(MARK_IMAGE_MAX_DATA_URL_LENGTH)
    expect(isMarkImageDataUrl(`data:image/png;base64,${body}`)).toBe(false)
  })
})

describe('checkMarkImageFile', () => {
  test('names the type problem before the size problem', () => {
    expect(checkMarkImageFile({ type: 'image/svg+xml', size: 1 })).toBe('type')
    expect(checkMarkImageFile({ type: 'text/plain', size: MARK_IMAGE_MAX_SOURCE_BYTES + 1 })).toBe(
      'type'
    )
  })

  test('accepts every raster type up to the source limit and no further', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
      expect(checkMarkImageFile({ type, size: MARK_IMAGE_MAX_SOURCE_BYTES })).toBeUndefined()
    expect(checkMarkImageFile({ type: 'image/png', size: MARK_IMAGE_MAX_SOURCE_BYTES + 1 })).toBe(
      'size'
    )
  })
})

describe('centredSquare', () => {
  test('crops the long edge evenly', () => {
    expect(centredSquare(300, 100)).toEqual({ x: 100, y: 0, side: 100 })
    expect(centredSquare(100, 300)).toEqual({ x: 0, y: 100, side: 100 })
    expect(centredSquare(64, 64)).toEqual({ x: 0, y: 0, side: 64 })
  })

  test('rounds an odd margin down to a whole pixel', () => {
    expect(centredSquare(101, 100)).toEqual({ x: 0, y: 0, side: 100 })
    expect(centredSquare(100, 103)).toEqual({ x: 0, y: 1, side: 100 })
  })
})

describe('markImageProblemCopy', () => {
  test('every problem has a sentence a person can act on', () => {
    for (const problem of ['type', 'size', 'unreadable', 'too-large'] as const) {
      expect(markImageProblemCopy[problem].length).toBeGreaterThan(20)
    }
    const error = new MarkImageError('size')
    expect(error.problem).toBe('size')
    expect(error.name).toBe('MarkImageError')
    expect(error).toBeInstanceOf(Error)
  })
})

type Draw = Parameters<CanvasRenderingContext2D['drawImage']>
function stubBrowser(options: {
  bitmap?: { width: number; height: number }
  decode?: 'ok' | 'fail'
  context?: 'ok' | 'none'
  encode: (type: string) => string
}) {
  const calls = { draws: [] as unknown[][], closed: 0, encoded: [] as string[] }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () =>
      options.context === 'none'
        ? null
        : { drawImage: (...args: Draw) => void calls.draws.push([...args]) },
    toDataURL: (type: string) => {
      calls.encoded.push(type)
      return options.encode(type)
    },
  }
  g.document = { createElement: () => canvas }
  g.createImageBitmap = async () => {
    if (options.decode === 'fail') throw new Error('not an image')
    return { ...(options.bitmap ?? { width: 200, height: 100 }), close: () => (calls.closed += 1) }
  }
  return { calls, canvas }
}
const file = (type = 'image/png', size = 10) => ({ type, size }) as File

describe('markImageFromFile', () => {
  test('refuses a file before it is decoded', async () => {
    const stub = stubBrowser({ encode: () => PNG })
    await expect(markImageFromFile(file('image/svg+xml'))).rejects.toMatchObject({
      problem: 'type',
    })
    expect(stub.calls.draws).toHaveLength(0)
  })

  test('a file the browser cannot decode is unreadable', async () => {
    stubBrowser({ decode: 'fail', encode: () => PNG })
    await expect(markImageFromFile(file())).rejects.toMatchObject({ problem: 'unreadable' })
  })

  test('draws the centred cover crop into the fixed square and prefers WebP', async () => {
    const webp = 'data:image/webp;base64,QUJD'
    const { calls, canvas } = stubBrowser({
      bitmap: { width: 300, height: 100 },
      encode: (type) => (type === 'image/webp' ? webp : PNG),
    })
    await expect(markImageFromFile(file())).resolves.toBe(webp)
    expect(canvas.width).toBe(MARK_IMAGE_SIZE)
    expect(canvas.height).toBe(MARK_IMAGE_SIZE)
    expect(calls.draws[0]!.slice(1)).toEqual([
      100,
      0,
      100,
      100,
      0,
      0,
      MARK_IMAGE_SIZE,
      MARK_IMAGE_SIZE,
    ])
    expect(calls.encoded).toEqual(['image/webp'])
    expect(calls.closed).toBe(1)
  })

  test('falls back to PNG where the browser cannot encode WebP', async () => {
    // A browser that cannot encode WebP answers the WebP request with a PNG data URL.
    const { calls } = stubBrowser({ encode: () => PNG })
    await expect(markImageFromFile(file())).resolves.toBe(PNG)
    expect(calls.encoded).toEqual(['image/webp', 'image/png'])
  })

  test('a result longer than a stored mark is too large, and the bitmap is still released', async () => {
    const big = `data:image/png;base64,${'A'.repeat(MARK_IMAGE_MAX_DATA_URL_LENGTH)}`
    const { calls } = stubBrowser({ encode: () => big })
    await expect(markImageFromFile(file())).rejects.toMatchObject({ problem: 'too-large' })
    expect(calls.closed).toBe(1)
  })

  test('a canvas without a 2d context is unreadable, and the bitmap is still released', async () => {
    const { calls } = stubBrowser({ context: 'none', encode: () => PNG })
    await expect(markImageFromFile(file())).rejects.toMatchObject({ problem: 'unreadable' })
    expect(calls.closed).toBe(1)
  })
})
