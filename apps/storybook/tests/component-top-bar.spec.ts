import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { resolve } from 'node:path'
import { build } from 'vite'
import solid from 'vite-plugin-solid'
import tailwindcss from '@tailwindcss/vite'

let script: string
let css: string
test.beforeAll(async () => {
  const packedRoot = process.env['ADEA_TOPBAR_PACKED_ROOT']
  const condition = process.env['ADEA_TOPBAR_PACKED_CONDITION']
  if (packedRoot && condition !== 'compiled' && condition !== 'solid')
    throw new Error('Packed toolbar requires an explicit browser condition')
  const result = await build({
    root: packedRoot ?? resolve(import.meta.dirname, '../../../packages/ui'),
    configFile: false,
    logLevel: 'error',
    plugins: [
      solid(),
      tailwindcss(),
      ...(packedRoot && condition === 'compiled'
        ? [
            {
              name: 'compiled-toolbar-condition',
              enforce: 'post' as const,
              configEnvironment(_name: string, config: import('vite').EnvironmentOptions) {
                config.resolve ??= {}
                config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                  (value) => value !== 'solid' && value !== 'development'
                )
              },
            },
          ]
        : []),
    ],
    resolve: packedRoot
      ? { conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'] }
      : undefined,
    build: {
      write: false,
      minify: false,
      lib: {
        entry: packedRoot
          ? resolve(packedRoot, 'topbar.tsx')
          : resolve(import.meta.dirname, '../../../packages/ui/tests/fixtures/top-bar.tsx'),
        formats: ['iife'],
        name: 'TopBarFixture',
      },
    },
  })
  const assets = (Array.isArray(result) ? result : [result]).flatMap((output) =>
    'output' in output ? output.output : []
  )
  if (packedRoot) {
    const modules = assets.flatMap((asset) =>
      asset.type === 'chunk'
        ? Object.entries(asset.modules)
            .filter(([, data]) => data.renderedLength > 0)
            .map(([id]) => id)
        : []
    )
    const ui = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    const expected = condition === 'compiled' ? '/dist/' : '/src/'
    if (!ui.length || !ui.every((id) => id.includes(expected)))
      throw new Error('Toolbar export conditions mixed or missing')
  }
  script = assets.flatMap((asset) => (asset.type === 'chunk' ? [asset.code] : [])).join('\n')
  css = assets
    .flatMap((asset) =>
      asset.type === 'asset' && asset.fileName.endsWith('.css') ? [String(asset.source)] : []
    )
    .join('\n')
})

