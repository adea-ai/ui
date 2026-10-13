import { describe, expect, test } from 'bun:test'
import {
  applyThemeToRoot,
  applyWithoutTransitions,
  themeDocumentTokens,
  type ThemeDocumentState,
} from '../src/components/theme/theme-document'
import { defaultThemeSelection, mergeThemeSelection } from '../src/components/theme/theme-state'
import {
  accentVariables,
  themeById,
  themeCssVariables,
  tokensAsHex,
  variantFromRecord,
} from '../src/lib/themes'
import { getTheme } from '@adea-ai/themes'
import { surfaceAlpha } from '../src/lib/theme-surface'
import { terminalCssVariables } from '../src/lib/themes'
import { fakeRoot } from './helpers/fake-root'

const stateOf = (
  patch: Partial<typeof defaultThemeSelection> = {},
  id = 'adea-dark',
  appearance: 'light' | 'dark' = 'dark'
): ThemeDocumentState => ({
  selection: mergeThemeSelection(defaultThemeSelection, patch),
  appearance,
  variant: themeById(id)!,
})

describe('applyThemeToRoot', () => {
  test('writes the variant, the appearance attributes and nothing else for a plain selection', () => {
    const { root, attributes, properties, classes, style } = fakeRoot()
    applyThemeToRoot(root, stateOf())

    expect(classes.has('dark')).toBe(true)
    expect(style.colorScheme).toBe('dark')
    expect(attributes.get('data-theme')).toBe('adea-dark')
    expect(attributes.get('data-appearance')).toBe('dark')
    expect(properties.get('--background')).toBe(
      themeCssVariables(themeById('adea-dark')!)['--background']
    )

    expect(attributes.has('data-accent')).toBe(false)
    expect(attributes.has('data-density')).toBe(false)
    expect(attributes.has('data-surface')).toBe(false)
    expect(attributes.has('data-reduce-transparency')).toBe(false)
  })

  test('the full attribute set for the default selection is pinned', () => {
    const { root, attributes } = fakeRoot()
    applyThemeToRoot(root, stateOf())
    expect([...attributes.keys()].toSorted()).toEqual([
      'data-appearance',
      'data-font-settings',
      'data-theme',
    ])
  })

  test('a light appearance removes the dark class and sets the light scheme', () => {
    const { root, classes, style } = fakeRoot()
    applyThemeToRoot(root, stateOf({}, 'adea-dark', 'dark'))
    applyThemeToRoot(root, stateOf({}, 'adea-light', 'light'))
    expect(classes.has('dark')).toBe(false)
    expect(style.colorScheme).toBe('light')
  })

  test('an accent overlays the variant and is named on the root; `theme` removes it', () => {
    const { root, attributes, properties } = fakeRoot()
    applyThemeToRoot(root, stateOf({ accent: 'violet' }))
    expect(attributes.get('data-accent')).toBe('violet')
    const expected = accentVariables('violet', 'dark', defaultThemeSelection)!
    for (const [name, value] of Object.entries(expected)) expect(properties.get(name)).toBe(value)

    applyThemeToRoot(root, stateOf({ accent: 'theme' }))
    expect(attributes.has('data-accent')).toBe(false)
    expect(properties.get('--primary')).toBe(
      themeCssVariables(themeById('adea-dark')!)['--primary']
    )
  })

  test('compact density is an attribute and comfortable is its absence', () => {
    const { root, attributes } = fakeRoot()
    applyThemeToRoot(root, stateOf({ density: 'compact' }))
    expect(attributes.get('data-density')).toBe('compact')
    applyThemeToRoot(root, stateOf({ density: 'comfortable' }))
    expect(attributes.has('data-density')).toBe(false)
  })

  test('fonts follow the selection', () => {
    const { root, attributes, properties } = fakeRoot()
    applyThemeToRoot(root, stateOf({ font: 'geist' }))
    expect(attributes.get('data-ui-font')).toBe('geist')
    expect(properties.get('--font-ui')).toBe('var(--font-family-geist)')
  })

  test('reports the properties it wrote, and re-applying the catalogue removes nothing', () => {
    const { root, properties } = fakeRoot()
    const first = applyThemeToRoot(root, stateOf({}, 'adea-dark'))
    const before = new Map(properties)
    const second = applyThemeToRoot(root, stateOf({}, 'nord'), {}, first)
    expect(second.size).toBe(first.size)
    expect(properties.size).toBe(before.size)
  })

  test('a property a previous host variant owned is swept when the next does not set it', () => {
    const { root, properties } = fakeRoot()
    const record = getTheme('nord')!
    const imported = {
      ...variantFromRecord({ ...record, id: 'custom-x' }),
      tokens: { '--only-on-import': '#123456', '--background': '#010203' },
    }

    const withImport = applyThemeToRoot(root, { ...stateOf(), variant: imported })
    expect(properties.get('--only-on-import')).toBe('#123456')
    expect(properties.get('--background')).toBe('#010203')

    applyThemeToRoot(root, stateOf({}, 'adea-dark'), {}, withImport)
    expect(properties.has('--only-on-import')).toBe(false)
    expect(properties.get('--background')).toBe(
      themeCssVariables(themeById('adea-dark')!)['--background']
    )
  })

  test('without `previous` nothing is swept', () => {
    const { root, properties } = fakeRoot()
    properties.set('--left-by-someone-else', 'x')
    applyThemeToRoot(root, stateOf())
    expect(properties.get('--left-by-someone-else')).toBe('x')
  })

  test('transformTokens sees the variant with the accent over it and decides what is written', () => {
    const { root, properties } = fakeRoot()
    const seen: Record<string, string>[] = []
    applyThemeToRoot(root, stateOf({ accent: 'violet' }), {
      transformTokens(tokens) {
        seen.push(tokens)
        return tokensAsHex(tokens)
      },
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]!['--primary']).toBe(
      accentVariables('violet', 'dark', defaultThemeSelection)!['--primary']
    )
    for (const name of ['--background', '--primary', '--ring', '--terminal-ansi-red']) {
      expect(properties.get(name)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

const written = (root: ReturnType<typeof fakeRoot>) =>
  ['--primary', '--primary-foreground', '--primary-hover', '--ring', '--primary-subtle'].map(
    (name) => root.properties.get(name)
  )

describe('accent override on the document', () => {
  test('writes --primary, --primary-foreground, --primary-hover and --ring, and leaves the theme tint', () => {
    const root = fakeRoot()
    applyThemeToRoot(root.root, stateOf({ accent: 'violet' }), { accentContrastFloor: 3 })
    const variant = themeCssVariables(themeById('adea-dark')!)
    const roles = accentVariables('violet', 'dark', defaultThemeSelection)!
    const [primary, foreground, hover, ring, subtle] = written(root)
    expect({ primary, foreground, hover, ring }).toEqual({
      primary: roles['--primary'],
      foreground: roles['--primary-foreground'],
      hover: roles['--primary-hover'],
      ring: roles['--ring'],
    })
    // The tint is the theme's measured one, never the accent's.
    expect(subtle).toBe(variant['--primary-subtle'])
  })

  test('the floor is the identity for a preset, so the same properties are written', () => {
    const plain = fakeRoot()
    const gated = fakeRoot()
    applyThemeToRoot(plain.root, stateOf({ accent: 'violet' }))
    applyThemeToRoot(gated.root, stateOf({ accent: 'violet' }), { accentContrastFloor: 3 })
    expect(Object.fromEntries(gated.properties)).toEqual(Object.fromEntries(plain.properties))
  })

  test('a stricter floor repairs a preset on this variant', () => {
    const plain = fakeRoot()
    const strict = fakeRoot()
    applyThemeToRoot(plain.root, stateOf({ accent: 'violet' }))
    applyThemeToRoot(strict.root, stateOf({ accent: 'violet' }), { accentContrastFloor: 12 })
    expect(strict.properties.get('--primary')).not.toBe(plain.properties.get('--primary'))
    expect(strict.attributes.get('data-accent')).toBe('violet')
  })

  test('a custom colour paints its roles, is reported as `custom`, and is gated without a floor', () => {
    const root = fakeRoot()
    applyThemeToRoot(root.root, stateOf({ accent: '#0B57D0' }, 'adea-light', 'light'))
    expect(root.attributes.get('data-accent')).toBe('custom')
    const expected = accentVariables('#0b57d0', 'light', defaultThemeSelection, {
      background: themeById('adea-light')!.colors.background,
    })!
    for (const [name, value] of Object.entries(expected)) {
      expect(root.properties.get(name)).toBe(value)
    }

    // Too pale for a white-ish surface: raised, not painted as chosen.
    const pale = fakeRoot()
    applyThemeToRoot(pale.root, stateOf({ accent: '#f0f0f0' }, 'adea-light', 'light'))
    expect(pale.properties.get('--primary')).not.toBe(
      accentVariables('#f0f0f0', 'light', defaultThemeSelection)!['--primary']
    )
  })

  test('returning to `theme` or to another preset leaves no custom colour behind', () => {
    const root = fakeRoot()
    let previous = applyThemeToRoot(root.root, stateOf({ accent: '#0b57d0' }))
    previous = applyThemeToRoot(root.root, stateOf({ accent: 'theme' }), {}, previous)
    expect(root.attributes.has('data-accent')).toBe(false)
    expect(root.properties.get('--primary')).toBe(
      themeCssVariables(themeById('adea-dark')!)['--primary']
    )
  })

  test('an invalid hex is not an accent, however it is spelled', () => {
    for (const accent of ['#abc', '#0b57d0ff', '0b57d0', '#zzzzzz']) {
      expect(themeDocumentTokens(stateOf({ accent })).accented).toBe(false)
    }
  })
})

describe('themeDocumentTokens', () => {
  test('is the variant roles verbatim when nothing else applies', () => {
    const { tokens, accented } = themeDocumentTokens(stateOf())
    expect(tokens).toEqual(themeCssVariables(themeById('adea-dark')!))
    expect(accented).toBe(false)
  })

  test('an unknown accent id is not an accent', () => {
    expect(themeDocumentTokens(stateOf({ accent: 'chartreuse' })).accented).toBe(false)
  })
})

const terminalNames = (tokens: Record<string, string>) =>
  Object.keys(tokens).filter((name) => name.startsWith('--terminal-'))

describe('a pinned terminal palette', () => {
  test('is written over the interface variant, last, and only the terminal ramp', () => {
    const { root, properties } = fakeRoot()
    const dracula = themeById('dracula')!
    applyThemeToRoot(root, { ...stateOf({}, 'nord'), terminalVariant: dracula })

    const pinned = terminalCssVariables(dracula)
    const interfaceVariant = themeCssVariables(themeById('nord')!)
    expect(terminalNames(pinned)).toHaveLength(20)
    expect(pinned['--terminal-background']).not.toBe(interfaceVariant['--terminal-background'])
    for (const [name, value] of Object.entries(pinned)) expect(properties.get(name)).toBe(value)
    // Everything else is still nord's.
    expect(properties.get('--background')).toBe(interfaceVariant['--background'])
    expect(properties.get('--editor-keyword')).toBe(interfaceVariant['--editor-keyword'])
  })

  test('dropping the pin repaints the interface palette on the same root', () => {
    const { root, properties } = fakeRoot()
    const pinned = applyThemeToRoot(root, {
      ...stateOf({}, 'nord'),
      terminalVariant: themeById('dracula')!,
    })
    applyThemeToRoot(root, stateOf({}, 'nord'), {}, pinned)
    const own = themeCssVariables(themeById('nord')!)
    for (const name of terminalNames(own)) expect(properties.get(name)).toBe(own[name])
  })

  test('is a custom variant`s verbatim terminal tokens when it carries them', () => {
    const imported = {
      ...variantFromRecord({ ...getTheme('nord')!, id: 'custom-t' }),
      tokens: { '--terminal-background': '#010203' },
    }
    const { root, properties } = fakeRoot()
    applyThemeToRoot(root, { ...stateOf(), terminalVariant: imported })
    expect(properties.get('--terminal-background')).toBe('#010203')
  })

  test('goes through transformTokens with the rest of the pass', () => {
    const { root, properties } = fakeRoot()
    applyThemeToRoot(
      root,
      { ...stateOf({}, 'nord'), terminalVariant: themeById('dracula')! },
      { transformTokens: tokensAsHex }
    )
    expect(properties.get('--terminal-ansi-red')).toMatch(/^#[0-9a-f]{6}$/)
  })
})

const surface = (name: 'opaque' | 'frosted' | 'translucent', reduce = false) => ({
  surface: { surface: name, reduceTransparencyActive: reduce },
})

describe('the surface axis on the document', () => {
  test('absent state writes no attribute and no property', () => {
    const { root, attributes, properties } = fakeRoot()
    applyThemeToRoot(root, stateOf())
    expect(attributes.has('data-surface')).toBe(false)
    expect(attributes.has('data-reduce-transparency')).toBe(false)
    expect(properties.has('--surface-alpha')).toBe(false)
  })

  test('each surface writes its attribute and its alpha', () => {
    for (const name of ['opaque', 'frosted', 'translucent'] as const) {
      const { root, attributes, properties } = fakeRoot()
      applyThemeToRoot(root, { ...stateOf(), ...surface(name) })
      expect(attributes.get('data-surface')).toBe(name)
      expect(attributes.get('data-reduce-transparency')).toBe('false')
      expect(properties.get('--surface-alpha')).toBe(surfaceAlpha[name])
    }
  })

  test('reduced transparency is diagnosable and forces the opaque alpha', () => {
    const { root, attributes, properties } = fakeRoot()
    applyThemeToRoot(root, { ...stateOf(), ...surface('opaque', true) })
    expect(attributes.get('data-reduce-transparency')).toBe('true')
    expect(attributes.get('data-surface')).toBe('opaque')
    expect(properties.get('--surface-alpha')).toBe('1')
  })

  test('turning the axis off removes what it wrote', () => {
    const { root, attributes, properties } = fakeRoot()
    const on = applyThemeToRoot(root, { ...stateOf(), ...surface('frosted') })
    applyThemeToRoot(root, stateOf(), {}, on)
    expect(attributes.has('data-surface')).toBe(false)
    expect(attributes.has('data-reduce-transparency')).toBe(false)
    expect(properties.has('--surface-alpha')).toBe(false)
  })

  test('the alpha is reported among the properties the pass owns', () => {
    const { root } = fakeRoot()
    expect(
      applyThemeToRoot(root, { ...stateOf(), ...surface('frosted') }).has('--surface-alpha')
    ).toBe(true)
  })
})

describe("palette: 'stylesheet'", () => {
  const options = { palette: 'stylesheet' as const }

  test('a catalogue variant writes no palette inline, default pair or not', () => {
    for (const [id, appearance] of [
      ['adea-dark', 'dark'],
      ['nord', 'dark'],
      ['adea-light', 'light'],
    ] as const) {
      const { root, properties, attributes } = fakeRoot()
      applyThemeToRoot(root, stateOf({}, id, appearance), options)
      expect(properties.has('--background')).toBe(false)
      expect(properties.has('--terminal-background')).toBe(false)
      expect(properties.has('--editor-keyword')).toBe(false)
      // The attributes the stylesheet selects on are still written.
      expect(attributes.get('data-theme')).toBe(id)
    }
  })

  test('fonts, an accent and the surface alpha are still written inline', () => {
    const { root, properties } = fakeRoot()
    applyThemeToRoot(
      root,
      {
        ...stateOf({ accent: 'violet', font: 'geist' }),
        surface: { surface: 'frosted', reduceTransparencyActive: false },
      },
      options
    )
    const expected = accentVariables('violet', 'dark', defaultThemeSelection)!
    for (const [name, value] of Object.entries(expected)) expect(properties.get(name)).toBe(value)
    expect(properties.get('--font-ui')).toBe('var(--font-family-geist)')
    expect(properties.get('--surface-alpha')).toBe('0.92')
  })

  test('a pinned terminal palette is the only palette written for a catalogue variant', () => {
    const { root, properties } = fakeRoot()
    applyThemeToRoot(
      root,
      { ...stateOf({}, 'nord'), terminalVariant: themeById('dracula')! },
      options
    )
    expect(properties.has('--background')).toBe(false)
    expect(properties.get('--terminal-background')).toBe(
      terminalCssVariables(themeById('dracula')!)['--terminal-background']
    )
  })

  test('an imported variant is written inline, and switching back sweeps every key it wrote', () => {
    const { root, properties } = fakeRoot()
    const imported = {
      ...variantFromRecord({ ...getTheme('nord')!, id: 'custom-x' }),
      tokens: { '--only-on-import': '#123456' },
    }
    const withImport = applyThemeToRoot(root, { ...stateOf(), variant: imported }, options)
    expect(properties.get('--only-on-import')).toBe('#123456')
    expect(properties.get('--background')).toBe(themeCssVariables(imported)['--background'])

    applyThemeToRoot(root, stateOf({}, 'adea-dark'), options, withImport)
    // Nothing the imported theme owned is left inline to beat the stylesheet.
    expect(properties.has('--only-on-import')).toBe(false)
    expect(properties.has('--background')).toBe(false)
    expect(properties.has('--terminal-background')).toBe(false)
  })

  test('a host copy that merely shares a catalogue id is not the catalogue', () => {
    const copy = { ...variantFromRecord(getTheme('nord')!), tokens: { '--x': '1' } }
    const { root, properties } = fakeRoot()
    applyThemeToRoot(root, { ...stateOf(), variant: copy }, options)
    expect(properties.get('--x')).toBe('1')
    expect(properties.has('--background')).toBe(true)
  })

  test('the default `inline` mode is unchanged: the whole palette is written', () => {
    const { root, properties } = fakeRoot()
    applyThemeToRoot(root, stateOf({}, 'nord'), { palette: 'inline' })
    expect(properties.get('--background')).toBe(
      themeCssVariables(themeById('nord')!)['--background']
    )
  })

  test('the tokens of a catalogue variant are only the accent and the pin', () => {
    expect(themeDocumentTokens(stateOf({}, 'nord'), options).tokens).toEqual({})
  })
})

function fakeDocument() {
  const appended: { textContent: string | null; removed: boolean; remove(): void }[] = []
  const doc = {
    head: {
      appendChild(node: unknown) {
        appended.push(node as (typeof appended)[number])
        return node
      },
    },
    createElement() {
      const node = {
        textContent: null as string | null,
        offsetHeight: 0,
        removed: false,
        remove() {
          node.removed = true
        },
      }
      return node
    },
  }
  return { doc, appended }
}

describe('applyWithoutTransitions', () => {
  test('the rule is in place while the change is applied and gone two frames later', () => {
    const { doc, appended } = fakeDocument()
    const frames: (() => void)[] = []
    let during: boolean | undefined
    applyWithoutTransitions(
      doc,
      () => {
        during = appended.length === 1 && !appended[0]!.removed
      },
      (callback) => void frames.push(callback)
    )
    expect(during).toBe(true)
    expect(appended[0]!.textContent).toBe('*{transition:none !important}')
    expect(appended[0]!.removed).toBe(false)

    frames.shift()!()
    expect(appended[0]!.removed).toBe(false)
    frames.shift()!()
    expect(appended[0]!.removed).toBe(true)
  })

  test('restore removes it early and only once', () => {
    const { doc, appended } = fakeDocument()
    const restore = applyWithoutTransitions(
      doc,
      () => {},
      () => {}
    )
    restore()
    restore()
    expect(appended[0]!.removed).toBe(true)
  })

  test('a throwing change does not leave the rule behind', () => {
    const { doc, appended } = fakeDocument()
    expect(() =>
      applyWithoutTransitions(
        doc,
        () => {
          throw new Error('boom')
        },
        () => {}
      )
    ).toThrow('boom')
    expect(appended[0]!.removed).toBe(true)
  })

  test('with no frame source the change still applies', () => {
    const { doc, appended } = fakeDocument()
    let applied = false
    applyWithoutTransitions(doc, () => {
      applied = true
    })
    expect(applied).toBe(true)
    // `requestAnimationFrame` is absent under the unit runner, so both frames collapse.
    expect(appended[0]!.removed).toBe(typeof requestAnimationFrame !== 'function')
  })
})

const editorNames = (properties: Map<string, string>) =>
  [...properties.keys()].filter((name) => name.startsWith('--editor-'))

describe('editorRoles', () => {
  const floor = { editorRoles: 'floor' as const }

  test('absent, `syntax` and an empty options object write exactly the same document', () => {
    for (const id of ['adea-dark', 'nord', 'adea-light']) {
      const appearance = themeById(id)!.appearance
      const documentFor = (options?: Parameters<typeof applyThemeToRoot>[2]) => {
        const { root, properties, attributes } = fakeRoot()
        applyThemeToRoot(root, stateOf({ accent: 'blue' }, id, appearance), options)
        return { properties: [...properties], attributes: [...attributes] }
      }
      const baseline = documentFor()
      expect(documentFor({}), id).toEqual(baseline)
      expect(documentFor({ editorRoles: 'syntax' }), id).toEqual(baseline)
      expect(documentFor({ editorRoles: undefined }), id).toEqual(baseline)
    }
  })

  test('floor replaces the sixteen editor roles and nothing else', () => {
    const { root, properties } = fakeRoot()
    applyThemeToRoot(root, stateOf({}, 'nord'), floor)
    const plain = fakeRoot()
    applyThemeToRoot(plain.root, stateOf({}, 'nord'))

    expect(editorNames(properties)).toHaveLength(16)
    expect(properties.get('--editor-keyword')).toMatch(/^#[0-9a-f]{6}$/)
    expect(plain.properties.get('--editor-keyword')).toMatch(/^oklch\(/)
    for (const [name, value] of plain.properties) {
      if (name.startsWith('--editor-')) continue
      expect(properties.get(name), name).toBe(value)
    }
    expect(properties.size).toBe(plain.properties.size)
  })

  test("with palette 'stylesheet', floor writes the editor roles and still no other palette", () => {
    const options = { palette: 'stylesheet' as const, ...floor }
    const { tokens } = themeDocumentTokens(stateOf({}, 'nord'), options)
    expect(Object.keys(tokens).toSorted()).toEqual(
      Object.keys(themeCssVariables(themeById('nord')!, { editor: 'floor' }))
        .filter((name) => name.startsWith('--editor-'))
        .toSorted()
    )
    // The stylesheet's own projection needs no write at all.
    expect(
      themeDocumentTokens(stateOf({}, 'nord'), { palette: 'stylesheet', editorRoles: 'syntax' })
        .tokens
    ).toEqual({})
  })

  test('switching floor on and off leaves nothing behind', () => {
    const { root, properties } = fakeRoot()
    const withFloor = applyThemeToRoot(root, stateOf({}, 'nord'), {
      palette: 'stylesheet',
      ...floor,
    })
    expect(editorNames(properties)).toHaveLength(16)
    applyThemeToRoot(root, stateOf({}, 'nord'), { palette: 'stylesheet' }, withFloor)
    expect(editorNames(properties)).toEqual([])
  })

  test('a host variant keeps its own editor roles and its verbatim tokens', () => {
    const imported = {
      ...variantFromRecord({ ...getTheme('nord')!, id: 'custom-x' }),
      tokens: { '--editor-keyword': '#123456' },
    }
    const { tokens } = themeDocumentTokens({ ...stateOf(), variant: imported }, floor)
    expect(tokens['--editor-keyword']).toBe('#123456')
    expect(tokens['--editor-string']).toBe(imported.editor.string)
  })
})
