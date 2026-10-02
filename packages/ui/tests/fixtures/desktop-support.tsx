import { createSignal, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import { AboutDialog } from '../../src/components/composites/about-dialog'
import { HelpCenter } from '../../src/components/composites/help-center'
import { AccountMenu, createAppMenuItems } from '../../src/components/composites/account-menu'
import {
  UpdateDialog,
  type UpdateAdapter,
  type UpdateState,
} from '../../src/components/composites/update-dialog'
import { Button } from '../../src/components/ui/button'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    desktopSupportResolveCancel?: () => void
  }
}

function Fixture() {
  const [about, setAbout] = createSignal(false)
  const [updates, setUpdates] = createSignal(false)
  const [copied, setCopied] = createSignal('')
  const [opened, setOpened] = createSignal('')
  const [denyCopy, setDenyCopy] = createSignal(false)
  const [deferCancellation, setDeferCancellation] = createSignal(false)
  const [cancelCalls, setCancelCalls] = createSignal(0)
  const [statusCalls, setStatusCalls] = createSignal(0)
  let finishCancel: (() => void) | undefined
  let opener: HTMLButtonElement | undefined
  let snapshot: UpdateState = {
    phase: 'available',
    currentVersion: '1.2.0',
    availableVersion: '1.3.0',
    releaseUrl: 'https://example.com/releases',
    releaseNotes: '# New release\n\nNewest improvements.',
    changelog:
      '# 1.2.0\n\nNewest installed fixes.\n\n' +
      '* Retained history\n'.repeat(2500) +
      '\n# 0.1.0\n\nOldest release is preserved.',
  }
  let finishInstall: ((state: UpdateState) => void) | undefined
  const openExternal = async (url: string) => {
    setOpened(url)
  }
  const adapter: UpdateAdapter = {
    getStatus: async () => {
      setStatusCalls((count) => count + 1)
      return snapshot
    },
    check: async () => snapshot,
    install: async () => {
      snapshot = { ...snapshot, phase: 'downloading', downloadedBytes: 25, totalBytes: 100 }
      return new Promise((resolve) => {
        finishInstall = resolve
      })
    },
    cancel: async () => {
      setCancelCalls((count) => count + 1)
      if (deferCancellation())
        await new Promise<void>((resolve) => {
          finishCancel = resolve
        })
      snapshot = { ...snapshot, phase: 'cancelled' }
      finishInstall?.(snapshot)
      return snapshot
    },
    isDesktopRuntime: () => true,
    openExternal,
    pollIntervalMs: 250,
  }
  onMount(() => {
    window.desktopSupportResolveCancel = () => finishCancel?.()
  })
  onCleanup(() => {
    delete window.desktopSupportResolveCancel
  })
  const items = createAppMenuItems({
    primaryItem: { id: 'index', label: 'Index', onSelectAfterClose: () => {} },
    onAbout: () => setAbout(true),
    onHelp: () => {},
    onFeedback: () => {},
    onUpdates: () => setUpdates(true),
    onSettings: () => {},
  })
  return (
    <>
      <Button
        ref={(element) => {
          opener = element
        }}
        onClick={() => setAbout(true)}
      >
        Open about
      </Button>
      <Button onClick={() => setUpdates(true)}>Open updates</Button>
      <Button onClick={() => setDenyCopy(true)}>Deny clipboard</Button>
      <Button onClick={() => setDeferCancellation(true)}>Defer cancellation</Button>
      <AccountMenu
        items={items}
        showSession={false}
        authenticated={false}
        label="Settings and utilities"
      />
      <AboutDialog
        appName="Cortana"
        appIcon="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath fill='currentColor' d='M0 0h64v64H0z'/%3E%3C/svg%3E"
        version="1.2.0"
        platform="desktop"
        copyright="Copyright © 2026 Contributors"
        sourceUrl="https://example.com/source"
        open={about()}
        onOpenChange={setAbout}
        restoreFocusRef={() => opener}
        copyVersionInfo={async (text) => {
          if (denyCopy()) throw new Error('Private clipboard error')
          setCopied(text)
        }}
        openExternal={openExternal}
      />
      <UpdateDialog
        adapter={adapter}
        appName="Cortana"
        appIcon="/app-icon.svg"
        open={updates()}
        onOpenChange={setUpdates}
      />
      <HelpCenter
        appName="Cortana"
        shortcuts={[{ label: 'Open settings', keys: ['⌘', ','] }]}
        links={[{ label: 'Project documentation', url: 'https://example.com/docs' }]}
        openExternal={openExternal}
      />
      <output aria-label="Copied payload">{copied()}</output>
      <output aria-label="Opened URL">{opened()}</output>
      <output aria-label="Cancel requests">{cancelCalls()}</output>
      <output aria-label="Status requests">{statusCalls()}</output>
    </>
  )
}
render(() => <Fixture />, document.getElementById('root')!)
