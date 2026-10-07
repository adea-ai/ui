import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { AccountMenu } from '../../src/components/composites/account-menu/account-menu'
import {
  UpdateDialog,
  type UpdateAdapter,
  type UpdateState,
} from '../../src/components/composites/update-dialog/update-dialog'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

const current: UpdateState = { phase: 'current', currentVersion: '0.81.0' }

const adapter: UpdateAdapter = {
  getStatus: async () => current,
  check: async () => current,
  install: async () => current,
  isDesktopRuntime: () => true,
}

function Fixture() {
  const [dialogOpen, setDialogOpen] = createSignal(false)
  const [events, setEvents] = createSignal<string[]>([])
  const [cleanupMenuMounted, setCleanupMenuMounted] = createSignal(true)
  const [cleanupCallbackFired, setCleanupCallbackFired] = createSignal(false)
  let opener: HTMLButtonElement | undefined

  const record = (event: string) => setEvents((previous) => [...previous, event])

  return (
    <main class="flex items-center gap-3">
      <div class="absolute top-96 left-4">
        <AccountMenu
          label="Rail settings"
          placement="right-end"
          gutter={4}
          hideArrow
          authenticated={false}
          showSession={false}
          items={[{ id: 'settings', label: 'Settings' }]}
        />
      </div>
      <AccountMenu
        label="User settings"
        authenticated
        items={[
          {
            id: 'updates',
            label: 'Updates',
            onSelect: () => record('selected'),
            onSelectAfterClose: (trigger) => {
              const button = document.querySelector('button[aria-label="User settings"]')
              const closed = button?.getAttribute('aria-expanded') === 'false'
              const exactOpener = trigger === button
              const nativeButton = trigger instanceof HTMLButtonElement
              record(
                `after-close:${nativeButton}:${trigger?.isConnected === true}:${exactOpener}:${closed}`
              )
              opener = trigger
              setDialogOpen(true)
            },
          },
        ]}
      />
      <AccountMenu
        label="Shortcut menu"
        authenticated={false}
        showSession={false}
        items={[{ id: 'settings', label: 'Settings', shortcut: '⌘,', keyshortcuts: 'Meta+,' }]}
      />
      <AccountMenu
        label="Pending update"
        authenticated
        updateAvailable
        items={[{ id: 'updates', label: 'Updates' }]}
      />
      <Show when={cleanupMenuMounted()}>
        <AccountMenu
          label="Unmount test menu"
          authenticated
          items={[
            {
              id: 'remove-menu',
              label: 'Remove menu',
              onSelect: () => setCleanupMenuMounted(false),
              onSelectAfterClose: () => setCleanupCallbackFired(true),
            },
          ]}
        />
      </Show>
      <Button size="sm" onClick={() => setEvents([])}>
        Reset lifecycle
      </Button>
      <output aria-label="Selection lifecycle">{events().join('|')}</output>
      <output aria-label="Cleanup callback">
        {cleanupCallbackFired() ? 'deferred callback fired' : 'deferred callback not fired'}
      </output>
      <Show when={dialogOpen()}>
        <UpdateDialog
          adapter={adapter}
          appName="Adea"
          open={dialogOpen()}
          onOpenChange={setDialogOpen}
          restoreFocusRef={() => opener}
        />
      </Show>
    </main>
  )
}

render(Fixture, document.body)