test('toolbar actions remain reachable without document overflow at narrow widths and enlarged text', async ({
  page,
}) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Toolbar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const toolbar = page.locator('[data-slot="top-bar"][aria-label="Workspace toolbar"]')
  const titleOnlyToolbar = page.locator('[data-slot="top-bar"][aria-label="Title-only toolbar"]')
  const search = toolbar.getByRole('button', {
    name: 'Search projects, files and sessions',
    exact: true,
  })
  const tabKey =
    test.info().project.name === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
  await expect(titleOnlyToolbar).toBeVisible()
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    for (const factor of [1, 2]) {
      await page.evaluate((scale) => {
        document.documentElement.style.fontSize = `${16 * scale}px`
      }, factor)
      // The first sample can land before the fixture's initial layout has
      // settled and report a transient frame; measure the settled document,
      // so a genuine overflow still fails once the timeout elapses.
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true)
      if (width < 768) {
        const middleTrack = await titleOnlyToolbar.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).gridTemplateColumns.split(' ')[1]!)
        )
        expect(
          middleTrack,
          `${width}px title-only middle track should collapse`
        ).toBeLessThanOrEqual(1)
      }
      const searchBounds = await search.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const controlHeight = Number.parseFloat(getComputedStyle(element).height)
        const parent = element.closest('[data-slot="top-bar"]')!.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          controlHeight,
          parentLeft: parent.left,
          parentRight: parent.right,
        }
      })
      expect(searchBounds.left).toBeGreaterThanOrEqual(searchBounds.parentLeft - 1)
      expect(searchBounds.right).toBeLessThanOrEqual(searchBounds.parentRight + 1)
      expect(searchBounds.width).toBeGreaterThanOrEqual(searchBounds.controlHeight - 1)
      const buttons = toolbar.getByRole('button')
      await buttons.first().focus()
      for (let index = 0; index < (await buttons.count()); index++) {
        const button = buttons.nth(index)
        await expect(button).toBeFocused()
        const visibility = await button.evaluate((element) => {
          const parent =
            element.closest('[data-slot="top-bar-section"]') ??
            element.closest('[data-slot="top-bar"]')!
          const control = element.getBoundingClientRect()
          const viewport = parent.getBoundingClientRect()
          return {
            visible: control.left >= viewport.left - 1 && control.right <= viewport.right + 1,
            controlLeft: control.left,
            controlRight: control.right,
            viewportLeft: viewport.left,
            viewportRight: viewport.right,
            scrollLeft: (parent as HTMLElement).scrollLeft,
            scrollWidth: (parent as HTMLElement).scrollWidth,
          }
        })
        expect(
          visibility.visible,
          `${width}px at ${factor}x text: ${await button.getAttribute('aria-label')} should be within its scroll container (${JSON.stringify(visibility)})`
        ).toBe(true)
        if (
          width <= 390 &&
          factor === 2 &&
          (await button.getAttribute('aria-label')) === 'Agents'
        ) {
          const tooltip = page.getByRole('tooltip')
          await page.mouse.move(0, 0)
          await button.hover()
          await expect(button).toBeFocused()
          await expect(tooltip).toBeVisible()
          const tooltipBounds = await tooltip.boundingBox()
          expect(tooltipBounds, 'focused action tooltip should have visible bounds').not.toBeNull()
          expect(tooltipBounds!.x).toBeGreaterThanOrEqual(0)
          expect(tooltipBounds!.x + tooltipBounds!.width).toBeLessThanOrEqual(width)
          const actionBounds = (await button.boundingBox())!
          const tooltipStyle = await tooltip.evaluate((element) => ({
            className: element.className,
          }))
          expect(tooltipStyle.className).toContain('bg-card')
          expect(tooltipStyle.className).toContain('text-card-foreground')
          expect(tooltipStyle.className).toContain('text-sm')
          expect(tooltipStyle.className).toContain('font-medium')
          expect(tooltipBounds!.y).toBeGreaterThanOrEqual(actionBounds.y + actionBounds.height)
          const tooltipId = await tooltip.getAttribute('id')
          expect(tooltipId).toBeTruthy()
          expect((await button.getAttribute('aria-describedby'))?.split(/\s+/)).toContain(tooltipId)
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
                .analyze()
            ).violations
          ).toEqual([])
        }
        await page.keyboard.press('Enter')
        // The search button has no aria-label on purpose: its name is the
        // placeholder span, which is exactly what the fixture records.
        const firedLabel =
          (await button.getAttribute('aria-label')) ??
          (await button.locator('span').first().textContent())!
        await expect(page.locator('output')).toHaveText(firedLabel)
        if (index < (await buttons.count()) - 1) await page.keyboard.press(tabKey)
      }
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      })
      await page.mouse.move(0, 0)
      // Count, not visibility: a tooltip caught mid exit-animation still
      // matches the role, and a strict locator would trip over two of them.
      await expect(page.getByRole('tooltip')).toHaveCount(0)
    }
  }
  // The role count drops as soon as the closed tooltip flips aria-hidden, but
  // the still-mounted node composites its text at partial opacity through the
  // exit animation and axe still audits it. Scan only once it has unmounted.
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll('[role="tooltip"]').length))
    .toBe(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('the search chord stays out of the button accessible name', async ({ page }) => {
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Toolbar</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })

  // The name is the placeholder alone; the drawn ⌘K chip is aria-hidden and the
  // parseable chord lives on aria-keyshortcuts — the same contract as the menu
  // items. A name that reads "… sessions ⌘K" is the regression this guards.
  const search = page.locator('[data-slot="top-bar-search"]')
  await expect(search).toHaveAccessibleName('Search projects, files and sessions')
  await expect(search).toHaveAttribute('aria-keyshortcuts', 'Meta+K')
  await expect(search.locator('kbd')).toHaveAttribute('aria-hidden', 'true')
})

test('top-bar action tooltips stay below and center when space allows at 200% text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Toolbar tooltip</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  const edgeAction = page.getByRole('button', { name: 'Back', exact: true })
  await edgeAction.hover()
  const edgeTooltip = page.getByRole('tooltip', { name: 'Back', exact: true })
  await expect(edgeTooltip).toBeVisible()
  const edgeActionBounds = (await edgeAction.boundingBox())!
  const edgeTooltipBounds = (await edgeTooltip.boundingBox())!
  expect(edgeTooltipBounds.x).toBeGreaterThanOrEqual(0)
  expect(edgeTooltipBounds.x + edgeTooltipBounds.width).toBeLessThanOrEqual(1280)
  expect(edgeTooltipBounds.y).toBeGreaterThanOrEqual(edgeActionBounds.y + edgeActionBounds.height)
  await page.mouse.move(0, 0)
  await expect(edgeTooltip).toHaveCount(0)

  const action = page.getByRole('button', { name: 'Files', exact: true })
  await action.hover()
  const tooltip = page.getByRole('tooltip', { name: 'Files', exact: true })
  await expect(tooltip).toBeVisible()
  const actionBounds = (await action.boundingBox())!
  const tooltipBounds = (await tooltip.boundingBox())!
  const style = await tooltip.evaluate((element) => ({
    className: element.className,
    font: getComputedStyle(element).fontFamily,
    color: getComputedStyle(element).color,
  }))
  expect(style.className).toContain('bg-card')
  expect(style.className).toContain('text-card-foreground')
  expect(style.className).toContain('text-sm')
  expect(style.className).toContain('font-medium')
  expect(tooltipBounds.y).toBeGreaterThanOrEqual(actionBounds.y + actionBounds.height)
  expect(tooltipBounds.x + tooltipBounds.width / 2).toBeCloseTo(
    actionBounds.x + actionBounds.width / 2,
    0
  )
  expect(style.font).toBeTruthy()
  expect(style.color).not.toBe('rgba(0, 0, 0, 0)')
})
