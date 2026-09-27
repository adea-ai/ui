import { expect, test } from '@playwright/test'
import { resolve } from 'node:path'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'

type ImportOrder = 'root-first' | 'ui-first'

let scripts = new Map<ImportOrder, string>()
const packedRoot = process.env['ADEA_KOBALTE_OVERLAY_PACKED_ROOT']
const packedCondition = process.env['ADEA_KOBALTE_OVERLAY_PACKED_CONDITION']
const uiRoot = packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui')
const entries: Record<ImportOrder, string> = packedRoot
  ? {
      'root-first': resolve(packedRoot, 'kobalte-overlay-root-first.tsx'),
      'ui-first': resolve(packedRoot, 'kobalte-overlay-ui-first.tsx'),
    }
  : {
      'root-first': resolve(uiRoot, 'tests/fixtures/kobalte-overlay-root-first.tsx'),
      'ui-first': resolve(uiRoot, 'tests/fixtures/kobalte-overlay-ui-first.tsx'),
    }

if (packedRoot && packedCondition !== 'compiled' && packedCondition !== 'solid')
  throw new Error('Packed Kobalte overlay fixture requires an explicit browser condition')

test.beforeAll(async () => {
  for (const order of ['root-first', 'ui-first'] as const) {
    const result = await build({
      root: uiRoot,
      configFile: false,
      logLevel: 'error',
      plugins: [
        solid(),
        ...(packedRoot && packedCondition === 'compiled'
          ? [
              {
                name: 'compiled-kobalte-overlay-condition',
                enforce: 'post' as const,
                configEnvironment(_name: string, config: EnvironmentOptions) {
                  config.resolve ??= {}
                  config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                    (condition) => condition !== 'solid' && condition !== 'development'
                  )
                },
              },
            ]
          : []),
      ],
      resolve: packedRoot
        ? { conditions: packedCondition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
        : undefined,
      build: {
        write: false,
        minify: false,
        lib: {
          entry: entries[order],
          formats: ['iife'],
          name: order === 'root-first' ? 'KobalteOverlayRootFirst' : 'KobalteOverlayUiFirst',
        },
      },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs.flatMap((output) => ('output' in output ? output.output : []))
    const code = chunks
      .filter((asset) => asset.type === 'chunk')
      .map((asset) => asset.code)
      .join('\n')
    if (!code.includes('cmdkDialogRootImport'))
      throw new Error(`${order} fixture dropped the cmdk-solid package-root import`)
    if (packedRoot) {
      const modules = chunks
        .filter((asset) => asset.type === 'chunk')
        .flatMap((asset) => Object.keys(asset.modules))
        .filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
      const expected = packedCondition === 'compiled' ? '/dist/' : '/src/'
      if (!modules.length || modules.some((id) => !id.includes(expected)))
        throw new Error(`Packed Kobalte overlay selected the wrong ${packedCondition} condition`)
    }
    scripts.set(order, code)
  }
})

for (const order of ['root-first', 'ui-first'] as const) {
  test.describe(`Kobalte package-root import ${order}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setContent('<!doctype html><html lang="en"><body></body></html>')
      const script = scripts.get(order)
      if (!script) throw new Error(`No compiled fixture for ${order}`)
      await page.addScriptTag({ content: script })
    })

    test(`${order}: keeps a regular Dialog dismissible and restores its opener`, async ({
      page,
    }) => {
      const trigger = page.getByRole('button', { name: 'Open regular dialog' })
      await trigger.focus()
      await trigger.press('Enter')

      const dialog = page.getByRole('dialog', { name: 'Regular dialog title' })
      await expect(dialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    })

    test(`${order}: keeps a Sheet dismissible and restores its opener`, async ({ page }) => {
      const trigger = page.getByRole('button', { name: 'Open details sheet' })
      await trigger.focus()
      await trigger.press('Enter')

      const sheet = page.getByRole('dialog', { name: 'Details sheet title' })
      await expect(sheet).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(trigger).toBeFocused()
    })

    test(`${order}: keeps AlertDialog blocking Escape and restores focus after a choice`, async ({
      page,
    }) => {
      const trigger = page.getByRole('button', { name: 'Open confirmation' })
      await trigger.focus()
      await trigger.press('Enter')

      const alertDialog = page.getByRole('alertdialog', {
        name: 'Confirm irreversible action',
      })
      await expect(alertDialog).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(alertDialog).toBeVisible()
      await alertDialog.getByRole('button', { name: 'Keep item' }).click()
      await expect(alertDialog).toHaveCount(0)
      await expect(trigger).toBeFocused()
    })
  })
}
