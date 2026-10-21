import { render } from 'solid-js/web'
import { WorkspaceSwitcher } from '../../src/components/composites/workspace-switcher/workspace-switcher'
import '../../src/styles/globals.css'

/**
 * Two switchers over the same workspaces: one passes each mark as a node built
 * once, the other as a factory. Both must keep the current workspace's mark in
 * the trigger while the menu is closed, open and reopened.
 */
const mark = (variant: string, name: string) => (
  <span data-mark={`${variant}:${name}`} class="flex size-5 items-center justify-center">
    {name.slice(0, 1)}
  </span>
)

function Fixture() {
  const stable = [
    { id: 'a', name: 'Alpha', mark: mark('stable', 'Alpha') },
    { id: 'b', name: 'Beta', mark: mark('stable', 'Beta') },
  ]
  const factories = [
    { id: 'a', name: 'Alpha', mark: () => mark('factory', 'Alpha') },
    { id: 'b', name: 'Beta', mark: () => mark('factory', 'Beta') },
  ]
  return (
    <main class="flex items-center gap-3">
      <WorkspaceSwitcher
        label="Stable nodes"
        value="a"
        onValueChange={() => {}}
        workspaces={stable}
      />
      <WorkspaceSwitcher
        label="Factories"
        value="a"
        onValueChange={() => {}}
        workspaces={factories}
      />
    </main>
  )
}

render(Fixture, document.body)
