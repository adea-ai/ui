import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import { ThemeModeToggle } from '../src/components/theme/theme-mode-toggle'
import { ThemePicker, ThemePreview, ThemeSwatch } from '../src/components/theme/theme-picker'
import { ThemeProvider, useOptionalTheme, useTheme } from '../src/components/theme/theme-provider'
import { ThemeToggle } from '../src/components/theme/theme-toggle'
import type { ThemeContextValue, ThemeSelection } from '../src/components/theme/theme-state-core'
import { builtinThemes, themeById } from '../src/lib/themes'
import { useDom } from './helpers/dom'

const dom = useDom()

const slot = (root: HTMLElement, name: string) => root.querySelector(`[data-slot="${name}"]`)!
const buttonsOf = (root: HTMLElement) => [...root.querySelectorAll('button')] as HTMLButtonElement[]
const html = () => dom.window.document.documentElement

/** A provider over an in-memory store, handing the context to the test. */
function mountProvider(
  stored: Partial<ThemeSelection> | undefined,
  children: () => import('solid-js').JSX.Element
) {
  const writes: ThemeSelection[] = []
  const root = dom.mount(() => (
    <ThemeProvider persistence={{ read: () => stored, write: (next) => writes.push(next) }}>
      {children()}
    </ThemeProvider>
  ))
  return { root, writes }
}

describe('ThemeProvider', () => {
  test('paints the stored preference on the document and persists a change', () => {
    let theme!: ThemeContextValue
    const { writes } = mountProvider({ appearance: 'dark' }, () => {
      theme = useTheme()
      return null
    })
    expect(theme.selection().appearance).toBe('dark')
    expect(theme.resolvedAppearance()).toBe('dark')
    expect(html().getAttribute('data-theme')).toBe('adea-dark')
    expect(html().getAttribute('data-appearance')).toBe('dark')

    theme.setSelection({ appearance: 'light' })
    expect(html().getAttribute('data-theme')).toBe('adea-light')
    expect(html().getAttribute('data-appearance')).toBe('light')
    expect(writes.at(-1)?.appearance).toBe('light')
  })

  test('a preview paints the draft without changing or persisting the selection', () => {
    let theme!: ThemeContextValue
    const { writes } = mountProvider({ appearance: 'light' }, () => {
      theme = useTheme()
      return null
    })
    const before = writes.length
    expect(theme.previewing()).toBe(false)
    theme.preview({ appearance: 'dark' })
    expect(theme.previewing()).toBe(true)
    expect(html().getAttribute('data-theme')).toBe('adea-dark')
    expect(theme.selection().appearance).toBe('light')
    theme.preview(undefined)
    expect(theme.previewing()).toBe(false)
    expect(html().getAttribute('data-theme')).toBe('adea-light')
    expect(writes.length).toBe(before)
  })

  test('the eager provider offers the whole catalogue as ready', () => {
    let theme!: ThemeContextValue
    mountProvider(undefined, () => {
      theme = useTheme()
      return null
    })
    expect(theme.themes.length).toBe(builtinThemes.length)
    expect(theme.allThemes().length).toBe(builtinThemes.length)
    expect(theme.catalogueReady?.()).toBe(true)
  })

  test('useOptionalTheme is undefined outside a provider and useTheme throws', () => {
    let optional: ThemeContextValue | undefined | 'unset' = 'unset'
    dom.mount(() => {
      optional = useOptionalTheme()
      return null
    })
    expect(optional).toBeUndefined()
    expect(() => dom.mount(() => (useTheme(), null))).toThrow('useTheme must be called')
  })
})

describe('ThemeToggle', () => {
  test('marks the stored appearance as pressed and changes it on click', () => {
    let theme!: ThemeContextValue
    const { root } = mountProvider({ appearance: 'light' }, () => {
      theme = useTheme()
      return <ThemeToggle />
    })
    const group = slot(root, 'toggle-group')
    expect(group.getAttribute('aria-label')).toBe('Appearance')
    const [light, dark, system] = buttonsOf(root)
    expect(buttonsOf(root).map((button) => button.getAttribute('aria-label'))).toEqual([
      'Light',
      'Dark',
      'System',
    ])
    expect(light?.getAttribute('aria-pressed')).toBe('true')
    dark?.click()
    expect(theme.selection().appearance).toBe('dark')
    expect(dark?.getAttribute('aria-pressed')).toBe('true')
    system?.click()
    expect(theme.selection().appearance).toBe('system')
  })

  test('pressing the current appearance again keeps it rather than unsetting it', () => {
    let theme!: ThemeContextValue
    const { root } = mountProvider({ appearance: 'dark' }, () => {
      theme = useTheme()
      return <ThemeToggle />
    })
    buttonsOf(root)[1]?.click()
    expect(theme.selection().appearance).toBe('dark')
  })

  test('withLabels shows the words beside the icons', () => {
    const plain = mountProvider({}, () => <ThemeToggle />).root
    const labelled = mountProvider({}, () => <ThemeToggle withLabels class="mt-2" />).root
    expect(buttonsOf(plain).map((button) => button.textContent)).toEqual(['', '', ''])
    expect(buttonsOf(labelled).map((button) => button.textContent)).toEqual([
      'Light',
      'Dark',
      'System',
    ])
    expect(slot(labelled, 'toggle-group').classList.contains('mt-2')).toBe(true)
  })
})

