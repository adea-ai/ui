import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { bundleFixture } from './fixture-bundle'

/**
 * Tree `disclosure="marker"`: the chevron becomes a pointer target and nothing
 * else about the tree changes.
 *
 * Three identical trees are mounted on one page: the prop omitted (what every
 * existing consumer renders), `disclosure="row"`, and `disclosure="marker"`.
 * The baseline text file is the omitted tree's serialised DOM captured from the
 * commit before the prop existed, so "unchanged" is measured against the old
 * implementation rather than against itself.
 */
declare global {
  interface Window {
    treeDisclosureLogs: Record<string, string[]>
  }
}

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await bundleFixture('tree-disclosure'))
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><title>Tree disclosure</title></head><body></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
})

type Mode = 'omitted' | 'row' | 'marker'
const modes: readonly Mode[] = ['omitted', 'row', 'marker']

const row = (page: Page, mode: Mode, id: string) =>
  page.locator(`#tree-${mode} [data-tree-id="${id}"]`)
const marker = (page: Page, mode: Mode, id: string) => row(page, mode, id).locator('> span').first()
const logs = (page: Page, mode: Mode) => page.evaluate((m) => window.treeDisclosureLogs[m]!, mode)
/** Every `onActiveIdChange` call, including repeats for the row that is already active. */
const activeCalls = (page: Page, mode: Mode) =>
  page.evaluate((m) => window.treeDisclosureLogs[`${m}:active-calls`] ?? [], mode)

/** Serialise a tree the way the baseline was: one tag per line, unique ids neutralised. */
async function serialise(page: Page, mode: Mode): Promise<string> {
  const html = await page.locator(`#tree-${mode}`).evaluate((element) => element.outerHTML)
  return (
    html
      .replace(/cl-\d+/g, 'cl-N')
      .replace(`id="tree-${mode}"`, 'id="tree-omitted"')
      .replace(`aria-label="Sources ${mode}"`, 'aria-label="Sources omitted"')
      .replaceAll('><', '>\n<') + '\n'
  )
}

const baseline = readFileSync(
  resolve(import.meta.dirname, 'component-tree-disclosure.baseline.txt'),
  'utf8'
)

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
}

test.describe('existing consumers are unchanged', () => {
  for (const mode of ['omitted', 'row'] as const) {
    test(`${mode}: the DOM, classes and ARIA match the pre-change serialisation`, async ({
      page,
    }) => {
      expect(await serialise(page, mode)).toBe(baseline)
    })
  }

  test('marker mode adds only the disclosure slot, hit-area classes and nothing else', async ({
    page,
  }) => {
    const stripped = (await serialise(page, 'marker'))
      .replaceAll(' data-slot="tree-row-disclosure"', '')
      .replaceAll(
        ' relative w-3.5 cursor-pointer self-stretch hover:text-foreground after:absolute after:inset-y-0 after:-inset-x-1.5',
        ''
      )
      .replaceAll(
        'class="flex shrink-0 items-center justify-center',
        'class="flex size-3.5 shrink-0 items-center justify-center'
      )
    // The expandable rows (sources, repo-a, repo-b) are the only ones that differ.
    expect(stripped).toBe(baseline)
    expect((await serialise(page, 'marker')).split('tree-row-disclosure').length - 1).toBe(3)
  })

  test('with the prop omitted, a click on the chevron still activates and does not expand', async ({
    page,
  }) => {
    const { x, y } = await center(marker(page, 'omitted', 'repo-b'))
    await page.mouse.click(x, y)
    expect(await logs(page, 'omitted')).toEqual(['active:repo-b', 'activate:repo-b:click'])
  })
})

