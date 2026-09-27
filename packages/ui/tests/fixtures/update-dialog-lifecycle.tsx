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
    updateDialogLifecycle?: {
      resolveStatus(index: number, state: UpdateState): Promise<void>
      resolveCheck(index: number, state: UpdateState): Promise<void>
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
  let statusCallCount = 0
  let checkCallCount = 0
  const statusResolvers: Array<(state: UpdateState) => void> = []
  const checkResolvers: Array<(state: UpdateState) => void> = []

  const adapter: UpdateAdapter = {
    getStatus: () => {
      const call = statusCallCount
      statusCallCount += 1
      setStatusCalls(statusCallCount)
      if (call === 0) return Promise.resolve(current('0.70.1'))
      return new Promise((resolve) => statusResolvers.push(resolve))
    },
    check: () => {
      checkCallCount += 1
      setCheckCalls(checkCallCount)
      return new Promise((resolve) => checkResolvers.push(resolve))
    },
    install: async () => current('0.70.1'),
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
    }
  })
  onCleanup(() => delete window.updateDialogLifecycle)

  return (
    <main>
      <UpdateDialog adapter={adapter} appName="Adea" />
      <output aria-label="Status requests">{statusCalls()}</output>
      <output aria-label="Update checks">{checkCalls()}</output>
    </main>
  )
}

render(Fixture, document.body)