describe('ThemeModeToggle', () => {
  test('is controlled: the mode prop is pressed and a click reports the new mode', () => {
    const [mode, setMode] = createSignal<'light' | 'dark' | 'system'>('system')
    const reported: string[] = []
    const root = dom.mount(() => (
      <ThemeModeToggle
        mode={mode()}
        onModeChange={(next) => {
          reported.push(next)
          setMode(next)
        }}
      />
    ))
    const [light, dark, system] = buttonsOf(root)
    expect(slot(root, 'toggle-group').getAttribute('aria-label')).toBe('Appearance')
    expect(system?.getAttribute('aria-pressed')).toBe('true')
    dark?.click()
    expect(reported).toEqual(['dark'])
    expect(dark?.getAttribute('aria-pressed')).toBe('true')
    expect(light?.getAttribute('aria-pressed')).toBe('false')
  })

  test('shows labels when asked and takes a caller aria-label', () => {
    const root = dom.mount(() => (
      <ThemeModeToggle mode="light" onModeChange={() => {}} withLabels aria-label="Colour mode" />
    ))
    expect(slot(root, 'toggle-group').getAttribute('aria-label')).toBe('Colour mode')
    expect(buttonsOf(root).map((button) => button.textContent)).toEqual(['Light', 'Dark', 'System'])
  })
})

describe('ThemeSwatch and ThemePreview', () => {
  // Hex colours: the DOM drops a declaration it cannot parse, and it cannot parse the
  // catalogue's oklch values.
  const base = themeById('adea-dark')!
  const theme = {
    ...base,
    colors: { ...base.colors, background: '#102030', primary: '#c0ffee' },
  }

  test('a swatch draws five colour chips from the theme and hides from assistive tech', () => {
    const swatch = slot(
      dom.mount(() => <ThemeSwatch theme={theme} size="lg" />),
      'theme-swatch'
    )
    expect(swatch.getAttribute('aria-hidden')).toBe('true')
    const chips = [...swatch.children] as HTMLElement[]
    expect(chips.length).toBe(5)
    expect(chips.every((chip) => chip.classList.contains('h-8'))).toBe(true)
    expect(chips[0]?.style.getPropertyValue('background-color')).toBe(theme.colors.background)
    expect(chips[2]?.style.getPropertyValue('background-color')).toBe(theme.colors.primary)
  })

  test('a swatch defaults to the medium size', () => {
    const swatch = slot(
      dom.mount(() => <ThemeSwatch theme={theme} />),
      'theme-swatch'
    )
    expect(swatch.firstElementChild?.classList.contains('h-6')).toBe(true)
  })

  test('a preview paints the theme background and rings itself only when selected', () => {
    const plain = slot(
      dom.mount(() => <ThemePreview theme={theme} />),
      'theme-preview'
    )
    const selected = slot(
      dom.mount(() => <ThemePreview theme={theme} selected />),
      'theme-preview'
    )
    expect((plain as HTMLElement).style.getPropertyValue('background-color')).toBe(
      theme.colors.background
    )
    expect(plain.classList.contains('border-border')).toBe(true)
    expect(selected.classList.contains('border-primary')).toBe(true)
  })
})

describe('ThemePicker', () => {
  const light = themeById('adea-light')!
  const dark = themeById('adea-dark')!
  const other = builtinThemes.find((candidate) => candidate.family !== 'adea')!

  test('is a radio group with one option per theme, the selected one checked', () => {
    const root = dom.mount(() => (
      <ThemePicker themes={[light, dark, other]} selectedId={dark.id} onThemeSelect={() => {}} />
    ))
    const picker = slot(root, 'theme-picker')
    expect(picker.getAttribute('role')).toBe('radiogroup')
    const options = buttonsOf(root)
    expect(options.map((option) => option.getAttribute('role'))).toEqual([
      'radio',
      'radio',
      'radio',
    ])
    expect(options.map((option) => option.getAttribute('aria-checked'))).toEqual([
      'false',
      'true',
      'false',
    ])
    expect(options[2]?.getAttribute('aria-label')).toBe(`${other.familyLabel} ${other.label}`)
  })

  test('names the family under a theme that is not an Adea one, and not under an Adea one', () => {
    const root = dom.mount(() => (
      <ThemePicker themes={[light, other]} selectedId={light.id} onThemeSelect={() => {}} />
    ))
    const [adea, third] = buttonsOf(root)
    expect(adea?.textContent).toBe(light.label)
    expect(third?.textContent).toBe(`${other.label}${other.familyLabel}`)
  })

  test('selecting an option reports that theme', () => {
    const selected: string[] = []
    const root = dom.mount(() => (
      <ThemePicker
        themes={[light, dark]}
        selectedId={light.id}
        onThemeSelect={(theme) => selected.push(theme.id)}
      />
    ))
    buttonsOf(root)[1]?.click()
    expect(selected).toEqual([dark.id])
  })
})
