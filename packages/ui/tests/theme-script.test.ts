import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  inlineScriptLiteral,
  themeScript,
  defaultThemeSelection,
  type ThemeScriptOptions,
  type ThemeSurface,
} from '../src/components/theme'
import { applyThemeToRoot } from '../src/components/theme/theme-document'
import { mergeThemeSelection, resolveThemeState } from '../src/components/theme/theme-state'
import { fontSettingsBootstrapScript } from '../src/lib/appearance-font-settings'
import { accentPresets } from '../src/lib/tokens'
import {
  builtinThemes,
  defaultDarkThemeId,
  defaultLightThemeId,
  themeById,
  themeCssVariables,
} from '../src/lib/themes'
import {
  REDUCED_TRANSPARENCY_QUERY,
  resolveSurfaceState,
  surfaceAlpha,
} from '../src/lib/theme-surface'
import { fakeRoot } from './helpers/fake-root'

/**
 * The no-flash script's only injection surface.
 *
 * `themeScript` is emitted into an inline `<script>`, and the one value that reaches
 * its source as *text* is the storage key. `JSON.stringify` alone is not enough
 * there: it produces a correct JavaScript literal and leaves `<` alone, so a key
 * containing `</script>` ends the tag early and the remainder is parsed as HTML.
 *
 * CodeQL flags the unescaped form as `js/bad-code-sanitization`, which is how this
 * was found. These tests are the reason it cannot come back — the escaping is easy to
 * "simplify" back to `JSON.stringify` in a refactor, and the result would look
 * identical for every ordinary key.
 */

/** The literal as it would appear inside a `<script>` element. */
function embedded(storageKey: string): string {
  return inlineScriptLiteral(storageKey)
}

describe('inlineScriptLiteral', () => {
  test('a key containing a closing tag cannot end the script element', () => {
    const literal = embedded('x</script><img src=x onerror=alert(1)>')
    expect(literal).not.toContain('</script>')
    expect(literal).not.toContain('<')
    expect(literal).not.toContain('>')
  })

  test('the escaped literal still parses back to the original string', () => {
    const key = 'x</script>&"\'\u2028\u2029'
    // `JSON.parse` accepts the `\uXXXX` escapes, which is the whole point: the value
    // is inert to the HTML tokenizer and identical to the JavaScript parser.
    expect(JSON.parse(embedded(key))).toBe(key)
  })

  test('quotes and backslashes are still escaped', () => {
    expect(JSON.parse(embedded('a"b\\c'))).toBe('a"b\\c')
  })

  test('an ordinary key is unchanged apart from its quotes', () => {
    expect(embedded('adea-appearance')).toBe('"adea-appearance"')
  })

  test('line separators are escaped, because a parser treated them as terminators', () => {
    const literal = embedded('a\u2028b')
    expect(literal).not.toContain('\u2028')
    expect(literal).toContain('\\u2028')
  })
})

describe('themeScript', () => {
  test('the default key produces a script with no angle brackets', () => {
    const script = themeScript()
    expect(script).toContain('"adea-appearance"')
    expect(script).not.toContain('<')
    expect(script).not.toContain('>')
  })

  test('a hostile key is neutralised in the emitted script', () => {
    const script = themeScript('</script><script>alert(1)</script>')
    expect(script).not.toContain('</script>')
    expect(script).not.toContain('<script>')
  })

  /**
   * The stored values are read at runtime and written to `dataset`, which is a
   * property assignment rather than code — worth asserting, because it is the reason
   * only the key needs escaping.
   */
  test('stored accent and font ids are applied as validated properties, never executed', () => {
    const script = themeScript()
    expect(script).toContain('r.dataset.accent=p.accent')
    expect(script).toContain('r.setAttribute(spec.familyAttribute,family)')
    expect(script).toContain("r.style.setProperty(spec.sizeProperty,px+'px')")
    expect(script).toContain("valid(p.font,'system')")
    expect(script).not.toContain('eval(')
  })
})

