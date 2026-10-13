import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { getTheme } from '@adea-ai/themes'
import {
  ThemeProvider,
  useOptionalTheme,
  useTheme,
  type ThemePersistence,
  type ThemeSelection,
} from '../../src/components/theme'
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
 *
 * The page configures it through `window.themeFixture` before the script runs.
 */
type FixtureConfig = {
  stored?: Record<string, unknown>
  initial?: Partial<ThemeSelection>
  hex?: boolean
  transitions?: boolean
  withCustom?: boolean
  throwOnWrite?: boolean
  throwOnRead?: boolean
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
      >
        <Controls removeCustom={() => setCustom([])} />
      </ThemeProvider>
    </>
  )
}

render(() => <Fixture />, document.body)
