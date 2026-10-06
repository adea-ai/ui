import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

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
        entry: resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/form-field.tsx'),
        formats: ['iife'],
        name: 'FormFieldFixture',
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
    '<!doctype html><html lang="en"><head><title>Form field contracts</title></head><body><div id="app"></div></body></html>'
  )
  if (css) await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('wires names, IDs, help and validation to the actual controls', async ({ page }) => {
  const duplicateLabels = page.getByRole('textbox', { name: 'Workspace name', exact: true })
  await expect(duplicateLabels).toHaveCount(2)
  const ids = await duplicateLabels.evaluateAll((inputs) => inputs.map((input) => input.id))
  expect(ids[0]).not.toBe('')
  expect(ids[0]).not.toBe(ids[1])

  const workspaceName = duplicateLabels.first()
  await expect(workspaceName).toHaveAccessibleDescription(
    'Shown to anyone you invite. Choose a workspace name.'
  )
  await expect(workspaceName).toHaveAttribute('aria-invalid', 'true')
  await expect(workspaceName).toHaveAttribute('aria-errormessage', /-error$/)
  const explicitIdInput = page.locator('#workspace-slug')
  await expect(explicitIdInput).toHaveAccessibleName('Workspace name')
  await expect(explicitIdInput).toHaveAttribute('id', 'workspace-slug')

  const provider = page.getByRole('combobox', { name: 'Provider', exact: true })
  await expect(provider).toHaveAttribute('id', /.+/)
  await expect(
    page.getByRole('textbox', { name: 'Custom query name', exact: true })
  ).toHaveAccessibleDescription(
    'Use the exact identifier from the provider. Shown beside the query.'
  )
  await expect(page.getByRole('textbox', { name: 'Accessible name', exact: true })).toHaveCount(0)
  await expect(
    page.getByRole('textbox', { name: 'Objective', exact: true })
  ).toHaveAccessibleDescription('A short description for this workspace.')
  await expect(page.getByRole('combobox', { name: 'Model', exact: true })).toHaveAttribute(
    'id',
    /.+/
  )

  const syncSwitch = page.getByRole('switch', { name: 'Enable sync', exact: true })
  await expect(syncSwitch).toHaveAccessibleDescription(
    'Runs after the next workspace change. Sync is unavailable.'
  )
  await expect(syncSwitch).toHaveAttribute('aria-invalid', 'true')
  await expect(syncSwitch).toHaveAttribute('aria-errormessage', /-error$/)
  await expect(
    page.getByRole('checkbox', { name: 'Include source metadata', exact: true })
  ).toHaveAttribute('id', /.+/)

  const radioGroup = page.getByRole('radiogroup', { name: 'Processing mode', exact: true })
  await expect(radioGroup).toHaveAccessibleDescription('Choose one mode.')
  await expect(page.getByRole('group', { name: 'Processing mode', exact: true })).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: 'Read sources', exact: true })
  ).toHaveAccessibleDescription('These permissions apply to each source.')
  await expect(
    page.getByRole('checkbox', { name: 'Read documents', exact: true })
  ).toHaveAccessibleDescription('These permissions apply to each source.')
  const layoutGroup = page.locator('[data-slot="field-group"]')
  await expect(layoutGroup).toBeVisible()
  await expect(layoutGroup).not.toHaveAttribute('role', 'group')
  await expect(page.getByRole('group', { name: 'Processing mode', exact: true })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Permissions', exact: true })).toBeVisible()
})

