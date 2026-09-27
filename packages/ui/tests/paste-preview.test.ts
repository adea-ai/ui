import { expect, test } from 'bun:test'
import { summarizePastePreview } from '../src/components/conversation/paste-preview'

test('bounds preview scanning for a very long single-line paste', () => {
  const content = 'x'.repeat(5_000_000)
  const preview = summarizePastePreview(content, 1)

  expect(preview.text).toBe('x'.repeat(1200))
  expect(preview.hiddenLines).toBe(0)
  expect(preview.hiddenCharacters).toBe(content.length - 1200)
  expect(preview.scannedCharacters).toBe(1200)
})

test('stops after the twelfth line and uses the known total line count', () => {
  const lines = Array.from({ length: 15 }, (_, index) => `line ${index + 1}`)
  const content = lines.join('\n')
  const preview = summarizePastePreview(content, lines.length)
  const shown = lines.slice(0, 12).join('\n')

  expect(preview.text).toBe(shown)
  expect(preview.hiddenLines).toBe(3)
  expect(preview.hiddenCharacters).toBe(content.length - shown.length)
  expect(preview.scannedCharacters).toBe(shown.length + 1)
})
