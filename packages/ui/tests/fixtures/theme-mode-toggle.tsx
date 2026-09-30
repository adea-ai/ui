import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ThemeModeToggle } from '../../src/components/theme/theme-mode-toggle'
import '../../src/styles/globals.css'

function Fixture() {
  const [mode, setMode] = createSignal<'light' | 'dark' | 'system'>('system')
  return (
    <main>
      <ThemeModeToggle mode={mode()} onModeChange={setMode} />
      <output data-testid="mode">{mode()}</output>
      <ThemeModeToggle
        mode="dark"
        onModeChange={() => {
          throw new Error('Disabled mode changed')
        }}
        disabled
        aria-label="Disabled appearance"
      />
    </main>
  )
}
render(() => <Fixture />, document.body)
