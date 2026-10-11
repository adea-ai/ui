import type { ComponentProps } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { UserRound } from 'lucide-solid'
import { render } from 'solid-js/web'
import { AccountMenu } from '../../src/components/composites/account-menu/account-menu'
import {
  SideRail,
  SideRailButton,
  SideRailFooter,
} from '../../src/components/layout/side-rail/side-rail'
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
  const [customEvents, setCustomEvents] = createSignal<string[]>([])
  const [customTriggerCallbacks, setCustomTriggerCallbacks] = createSignal<string[]>([])
  const [cleanupMenuMounted, setCleanupMenuMounted] = createSignal(true)
  const [cleanupCallbackFired, setCleanupCallbackFired] = createSignal(false)
  let opener: HTMLButtonElement | undefined

  const record = (event: string) => setEvents((previous) => [...previous, event])

  return (
    <main class="flex items-center gap-3">
      <SideRail collapsed aria-label="Rail trigger fixture" class="absolute top-24 left-4 h-64">
        <SideRailFooter>
          <AccountMenu
            label="Rail settings"
            placement="right-end"
            gutter={4}
            hideArrow
            authenticated={false}
            showSession={false}
            items={[
              {
                id: 'updates',
                label: 'Updates',
                onSelect: () => setCustomEvents(['selected']),
                onSelectAfterClose: (trigger) => {
                  const button = document.querySelector('button[aria-label="Rail settings"]')
                  const closed = button?.getAttribute('aria-expanded') === 'false'
                  const exactOpener = trigger === button
                  const nativeButton = trigger instanceof HTMLButtonElement
                  setCustomEvents([
                    `after-close:${nativeButton}:${trigger?.isConnected === true}:${exactOpener}:${closed}`,
                  ])
                  opener = trigger
                  setDialogOpen(true)
                },
              },
            ]}
            renderTrigger={(triggerProps) => (
              <SideRailButton
                {...triggerProps}
                label={triggerProps.label}
                onFocus={[
                  (data: { forwarded: unknown }, event: FocusEvent) => {
                    invokeEventHandler(data.forwarded, event)
                    setCustomTriggerCallbacks((previous) => [...previous, 'focus'])
                  },
                  { forwarded: triggerProps.onFocus },
                ] as ComponentProps<'button'>['onFocus']}
              >
                <UserRound aria-hidden="true" />
              </SideRailButton>
            )}
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
              renderTrigger={(triggerProps) => (
                <SideRailButton {...triggerProps} label={triggerProps.label}>
                  <UserRound aria-hidden="true" />
                </SideRailButton>
              )}
            />
          </Show>
        </SideRailFooter>
      </SideRail>
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
      <Button size="sm" onClick={() => setEvents([])}>
        Reset lifecycle
      </Button>
      <output aria-label="Selection lifecycle">{events().join('|')}</output>
      <output aria-label="Cleanup callback">
        {cleanupCallbackFired() ? 'deferred callback fired' : 'deferred callback not fired'}
      </output>
      <output aria-label="Custom selection lifecycle">{customEvents().join('|')}</output>
      <output aria-label="Custom trigger callbacks">{customTriggerCallbacks().join('|')}</output>
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

function invokeEventHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}

render(Fixture, document.body)
