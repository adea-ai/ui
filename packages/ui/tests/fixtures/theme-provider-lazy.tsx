import { render } from 'solid-js/web'
import {
  ThemeProvider,
  loadThemeCatalogue,
  useTheme,
  type ThemePersistence,
  type ThemeSelection,
} from '../../src/components/theme/lazy'
import '../../src/styles/globals.css'
import '../../src/styles/theme-variants.css'

/**
 * The lazy provider, driven the way adea drives it: the palette comes from the
 * generated `theme-variants.css`, the document is restored before the provider runs
 * (what `themeScript` does, here by `bootTheme`), and the catalogue is only imported
 * when a theme beyond the default pair is selected or previewed.
 *
 * The page configures it through `window.themeFixture` before the script runs.
 */
type FixtureConfig = { stored?: Partial<ThemeSelection>; bootTheme?: string; accentFloor?: number }
type FixtureWindow = Window & { themeFixture?: FixtureConfig; fixtureWrites?: unknown[] }

const config = (window as FixtureWindow).themeFixture ?? {}
const writes: unknown[] = []
;(window as FixtureWindow).fixtureWrites = writes

if (config.bootTheme) document.documentElement.dataset['theme'] = config.bootTheme

const persistence: ThemePersistence = {
  read: () => config.stored,
  write: (next) => void writes.push(next),
}

function Controls() {
  const theme = useTheme()
  return (
    <div>
      <output data-testid="variant">{theme.variant().id}</output>
      <output data-testid="ready">{String(theme.catalogueReady?.())}</output>
      <output data-testid="all-count">{theme.allThemes().length}</output>
      <output data-testid="previewing">{String(theme.previewing())}</output>
      <button
        type="button"
        onClick={() => theme.preview({ appearance: 'dark', darkThemeId: 'dracula' })}
      >
        Preview dracula
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
      <button type="button" onClick={() => void theme.loadCatalogue?.()}>
        Load catalogue
      </button>
      <button type="button" onClick={() => void loadThemeCatalogue()}>
        Load directly
      </button>
    </div>
  )
}

render(
  () => (
    <ThemeProvider
      persistence={persistence}
      initial={{ appearance: 'dark' }}
      palette="stylesheet"
      accentContrastFloor={config.accentFloor}
    >
      <Controls />
    </ThemeProvider>
  ),
  document.body
)
