import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

type UpdateState = {
  phase: 'current' | 'available' | 'downloading' | 'installed' | 'failed'
  currentVersion: string
  availableVersion?: string
  downloadedBytes?: number
  totalBytes?: number
  error?: unknown
}

type FixtureWindow = Window & {
  updateDialogLifecycleConfig?: { deferInitialStatus?: boolean }
  updateDialogLifecycle?: {
    resolveStatus(index: number, state: UpdateState): Promise<void>
    resolveCheck(index: number, state: UpdateState): Promise<void>
    rejectCheck(index: number, reason: unknown): Promise<void>
    resolveInstall(index: number, state: UpdateState): Promise<void>
    rejectInstall(index: number, message: string): Promise<void>
    resolveChannelSave(index: number): Promise<void>
    rejectChannelSave(index: number, reason: unknown): Promise<void>
  }
}

let script: string
let css: string

test.beforeAll(async () => {
  const result = await build({
    root: resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [solid(), tailwindcss()],
    build: {
      write: false,
      minify: false,
      lib: {
        entry: resolve(
          import.meta.dirname,
          '../../../packages/ui/tests/fixtures/update-dialog-lifecycle.tsx'
        ),
        formats: ['iife'],
        name: 'UpdateDialogLifecycleFixture',
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const assets = outputs.flatMap((output) => ('output' in output ? output.output : []))
  script = assets
    .filter((asset) => asset.type === 'chunk')
    .map((asset) => asset.code)
    .join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test.beforeEach(async ({ page }, testInfo) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Update dialog lifecycle</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  if (testInfo.title === 'a pending initial status cannot overwrite reopened state') {
    await page.evaluate(() => {
      ;(window as FixtureWindow).updateDialogLifecycleConfig = { deferInitialStatus: true }
    })
  }
  await page.addScriptTag({ content: script })
  await expect(page.getByLabel('Status requests')).toHaveText('1')
})

async function resolveStatus(
  page: import('@playwright/test').Page,
  index: number,
  state: UpdateState
) {
  await page.evaluate(
    async ({ requestIndex, nextState }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.resolveStatus(requestIndex, nextState)
    },
    { requestIndex: index, nextState: state }
  )
}

async function resolveCheck(
  page: import('@playwright/test').Page,
  index: number,
  state: UpdateState
) {
  await page.evaluate(
    async ({ requestIndex, nextState }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.resolveCheck(requestIndex, nextState)
    },
    { requestIndex: index, nextState: state }
  )
}

async function rejectCheck(page: import('@playwright/test').Page, index: number, reason: unknown) {
  await page.evaluate(
    async ({ requestIndex, error }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.rejectCheck(requestIndex, error)
    },
    { requestIndex: index, error: reason }
  )
}

async function resolveInstall(
  page: import('@playwright/test').Page,
  index: number,
  state: UpdateState
) {
  await page.evaluate(
    async ({ requestIndex, nextState }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.resolveInstall(requestIndex, nextState)
    },
    { requestIndex: index, nextState: state }
  )
}

async function rejectInstall(
  page: import('@playwright/test').Page,
  index: number,
  message: string
) {
  await page.evaluate(
    async ({ requestIndex, errorMessage }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.rejectInstall(
        requestIndex,
        errorMessage
      )
    },
    { requestIndex: index, errorMessage: message }
  )
}

test('a status request from a closed dialog cannot update after reopen', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Version & updates' })).toBeVisible()
  await expect(page.getByLabel('Status requests')).toHaveText('2')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByRole('dialog', { name: 'Version & updates' })).toBeVisible()
  await expect(page.getByLabel('Status requests')).toHaveText('3')

  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.72.1' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.1')

  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.69.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.1')
  await expect(page.getByText('v0.69.0', { exact: true })).toHaveCount(0)
})

test('a failed auto-check hides cached current status and retry recovers', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await rejectCheck(page, 0, {
    safe: { message: 'The update feed is temporarily unavailable.' },
    accessToken: 'test-token-must-not-render',
  })
  await expect(page.getByRole('alert')).toHaveText('The update feed is temporarily unavailable.')
  await expect(page.getByText('Adea is up to date.', { exact: true })).toHaveCount(0)
  await expect(page.getByText('You are running the latest release.', { exact: true })).toHaveCount(
    0
  )
  await expect(page.getByText('test-token-must-not-render', { exact: true })).toHaveCount(0)

  const retry = page.getByRole('button', { name: 'Retry update check' })
  await expect(retry).toBeEnabled()
  await retry.click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await resolveCheck(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByText('Adea is up to date.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a failed auto-check preserves an available update snapshot', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await rejectCheck(page, 0, 'The release feed could not be reached.')
  await expect(page.getByRole('alert')).toHaveText('The release feed could not be reached.')
  await expect(page.getByRole('region', { name: 'Available update' })).toContainText(
    'Version 0.73.0 is ready'
  )
  await expect(page.getByRole('button', { name: 'Install and restart' })).toBeEnabled()
  await expect(page.getByText('Adea is up to date.', { exact: true })).toHaveCount(0)
})

test('a failed auto-check preserves active download progress', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, {
    phase: 'downloading',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
    downloadedBytes: 1024,
    totalBytes: 4096,
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await rejectCheck(page, 0, 'The release feed could not be reached.')
  await expect(page.getByRole('alert')).toHaveText('The release feed could not be reached.')
  await expect(page.getByRole('region', { name: 'Update progress' })).toContainText('25%')
  await expect(page.getByText('Adea is up to date.', { exact: true })).toHaveCount(0)
})

test('changing the release channel clears the old offer until save and recheck finish', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await resolveStatus(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByRole('button', { name: 'Install and restart' })).toBeEnabled()

  const channel = page.getByRole('combobox', { name: 'Update channel' })
  await channel.selectOption('dev')
  await expect(page.getByLabel('Channel saves')).toHaveText('1')
  await expect(channel).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Check latest version' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await page.evaluate(async () => {
    await (window as FixtureWindow).updateDialogLifecycle!.resolveChannelSave(0)
  })
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await expect(channel).toBeDisabled()
  await resolveCheck(page, 1, { phase: 'current', currentVersion: '0.72.0' })

  await expect(channel).toBeEnabled()
  await expect(channel).toHaveValue('dev')
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
})