test('preserves native label activation and tracks conditional control IDs', async ({ page }) => {
  const checkbox = page.getByRole('checkbox', { name: 'Include source metadata', exact: true })
  await expect(checkbox).not.toBeChecked()
  await page.getByText('Include source metadata', { exact: true }).click()
  await expect(checkbox).toBeChecked()

  const label = page.getByText('Dynamic control', { exact: true })
  await expect(label).toHaveAttribute('for', 'dynamic-input')
  await page.getByRole('button', { name: 'Change dynamic control', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Dynamic control', exact: true })).toHaveAttribute(
    'id',
    'dynamic-textarea'
  )
  await expect(label).toHaveAttribute('for', 'dynamic-textarea')
  await expect(page.locator('#dynamic-input')).toHaveCount(0)

  const settingsRowSwitch = page.getByRole('switch', { name: 'Row control', exact: true })
  await expect(settingsRowSwitch).toHaveAccessibleDescription('A row description.')
})

test('validates number boundaries, restores invalid drafts and follows controlled values', async ({
  page,
}) => {
  const workers = page.getByRole('spinbutton', { name: 'Workers', exact: true })
  await expect(workers).toHaveValue('4')
  await expect(workers).toHaveAccessibleDescription('Choose between one and eight workers.')

  await workers.fill('8')
  await expect(workers).toHaveValue('8')
  await expect(workers).not.toHaveAttribute('aria-invalid', 'true')

  await workers.fill('9')
  await expect(workers).toHaveAttribute('aria-invalid', 'true')
  await expect(workers).toHaveAccessibleDescription(
    'Choose between one and eight workers. Workers must be between 1 and 8.'
  )
  const workerErrorId = await workers.getAttribute('aria-errormessage')
  const workerError = page.locator(`#${workerErrorId}`)
  await expect(workerError).toHaveAttribute('role', 'alert')
  await expect(workerError).toHaveText('Workers must be between 1 and 8.')
  await page.getByRole('button', { name: 'Set workers to six', exact: true }).click()
  await expect(workers).toHaveValue('6')
  await expect(workers).not.toHaveAttribute('aria-invalid', 'true')

  const ratio = page.getByRole('spinbutton', { name: 'Ratio', exact: true })
  await ratio.fill('2.75')
  await expect(ratio).toHaveValue('2.75')
  await ratio.fill('')
  await expect(ratio).toHaveAttribute('aria-invalid', 'true')
  await ratio.blur()
  await expect(ratio).toHaveValue('2.75')
  await expect(ratio).not.toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Set ratio to two point five', exact: true }).click()
  await expect(ratio).toHaveValue('2.5')
})

test('keeps composite inputs inside the shared field and clear tooltip contracts', async ({
  page,
}) => {
  const model = page.getByRole('combobox', { name: 'Controlled model', exact: true })
  await expect(model).toHaveAccessibleDescription('Select a provider model.')
  await expect(model).toHaveAttribute('id', /.+/)
  await model.fill('Adea Large')
  await page.getByRole('option', { name: 'Adea Large', exact: true }).click()
  await expect(model).toHaveValue('Adea Large')

  const secret = page.locator('[data-slot="input-group-input"]').first()
  await expect(secret).toHaveAccessibleName('API key')
  await expect(secret).toHaveAccessibleDescription('Stored securely for this provider.')
  const lockedSecret = page.getByLabel('Locked API key', { exact: true })
  await expect(lockedSecret).toBeDisabled()
  await expect(lockedSecret).toHaveAccessibleDescription('Managed by policy.')
  const lockedClear = page.getByRole('button', { name: 'Clear API key', exact: true }).nth(1)
  await expect(lockedClear).toHaveAttribute('aria-disabled', 'true')
  await expect(lockedClear).toHaveAttribute('tabindex', '0')
  await page.mouse.move(0, 0)
  await secret.focus()
  await page.keyboard.press('Tab')
  const enabledClear = page.getByRole('button', { name: 'Clear API key', exact: true }).first()
  await expect(enabledClear).toBeFocused()
  await page.mouse.move(0, 0)
  await page.keyboard.press('Tab')
  await expect(lockedClear).toBeFocused()
  await expect(lockedClear).toHaveAttribute('aria-describedby', /.+/)
  const lockedTooltipId = await lockedClear.getAttribute('aria-describedby')
  const lockedTooltip = page.locator(`[id="${lockedTooltipId}"][role="tooltip"][data-expanded]`)
  await expect(lockedTooltip).toHaveText('This API key is managed by policy')
  await lockedClear.dispatchEvent('click')
  await expect(lockedSecret).toHaveValue('sk-managed')
  await lockedClear.evaluate((element) => element.blur())
  await secret.fill('sk-updated')
  await expect(secret).toHaveValue('sk-updated')

  const clear = page.getByRole('button', { name: 'Clear API key', exact: true }).first()
  await clear.hover()
  await expect(clear).toHaveAttribute('aria-describedby', /.+/)
  const clearTooltipId = await clear.getAttribute('aria-describedby')
  const clearTooltip = page.locator(`[id="${clearTooltipId}"][role="tooltip"][data-expanded]`)
  await expect(clearTooltip).toHaveText('Clear API key')
  await page.mouse.move(0, 0)
  await expect(clearTooltip).toHaveCount(0)
  await clear.focus()
  await expect(clear).toBeFocused()
  const clearStyle = await clear.evaluate((element) => ({
    disabled: (element as HTMLButtonElement).disabled,
    pointerEvents: getComputedStyle(element).pointerEvents,
    visibility: getComputedStyle(element).visibility,
  }))
  expect(clearStyle).toEqual({ disabled: false, pointerEvents: 'auto', visibility: 'visible' })
  // The tooltip focus gate keeps a programmatic focus() quiet, so the tip is
  // announced by a real hover here (keyboard intent is covered elsewhere).
  // Move the pointer first: it releases the focus() phantom away from the
  // control, so the hover's enter is not undone by the release blur.
  await page.mouse.move(4, 320)
  await clear.hover()
  await expect(clearTooltip).toHaveText('Clear API key')
  await clear.click()
  await expect(secret).toHaveValue('')
})