test.describe('pointer', () => {
  test('the chevron expands and collapses without activating, selecting or moving focus', async ({
    page,
  }) => {
    // Keyboard focus is on another row; pressing a chevron must leave it there.
    await row(page, 'marker', 'repo-a').focus()
    await expect(row(page, 'marker', 'repo-a')).toBeFocused()
    expect(await logs(page, 'marker')).toEqual(['active:repo-a'])

    const callsBefore = await activeCalls(page, 'marker')
    let target = await center(marker(page, 'marker', 'repo-b'))
    await page.mouse.click(target.x, target.y)
    await expect(row(page, 'marker', 'repo-b-hint')).toBeVisible()
    await expect(row(page, 'marker', 'repo-b')).toHaveAttribute('aria-expanded', 'true')

    target = await center(marker(page, 'marker', 'repo-b'))
    await page.mouse.click(target.x, target.y)
    await expect(row(page, 'marker', 'repo-b-hint')).toHaveCount(0)

    expect(await logs(page, 'marker')).toEqual([
      'active:repo-a',
      'expand:repo-b:true',
      'expand:repo-b:false',
    ])
    // `Tree` re-notifies the current row when the projection changes (keyboard
    // expansion does too); the chevron must never name any other row.
    expect(new Set(await activeCalls(page, 'marker'))).toEqual(new Set(callsBefore))
    await expect(row(page, 'marker', 'repo-a')).toBeFocused()
    await expect(row(page, 'marker', 'repo-a')).toHaveAttribute('tabindex', '0')
    await expect(row(page, 'marker', 'repo-b')).toHaveAttribute('tabindex', '-1')
    // Nothing was selected.
    await expect(page.locator('#tree-marker [aria-selected="true"]')).toHaveCount(0)
  })

  test('the chevron works when nothing in the tree had focus, and still leaves focus alone', async ({
    page,
  }) => {
    const target = await center(marker(page, 'marker', 'repo-a'))
    await page.mouse.click(target.x, target.y)
    expect(await logs(page, 'marker')).toEqual(['expand:repo-a:false'])
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  })

  test('the rest of the row activates exactly as before and does not expand', async ({ page }) => {
    for (const label of ['Repository B']) {
      await page.locator('#tree-marker').getByText(label, { exact: true }).click()
    }
    expect(await logs(page, 'marker')).toEqual(['active:repo-b', 'activate:repo-b:click'])
    await expect(row(page, 'marker', 'repo-b')).toHaveAttribute('aria-expanded', 'false')
    await expect(row(page, 'marker', 'repo-b')).toBeFocused()
    await expect(row(page, 'marker', 'repo-b')).toHaveAttribute('aria-selected', 'true')
  })

  test('the hit area extends past the glyph but stops before the leading icon', async ({
    page,
  }) => {
    const { y, box } = await center(marker(page, 'marker', 'repo-b'))
    // 5px to either side of the 14px glyph is inside the 26px target.
    await page.mouse.click(box.x - 5, y)
    await page.mouse.click(box.x + box.width + 5, y)
    expect(await logs(page, 'marker')).toEqual(['expand:repo-b:true', 'expand:repo-b:false'])
    // 7px past the glyph is the leading icon, which is the row.
    await page.mouse.click(box.x + box.width + 7, y)
    expect(await logs(page, 'marker')).toEqual([
      'expand:repo-b:true',
      'expand:repo-b:false',
      'active:repo-b',
      'activate:repo-b:click',
    ])
    const rowBox = (await row(page, 'marker', 'repo-b').boundingBox())!
    const sizes = await marker(page, 'marker', 'repo-b').evaluate((element) => {
      const after = getComputedStyle(element, '::after')
      return { width: after.width, height: after.height }
    })
    expect(Number.parseFloat(sizes.width)).toBeGreaterThanOrEqual(24)
    // The full row height, so it follows density and never reaches a neighbour.
    expect(Number.parseFloat(sizes.height)).toBeCloseTo(rowBox.height, 0)
  })

  test('a leaf row has no marker target: the same spot is an ordinary row click', async ({
    page,
  }) => {
    await expect(marker(page, 'marker', 'notes')).not.toHaveAttribute('data-slot', /.+/)
    const { x, y } = await center(marker(page, 'marker', 'notes'))
    await page.mouse.click(x, y)
    expect(await logs(page, 'marker')).toEqual(['active:notes', 'activate:notes:click'])
  })

  test('double-clicking a chevron toggles twice and never reaches onDoubleClick', async ({
    page,
  }) => {
    const { x, y } = await center(marker(page, 'marker', 'repo-b'))
    await page.mouse.dblclick(x, y)
    expect(await logs(page, 'marker')).toEqual(['expand:repo-b:true', 'expand:repo-b:false'])
    await page.locator('#tree-marker').getByText('Repository B', { exact: true }).dblclick()
    expect(await logs(page, 'marker')).toContain('dblclick:repo-b')
  })

  for (const mode of modes) {
    test(`${mode}: trailing controls do not activate the row`, async ({ page }) => {
      const button = page
        .locator(`#tree-${mode}`)
        .getByRole('button', { name: 'Rename Repository A' })
      await button.click()
      const switchControl = page.locator(`#tree-${mode} [data-slot="switch"] > div`)
      await switchControl.click()
      const entries = await logs(page, mode)
      // Pressing the switch's non-focusable control still lands the roving stop on
      // its row (pre-existing); it must not activate or select it.
      expect(entries.filter((entry) => !entry.startsWith('active:'))).toEqual([
        'action:rename',
        'switch:true',
      ])
      await expect(page.locator(`#tree-${mode} [aria-selected="true"]`)).toHaveCount(0)
    })
  }
})