test('a failed channel save keeps the old offer cleared and skips its check', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await resolveStatus(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })

  const channel = page.getByRole('combobox', { name: 'Update channel' })
  await channel.selectOption('dev')
  await expect(page.getByLabel('Channel saves')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
  await page.evaluate(async () => {
    await (window as FixtureWindow).updateDialogLifecycle!.rejectChannelSave(
      0,
      'The channel could not be saved.'
    )
  })

  await expect(page.getByRole('alert')).toHaveText('The channel could not be saved.')
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await expect(channel).toBeEnabled()
  await expect(channel).toHaveValue('stable')
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
})

test('a failed channel check keeps the successfully saved selection', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await resolveStatus(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })

  const channel = page.getByRole('combobox', { name: 'Update channel' })
  await channel.selectOption('dev')
  await expect(page.getByLabel('Channel saves')).toHaveText('1')
  await page.evaluate(async () => {
    await (window as FixtureWindow).updateDialogLifecycle!.resolveChannelSave(0)
  })
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await rejectCheck(page, 1, 'The dev feed is temporarily unavailable.')

  await expect(page.getByRole('alert')).toHaveText('The dev feed is temporarily unavailable.')
  await expect(channel).toHaveValue('dev')
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Install and restart' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Retry update check' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('3')
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await rejectCheck(page, 2, 'The dev feed is still unavailable.')
  await expect(page.getByRole('alert')).toHaveText('The dev feed is still unavailable.')
  await expect(page.getByRole('region', { name: 'Available update' })).toHaveCount(0)
})

test('a failed manual check cannot discard an available snapshot during status reload', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })

  await page.getByRole('button', { name: 'Check latest version' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await rejectCheck(page, 1, 'The release feed could not be reached.')
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })

  await expect(page.getByRole('alert')).toHaveText('The release feed could not be reached.')
  await expect(page.getByRole('region', { name: 'Available update' })).toContainText(
    'Version 0.73.0 is ready'
  )
  await expect(page.getByRole('button', { name: 'Install and restart' })).toBeEnabled()
})

