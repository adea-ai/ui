import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  compareSizeBlocks,
  END_MARKER,
  extractSizeBlock,
  renderSizeBlock,
  replaceSizeBlock,
  START_MARKER,
  type SizeReport,
} from '../scripts/tree-shaking-docs'

const report = (scale = 1): SizeReport => ({
  rows: [
    { entry: '@adea-ai/ui', name: 'Button', brings: 'the floor', gzip: 22_000 * scale },
    {
      entry: '@adea-ai/ui/components/ui/chart',
      name: 'LineChart',
      brings: 'chart.js',
      gzip: 90_000 * scale,
    },
  ],
  whole: 350_000 * scale,
  one: 22_000 * scale,
  lineChart: 90_000 * scale,
  allCharts: 100_000 * scale,
  budgets: {
    oneComponentBytes: 40 * 1024,
    heaviestComponentBytes: 180 * 1024,
    ratioOfWholeLibrary: 0.25,
  },
})

describe('the generated size table', () => {
  test('round-trips through the markers', () => {
    const block = renderSizeBlock(report())
    const doc = `intro\n\n${START_MARKER}\nold\n${END_MARKER}\n\noutro\n`
    const written = replaceSizeBlock(doc, block)
    expect(written.startsWith('intro\n\n')).toBe(true)
    expect(written.endsWith('\n\noutro\n')).toBe(true)
    expect(extractSizeBlock(written)).toBe(block)
    expect(compareSizeBlocks(extractSizeBlock(written)!, block)).toEqual([])
  })

  test('refuses a document without markers', () => {
    expect(extractSizeBlock('no table here')).toBeUndefined()
    expect(() => replaceSizeBlock('no table here', 'x')).toThrow(/markers not found/)
  })

  test('tolerates the sub-percent gzip noise between platforms', () => {
    expect(compareSizeBlocks(renderSizeBlock(report(1.008)), renderSizeBlock(report()))).toEqual([])
  })

  test('fails the 86.2 → 88.9 kB kind of drift', () => {
    const findings = compareSizeBlocks(renderSizeBlock(report(0.97)), renderSizeBlock(report()))
    expect(findings.length).toBeGreaterThan(0)
    expect(findings.join('\n')).toContain('measured 87.9 kB')
  })

  test('fails a changed row even when every figure agrees', () => {
    const renamed = { ...report(), rows: report().rows.map((row) => ({ ...row, brings: 'x' })) }
    expect(compareSizeBlocks(renderSizeBlock(renamed), renderSizeBlock(report()))).toEqual([
      'the committed size table differs in wording or rows from what the gate renders',
    ])
  })

  test('the consumption guide carries the markers the gate writes between', () => {
    const doc = readFileSync(join(import.meta.dir, '../../../docs/consumption.md'), 'utf8')
    expect(extractSizeBlock(doc)).toBeDefined()
  })
})