test.describe('keyboard', () => {
  // Every key the tree handles, on rows of each kind, ending with the activating keys.
  const sequence = [
    'ArrowDown', // repo-a
    'ArrowLeft', // collapse repo-a
    'ArrowRight', // expand repo-a
    'ArrowRight', // into repo-a-hint
    'ArrowLeft', // back to repo-a
    'ArrowDown', // repo-a-hint
    'ArrowDown', // repo-b
    'Enter', // activate, must not expand
    'Space', // select, must not expand
    'ArrowRight', // expand repo-b
    'End', // notes
    'Enter',
    'ArrowDown', // wraps to sources
    'ArrowLeft', // collapse sources
    'Home',
    'ArrowRight', // expand sources
  ] as const

  const expected = [
    'active:repo-a',
    'expand:repo-a:false',
    'expand:repo-a:true',
    'active:repo-a-hint',
    'active:repo-a',
    'active:repo-a-hint',
    'active:repo-b',
    'activate:repo-b:keydown',
    'select:repo-b',
    'expand:repo-b:true',
    'active:notes',
    'activate:notes:keydown',
    'active:sources',
    'expand:sources:false',
    'expand:sources:true',
  ]

  async function run(page: Page, mode: Mode) {
    await row(page, mode, 'sources').focus()
    for (const key of sequence) await page.keyboard.press(key === 'Space' ? ' ' : key)
    return {
      log: await logs(page, mode),
      activeCalls: (await activeCalls(page, mode)).length,
      focused: await page.evaluate(() => document.activeElement?.getAttribute('data-tree-id')),
      tabStops: await page
        .locator(`#tree-${mode} [role="treeitem"][tabindex="0"]`)
        .evaluateAll((rows) => rows.map((element) => element.getAttribute('data-tree-id'))),
    }
  }

  test('the same keys do the same thing with the prop omitted, row and marker', async ({
    page,
  }) => {
    const results = {} as Record<Mode, Awaited<ReturnType<typeof run>>>
    for (const mode of modes) results[mode] = await run(page, mode)

    expect(results.omitted.log).toEqual(expected)
    expect(results.row).toEqual(results.omitted)
    expect(results.marker).toEqual(results.omitted)
    expect(results.marker.tabStops).toHaveLength(1)
  })

  test('Enter and Space on a collapsed row activate and select; they do not toggle', async ({
    page,
  }) => {
    await row(page, 'marker', 'repo-b').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press(' ')
    expect(await logs(page, 'marker')).toEqual([
      'active:repo-b',
      'activate:repo-b:keydown',
      'select:repo-b',
    ])
    await expect(row(page, 'marker', 'repo-b')).toHaveAttribute('aria-expanded', 'false')
  })

  test('Left and Right still expand and collapse after a pointer toggle', async ({ page }) => {
    const { x, y } = await center(marker(page, 'marker', 'repo-b'))
    await page.mouse.click(x, y)
    await row(page, 'marker', 'repo-b').focus()
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowRight')
    expect(await logs(page, 'marker')).toEqual([
      'expand:repo-b:true',
      'active:repo-b',
      'expand:repo-b:false',
      'expand:repo-b:true',
    ])
  })

  test('the marker is not a tab stop, not focusable and stays aria-hidden', async ({ page }) => {
    const stops: string[] = []
    await row(page, 'marker', 'sources').focus()
    for (let step = 0; step < 6; step += 1) {
      stops.push(
        await page.evaluate(() => {
          const active = document.activeElement
          return (
            active?.getAttribute('data-tree-id') ??
            active?.getAttribute('aria-label') ??
            active?.tagName ??
            'none'
          )
        })
      )
      await page.keyboard.press('Tab')
    }
    // Row (the single roving stop), then the two trailing controls, then out of the tree.
    expect(stops.slice(0, 3)).toEqual(['sources', 'Use Repository A', 'Rename Repository A'])

    for (const id of ['sources', 'repo-a', 'repo-b']) {
      const target = marker(page, 'marker', id)
      await expect(target).not.toHaveAttribute('tabindex', /.*/)
      await expect(target).not.toHaveAttribute('role', /.*/)
      expect(await target.evaluate((element) => element.querySelector('[tabindex]'))).toBeNull()
      await expect(target.locator('svg')).toHaveAttribute('aria-hidden', 'true')
    }
    await expect(page.locator('#tree-marker [role="treeitem"][tabindex="0"]')).toHaveCount(1)
  })
})
