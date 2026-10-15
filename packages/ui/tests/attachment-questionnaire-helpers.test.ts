import { describe, expect, test } from 'bun:test'
import { formatAttachmentSize, safePreviewSrc } from '../src/components/ui/attachment/attachment'
import {
  isQuestionAnswered,
  type QuestionnaireQuestion,
} from '../src/components/ui/questionnaire/questionnaire'

describe('formatAttachmentSize', () => {
  test('formats bytes, kilobytes, megabytes and beyond', () => {
    expect(formatAttachmentSize(0)).toBe('0 B')
    expect(formatAttachmentSize(1)).toBe('1 B')
    expect(formatAttachmentSize(1023)).toBe('1023 B')
    expect(formatAttachmentSize(1024)).toBe('1 KB')
    expect(formatAttachmentSize(1536)).toBe('1.5 KB')
    expect(formatAttachmentSize(10 * 1024)).toBe('10 KB')
    expect(formatAttachmentSize(1024 * 1024)).toBe('1 MB')
    expect(formatAttachmentSize(5.25 * 1024 * 1024)).toBe('5.3 MB')
    expect(formatAttachmentSize(3 * 1024 ** 3)).toBe('3 GB')
    expect(formatAttachmentSize(2 * 1024 ** 4)).toBe('2 TB')
  })

  test('stays in terabytes for absurd sizes', () => {
    expect(formatAttachmentSize(5000 * 1024 ** 4)).toBe('5000 TB')
    expect(formatAttachmentSize(Number.MAX_SAFE_INTEGER)).toMatch(/ TB$/)
  })

  test('says nothing for a value that is not a size', () => {
    for (const value of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY, -0.5]) {
      expect(formatAttachmentSize(value), String(value)).toBeUndefined()
    }
  })

  test('rounds a fractional byte count', () => {
    expect(formatAttachmentSize(0.4)).toBe('0 B')
    expect(formatAttachmentSize(512.6)).toBe('513 B')
  })

  test('never reports 1024 of a unit', () => {
    // 1023.9 KB is still below the megabyte step, so it must not read as "1024 KB".
    const text = formatAttachmentSize(1023.9 * 1024)
    expect(text).not.toBe('1024 KB')
  })
})

describe('safePreviewSrc', () => {
  test('accepts blob, http(s) and raster data URIs', () => {
    expect(safePreviewSrc('blob:https://example.com/3c1f')).toBe('blob:https://example.com/3c1f')
    expect(safePreviewSrc('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(safePreviewSrc('http://example.com/a.png')).toBe('http://example.com/a.png')
    for (const type of ['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif']) {
      const uri = `data:image/${type};base64,AAAA/+=`
      expect(safePreviewSrc(uri), type).toBe(uri)
    }
  })

  test('rejects SVG, including as a data URI', () => {
    expect(safePreviewSrc('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBeUndefined()
    expect(safePreviewSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBeUndefined()
    expect(safePreviewSrc('data:image/svg;base64,AAAA')).toBeUndefined()
  })

  test('rejects scripts, documents and anything that is not a raster', () => {
    for (const value of [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/png,not-base64',
      'data:image/png;base64,AAAA" onerror="alert(1)',
      'data:image/png;base64,AAAA\nalert(1)',
      'file:///etc/passwd',
      'ftp://example.com/a.png',
      '/relative.png',
      'relative.png',
      '',
      undefined,
    ]) {
      expect(safePreviewSrc(value), String(value)).toBeUndefined()
    }
  })
})

describe('isQuestionAnswered', () => {
  const choice: QuestionnaireQuestion = {
    id: 'q',
    prompt: 'Which?',
    options: [{ id: 'a', label: 'A' }],
  }
  const text: QuestionnaireQuestion = { id: 't', prompt: 'Why?' }

  test('an option or a non-blank text answers a question', () => {
    expect(isQuestionAnswered(choice, { optionIds: ['a'], text: '' })).toBe(true)
    expect(isQuestionAnswered(text, { optionIds: [], text: 'because' })).toBe(true)
    expect(isQuestionAnswered(choice, { optionIds: [], text: 'something else' })).toBe(true)
  })

  test('nothing, or only whitespace, does not', () => {
    expect(isQuestionAnswered(choice, undefined)).toBe(false)
    expect(isQuestionAnswered(choice, { optionIds: [], text: '' })).toBe(false)
    expect(isQuestionAnswered(text, { optionIds: [], text: '   \n\t' })).toBe(false)
  })

  test('an optional question is always satisfied', () => {
    expect(isQuestionAnswered({ ...text, optional: true }, undefined)).toBe(true)
    expect(isQuestionAnswered({ ...choice, optional: true }, { optionIds: [], text: '' })).toBe(
      true
    )
  })
})