test('unsafe object messages use a generic check failure', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await rejectCheck(page, 0, {
    message: 'test-token-must-not-render',
    error: { message: 'also-not-safe-to-render' },
  })
  await expect(page.getByRole('alert')).toHaveText('Could not check for updates')
  await expect(page.getByText('test-token-must-not-render', { exact: true })).toHaveCount(0)
  await expect(page.getByText('also-not-safe-to-render', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Adea is up to date.', { exact: true })).toHaveCount(0)
})

test('a failed check status reports a safe fallback and can be retried', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByLabel('Update checks')).toHaveText('1')

  await resolveCheck(page, 0, {
    phase: 'failed',
    currentVersion: '0.72.0',
    error: '[object Object]',
  })
  await expect(page.getByRole('alert')).toHaveText('Could not check for updates')
  await expect(page.getByText('Adea is up to date.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Available update' })).toContainText(
    'Version 0.73.0 is ready'
  )

  await page.getByRole('button', { name: 'Retry update check' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await resolveCheck(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByText('Adea is up to date.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a late manual check cannot change the closed dialog trigger', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.72.0' })

  await page.getByRole('button', { name: 'Check latest version' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await rejectCheck(page, 1, 'This result arrived after the dialog closed.')

  await expect(trigger).not.toContainText('Retry')
})

test('a successful install clears retry state after a failed check reloads availability', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Open version and updates' }).click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.72.0' })

  await page.getByRole('button', { name: 'Check latest version' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await rejectCheck(page, 1, 'The release feed could not be reached.')
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByRole('region', { name: 'Available update' })).toContainText(
    'Version 0.73.0 is ready'
  )
  await expect(page.getByRole('button', { name: 'Retry update check' })).toBeVisible()

  await page.getByRole('button', { name: 'Install and restart' }).click()
  await expect(page.getByLabel('Update installs')).toHaveText('1')
  await resolveInstall(page, 0, { phase: 'installed', currentVersion: '0.73.0' })

  await expect(page.getByRole('button', { name: 'Check latest version' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Retry update check' })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a pending initial status cannot overwrite reopened state', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.0')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 2, { phase: 'current', currentVersion: '0.73.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await resolveCheck(page, 1, { phase: 'current', currentVersion: '0.73.0' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.73.0')

  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.69.0' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.73.0')
  await expect(page.getByText('v0.69.0', { exact: true })).toHaveCount(0)
})

test('a check from a closed dialog cannot overwrite the reopened dialog', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.71.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('1')
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.71.0')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.0')

  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.69.0' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.0')
  await expect(page.getByText('v0.69.0', { exact: true })).toHaveCount(0)

  await resolveCheck(page, 1, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
})

test('a stale manual check cannot replace reopened state or clear its busy state', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.71.0' })
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.71.1' })

  const checkButton = page.getByRole('button', { name: 'Check latest version' })
  await expect(checkButton).toBeEnabled()
  await checkButton.click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('3')
  await resolveCheck(page, 2, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()

  await expect(checkButton).toBeEnabled()
  await checkButton.click()
  await expect(page.getByLabel('Update checks')).toHaveText('4')
  await expect(checkButton).toBeDisabled()

  await resolveCheck(page, 1, { phase: 'current', currentVersion: '0.69.0' })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
  await expect(checkButton).toBeDisabled()

  await resolveCheck(page, 3, { phase: 'current', currentVersion: '0.72.1' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.1')
  await expect(checkButton).toBeEnabled()
})

test('a stale manual-check fallback status cannot overwrite reopened state', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.71.0' })
  await resolveCheck(page, 0, { phase: 'current', currentVersion: '0.71.0' })

  await page.getByRole('button', { name: 'Check latest version' }).click()
  await expect(page.getByLabel('Update checks')).toHaveText('2')
  await rejectCheck(page, 1, 'The old check failed')
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await expect(page.getByRole('alert')).toContainText('The old check failed')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('4')
  await resolveStatus(page, 2, { phase: 'current', currentVersion: '0.72.0' })
  await expect(page.getByLabel('Update checks')).toHaveText('3')
  await resolveCheck(page, 2, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.69.0' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.0')
  await expect(page.getByText('v0.69.0', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('an in-flight install continues but cannot replace reopened state or clear its busy state', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.71.0' })
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.71.0',
    availableVersion: '0.72.0',
  })
  await expect(page.getByText('Version 0.72.0 is ready')).toBeVisible()

  const installButton = page.getByRole('button', { name: 'Install and restart' })
  await expect(installButton).toBeEnabled()
  await installButton.click()
  await expect(page.getByLabel('Update installs')).toHaveText('1')

  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await resolveCheck(page, 1, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()

  const checkButton = page.getByRole('button', { name: 'Check latest version' })
  await expect(checkButton).toBeEnabled()
  await checkButton.click()
  await expect(page.getByLabel('Update checks')).toHaveText('3')
  await expect(checkButton).toBeDisabled()

  await resolveInstall(page, 0, { phase: 'installed', currentVersion: '0.72.0' })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
  await expect(checkButton).toBeDisabled()

  await resolveCheck(page, 2, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.74.0',
  })
  await expect(page.getByText('Version 0.74.0 is ready')).toBeVisible()
  await expect(checkButton).toBeEnabled()
})

test('a late install rejection cannot start stale status fallback or clear reopened busy state', async ({
  page,
}) => {
  const trigger = page.getByRole('button', { name: 'Open version and updates' })
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('2')
  await resolveStatus(page, 0, { phase: 'current', currentVersion: '0.71.0' })
  await resolveCheck(page, 0, {
    phase: 'available',
    currentVersion: '0.71.0',
    availableVersion: '0.72.0',
  })

  await page.getByRole('button', { name: 'Install and restart' }).click()
  await expect(page.getByLabel('Update installs')).toHaveText('1')
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await trigger.click()
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await resolveStatus(page, 1, { phase: 'current', currentVersion: '0.72.0' })
  await resolveCheck(page, 1, {
    phase: 'available',
    currentVersion: '0.72.0',
    availableVersion: '0.73.0',
  })
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()

  const checkButton = page.getByRole('button', { name: 'Check latest version' })
  await checkButton.click()
  await expect(page.getByLabel('Update checks')).toHaveText('3')
  await expect(checkButton).toBeDisabled()

  await rejectInstall(page, 0, 'The old install failed')
  await expect(page.getByLabel('Status requests')).toHaveText('3')
  await expect(page.getByText('Version 0.73.0 is ready')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(checkButton).toBeDisabled()

  await resolveCheck(page, 2, { phase: 'current', currentVersion: '0.72.1' })
  await expect(page.getByRole('region', { name: 'Version status' })).toContainText('v0.72.1')
  await expect(checkButton).toBeEnabled()
})
