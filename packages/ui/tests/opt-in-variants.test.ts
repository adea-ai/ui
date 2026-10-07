import { describe, expect, test } from 'bun:test'
import { cardVariants } from '../src/components/ui/card/card'
import { dialogContentSizes } from '../src/components/ui/dialog/dialog'
import { cn } from '../src/lib/utils'

const classes = (value: string) => value.split(/\s+/).filter(Boolean).toSorted()

/**
 * Sizes and layouts added for consumers that used to set padding or width by hand.
 * Each one is opt-in: the default must render the classes it rendered before the
 * prop existed, so no existing call site moves.
 */
describe('Card size', () => {
  test('the default is the card it always was', () => {
    expect(classes(cardVariants())).toEqual(
      classes(
        'bg-card text-card-foreground flex flex-col gap-4 rounded-xl border border-border py-4 shadow-xs'
      )
    )
    expect(cardVariants({ size: 'default' })).toBe(cardVariants())
  })

  test('sm tightens the card and its parts together', () => {
    const sm = classes(cardVariants({ size: 'sm' }))
    expect(sm).toContain('py-3')
    expect(sm).toContain('gap-3')
    for (const part of ['card-header', 'card-content', 'card-footer'])
      expect(sm).toContain(`*:data-[slot=${part}]:px-3`)
    expect(sm).not.toContain('py-4')
  })

  test('flush drops the block padding and gap', () => {
    const flush = classes(cardVariants({ size: 'flush' }))
    expect(flush).toContain('py-0')
    expect(flush).toContain('gap-0')
    expect(flush).not.toContain('py-4')
  })
})

describe('DialogContent size', () => {
  test('md is the width every dialog already had', () => {
    expect(dialogContentSizes.md).toBe('max-w-lg')
  })

  test('the ladder widens one rung at a time', () => {
    expect(Object.values(dialogContentSizes)).toEqual([
      'max-w-md',
      'max-w-lg',
      'max-w-2xl',
      'max-w-3xl',
    ])
  })

  test('a caller width still wins over the rung', () => {
    expect(cn('max-w-lg', 'max-w-96')).toBe('max-w-96')
  })
})

describe('the panel width token', () => {
  test('w-panel replaces the sheet width through the class merge', () => {
    expect(cn('w-80', 'w-panel')).toBe('w-panel')
    expect(cn('w-lg', 'w-panel')).toBe('w-panel')
  })
})
