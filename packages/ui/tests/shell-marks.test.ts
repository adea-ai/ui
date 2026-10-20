import { describe, expect, test } from 'bun:test'
import {
  MARK_IMAGE_MAX_DATA_URL_LENGTH,
  MARK_IMAGE_MAX_SOURCE_BYTES,
  centredSquare,
  checkMarkImageFile,
  isMarkImageDataUrl,
  isShellIconKey,
  resolveShellIcon,
  shellIconEntries,
  shellIconLabel,
} from '../src/components/composites/icon-picker'

describe('mark image validation', () => {
  test('accepts only raster types within the source limit', () => {
    expect(checkMarkImageFile({ type: 'image/png', size: 10 })).toBeUndefined()
    expect(checkMarkImageFile({ type: 'image/jpeg', size: 10 })).toBeUndefined()
    expect(checkMarkImageFile({ type: 'image/svg+xml', size: 10 })).toBe('type')
    expect(checkMarkImageFile({ type: 'text/html', size: 10 })).toBe('type')
    expect(checkMarkImageFile({ type: 'image/png', size: MARK_IMAGE_MAX_SOURCE_BYTES + 1 })).toBe(
      'size'
    )
  })

  test('a stored mark is a bounded webp or png data URL and nothing else', () => {
    expect(isMarkImageDataUrl('data:image/webp;base64,AAAA')).toBe(true)
    expect(isMarkImageDataUrl('data:image/png;base64,AAAA==')).toBe(true)
    expect(isMarkImageDataUrl('data:image/svg+xml;base64,AAAA')).toBe(false)
    expect(isMarkImageDataUrl('https://example.com/a.png')).toBe(false)
    expect(isMarkImageDataUrl('data:image/png;base64,AAAA" onload="x')).toBe(false)
    expect(isMarkImageDataUrl(undefined)).toBe(false)
    const tooLong = `data:image/png;base64,${'A'.repeat(MARK_IMAGE_MAX_DATA_URL_LENGTH)}`
    expect(isMarkImageDataUrl(tooLong)).toBe(false)
  })

  test('the crop is the largest centred square', () => {
    expect(centredSquare(200, 100)).toEqual({ x: 50, y: 0, side: 100 })
    expect(centredSquare(100, 300)).toEqual({ x: 0, y: 100, side: 100 })
    expect(centredSquare(64, 64)).toEqual({ x: 0, y: 0, side: 64 })
  })
})

describe('shell icon registry', () => {
  test('keys are unique and every key is recognised', () => {
    const keys = shellIconEntries.map((entry) => entry.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const key of keys) expect(isShellIconKey(key)).toBe(true)
  })

  test('unknown keys fall back instead of throwing', () => {
    expect(isShellIconKey('not-an-icon')).toBe(false)
    expect(resolveShellIcon('not-an-icon')).toBe(resolveShellIcon('folder'))
    expect(resolveShellIcon(undefined, 'box')).toBe(resolveShellIcon('box'))
  })

  test('the Home and box defaults exist and every icon has a label', () => {
    expect(isShellIconKey('home')).toBe(true)
    expect(isShellIconKey('box')).toBe(true)
    expect(isShellIconKey('folder')).toBe(true)
    for (const entry of shellIconEntries)
      expect(shellIconLabel(entry.key).length).toBeGreaterThan(0)
  })
})
