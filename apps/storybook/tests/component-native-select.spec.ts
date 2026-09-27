import { expect, test } from '@playwright/test'
import { buildNativeSelectBrowser } from './native-select-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildNativeSelectBrowser())
})

test.beforeEach(async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Native Select fixture</title></head><body><div id="app"></div></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

test('renders a native select with an associated label and native option groups', async ({
  page,
}) => {
  const select = page.getByRole('combobox', { name: 'Relationship kind', exact: true })
  await expect(select).toHaveAttribute('id', 'relationship-kind')
  await expect(select).toHaveValue('derived')
  await expect(select.locator('option')).toHaveCount(3)
  await expect(select.locator('optgroup')).toHaveAttribute('label', 'Graph source')

  const nativeSemantics = await select.evaluate((element) => ({
    tagName: element.tagName,
    explicitRole: element.getAttribute('role'),
    labels: Array.from((element as HTMLSelectElement).labels ?? [], (label) =>
      label.textContent?.trim()
    ),
  }))
  expect(nativeSemantics).toEqual({
    tagName: 'SELECT',
    explicitRole: null,
    labels: ['Relationship kind'],
  })

  await page.getByText('Relationship kind', { exact: true }).click()
  await expect(select).toBeFocused()
  await expect(select.locator('..').locator('[data-slot="native-select-icon"]')).toHaveAttribute(
    'aria-hidden',
    'true'
  )
})

test('keeps native controlled, uncontrolled, disabled and form behavior', async ({ page }) => {
  const controlled = page.getByRole('combobox', { name: 'Relationship kind', exact: true })
  const uncontrolled = page.getByRole('combobox', { name: 'Minimum confidence', exact: true })
  const disabled = page.getByRole('combobox', { name: 'Locked filter', exact: true })

  await expect(disabled).toBeDisabled()
  await expect(disabled).toHaveValue('locked')
  await expect(uncontrolled).toHaveValue('0.75')
  await uncontrolled.selectOption('0.9')
  await expect(uncontrolled).toHaveValue('0.9')
  await controlled.selectOption('explicit')
  await expect(controlled).toHaveValue('explicit')
  await expect(page.getByLabel('Selected relationship kind')).toHaveText('explicit')
  await expect(page.getByLabel('Relationship change count')).toHaveText('1')

  const formValues = await page.locator('#native-select-form').evaluate((element) => {
    const data = new FormData(element as HTMLFormElement)
    return {
      relationshipKind: data.get('relationshipKind'),
      minimumConfidence: data.get('minimumConfidence'),
      allowedOrigins: data.getAll('allowedOrigin'),
    }
  })
  expect(formValues).toEqual({
    relationshipKind: 'explicit',
    minimumConfidence: '0.9',
    allowedOrigins: ['explicit', 'derived'],
  })
})

test('restores uncontrolled single and multiple defaults with native form reset', async ({
  page,
}) => {
  const form = page.locator('#native-select-form')
  const single = page.getByRole('combobox', { name: 'Minimum confidence', exact: true })
  const multiple = page.getByRole('listbox', { name: 'Allowed origins', exact: true })

  await expect(single).toHaveValue('0.75')
  await expect(multiple).toHaveValues(['explicit', 'derived'])
  await single.selectOption('0.9')
  await multiple.selectOption(['derived'])
  await expect(single).toHaveValue('0.9')
  await expect(multiple).toHaveValues(['derived'])

  await form.evaluate((element) => (element as HTMLFormElement).reset())

  await expect(single).toHaveValue('0.75')
  await expect(multiple).toHaveValues(['explicit', 'derived'])
})
