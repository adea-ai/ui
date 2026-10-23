import { describe, expect, test } from 'bun:test'
import { createRoot, createSignal } from 'solid-js'

import {
  SideRailContext,
  createSideRailValue,
  useSideRail,
} from '../src/components/layout/side-rail/side-rail-context'

describe('side rail context', () => {
  test('an item outside a rail fails loudly instead of guessing a form', () => {
    expect(() =>
      createRoot((dispose) => {
        try {
          return useSideRail()
        } finally {
          dispose()
        }
      })
    ).toThrow('useSideRail must be called inside a <SideRail>.')
  })

  test('the rail value follows the collapse state and reserves the width it was given', () => {
    createRoot((dispose) => {
      const [collapsed, setCollapsed] = createSignal(false)
      const [width, setWidth] = createSignal('16rem')
      const value = createSideRailValue(collapsed, width)
      expect(value.collapsed()).toBe(false)
      expect(value.width()).toBe('16rem')
      setCollapsed(true)
      setWidth('3rem')
      expect(value.collapsed()).toBe(true)
      expect(value.width()).toBe('3rem')
      dispose()
    })
  })

  test('items under a provider read the rail they sit in', () => {
    const seen = createRoot((dispose) => {
      const value = createSideRailValue(
        () => true,
        () => '3rem'
      )
      let read: ReturnType<typeof useSideRail> | undefined
      SideRailContext.Provider({
        value,
        get children() {
          read = useSideRail()
          return undefined
        },
      })
      dispose()
      return read
    })
    expect(seen?.collapsed()).toBe(true)
    expect(seen?.width()).toBe('3rem')
  })
})
