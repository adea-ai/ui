import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calloutVariants } from '../src/components/ui/callout/callout'
import { alertVariants } from '../src/components/ui/alert/alert'

const classes = (value: string) => value.split(/\s+/).filter(Boolean)

const source = readFileSync(
  resolve(import.meta.dirname, '../src/components/ui/callout/callout.tsx'),
  'utf8'
)
const body = (name: string) => {
  const start = source.search(new RegExp(`^export function ${name}\\b`, 'm'))
  if (start < 0) throw new Error(`${name} is not exported`)
  const next = source.slice(start + 1).search(/^(?:export|\/\*\*)/m)
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next)
}

const withoutHue = (list: string[]) =>
  list.filter((c) => !/^border-s-(?:primary|destructive|success|warning|info)$/.test(c))

describe('calloutVariants', () => {
  test('the default is the primary rule at the md rung on the card surface', () => {
    const list = classes(calloutVariants())
    for (const token of ['bg-card', 'text-card-foreground', 'border-s-primary', 'border-s-3'])
      expect(list).toContain(token)
    expect(calloutVariants({ variant: 'default', size: 'md' })).toBe(calloutVariants())
  })

  test('the variant moves only the rule hue, using the tokens Alert uses', () => {
    const base = withoutHue(classes(calloutVariants()))
    for (const variant of ['destructive', 'success', 'warning', 'info'] as const) {
      const list = classes(calloutVariants({ variant }))
      expect(list).toContain(`border-s-${variant}`)
      expect(list).not.toContain('border-s-primary')
      expect(withoutHue(list)).toEqual(base)
      // The same status token Alert draws its edge with, never a palette colour.
      expect(alertVariants({ variant })).toContain(`border-${variant}/30`)
    }
  })

  test('the start edge is logical, so the rule follows the text direction', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const list = classes(calloutVariants({ size }))
      expect(list.some((c) => /^border-s-\d/.test(c))).toBe(true)
      expect(list.some((c) => /^border-(l|r|x)\b/.test(c) || /^border-[lr]-/.test(c))).toBe(false)
    }
  })

  test('sizes carry Cortana answer-view padding and rule weight, 22/24 + 3px, 18/20 + 3px, 12/14 + 2px', () => {
    // 5.5 = 22px, 6 = 24px, 4.5 = 18px, 5 = 20px, 3 = 12px, 3.5 = 14px.
    const lg = classes(calloutVariants({ size: 'lg' }))
    expect(lg).toEqual(expect.arrayContaining(['py-5.5', 'px-6', 'border-s-3']))
    const md = classes(calloutVariants({ size: 'md' }))
    expect(md).toEqual(expect.arrayContaining(['py-4.5', 'px-5', 'border-s-3']))
    const sm = classes(calloutVariants({ size: 'sm' }))
    expect(sm).toEqual(expect.arrayContaining(['py-3', 'px-3.5', 'border-s-2']))
  })

  test('unbroken text wraps with overflow-wrap: anywhere, which also lets flex and grid items shrink', () => {
    const list = classes(calloutVariants())
    expect(list).toContain('wrap-anywhere')
    expect(list).not.toContain('wrap-break-word')
    // The block must stay a plain block: a flex or grid root would split inline children.
    expect(list.some((c) => /^(?:inline-)?(?:flex|grid)$/.test(c))).toBe(false)
  })

  test('the box is square and borderless apart from the rule', () => {
    const list = classes(calloutVariants())
    expect(list).toContain('rounded-none')
    expect(list).not.toContain('border')
    expect(list.some((c) => /^border-(?:\d|x|y|t|b)/.test(c))).toBe(false)
  })
})

describe('Callout source contract', () => {
  const callout = body('Callout')

  test('is a plain div with role="note" that a caller can override', () => {
    expect(callout).toContain('<div')
    expect(callout).toContain('role="note"')
    // The caller's props spread after the default role, so `role` wins.
    expect(callout.indexOf('role="note"')).toBeLessThan(callout.indexOf('{...rest}'))
  })

  test('marks a title-only callout from its rendered children', () => {
    expect(callout).toContain('children(() => local.children)')
    expect(callout).toContain("data-title-only={titleOnly() ? '' : undefined}")
    expect(source).toContain("getAttribute('data-slot') === 'callout-title'")
  })

  test('has no alert or live-region behaviour', () => {
    // Checked on the code, not the doc comment, which names these on purpose.
    const code = `${callout}${body('CalloutTitle')}${source.slice(source.indexOf('export const calloutVariants'))}`
    expect(code).not.toContain('role="alert"')
    expect(code).not.toContain('role="status"')
    expect(code).not.toContain('aria-live')
    expect(code).not.toContain('aria-atomic')
  })

  test('merges the caller class last and forwards everything else, including ref', () => {
    expect(callout).toContain("splitProps(props, ['class', 'variant', 'size', 'children'])")
    expect(callout).toContain(
      'cn(calloutVariants({ variant: local.variant, size: local.size }), local.class)'
    )
    expect(callout).toContain('{...rest}')
    expect(callout).toContain('data-slot="callout"')
  })

  test('CalloutTitle is a slotted div that merges the caller class and forwards props', () => {
    const title = body('CalloutTitle')
    expect(title).toContain('data-slot="callout-title"')
    expect(title).toContain('local.class')
    // The gap is the default: `not-last:` ignores text nodes and dropped it before bare text.
    expect(title).toContain("'mb-1 ")
    expect(title).not.toContain('not-last')
    // Only a callout that renders nothing but its title takes the gap away, by a mark
    // the callout sets, so no caller has to pass `mb-0`.
    expect(title).toContain('in-data-title-only:mb-0')
    expect(title).toContain('{...rest}')
  })
})
