import { createSignal, onCleanup, onMount } from 'solid-js'
import { render } from 'solid-js/web'
import {
  UpdateDialog,
  type UpdateAdapter,
  type UpdateState,
} from '../../src/components/composites/update-dialog'
import '../../src/styles/globals.css'

declare global {
  interface Window {
    updateDialogLifecycleConfig?: { deferInitialStatus?: boolean }
    updateDialogLifecycle?: {
      resolveStatus(index: number, state: UpdateState): Promise<void>
      resolveCheck(index: number, state: UpdateState): Promise<void>
      rejectCheck(index: number, message: string): Promise<void>
      resolveInstall(index: number, state: UpdateState): Promise<void>
      rejectInstall(index: number, message: string): Promise<void>
    }
  }
}

const current = (currentVersion: string): UpdateState => ({
  phase: 'current',
  currentVersion,
})

function Fixture() {
  const [statusCalls, setStatusCalls] = createSignal(0)
  const [checkCalls, setCheckCalls] = createSignal(0)
  const [installCalls, setInstallCalls] = createSignal(0)
  let statusCallCount = 0
  let checkCallCount = 0
  let installCallCount = 0
  const statusResolvers: Array<(state: UpdateState) => void> = []
  const checkResolvers: Array<(state: UpdateState) => void> = []
  const checkRejectors: Array<(error: Error) => void> = []
  const installResolvers: Array<(state: UpdateState) => void> = []
  const installRejectors: Array<(error: Error) => void> = []
  const deferInitialStatus = window.updateDialogLifecycleConfig?.deferInitialStatus ?? false

  const adapter: UpdateAdapter = {
    getStatus: () => {
      const call = statusCallCount
      statusCallCount += 1
      setStatusCalls(statusCallCount)
      if (call === 0 && !deferInitialStatus) return Promise.resolve(current('0.70.1'))
      return new Promise((resolve) => statusResolvers.push(resolve))
    },
    check: () => {
      checkCallCount += 1
      setCheckCalls(checkCallCount)
      return new Promise((resolve, reject) => {
        checkResolvers.push(resolve)
        checkRejectors.push(reject)
      })
    },
    install: () => {
      installCallCount += 1
      setInstallCalls(installCallCount)
      return new Promise((resolve, reject) => {
        installResolvers.push(resolve)
        installRejectors.push(reject)
      })
    },
    isDesktopRuntime: () => true,
  }

  onMount(() => {
    window.updateDialogLifecycle = {
      async resolveStatus(index, state) {
        statusResolvers[index]!(state)
        await Promise.resolve()
      },
      async resolveCheck(index, state) {
        checkResolvers[index]!(state)
        await Promise.resolve()
      },
      async rejectCheck(index, message) {
        checkRejectors[index]!(new Error(message))
        await Promise.resolve()
      },
      async resolveInstall(index, state) {
        installResolvers[index]!(state)
        await Promise.resolve()
      },
      async rejectInstall(index, message) {
        installRejectors[index]!(new Error(message))
        await Promise.resolve()
      },
    }
  })
  onCleanup(() => delete window.updateDialogLifecycle)

  return (
    <main>
      <UpdateDialog adapter={adapter} appName="Adea" />
      <output aria-label="Status requests">{statusCalls()}</output>
      <output aria-label="Update checks">{checkCalls()}</output>
      <output aria-label="Update installs">{installCalls()}</output>
    </main>
  )
}

render(Fixture, document.body)
