import { render } from 'solid-js/web'
import { ThemeProvider, useTheme } from '../../src/components/theme/theme-provider'
import '../../src/styles/globals.css'

/**
 * Cortana's provider profile, exactly as `apps/web/src/App.tsx` mounts it.
 *
 * Deliberately written against the original API only (`storageKey`, `initial`,
 * `useTheme().themes` / `setSelection`), so this one file runs unchanged against
 * every release of the provider. It is the guard for the additive promise: a
 * consumer that adopts none of the newer props sees no difference in what is
 * stored or in what lands on `<html>`.
 */
function Probe() {
  // `WorkspaceSection.tsx` destructures `themes` out of the context once.
  const { themes, setSelection, selection } = useTheme()
  return (
    <div>
      <output data-testid="themes-is-array">{String(Array.isArray(themes))}</output>
      <output data-testid="themes-count">{themes.length}</output>
      <output data-testid="appearance">{selection().appearance}</output>
      <button type="button" onClick={() => setSelection({ darkThemeId: 'nord' })}>
        Pick nord
      </button>
      <button type="button" onClick={() => setSelection({ accent: 'violet' })}>
        Pick violet
      </button>
    </div>
  )
}

render(
  () => (
    <ThemeProvider
      storageKey="cortana.appearance"
      initial={{ appearance: 'dark', accent: 'theme', font: 'geist' }}
    >
      <Probe />
    </ThemeProvider>
  ),
  document.body
)
