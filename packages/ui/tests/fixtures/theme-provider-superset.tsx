import { createEffect, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { getTheme } from '@adea-ai/themes'
import {
  ThemeProvider,
  useOptionalTheme,
  useTheme,
  type ThemePersistence,
  type ThemeSelection,
} from '../../src/components/theme'
import { paintAccentRoles } from '../../src/lib/accent-roles'
import { tokensAsHex, variantFromRecord, type ThemeVariant } from '../../src/lib/themes'
import '../../src/styles/globals.css'

/**
 * The provider's newer surface, driven the way adea drives it.
 *
 *   - `persistence`: a host-shaped document (`mode` for `appearance`, a `version`)
 *     that retains ids it does not know, and that counts its writes.
 *   - `themes`: a reactive set of extra variants, one carrying verbatim `tokens`.
 *   - `preview` / `previewing`, `allThemes`, `useOptionalTheme`.
 *   - `transformTokens` and `disableTransitionOnChange`.
 *   - `accentContrastFloor`, a custom `#rrggbb` accent, and `accentRolesFor` painted
 *     onto one element with `paintAccentRoles`.
 *   - the surface axis (`surface`, with and without the native-translucency
 *     capability), a pinned terminal palette, `palette="stylesheet"` and `fontZoom`.
 *
 * The page configures it through `window.themeFixture` before the script runs.
 */
type FixtureConfig = {
  stored?: Record<string, unknown>
  initial?: Partial<ThemeSelection>
  hex?: boolean
  transitions?: boolean
  accentFloor?: number
  withCustom?: boolean
  throwOnWrite?: boolean
  throwOnRead?: boolean
  /** The `surface` prop: on, or on with the host's capability. */
  surface?: boolean | { nativeTranslucency: boolean }
  palette?: 'inline' | 'stylesheet'
  fontZoom?: boolean
  /** Record the whole selection on write, not the five original fields. */
  recordSelection?: boolean
}

type FixtureWindow = Window & {
  themeFixture?: FixtureConfig
  fixtureWrites?: unknown[]
}

const config = (window as FixtureWindow).themeFixture ?? {}
const writes: unknown[] = []
;(window as FixtureWindow).fixtureWrites = writes

const persistence: ThemePersistence = {
  read() {
    if (config.throwOnRead) throw new Error('store exploded on read')
    const doc = config.stored
    if (!doc) return undefined
    const { mode, ...rest } = doc
    return {
      ...rest,
      ...(mode === undefined ? {} : { appearance: mode }),
    } as Partial<ThemeSelection>
  },
  write(next) {
    if (config.throwOnWrite) throw new Error('store exploded on write')
    if (config.recordSelection) {
      writes.push(next)
      return
    }
    const { appearance, lightThemeId, darkThemeId, accent } = next
    writes.push({ version: 2, mode: appearance, lightThemeId, darkThemeId, accent })
  },
}

const customVariant: ThemeVariant = {
  ...variantFromRecord({ ...getTheme('nord')!, id: 'custom-nord', label: 'Imported Nord' }),
  tokens: { '--background': '#102030', '--custom-extra': '1' },
}

function Outside() {
  return <output data-testid="outside">{String(useOptionalTheme() === undefined)}</output>
}

function Controls(props: { removeCustom: () => void }) {
  const theme = useTheme()
  return (
    <div>
      <output data-testid="same-context">{String(useOptionalTheme() === theme)}</output>
      <output data-testid="committed-variant">{theme.variant().id}</output>
      <output data-testid="committed-appearance">{theme.resolvedAppearance()}</output>
      <output data-testid="light-id">{theme.selection().lightThemeId}</output>
      <output data-testid="dark-id">{theme.selection().darkThemeId}</output>
      <output data-testid="previewing">{String(theme.previewing())}</output>
      <output data-testid="all-count">{theme.allThemes().length}</output>
      <output data-testid="themes-count">{theme.themes.length}</output>
      <button
        type="button"
        onClick={() => theme.preview({ appearance: 'dark', darkThemeId: 'nord' })}
      >
        Preview nord
      </button>
      <button type="button" onClick={() => theme.preview(undefined)}>
        End preview
      </button>
      <button
        type="button"
        onClick={() => theme.setSelection({ appearance: 'dark', darkThemeId: 'nord' })}
      >
        Commit nord
      </button>
      <button type="button" onClick={props.removeCustom}>
        Remove custom
      </button>
      <button type="button" onClick={() => theme.setSelection({ accent: '#0B57D0' })}>
        Custom blue
      </button>
      <button type="button" onClick={() => theme.setSelection({ accent: '#f4f4f4' })}>
        Custom pale
      </button>
      <button type="button" onClick={() => theme.setSelection({ accent: 'violet' })}>
        Violet
      </button>
      <output data-testid="effective-surface">{theme.effectiveSurface()}</output>
      <output data-testid="reduce-active">{String(theme.reduceTransparencyActive())}</output>
      <output data-testid="ui-size">{theme.selection().fonts?.ui.size}</output>
      <output data-testid="code-size">{theme.selection().fonts?.code.size}</output>
      <button type="button" onClick={() => theme.setSelection({ surface: 'frosted' })}>
        Frosted
      </button>
      <button type="button" onClick={() => theme.setSelection({ surface: 'translucent' })}>
        Translucent
      </button>
      <button type="button" onClick={() => theme.setSelection({ surface: 'opaque' })}>
        Opaque
      </button>
      <button type="button" onClick={() => theme.setSelection({ reduceTransparency: true })}>
        Reduce on
      </button>
      <button type="button" onClick={() => theme.setSelection({ reduceTransparency: false })}>
        Reduce off
      </button>
      <button type="button" onClick={() => theme.setSelection({ terminalThemeId: 'dracula' })}>
        Pin dracula
      </button>
      <button type="button" onClick={() => theme.setSelection({ terminalThemeId: 'theme' })}>
        Unpin terminal
      </button>
      <button type="button" onClick={() => theme.setSelection({ terminalThemeId: 'gone' })}>
        Pin missing
      </button>
      <button type="button" onClick={() => theme.zoomFonts('in')}>
        Zoom in
      </button>
      <button type="button" onClick={() => theme.zoomFonts('reset')}>
        Zoom reset
      </button>
      <div role="dialog" aria-label="Frosted probe" data-testid="dialog-probe" />
      <div role="dialog" aria-label="Sheet probe" data-variant="inset" data-testid="sheet-probe" />
      <output data-testid="unknown-roles">
        {String(theme.accentRolesFor('chartreuse') === undefined)}
      </output>
      <div
        data-testid="scoped"
        ref={(element) =>
          createEffect(() => paintAccentRoles(element, theme.accentRolesFor('green', 'adea-light')))
        }
      />
    </div>
  )
}

function Fixture() {
  const [custom, setCustom] = createSignal<readonly ThemeVariant[]>(
    config.withCustom ? [customVariant] : []
  )
  return (
    <>
      <Outside />
      <ThemeProvider
        persistence={persistence}
        initial={config.initial}
        themes={custom}
        transformTokens={config.hex ? tokensAsHex : undefined}
        disableTransitionOnChange={config.transitions}
        accentContrastFloor={config.accentFloor}
        surface={config.surface}
        palette={config.palette}
        fontZoom={config.fontZoom}
      >
        <Controls removeCustom={() => setCustom([])} />
      </ThemeProvider>
    </>
  )
}

render(() => <Fixture />, document.body)
