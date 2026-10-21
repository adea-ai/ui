import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { WorkspaceReorderDialog } from '../../src/components/composites/workspace-switcher/workspace-reorder-dialog'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

/**
 * Drives the reorder dialog with saves the test settles by hand, so the order of
 * completion, a close and reopen during a save, and a rejection are all decided
 * by the spec rather than by timing. The host applies a move only when its save
 * resolves, as a real route-backed host would.
 */
type Save = { ids: readonly string[]; resolve(): void; reject(): void }

const names: Record<string, string> = { home: 'Home', adea: 'adea', cortana: 'cortana' }

function Fixture() {
  const [open, setOpen] = createSignal(false)
  const [order, setOrder] = createSignal(['home', 'adea', 'cortana'])
  const [calls, setCalls] = createSignal(0)
  const saves: Save[] = []
  Object.assign(window, {
    reorderFixture: {
      resolve: (index: number) => saves[index]?.resolve(),
      reject: (index: number) => saves[index]?.reject(),
    },
  })

  return (
    <main class="flex items-center gap-3">
      <Button onClick={() => setOpen(true)}>Open reorder</Button>
      <output aria-label="Saves started">{calls()}</output>
      <output aria-label="Order">{order().join(',')}</output>
      <WorkspaceReorderDialog
        open={open()}
        onOpenChange={setOpen}
        workspaces={order().map((id) => ({ id, name: names[id] ?? id, fixed: id === 'home' }))}
        onReorder={(ids) =>
          new Promise<void>((resolve, reject) => {
            setCalls((count) => count + 1)
            saves.push({
              ids,
              resolve: () => {
                setOrder([...ids])
                resolve()
              },
              reject: () => reject(new Error('save failed')),
            })
          })
        }
      />
    </main>
  )
}

render(() => <Fixture />, document.body)
