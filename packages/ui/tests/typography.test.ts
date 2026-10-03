import { describe, expect, test } from 'bun:test'
import {
  headingElement,
  headingVariants,
  textElement,
  textVariants,
} from '../src/components/ui/typography/typography'

const classes = (value: string) => value.split(/\s+/).filter(Boolean)

describe('headingVariants', () => {
  test('maps each size to one rung of the ladder', () => {
    expect(classes(headingVariants({ size: 'display' }))).toContain('text-3xl')
    expect(classes(headingVariants({ size: 'title' }))).toContain('text-2xl')
    expect(classes(headingVariants({ size: 'page' }))).toContain('text-xl')
    expect(classes(headingVariants({ size: 'section' }))).toContain('text-lg')
    expect(classes(headingVariants({ size: 'card' }))).toContain('text-base')
    expect(classes(headingVariants({ size: 'subsection' }))).toContain('text-sm')
  })

  test('sets every heading at 600 and never heavier', () => {
    for (const size of Object.keys(headingElement) as (keyof typeof headingElement)[]) {
      const list = classes(headingVariants({ size }))
      expect(list).toContain('font-semibold')
      expect(list).not.toContain('font-bold')
    }
  })

  test('tightens tracking on the display rungs but not on text-sm', () => {
    expect(classes(headingVariants({ size: 'card' }))).toContain('tracking-tight')
    expect(classes(headingVariants({ size: 'subsection' }))).not.toContain('tracking-tight')
  })

  test('takes leading from the rung unless trimmed', () => {
    expect(headingVariants({ size: 'card' })).not.toContain('leading-')
    expect(classes(headingVariants({ size: 'card', leading: 'none' }))).toContain('leading-none')
  })

  test('defaults to a section heading that inherits its colour', () => {
    const list = classes(headingVariants())
    expect(list).toContain('text-lg')
    expect(list).not.toContain('text-foreground')
  })

  test('reproduces the class sets the shared titles used before adoption', () => {
    expect(classes(headingVariants({ size: 'page' })).toSorted()).toEqual(
      ['text-xl', 'font-semibold', 'tracking-tight'].toSorted()
    )
    expect(classes(headingVariants({ size: 'card', leading: 'none' })).toSorted()).toEqual(
      ['text-base', 'leading-none', 'font-semibold', 'tracking-tight'].toSorted()
    )
    expect(classes(headingVariants({ size: 'subsection', leading: 'none' })).toSorted()).toEqual(
      ['text-sm', 'leading-none', 'font-semibold'].toSorted()
    )
    expect(classes(headingVariants({ size: 'page', numeric: true })).toSorted()).toEqual(
      ['text-xl', 'font-semibold', 'tabular-nums', 'tracking-tight'].toSorted()
    )
  })

  test('names a conventional element per size', () => {
    expect(headingElement).toEqual({
      display: 'h1',
      title: 'h1',
      page: 'h1',
      section: 'h2',
      card: 'h3',
      subsection: 'h4',
    })
  })
})

describe('textVariants', () => {
  test('gives prose its own family and size axis', () => {
    expect(classes(textVariants({ variant: 'body' }))).toEqual(['font-content', 'text-content'])
    expect(classes(textVariants({ variant: 'strong' }))).toContain('font-content')
    expect(classes(textVariants({ variant: 'strong' }))).toContain('text-content')
  })

  test('keeps labels on the interface ladder and assigns the other roles', () => {
    expect(classes(textVariants({ variant: 'label' }))).toContain('text-sm')
    expect(classes(textVariants({ variant: 'label' }))).toContain('font-medium')
    expect(classes(textVariants({ variant: 'strong' }))).toContain('font-semibold')
  })

  test('covers the rungs below the default', () => {
    expect(classes(textVariants({ variant: 'caption' }))).toEqual(['text-xs'])
    expect(classes(textVariants({ variant: 'micro' }))).toEqual(['text-2xs', 'font-medium'])
    expect(classes(textVariants({ variant: 'code' }))).toEqual(['font-code', 'text-code'])
  })

  test('keeps tone independent of size', () => {
    expect(classes(textVariants({ variant: 'caption', tone: 'muted' }))).toEqual([
      'text-xs',
      'text-muted-foreground',
    ])
    expect(classes(textVariants())).toEqual(['font-content', 'text-content'])
  })

  test('renders body as a paragraph, code as code and the rest inline', () => {
    expect(textElement).toEqual({
      body: 'p',
      label: 'span',
      strong: 'span',
      caption: 'span',
      micro: 'span',
      code: 'code',
    })
  })
})
