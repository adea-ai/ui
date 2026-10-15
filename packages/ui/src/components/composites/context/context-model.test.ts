import { describe, expect, test } from 'bun:test'
import {
  breakdownRows,
  contextLabel,
  contextLevel,
  contextLevelWord,
  contextPercent,
  contextShort,
  formatCost,
  formatExact,
  formatTokens,
  hasContextFigures,
  isFigure,
} from './context-model'

describe('isFigure', () => {
  test('accepts zero and positive finite numbers only', () => {
    expect(isFigure(0)).toBe(true)
    expect(isFigure(1234)).toBe(true)
    for (const bad of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isFigure(bad)).toBe(false)
    }
  })
})

describe('hasContextFigures', () => {
  test('nothing known means nothing to render', () => {
    expect(hasContextFigures({})).toBe(false)
    expect(hasContextFigures({ breakdown: {} })).toBe(false)
    expect(hasContextFigures({ used: Number.NaN, total: -5 })).toBe(false)
    expect(hasContextFigures({ cost: { amount: Number.NaN } })).toBe(false)
  })

  test('any single known figure is enough, including a legitimate zero', () => {
    expect(hasContextFigures({ used: 0 })).toBe(true)
    expect(hasContextFigures({ total: 200_000 })).toBe(true)
    expect(hasContextFigures({ breakdown: { reasoning: 10 } })).toBe(true)
    expect(hasContextFigures({ cost: { amount: 0.4 } })).toBe(true)
  })
})

describe('contextPercent', () => {
  test('needs both figures and a non-empty window', () => {
    expect(contextPercent(124_000, 200_000)).toBe(62)
    expect(contextPercent(undefined, 200_000)).toBeUndefined()
    expect(contextPercent(10, undefined)).toBeUndefined()
    expect(contextPercent(10, 0)).toBeUndefined()
  })

  test('zero used is 0%, not unknown', () => {
    expect(contextPercent(0, 200_000)).toBe(0)
  })

  test('an overrun is reported, not clamped', () => {
    expect(contextPercent(224_000, 200_000)).toBe(112)
  })
})

describe('contextLevel', () => {
  test('steps at 75, 90 and 100', () => {
    expect(contextLevel(undefined)).toBe('normal')
    expect(contextLevel(74)).toBe('normal')
    expect(contextLevel(75)).toBe('high')
    expect(contextLevel(89)).toBe('high')
    expect(contextLevel(90)).toBe('critical')
    expect(contextLevel(99)).toBe('critical')
    expect(contextLevel(100)).toBe('full')
    expect(contextLevel(140)).toBe('full')
  })

  test('every raised level has a word, and normal has none', () => {
    expect(contextLevelWord('normal')).toBeUndefined()
    expect(contextLevelWord('high')).toBe('Getting full')
    expect(contextLevelWord('critical')).toBe('Nearly full')
    expect(contextLevelWord('full')).toBe('Full')
  })
})

describe('formatting', () => {
  test('compact tokens', () => {
    expect(formatTokens(950)).toBe('950')
    expect(formatTokens(1234)).toBe('1.2K')
    expect(formatTokens(48_200)).toBe('48.2K')
    expect(formatTokens(200_000)).toBe('200K')
    expect(formatTokens(1_250_000)).toBe('1.3M')
  })

  test('exact tokens', () => {
    expect(formatExact(151_800)).toBe('151,800')
  })

  test('cost with a valid currency', () => {
    expect(formatCost({ amount: 0.42, currency: 'USD' })).toBe('$0.42')
    expect(formatCost({ amount: 0.0042, currency: 'USD' })).toBe('$0.0042')
  })

  test('cost without a currency is a bare number', () => {
    expect(formatCost({ amount: 3 })).toBe('3.00')
  })

  test('an unrecognised currency is shown as written, bounded', () => {
    expect(formatCost({ amount: 2, currency: 'tokens' })).toBe('2.00 tokens')
    expect(formatCost({ amount: 2, currency: 'x'.repeat(100) }).length).toBeLessThan(20)
  })
})

describe('breakdownRows', () => {
  test('lists only supplied figures, in reading order', () => {
    expect(breakdownRows({ reasoning: 5, input: 100, cacheRead: 0 })).toEqual([
      { key: 'input', label: 'Input', value: 100 },
      { key: 'cacheRead', label: 'Cache read', value: 0 },
      { key: 'reasoning', label: 'Reasoning', value: 5 },
    ])
  })

  test('ignores invalid values and an absent breakdown', () => {
    expect(breakdownRows({ input: Number.NaN, output: -3 })).toEqual([])
    expect(breakdownRows(undefined)).toEqual([])
  })
})

describe('contextLabel and contextShort', () => {
  test('percent, in words, with the level spoken', () => {
    expect(contextLabel({ used: 124_000, total: 200_000 })).toBe('62% of context used')
    expect(contextLabel({ used: 180_000, total: 200_000 })).toBe('90% of context used, nearly full')
    expect(contextShort({ used: 124_000, total: 200_000 })).toBe('62%')
  })

  test('falls back to the most informative figure that is known', () => {
    expect(contextLabel({ used: 48_200 })).toBe('48.2K tokens used')
    expect(contextLabel({ total: 200_000 })).toBe('200K token context window')
    expect(contextLabel({ breakdown: { input: 1 } })).toBe('Token usage')
    expect(contextLabel({ cost: { amount: 0.5, currency: 'USD' } })).toBe('Cost $0.50')
    expect(contextShort({ used: 48_200 })).toBe('48.2K')
  })

  test('says nothing when nothing is known', () => {
    expect(contextLabel({})).toBeUndefined()
    expect(contextShort({})).toBeUndefined()
  })

  test('never reports an unknown as 0', () => {
    expect(contextLabel({ total: 200_000 })).not.toContain('0%')
    expect(contextLabel({ total: 200_000 })).not.toContain(' 0 ')
  })

  test('the visible text is contained in the accessible name', () => {
    for (const figures of [
      { used: 124_000, total: 200_000 },
      { used: 48_200 },
      { total: 200_000 },
    ]) {
      expect(contextLabel(figures)!).toContain(contextShort(figures)!)
    }
  })
})
