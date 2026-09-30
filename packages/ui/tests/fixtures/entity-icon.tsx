import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'

import { EntityIcon } from '../../src/components/ui/entity-icon'
import '../../src/styles/globals.css'

const embeddedSvg = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="8" y="8" width="48" height="48" rx="12" fill="#7c3aed"/></svg>'
)}`

function Fixture() {
  const [source, setSource] = createSignal('https://entity.test/broken.svg')

  return (
    <main class="grid gap-4">
      <h1>EntityIcon image states</h1>
      <EntityIcon name="Workspace Logo" src={source()} size="md" data-testid="workspace" />
      <EntityIcon
        name="Pending Logo"
        src="https://entity.test/pending.svg"
        size="xl"
        data-testid="pending"
      />
      <EntityIcon name="Small Logo" src={embeddedSvg} size="xs" data-testid="small" />
      <button
        type="button"
        data-testid="replace-source"
        onClick={() => setSource('https://entity.test/recovered.svg')}
      >
        Use replacement logo
      </button>
    </main>
  )
}

render(Fixture, document.body)
