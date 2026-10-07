import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { menuItem } from '../src/lib/overlay'

/**
 * A menu row's descendant `svg` rules leave its selection indicator alone.
 *
 * `menuItem` sizes and dims every icon in the row with `[&_svg]` rules, whose
 * selector (a class plus an element) outranks the single utility on an
 * indicator's glyph. Applied to the indicator, they drew a radio item's
 * `size-2` dot as a 16px muted disc and took the accent off every check. The
 * rules exclude anything inside a `[data-slot$=-indicator]`, so each row
 * component that renders an `ItemIndicator` must give it such a slot.
 *
 * The unit lane has no DOM, so this holds the two halves of that contract in
 * source: the exclusion in the shared class list, and the slot on each
 * indicator that sits inside a `menuItem` row.
 */
const root = resolve(import.meta.dirname, '../src/components')
const classes = menuItem.split(/\s+/)

const rows: { file: string; slot: string; indicators: number }[] = [
  { file: 'ui/dropdown-menu/dropdown-menu.tsx', slot: 'dropdown-menu-indicator', indicators: 2 },
  { file: 'ui/context-menu/context-menu.tsx', slot: 'context-menu-indicator', indicators: 2 },
  { file: 'ui/menubar/menubar.tsx', slot: 'menubar-indicator', indicators: 2 },
  { file: 'ui/select/select.tsx', slot: 'select-indicator', indicators: 1 },
  { file: 'ui/combobox/combobox.tsx', slot: 'combobox-indicator', indicators: 1 },
]

describe('menu row icon rules', () => {
  test('size and colour every row svg except an indicator glyph', () => {
    const svgRules = classes.filter((name) => name.startsWith('[&_svg'))
    const sizing = svgRules.filter((name) => /\]:size-/.test(name))
    const colouring = svgRules.filter((name) => /\]:text-/.test(name))

    expect(sizing.length).toBeGreaterThan(0)
    expect(colouring.length).toBeGreaterThan(0)
    for (const rule of [...sizing, ...colouring])
      expect(rule).toContain(':not([data-slot$=-indicator]_*)')
  })
})

describe('menu row indicators', () => {
  for (const { file, slot, indicators } of rows) {
    test(`${file} marks each ItemIndicator as ${slot}`, () => {
      const source = readFileSync(resolve(root, file), 'utf8')
      const opened = source.match(/<Kobalte\w+\.ItemIndicator\b[^>]*>/g) ?? []

      expect(opened).toHaveLength(indicators)
      for (const tag of opened) expect(tag).toContain(`data-slot="${slot}"`)
    })
  }
})
