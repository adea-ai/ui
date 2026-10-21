import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { WorkspaceSwitcher } from '../../src/components/composites/workspace-switcher/workspace-switcher'
import '../../src/styles/globals.css'

/**
 * The switcher with reordering turned on. The reorder dialog loads on demand, so
 * this drives the whole path a user takes: open the menu, choose "Reorder
 * workspaces…", move a row, close.
 */
const names: Record<string, string> = { home: 'Home', adea: 'adea', cortana: 'cortana' }

function Fixture() {
  const [order, setOrder] = createSignal(['home', 'adea', 'cortana'])
  const [value, setValue] = createSignal('adea')

  return (
    <main class="flex items-center gap-3 p-4">
      <WorkspaceSwitcher
        value={value()}
        onValueChange={setValue}
        workspaces={order().map((id) => ({
          id,
          name: names[id] ?? id,
          mark: () => <span aria-hidden="true">{id[0]}</span>,
          fixed: id === 'home',
        }))}
        onReorder={(ids) => {
          setOrder([...ids])
        }}
      />
      <output aria-label="Order">{order().join(',')}</output>
    </main>
  )
}

render(() => <Fixture />, document.body)