/**
 * The string form is a compatibility surface: Cortana-style consumers inline it, and
 * the options form was added beside it. Its first segment is pinned character for
 * character; the font bootstrap that follows it is the shared one.
 */
describe('themeScript(string) is unchanged', () => {
  const KEY = 'cortana.appearance'
  const pinned = `(function(){try{var s=localStorage.getItem("cortana.appearance");var p=s?JSON.parse(s):{};var a=p.appearance||'system';var d=a==='dark'||(a==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d)r.classList.add('dark');r.style.colorScheme=d?'dark':'light';if(p.accent&&p.accent!=='theme')r.dataset.accent=p.accent;if(p.density==='compact')r.dataset.density='compact';}catch(e){}})();`

  test('is the pinned first segment followed by the shared font bootstrap', () => {
    expect(themeScript(KEY)).toBe(`${pinned}${fontSettingsBootstrapScript(KEY)}`)
  })

  test('the default key is adea-appearance', () => {
    expect(themeScript()).toBe(themeScript('adea-appearance'))
    expect(themeScript()).toStartWith(pinned.replace('cortana.appearance', 'adea-appearance'))
  })

  test('the string form still writes the raw stored accent and no theme attributes', () => {
    const run = runScript(themeScript(KEY), { [KEY]: JSON.stringify({ accent: '#0b57d0' }) })
    expect(run.attributes.get('data-accent')).toBe('#0b57d0')
    expect(run.attributes.has('data-theme')).toBe(false)
    expect(run.attributes.has('data-appearance')).toBe(false)
  })
})

type Run = ReturnType<typeof fakeRoot> & { script: string }

/** Execute a script against a fake document, `localStorage` and `matchMedia`. */
function runScript(
  script: string,
  storage: Record<string, string> = {},
  environment: { dark?: boolean; reducedTransparency?: boolean; blocked?: boolean } = {}
): Run {
  const fake = fakeRoot()
  const window = {
    matchMedia: (query: string) => ({
      matches:
        query === '(prefers-color-scheme: dark)'
          ? environment.dark === true
          : query === REDUCED_TRANSPARENCY_QUERY
            ? environment.reducedTransparency === true
            : false,
    }),
  }
  const backing = new Map(Object.entries(storage))
  const localStorage = {
    getItem(key: string) {
      if (environment.blocked) throw new DOMException('Access is denied', 'SecurityError')
      return backing.get(key) ?? null
    },
  }
  new Function('window', 'document', 'localStorage', script)(
    window,
    { documentElement: fake.root },
    localStorage
  )
  return { ...fake, script }
}

const adea: ThemeScriptOptions = {
  key: 'appearance',
  version: 2,
  appearanceField: 'mode',
  legacyAppearanceKey: 'theme',
  libraryKey: 'appearance.library',
  recoveryKey: 'appearance.recovery',
  defaultAccent: 'violet',
  surface: true,
  palette: 'stylesheet',
}
const adeaScript = themeScript(adea)
const v2 = (doc: Record<string, unknown>) => ({
  appearance: JSON.stringify({ version: 2, ...doc }),
})

const library = (version: unknown, themes: unknown) => ({
  'appearance.library': JSON.stringify({ version, themes }),
})
const accentOf = (doc: Record<string, unknown>, script = adeaScript) =>
  runScript(script, v2(doc)).attributes.get('data-accent')
const surfaceOf = (doc: Record<string, unknown>, reduced = false) => {
  const run = runScript(adeaScript, v2(doc), { reducedTransparency: reduced })
  return {
    surface: run.attributes.get('data-surface'),
    reduce: run.attributes.get('data-reduce-transparency'),
    alpha: run.properties.get('--surface-alpha'),
  }
}

