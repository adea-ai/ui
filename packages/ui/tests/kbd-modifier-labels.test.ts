import { describe, expect, test } from 'bun:test'
import {
  platformModifierKey,
  searchShortcutKeyshortcuts,
  searchShortcutLabel,
} from '../src/components/ui/kbd'

describe('the platform modifier glyph', () => {
  test('Apple platforms draw ⌘, everyone else spells Ctrl', () => {
    expect(platformModifierKey('MacIntel')).toBe('⌘')
    expect(platformModifierKey('iPhone')).toBe('⌘')
    expect(platformModifierKey('iPad Pro')).toBe('⌘')
    expect(platformModifierKey('Win32')).toBe('Ctrl')
    expect(platformModifierKey('Linux x86_64')).toBe('Ctrl')
    expect(platformModifierKey('')).toBe('Ctrl')
  })

  test('a missing navigator falls back to the spelled-out modifier', () => {
    // Server renders have no navigator; the honest answer is Ctrl, the key
    // that works on the widest set of keyboards, never a guessed ⌘.
    const originalNavigator = globalThis.navigator
    // @ts-expect-error -- deleting a host global is the point of the test.
    delete globalThis.navigator
    try {
      expect(platformModifierKey()).toBe('Ctrl')
      expect(searchShortcutLabel()).toBe('Ctrl+K')
    } finally {
      // eslint-disable-next-line no-restricted-globals
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
      })
    }
  })

  test('the search label follows the same glyph the caps draw', () => {
    expect(searchShortcutLabel('MacIntel')).toBe('⌘K')
    expect(searchShortcutLabel('Win32')).toBe('Ctrl+K')
  })

  test('the announced shortcuts name both modifiers the binding accepts', () => {
    expect(searchShortcutKeyshortcuts).toBe('Meta+K Control+K')
  })
})
