import { createEffect, createSignal, onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { ThemeModeToggle } from '../../src/components/theme/theme-mode-toggle'
import '../../src/styles/globals.css'

function Fixture() {
  const [mode, setMode] = createSignal<'light' | 'dark' | 'system'>('system')
  const [escape, setEscape] = createSignal('idle')

  // Added after the delegated keydown listener exists, so it observes Escape
  // the way an enclosing dialog or drawer's own document listener would.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setEscape(event.defaultPrevented ? 'handled' : 'pass-through')
    }
  }
  createEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    onCleanup(() => document.removeEventListener('keydown', onKeyDown))
  })

  return (
    <main>
      <ThemeModeToggle mode={mode()} onModeChange={setMode} />
      <output data-testid="mode">{mode()}</output>
      <output data-testid="escape">{escape()}</output>
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