describe('themeScript(options)', () => {
  test('is a different script from the string form, with the same font bootstrap guarded to the version', () => {
    expect(adeaScript).not.toBe(themeScript('appearance'))
    expect(adeaScript).toEndWith(fontSettingsBootstrapScript('appearance', 2))
    expect(adeaScript).not.toContain('<')
    expect(adeaScript).not.toContain('>')
  })

  test('no storage: system light, the default pair, the default accent and the opaque surface', () => {
    const run = runScript(adeaScript)
    expect(run.classes.has('dark')).toBe(false)
    expect(run.style.colorScheme).toBe('light')
    expect(run.attributes.get('data-theme')).toBe(defaultLightThemeId)
    expect(run.attributes.get('data-appearance')).toBe('light')
    expect(run.attributes.get('data-accent')).toBe('violet')
    expect(run.attributes.get('data-surface')).toBe('opaque')
    expect(run.attributes.get('data-reduce-transparency')).toBe('false')
    expect(run.properties.get('--surface-alpha')).toBe(surfaceAlpha.opaque)
    expect(run.attributes.has('data-density')).toBe(false)
  })

  test('system follows the operating system', () => {
    const run = runScript(adeaScript, {}, { dark: true })
    expect(run.classes.has('dark')).toBe(true)
    expect(run.attributes.get('data-theme')).toBe(defaultDarkThemeId)
    expect(run.attributes.get('data-appearance')).toBe('dark')
  })

  test('a stored mode and theme pair restore the palette selector, not the palette', () => {
    const run = runScript(
      adeaScript,
      v2({ mode: 'dark', lightThemeId: 'adea-light', darkThemeId: 'nord', surface: 'frosted' })
    )
    expect(run.classes.has('dark')).toBe(true)
    expect(run.attributes.get('data-theme')).toBe('nord')
    expect(run.attributes.get('data-surface')).toBe('frosted')
    expect(run.properties.get('--surface-alpha')).toBe(surfaceAlpha.frosted)
    expect(run.properties.has('--background')).toBe(false)
  })

  test('the appearance field is the schema field, and an unknown mode is system', () => {
    expect(runScript(adeaScript, v2({ appearance: 'dark' })).classes.has('dark')).toBe(false)
    expect(runScript(adeaScript, v2({ mode: 'sepia' }), { dark: true }).classes.has('dark')).toBe(
      true
    )
    const plain = themeScript({ key: 'k' })
    expect(
      runScript(plain, { k: JSON.stringify({ appearance: 'dark' }) }).classes.has('dark')
    ).toBe(true)
  })

  test('a document of another version is ignored for everything, fonts included', () => {
    const run = runScript(
      adeaScript,
      {
        appearance: JSON.stringify({
          version: 3,
          mode: 'dark',
          darkThemeId: 'nord',
          accent: 'blue',
          fonts: { ui: { family: 'geist', size: 32 } },
        }),
      },
      { dark: false }
    )
    expect(run.classes.has('dark')).toBe(false)
    expect(run.attributes.get('data-theme')).toBe(defaultLightThemeId)
    expect(run.attributes.get('data-accent')).toBe('violet')
    expect(run.attributes.has('data-ui-font')).toBe(false)
    expect(run.properties.get('--font-ui-size')).toBe('14px')
  })

  test('corrupt, non-object and array documents degrade to defaults without throwing', () => {
    for (const raw of ['{not json', 'null', '5', '[]', '']) {
      const run = runScript(adeaScript, { appearance: raw })
      expect(run.attributes.get('data-theme'), raw).toBe(defaultLightThemeId)
    }
  })

  test('blocked storage still paints the defaults', () => {
    const run = runScript(adeaScript, {}, { blocked: true })
    expect(run.attributes.get('data-theme')).toBe(defaultLightThemeId)
    expect(run.attributes.get('data-accent')).toBe('violet')
  })

  describe('the legacy key', () => {
    test('is read while the main key is absent, for light and dark', () => {
      expect(runScript(adeaScript, { theme: 'dark' }).classes.has('dark')).toBe(true)
      expect(runScript(adeaScript, { theme: 'light' }, { dark: true }).classes.has('dark')).toBe(
        false
      )
      expect(runScript(adeaScript, { theme: 'bogus' }).classes.has('dark')).toBe(false)
    })

    test('is not read when the main document is unreadable or unsupported', () => {
      expect(runScript(adeaScript, { appearance: '{bad', theme: 'dark' }).classes.has('dark')).toBe(
        false
      )
      expect(
        runScript(adeaScript, { appearance: '{"version":9}', theme: 'dark' }).classes.has('dark')
      ).toBe(false)
    })

    test('is not read when the schema names none', () => {
      const run = runScript(themeScript({ ...adea, legacyAppearanceKey: undefined }), {
        theme: 'dark',
      })
      expect(run.classes.has('dark')).toBe(false)
    })
  })

  describe('themes', () => {
    test('an unknown id paints the default of the resolved appearance, for both appearances', () => {
      for (const mode of ['light', 'dark'] as const) {
        const run = runScript(
          adeaScript,
          v2({ mode, lightThemeId: 'removed-light', darkThemeId: 'removed-dark' })
        )
        expect(run.attributes.get('data-theme')).toBe(
          mode === 'dark' ? defaultDarkThemeId : defaultLightThemeId
        )
      }
    })

    test('every catalogue id is recognised', () => {
      for (const theme of builtinThemes) {
        const run = runScript(
          adeaScript,
          v2({ mode: theme.appearance, lightThemeId: theme.id, darkThemeId: theme.id })
        )
        expect(run.attributes.get('data-theme'), theme.id).toBe(theme.id)
      }
    })

    const imported = [
      { id: 'custom-mine', flatTokens: { '--background': '#102030', '--custom-extra': '1' } },
    ]

    test('an imported theme from the stored library paints its id and its own tokens', () => {
      const run = runScript(adeaScript, {
        ...v2({ mode: 'dark', darkThemeId: 'custom-mine' }),
        ...library(1, imported),
      })
      expect(run.attributes.get('data-theme')).toBe('custom-mine')
      expect(run.properties.get('--background')).toBe('#102030')
      expect(run.properties.get('--custom-extra')).toBe('1')
    })

    test('library tokens are applied as properties only: names must be custom properties, values strings', () => {
      const run = runScript(adeaScript, {
        ...v2({ mode: 'dark', darkThemeId: 'custom-mine' }),
        ...library(1, [
          {
            id: 'custom-mine',
            flatTokens: { '--ok': 'red', color: 'blue', '--number': 5, '--nested': {} },
          },
        ]),
      })
      expect([...run.properties.keys()].filter((name) => !/^--(font|ui)-/.test(name))).toEqual([
        '--ok',
        '--surface-alpha',
      ])
    })

    test('an id missing from the library, or a library of another version, paints the default', () => {
      const doc = v2({ mode: 'dark', darkThemeId: 'custom-mine' })
      for (const files of [
        { ...doc, ...library(1, []) },
        { ...doc, ...library(2, imported) },
        { ...doc, ...library(1, [{ id: 'custom-mine' }]) },
        { ...doc, 'appearance.library': '{bad' },
        doc,
      ]) {
        const run = runScript(adeaScript, files)
        expect(run.attributes.get('data-theme')).toBe(defaultDarkThemeId)
        expect(run.properties.has('--custom-extra')).toBe(false)
      }
    })

    test('a library entry cannot shadow a catalogue id', () => {
      const run = runScript(adeaScript, {
        ...v2({ mode: 'dark', darkThemeId: 'nord' }),
        ...library(1, [{ id: 'nord', flatTokens: { '--background': '#ffffff' } }]),
      })
      expect(run.attributes.get('data-theme')).toBe('nord')
      expect(run.properties.has('--background')).toBe(false)
    })

    test('without a library key the library is not consulted', () => {
      const run = runScript(themeScript({ ...adea, libraryKey: undefined }), {
        ...v2({ mode: 'dark', darkThemeId: 'custom-mine' }),
        ...library(1, imported),
      })
      expect(run.attributes.get('data-theme')).toBe(defaultDarkThemeId)
    })

    test('libraryVersion selects the version read', () => {
      const run = runScript(themeScript({ ...adea, libraryVersion: 2 }), {
        ...v2({ mode: 'dark', darkThemeId: 'custom-mine' }),
        ...library(2, imported),
      })
      expect(run.attributes.get('data-theme')).toBe('custom-mine')
    })
  })

  describe('the accent', () => {
    test('a preset is written as stored', () => {
      for (const preset of accentPresets.filter((candidate) => candidate.id !== 'theme')) {
        expect(accentOf({ accent: preset.id })).toBe(preset.id)
      }
    })

    test('a #rrggbb accent is written as custom, never as the hex', () => {
      expect(accentOf({ accent: '#0B57D0' })).toBe('custom')
      expect(accentOf({ accent: '#0b57d0' }, themeScript({ key: 'appearance' }))).toBe('custom')
      const run = runScript(adeaScript, v2({ accent: '#0b57d0' }))
      expect([...run.attributes.values()]).not.toContain('#0b57d0')
    })

    test('absent, legacy theme and unrecognised accents take the default accent', () => {
      for (const accent of [undefined, 'theme', 'chartreuse', '#abc', 'rgb(1,2,3)', 7, null]) {
        expect(accentOf({ accent }), String(accent)).toBe('violet')
      }
    })

    test('a theme-derived accent writes nothing: it has no stylesheet block', () => {
      expect(accentOf({ accent: 'ansi-blue' })).toBeUndefined()
    })

    test('without a default accent the unset cases write nothing, as the provider does for theme', () => {
      const bare = themeScript({ ...adea, defaultAccent: undefined })
      for (const accent of [undefined, 'theme', 'chartreuse']) {
        expect(accentOf({ accent }, bare)).toBeUndefined()
      }
      expect(accentOf({ accent: 'blue' }, bare)).toBe('blue')
    })

    test('a default accent in the custom form is written as custom', () => {
      expect(accentOf({}, themeScript({ ...adea, defaultAccent: '#0B57D0' }))).toBe('custom')
    })
  })

  describe('the surface axis', () => {
    test('frosted and translucent paint frosted before the capability is known', () => {
      expect(surfaceOf({ surface: 'frosted' })).toEqual({
        surface: 'frosted',
        reduce: 'false',
        alpha: surfaceAlpha.frosted,
      })
      expect(surfaceOf({ surface: 'translucent' }).surface).toBe('frosted')
    })

    test('the operating system or the stored flag forces opaque', () => {
      expect(surfaceOf({ surface: 'frosted' }, true)).toEqual({
        surface: 'opaque',
        reduce: 'true',
        alpha: surfaceAlpha.opaque,
      })
      expect(surfaceOf({ surface: 'frosted', reduceTransparency: true })).toEqual({
        surface: 'opaque',
        reduce: 'true',
        alpha: surfaceAlpha.opaque,
      })
      expect(surfaceOf({ surface: 'frosted', reduceTransparency: 'yes' }).surface).toBe('frosted')
    })

    test('unreadable surfaces are opaque', () => {
      expect(surfaceOf({ surface: 'glass' }).surface).toBe('opaque')
    })

    test('without the option the axis writes nothing', () => {
      const run = runScript(
        themeScript({ ...adea, surface: undefined }),
        v2({ surface: 'frosted' })
      )
      expect(run.attributes.has('data-surface')).toBe(false)
      expect(run.attributes.has('data-reduce-transparency')).toBe(false)
      expect(run.properties.has('--surface-alpha')).toBe(false)
    })

    test('the alpha table and the query are the ones the provider uses', () => {
      expect(adeaScript).toContain(JSON.stringify(surfaceAlpha))
      expect(adeaScript).toContain(JSON.stringify(REDUCED_TRANSPARENCY_QUERY))
    })
  })

  test('a compact density is restored; comfortable writes nothing', () => {
    expect(runScript(adeaScript, v2({ density: 'compact' })).attributes.get('data-density')).toBe(
      'compact'
    )
    expect(
      runScript(adeaScript, v2({ density: 'comfortable' })).attributes.has('data-density')
    ).toBe(false)
  })

  test('saved fonts match the mounted provider', () => {
    const fonts = {
      ui: { family: 'geist', size: 16 },
      content: { family: 'space-grotesk', size: 18 },
      code: { family: 'jetbrains-mono', size: 13 },
    } as const
    const prepaint = runScript(adeaScript, v2({ fonts }))
    const mounted = fakeRoot()
    applyThemeToRoot(
      mounted.root,
      {
        selection: mergeThemeSelection(defaultThemeSelection, { fonts }),
        appearance: 'light',
        variant: builtinThemes.find((theme) => theme.id === defaultLightThemeId)!,
      },
      {}
    )
    for (const name of [
      'data-ui-font',
      'data-content-font',
      'data-code-font',
      'data-font-settings',
    ]) {
      expect(prepaint.attributes.get(name), name).toBe(mounted.attributes.get(name))
    }
    for (const axis of ['ui', 'content', 'code']) {
      for (const suffix of ['', '-size', '-scale']) {
        const name = `--font-${axis}${suffix}`
        expect(prepaint.properties.get(name), name).toBe(mounted.properties.get(name))
      }
    }
  })

  test('hostile keys, ids and accents cannot end the script element', () => {
    const hostile = '</script><script>alert(1)</script>'
    const script = themeScript({
      key: hostile,
      legacyAppearanceKey: hostile,
      libraryKey: hostile,
      appearanceField: 'mode',
      defaultAccent: hostile,
      surface: true,
    })
    expect(script).not.toContain('</script>')
    expect(script).not.toContain('<')
    expect(script).not.toContain('>')
  })

  test('an unsafe version is refused, as the font bootstrap refuses it', () => {
    expect(() => themeScript({ key: 'k', version: 1.5 })).toThrow(RangeError)
  })

  test('an unversioned schema reads any object and guards nothing', () => {
    const script = themeScript({ key: 'k', defaultAccent: 'violet' })
    const run = runScript(script, { k: JSON.stringify({ appearance: 'dark', accent: 'blue' }) })
    expect(run.classes.has('dark')).toBe(true)
    expect(run.attributes.get('data-accent')).toBe('blue')
    expect(run.attributes.has('data-surface')).toBe(false)
  })
})

