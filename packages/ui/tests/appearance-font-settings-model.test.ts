import { describe, expect, test } from 'bun:test'
import { fontOptions } from '../src/lib/font-catalog'
import {
  APPEARANCE_EDITOR_FONT_SIZE_MAX,
  APPEARANCE_EDITOR_FONT_SIZE_MIN,
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  applyAppearanceFontSettings,
  fontSettingsBootstrapScript,
  normalizeAppearanceEditorFontSettings,
  normalizeAppearanceEditorFontSize,
} from '../src/lib/appearance-font-settings'

function mockRoot() {
  const attributes = new Map<string, string>()
  const properties = new Map<string, string>()
  const root = {
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    removeAttribute(name: string) {
      attributes.delete(name)
    },
    style: {
      setProperty(name: string, value: string) {
        properties.set(name, value)
      },
    },
  } as unknown as HTMLElement
  return { root, attributes, properties }
}

describe('appearance editor font settings', () => {
  test('starts each text role with the requested System face and sizes', () => {
    expect(DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS).toEqual({
      ui: { family: 'system', size: 14 },
      content: { family: 'system', size: 14 },
      code: { family: 'system', size: 12 },
    })
  })

  test('uses the existing font catalogue and migrates the old family to UI only', () => {
    const migrated = normalizeAppearanceEditorFontSettings(undefined, 'geist')

    expect(migrated).toEqual({
      settings: {
        ui: { family: 'geist', size: 14 },
        content: { family: 'system', size: 14 },
        code: { family: 'system', size: 12 },
      },
      recoveredAxes: [],
    })
    expect(fontOptions.map((option) => option.id)).toContain(migrated.settings.ui.family)
  })

  test('recovers removed family ids to System and reports the affected axis', () => {
    const normalized = normalizeAppearanceEditorFontSettings({
      ui: { family: 'retired-local-font', size: 16 },
      content: { family: 'geist', size: 15 },
      code: { family: 'jetbrains-mono', size: 12 },
    })

    expect(normalized.settings.ui.family).toBe('system')
    expect(normalized.settings.content.family).toBe('geist')
    expect(normalized.recoveredAxes).toEqual(['ui'])
  })

  test('clamps finite sizes and reports out-of-range or malformed saved values', () => {
    const normalized = normalizeAppearanceEditorFontSettings({
      ui: { family: 'system', size: APPEARANCE_EDITOR_FONT_SIZE_MIN - 1 },
      content: { family: 'system', size: APPEARANCE_EDITOR_FONT_SIZE_MAX + 10 },
      code: { family: 'system', size: 'small' },
    })

    expect(normalized.settings.ui.size).toBe(APPEARANCE_EDITOR_FONT_SIZE_MIN)
    expect(normalized.settings.content.size).toBe(APPEARANCE_EDITOR_FONT_SIZE_MAX)
    expect(normalized.settings.code.size).toBe(12)
    expect(normalized.recoveredAxes).toEqual(['ui', 'content', 'code'])
  })

  test('normalizes an in-progress numeric input without losing its current value on blank input', () => {
    expect(normalizeAppearanceEditorFontSize('18', 14)).toBe(18)
    expect(normalizeAppearanceEditorFontSize('100', 14)).toBe(APPEARANCE_EDITOR_FONT_SIZE_MAX)
    expect(normalizeAppearanceEditorFontSize('', 14)).toBe(14)
    expect(normalizeAppearanceEditorFontSize(Number.NaN, 14)).toBe(14)
  })

  test('projects validated families and sizes to the shared document axes', () => {
    const { root, attributes, properties } = mockRoot()
    attributes.set('data-font', 'space-grotesk')

    const result = applyAppearanceFontSettings(root, {
      ui: { family: 'geist-mono', size: 18 },
      content: { family: 'geist', size: 16 },
      code: { family: 'jetbrains-mono', size: 11 },
    })

    expect(result.recoveredAxes).toEqual([])
    expect(attributes.has('data-font')).toBe(false)
    expect(attributes.get('data-ui-font')).toBe('geist-mono')
    expect(attributes.get('data-content-font')).toBe('geist')
    expect(attributes.get('data-code-font')).toBe('jetbrains-mono')
    expect(properties.get('--font-ui-size')).toBe('18px')
    expect(properties.get('--font-content-size')).toBe('16px')
    expect(properties.get('--font-code-size')).toBe('11px')
    expect(properties.get('--font-ui-scale')).toBe(String(18 / 14))
    expect(properties.get('--font-content-scale')).toBe(String(16 / 14))
    expect(properties.get('--font-code-scale')).toBe(String(11 / 12))
  })

  test('bootstrap applies the same defaults, migration, whitelist and size bounds', () => {
    const { attributes, properties } = mockRoot()
    const document = {
      documentElement: {
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        removeAttribute: (name: string) => attributes.delete(name),
        style: { setProperty: (name: string, value: string) => properties.set(name, value) },
      },
    }
    const storage = {
      getItem: () =>
        JSON.stringify({
          font: 'geist',
          fonts: {
            ui: { size: 100 },
            content: { family: 'missing-font', size: 8 },
            code: { family: 'jetbrains-mono', size: 12 },
          },
        }),
    }
    const run = new Function(
      'localStorage',
      'document',
      fontSettingsBootstrapScript('appearance')
    ) as (storage: Storage, document: unknown) => void

    attributes.set('data-font', 'space-grotesk')
    run(storage as Storage, document)

    expect(attributes.has('data-font')).toBe(false)
    expect(attributes.get('data-ui-font')).toBe('geist')
    expect(attributes.has('data-content-font')).toBe(false)
    expect(attributes.get('data-code-font')).toBe('jetbrains-mono')
    expect(properties.get('--font-ui-size')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MAX) + 'px')
    expect(properties.get('--font-content-size')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MIN) + 'px')
    expect(properties.get('--font-code-size')).toBe('12px')
    expect(properties.get('--font-ui-scale')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MAX / 14))
    expect(properties.get('--font-content-scale')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MIN / 14))
    expect(properties.get('--font-code-scale')).toBe('1')
    expect(properties.get('--font-ui-scale')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MAX / 14))
    expect(properties.get('--font-content-scale')).toBe(String(APPEARANCE_EDITOR_FONT_SIZE_MIN / 14))
    expect(properties.get('--font-code-scale')).toBe('1')
  })

  test('bootstrap leaves a malformed or inaccessible preference on System defaults', () => {
    for (const getItem of [() => '{not-json', () => { throw new Error('blocked') }]) {
      const { attributes, properties } = mockRoot()
      const document = {
        documentElement: {
          setAttribute: (name: string, value: string) => attributes.set(name, value),
          removeAttribute: (name: string) => attributes.delete(name),
          style: { setProperty: (name: string, value: string) => properties.set(name, value) },
        },
      }
      const run = new Function(
        'localStorage',
        'document',
        fontSettingsBootstrapScript('appearance')
      ) as (storage: Storage, document: unknown) => void

      attributes.set('data-font', 'space-grotesk')
      run({ getItem } as Storage, document)

      expect(attributes.has('data-font')).toBe(false)
      expect(attributes.has('data-ui-font')).toBe(false)
      expect(attributes.has('data-content-font')).toBe(false)
      expect(attributes.has('data-code-font')).toBe(false)
      expect(properties.get('--font-ui-size')).toBe('14px')
      expect(properties.get('--font-content-size')).toBe('14px')
      expect(properties.get('--font-code-size')).toBe('12px')
      expect(properties.get('--font-ui-scale')).toBe('1')
      expect(properties.get('--font-content-scale')).toBe('1')
      expect(properties.get('--font-code-scale')).toBe('1')
    }
  })
})
