import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

type UpdateState = {
  phase: 'current' | 'available'
  currentVersion: string
  availableVersion?: string
}

type FixtureWindow = Window & {
  updateDialogLifecycle?: {
    resolveStatus(index: number, state: UpdateState): Promise<void>
    resolveCheck(index: number, state: UpdateState): Promise<void>
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

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Update dialog lifecycle</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await expect(page.getByLabel('Status requests')).toHaveText('1')
})

async function resolveStatus(
  page: import('@playwright/test').Page,
  index: number,
  state: UpdateState
) {
  await page.evaluate(
    async ({ index, state }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.resolveStatus(index, state)
    },
    { index, state }
  )
}

async function resolveCheck(
  page: import('@playwright/test').Page,
  index: number,
  state: UpdateState
) {
  await page.evaluate(
    async ({ index, state }) => {
      await (window as FixtureWindow).updateDialogLifecycle!.resolveCheck(index, state)
    },
    { index, state }
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