/**
 * What the script writes is what the provider writes, so mounting repaints nothing.
 * Compared on the attributes both own, for documents that exercise each axis.
 */
describe('themeScript(options) agrees with the provider', () => {
  const documents: Array<[string, Record<string, unknown>, { dark?: boolean; reduced?: boolean }]> =
    [
      ['defaults', {}, {}],
      ['system dark', { mode: 'system' }, { dark: true }],
      ['dark nord with a preset', { mode: 'dark', darkThemeId: 'nord', accent: 'blue' }, {}],
      ['light with a custom accent', { mode: 'light', accent: '#0b57d0' }, {}],
      ['frosted', { mode: 'dark', surface: 'frosted' }, {}],
      ['translucent resolves to frosted', { mode: 'light', surface: 'translucent' }, {}],
      ['reduced by the OS', { mode: 'dark', surface: 'frosted' }, { reduced: true }],
      [
        'reduced by the document',
        { mode: 'dark', surface: 'frosted', reduceTransparency: true },
        {},
      ],
      ['unknown ids', { mode: 'dark', darkThemeId: 'gone', accent: 'chartreuse' }, {}],
      ['compact', { density: 'compact' }, {}],
    ]

  for (const [name, doc, env] of documents) {
    test(name, () => {
      const prepaint = runScript(adeaScript, v2(doc), {
        dark: env.dark,
        reducedTransparency: env.reduced,
      })
      const stored = {
        appearance: (doc['mode'] ?? 'system') as 'system' | 'light' | 'dark',
        lightThemeId: (doc['lightThemeId'] as string | undefined) ?? defaultLightThemeId,
        darkThemeId: (doc['darkThemeId'] as string | undefined) ?? defaultDarkThemeId,
        accent:
          typeof doc['accent'] === 'string' && doc['accent'] !== 'chartreuse'
            ? doc['accent']
            : 'violet',
        surface: (doc['surface'] as ThemeSurface | undefined) ?? 'opaque',
        reduceTransparency: doc['reduceTransparency'] === true,
        density: doc['density'] as 'compact' | undefined,
      }
      const selection = mergeThemeSelection(defaultThemeSelection, stored)
      const resolved = resolveThemeState(selection, env.dark ? 'dark' : 'light', builtinThemes)
      const mounted = fakeRoot()
      applyThemeToRoot(
        mounted.root,
        {
          selection,
          appearance: resolved.appearance,
          variant: resolved.variant,
          surface: resolveSurfaceState(selection.surface, {
            osReducedTransparency: env.reduced === true,
            userReducedTransparency: selection.reduceTransparency === true,
            nativeTranslucency: false,
          }),
        },
        { palette: 'stylesheet' }
      )
      for (const attribute of [
        'data-theme',
        'data-appearance',
        'data-accent',
        'data-surface',
        'data-reduce-transparency',
        'data-density',
      ]) {
        expect(prepaint.attributes.get(attribute), attribute).toBe(
          mounted.attributes.get(attribute)
        )
      }
      expect(prepaint.classes.has('dark')).toBe(mounted.classes.has('dark'))
      expect(prepaint.style.colorScheme).toBe(mounted.style.colorScheme)
      expect(prepaint.properties.get('--surface-alpha')).toBe(
        mounted.properties.get('--surface-alpha')
      )
    })
  }
})

