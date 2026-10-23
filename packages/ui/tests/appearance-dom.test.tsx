import { RadioGroup } from '@kobalte/core/radio-group'
import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import { AccentSwatchGroups } from '../src/components/composites/appearance-editor/accent-swatch-groups'
import { AppearanceFontSettingsGroup } from '../src/components/composites/appearance-editor/font-settings-group'
import { AppearancePanel } from '../src/components/theme/appearance-panel'
import { ThemeProvider, useTheme } from '../src/components/theme/theme-provider'
import type { ThemeContextValue, ThemeSelection } from '../src/components/theme/theme-state-core'
import {
  APPEARANCE_EDITOR_FONT_SIZE_MAX,
  APPEARANCE_EDITOR_FONT_SIZE_MIN,
  DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS,
  type AppearanceEditorFontSettings,
} from '../src/lib/appearance-font-settings'
import { fontOptions } from '../src/lib/font-catalog'
import { accentPresets } from '../src/lib/tokens'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  )
const choose = (item: Element) =>
  item.dispatchEvent(
    new dom.window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
  )

const swatch = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-accent-option="${id}"]`) as HTMLElement | null
const colourOf = (element: HTMLElement) =>
  (element.querySelector('span[aria-hidden="true"]') as HTMLElement | null)?.style.getPropertyValue(
    'background-color'
  )

describe('AccentSwatchGroups', () => {
  const options = [
    { id: 'theme', label: 'Theme', light: '#000000', dark: '#ffffff' },
    { id: 'violet', label: 'Violet', light: '#6d28d9', dark: '#a78bfa' },
    { id: 'teal', label: 'Teal', light: '#0f766e' },
  ]
  const mountSwatches = (extra: { appearance?: 'light' | 'dark'; row?: boolean; hide?: boolean }) =>
    dom.mount(() => (
      <RadioGroup value="violet" aria-label="Accent">
        <AccentSwatchGroups
          accentOptions={options}
          resolvedAppearance={extra.appearance ?? 'light'}
          themeDefaultColor="#123456"
          showThemeDefault={extra.hide ? false : undefined}
          layout={extra.row ? 'row' : 'grid'}
        />
      </RadioGroup>
    ))

  test('offers the theme default first, then every preset except the theme entry', () => {
    const root = mountSwatches({})
    expect(
      [...root.querySelectorAll('[data-accent-option]')].map((node) =>
        node.getAttribute('data-accent-option')
      )
    ).toEqual(['theme', 'violet', 'teal'])
    expect(swatch(root, 'theme')?.textContent).toBe('Theme default')
    expect(swatch(root, 'violet')?.textContent).toBe('Violet')
    expect(root.querySelector('[data-accent-grid]')?.classList.contains('grid-cols-4')).toBe(true)
  })

  test('each swatch is painted for the resolved appearance', () => {
    const light = mountSwatches({ appearance: 'light' })
    expect(colourOf(swatch(light, 'violet')!)).toBe('#6d28d9')
    expect(colourOf(swatch(light, 'theme')!)).toBe('#123456')
    const dark = mountSwatches({ appearance: 'dark' })
    expect(colourOf(swatch(dark, 'violet')!)).toBe('#a78bfa')
  })

  test('a preset with no colour for the appearance is drawn empty rather than failing', () => {
    const root = mountSwatches({ appearance: 'dark' })
    expect(colourOf(swatch(root, 'teal')!)).toBe('')
  })

  test('the theme default can be left out', () => {
    expect(swatch(mountSwatches({ hide: true }), 'theme')).toBeNull()
  })

  test('the row layout draws round chips and lays them out in a single row', () => {
    const root = mountSwatches({ row: true })
    expect(root.querySelector('[data-accent-grid]')?.classList.contains('grid-flow-col')).toBe(true)
    const violet = swatch(root, 'violet')!
    expect(violet.querySelector('svg circle')?.getAttribute('fill')).toBe('#6d28d9')
    expect(violet.classList.contains('flex')).toBe(true)
  })

  test('the checked swatch follows the group value', () => {
    const root = mountSwatches({})
    const checked = [...root.querySelectorAll('input[type="radio"]')].filter(
      (input) => (input as HTMLInputElement).checked
    )
    expect(checked.length).toBe(1)
  })
})

function Harness(props: {
  initial?: AppearanceEditorFontSettings
  disabled?: boolean
  changes: AppearanceEditorFontSettings[]
}) {
  const [settings, setSettings] = createSignal(
    props.initial ?? DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS
  )
  return (
    <AppearanceFontSettingsGroup
      settings={settings()}
      disabled={props.disabled}
      onChange={(next) => {
        props.changes.push(next)
        setSettings(next)
      }}
    />
  )
}
const sizeInput = (axis: string) =>
  doc().querySelector(`input[aria-label="${axis} font size in pixels"]`) as HTMLInputElement
const type = (input: HTMLInputElement, value: string) => {
  input.value = value
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}

describe('AppearanceFontSettingsGroup', () => {
  test('has a row for the interface, content and code, each with a family menu and size field', () => {
    dom.mount(() => <Harness changes={[]} />)
    expect(
      [...doc().querySelectorAll('[data-font-settings-row]')].map((row) =>
        row.getAttribute('data-font-settings-row')
      )
    ).toEqual(['ui', 'content', 'code'])
    expect(doc().querySelector('button[aria-label="UI font family"]')).not.toBeNull()
    expect(sizeInput('Code').value).toBe(String(DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.code.size))
    expect(doc().body.textContent).toContain('Controls and interface labels.')
  })

  test('a size is committed on blur, clamped into range, and reported for that axis only', () => {
    const changes: AppearanceEditorFontSettings[] = []
    dom.mount(() => <Harness changes={changes} />)
    const input = sizeInput('Content')
    type(input, '19')
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(changes.length).toBe(1)
    expect(changes[0]?.content.size).toBe(19)
    expect(changes[0]?.ui.size).toBe(DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.ui.size)
    type(input, '999')
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(changes.at(-1)?.content.size).toBe(APPEARANCE_EDITOR_FONT_SIZE_MAX)
  })

  test('Enter commits a size without leaving the field', () => {
    const changes: AppearanceEditorFontSettings[] = []
    dom.mount(() => <Harness changes={changes} />)
    const input = sizeInput('UI')
    type(input, '2')
    const enter = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(changes.at(-1)?.ui.size).toBe(APPEARANCE_EDITOR_FONT_SIZE_MIN)
    const other = new dom.window.KeyboardEvent('keydown', { key: 'a', bubbles: true })
    input.dispatchEvent(other)
    expect(changes.length).toBe(1)
  })

  test('an unchanged or non-numeric size reports nothing', () => {
    const changes: AppearanceEditorFontSettings[] = []
    dom.mount(() => <Harness changes={changes} />)
    const input = sizeInput('Code')
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    type(input, String(DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS.code.size))
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    type(input, 'abc')
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(changes).toEqual([])
  })

  test('flags a size draft that is out of range or not a whole number while it is being typed', () => {
    dom.mount(() => <Harness changes={[]} />)
    const input = sizeInput('UI')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    type(input, '5')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    type(input, '14.5')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    type(input, '')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    type(input, '16')
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(doc().getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain(
      `from ${APPEARANCE_EDITOR_FONT_SIZE_MIN} to ${APPEARANCE_EDITOR_FONT_SIZE_MAX}`
    )
  })

  test('disabled controls cannot be edited or opened', () => {
    dom.mount(() => <Harness changes={[]} disabled />)
    expect(sizeInput('UI').disabled).toBe(true)
    expect(
      (doc().querySelector('button[aria-label="UI font family"]') as HTMLButtonElement).disabled
    ).toBe(true)
  })

  test('the family menu names the current family and lists System and the catalogue', async () => {
    const changes: AppearanceEditorFontSettings[] = []
    dom.mount(() => <Harness changes={changes} />)
    const trigger = doc().querySelector('button[aria-label="Content font family"]')!
    expect(trigger.textContent).toBe('System')
    key(trigger, 'Enter')
    await tick()
    const radios = [...doc().querySelectorAll('[role="menuitemradio"]')]
    expect(radios.length).toBe(fontOptions.length)
    expect(radios[0]?.textContent).toBe('System')
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true')
  })

  test('choosing a catalogue family reports it for that axis, and choosing System puts it back', async () => {
    const changes: AppearanceEditorFontSettings[] = []
    dom.mount(() => <Harness changes={changes} />)
    const trigger = doc().querySelector('button[aria-label="Code font family"]')!
    key(trigger, 'Enter')
    await tick()
    const family = fontOptions.find((option) => option.id !== 'system')!
    choose(
      [...doc().querySelectorAll('[role="menuitemradio"]')].find(
        (r) => r.textContent === family.label
      )!
    )
    await tick(60)
    expect(changes.at(-1)?.code.family).toBe(family.id)
    expect(trigger.textContent).toBe(family.label)
    key(trigger, 'Enter')
    await tick()
    choose(
      [...doc().querySelectorAll('[role="menuitemradio"]')].find((r) => r.textContent === 'System')!
    )
    await tick(60)
    expect(changes.at(-1)?.code.family).toBe('system')
  })

  test('Escape closes the family menu', async () => {
    dom.mount(() => <Harness changes={[]} />)
    const trigger = doc().querySelector('button[aria-label="UI font family"]')!
    key(trigger, 'Enter')
    await tick()
    key(doc().querySelector('[role="menu"]')!, 'Escape')
    await tick(60)
    expect(doc().querySelector('[role="menu"]')).toBeNull()
  })

  test('inside a dialog, Tab from an open menu closes it and moves to the next control', async () => {
    const mountNode = doc().createElement('div')
    const dialog = doc().createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.appendChild(mountNode)
    doc().body.appendChild(dialog)
    // Laid-out controls: the tab-stop scan skips anything with no box.
    const original = dom.window.HTMLElement.prototype.getClientRects
    dom.window.HTMLElement.prototype.getClientRects = (() => [{}]) as never
    try {
      dom.mount(() => (
        <AppearanceFontSettingsGroup
          settings={DEFAULT_APPEARANCE_EDITOR_FONT_SETTINGS}
          onChange={() => {}}
          menuPortalMount={mountNode}
        />
      ))
      const container = doc().querySelector('.global-appearance-font-settings')!
      dialog.appendChild(container)
      const trigger = doc().querySelector('button[aria-label="UI font family"]') as HTMLElement
      key(trigger, 'Enter')
      await tick()
      const menu = mountNode.querySelector('[role="menu"]')!
      expect(menu).not.toBeNull()
      const tab = new dom.window.KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      })
      menu.dispatchEvent(tab)
      await tick(60)
      expect(tab.defaultPrevented).toBe(true)
      expect(mountNode.querySelector('[role="menu"]')).toBeNull()
      expect(doc().activeElement === trigger).toBe(false)
      expect(doc().activeElement?.tagName).not.toBe('BODY')
    } finally {
      dom.window.HTMLElement.prototype.getClientRects = original
      dialog.remove()
    }
  })
})

function mountPanel(stored: Partial<ThemeSelection> = {}) {
  let theme!: ThemeContextValue
  const root = dom.mount(() => (
    <ThemeProvider persistence={{ read: () => stored, write: () => {} }}>
      {(() => {
        theme = useTheme()
        return <AppearancePanel class="opacity-90" />
      })()}
    </ThemeProvider>
  ))
  return { root, theme: () => theme }
}

describe('AppearancePanel', () => {
  test('has sections for appearance, the theme, the accent and fonts', () => {
    const { root } = mountPanel({ appearance: 'light' })
    const panel = root.querySelector('[data-slot="appearance-panel"]')!
    expect(panel.classList.contains('opacity-90')).toBe(true)
    expect([...panel.querySelectorAll('h2')].map((heading) => heading.textContent)).toEqual([
      'Appearance',
      'Light theme',
      'Accent',
      'Fonts',
    ])
  })

  test('shows the dark theme picker when the appearance resolves to dark', () => {
    const { root } = mountPanel({ appearance: 'dark' })
    expect([...root.querySelectorAll('h2')].map((heading) => heading.textContent)).toContain(
      'Dark theme'
    )
    expect(root.textContent).not.toContain('Light theme')
  })

  test('picking an appearance changes the stored preference and the theme section follows', () => {
    const { root, theme } = mountPanel({ appearance: 'light' })
    const dark = root.querySelector('input[type="radio"][value="dark"]') as HTMLInputElement
    dark.click()
    expect(theme().selection().appearance).toBe('dark')
    expect([...root.querySelectorAll('h2')].map((heading) => heading.textContent)).toContain(
      'Dark theme'
    )
  })

  test('explains what the system appearance currently resolves to', () => {
    const { root } = mountPanel({ appearance: 'light' })
    expect(root.textContent).toContain('Currently resolving to light.')
  })

  test('choosing a theme sets the theme for that appearance', () => {
    const { root, theme } = mountPanel({ appearance: 'light' })
    const options = [...root.querySelectorAll('[data-slot="theme-picker"] button')]
    const second = options[1] as HTMLButtonElement
    second.click()
    expect(theme().selection().lightThemeId).not.toBe('')
    expect(second.getAttribute('aria-checked')).toBe('true')
  })

  test('choosing an accent sets it, and an unknown stored accent shows the theme default', () => {
    const { root, theme } = mountPanel({ appearance: 'light', accent: 'no-such-accent' })
    const checkedBefore = root.querySelector(
      '[data-accent-option="theme"] input[type="radio"]'
    ) as HTMLInputElement
    expect(checkedBefore.checked).toBe(true)
    const preset = accentPresets.find((option) => option.id !== 'theme')!
    const input = root.querySelector(
      `[data-accent-option="${preset.id}"] input[type="radio"]`
    ) as HTMLInputElement
    input.click()
    expect(theme().selection().accent).toBe(preset.id)
  })

  test('editing a font size updates the stored fonts', () => {
    const { root, theme } = mountPanel({ appearance: 'light' })
    const input = root.querySelector(
      'input[aria-label="UI font size in pixels"]'
    ) as HTMLInputElement
    input.value = '18'
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    input.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(theme().selection().fonts?.ui?.size).toBe(18)
  })
})