/**
 * The script and the pre-paint sheet are two halves of one first frame: the script
 * names the theme (`data-theme`), the sheet is the rule that attribute selects. Neither
 * half is useful if the other disagrees about which themes exist.
 */
describe('themeScript(options) and theme-variants.css', () => {
  const sheet = readFileSync(join(import.meta.dir, '../src/styles/theme-variants.css'), 'utf8')
  const hasRule = (id: string) => sheet.includes(`[data-theme='${id}'] {`)
  const inline = themeScript({ ...adea, palette: 'inline' })

  test('`palette` does not change what the script writes: it never paints a catalogue palette', () => {
    // The stylesheet is the catalogue palette's pre-paint source, so there is nothing
    // for the script to skip in stylesheet mode and nothing for it to add in inline mode.
    expect(adeaScript).toBe(inline)
    expect(themeScript({ ...adea, palette: undefined })).toBe(inline)
  })

  test('a catalogue theme is selected by attribute alone: no palette property is written', () => {
    for (const id of ['nord', 'dracula', 'adea-dark']) {
      const run = runScript(adeaScript, v2({ mode: 'dark', darkThemeId: id }))
      expect(run.attributes.get('data-theme')).toBe(id)
      const palette = Object.keys(themeCssVariables(themeById(id)!))
      expect([...run.properties.keys()].filter((name) => palette.includes(name))).toEqual([])
    }
  })

  test('every theme id the script accepts has a rule waiting for it', () => {
    for (const theme of builtinThemes) {
      const run = runScript(
        adeaScript,
        v2({ mode: theme.appearance, [`${theme.appearance}ThemeId`]: theme.id })
      )
      expect(run.attributes.get('data-theme'), theme.id).toBe(theme.id)
      // The default pair is theme.css's: the sheet adds only the properties it lacks.
      expect(hasRule(theme.id), `${theme.id} has no [data-theme] rule`).toBe(true)
    }
  })

  test('an id the script falls back from is not left without a rule either', () => {
    const run = runScript(adeaScript, v2({ mode: 'dark', darkThemeId: 'gone' }))
    expect(hasRule(run.attributes.get('data-theme')!)).toBe(true)
  })

  test('the accent the script sets is one the sheet keeps above the theme', () => {
    const run = runScript(
      adeaScript,
      v2({ mode: 'light', lightThemeId: 'nord-light', accent: 'blue' })
    )
    expect(run.attributes.get('data-accent')).toBe('blue')
    expect(sheet).toContain("[data-accent='blue'] {")
    expect(sheet.indexOf("[data-accent='blue'] {")).toBeGreaterThan(
      sheet.indexOf("[data-theme='nord-light'] {")
    )
  })
})
