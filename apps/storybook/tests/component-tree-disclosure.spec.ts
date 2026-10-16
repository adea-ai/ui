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

const treeRows = (page: Page, mode: Mode) =>
  page
    .locator(`#tree-${mode} [data-tree-id]`)
    .evaluateAll((rows) => rows.map((element) => element.getAttribute('data-tree-id')))
const tabStops = (page: Page, mode: Mode) =>
  page
    .locator(`#tree-${mode} [role="treeitem"][tabindex="0"]`)
    .evaluateAll((rows) => rows.map((element) => element.getAttribute('data-tree-id')))
/** The element that really holds focus: a row id, a tag name, or BODY. */
const focusOwner = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement
    return active?.getAttribute('data-tree-id') ?? active?.tagName ?? 'none'
  })
/** What the host does that `Tree` cannot see; see `HostControls` in the fixture. */
const host = (
  page: Page,
  mode: Mode,
  call: 'setExpanded' | 'setActiveId' | 'setToggleOnActivate',
  ...args: unknown[]
) =>
  page.evaluate(
    ({ target, name, values }) =>
      (
        window as unknown as {
          treeDisclosureHost: Record<string, Record<string, (...values: unknown[]) => void>>
        }
      ).treeDisclosureHost[target]![name]!(...values),
    { target: mode, name: call, values: args }
  )

/** How a collapse of `id` arrives: the chevron where there is one, the host otherwise. */
const collapse = async (page: Page, mode: Mode, id: string) => {
  if (mode === 'marker') await marker(page, mode, id).click()
  else await host(page, mode, 'setExpanded', id, false)
}

/**
 * Every key the tree handles, from the row that took focus after `sources` was
 * collapsed with `repo-a-hint` focused. `repo-a` is still expanded inside it.
 */
async function keysAfterRecovery(page: Page, mode: Mode) {
  const seen: Array<[string, string]> = []
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'End', 'Home']) {
    await page.keyboard.press(key)
    await expect(page.locator(`#tree-${mode} [data-tree-id]:focus`)).toHaveCount(1)
    seen.push([key, await focusOwner(page)])
  }
  await page.keyboard.press('Enter')
  await page.keyboard.press(' ')
  return { seen, tabStops: await tabStops(page, mode), log: (await logs(page, mode)).slice(3) }
}
const expectedKeys = {
  seen: [
    ['ArrowRight', 'sources'], // expands the recovered row
    ['ArrowDown', 'repo-a'],
    ['ArrowRight', 'repo-a-hint'], // repo-a kept its expansion
    ['ArrowLeft', 'repo-a'],
    ['End', 'notes'],
    ['Home', 'sources'],
  ],
  tabStops: ['sources'],
  log: [
    'expand:sources:true',
    'active:repo-a',
    'active:repo-a-hint',
    'active:repo-a',
    'active:notes',
    'active:sources',
    'activate:sources:keydown',
    'select:sources',
  ],
}

/**
 * Collapsing a row hides its whole subtree, and when that removes the row that
 * held focus `Tree` recovers it. The recovery is `Tree`'s existing behaviour and
 * identical in every mode; these specs pin what it really does so that docs/tree.md
 * can state it, and so the chevron (which never moves focus itself) is measured
 * against the same outcome as a host-driven or keyboard collapse.
 */
test.describe('collapsing an ancestor', () => {
  test('a collapsed row hides every descendant, not only its children', async ({ page }) => {
    for (const mode of modes) {
      // `repo-a` is expanded inside `sources`; its child is a grandchild of `sources`.
      expect(await treeRows(page, mode)).toEqual([
        'sources',
        'repo-a',
        'repo-a-hint',
        'repo-b',
        'notes',
      ])
      await row(page, mode, 'sources').focus()
      await page.keyboard.press('ArrowLeft')
      await expect(row(page, mode, 'sources')).toHaveAttribute('aria-expanded', 'false')
      expect(await treeRows(page, mode)).toEqual(['sources'])
      await expect(page.locator(`#tree-${mode} [data-tree-id="repo-a-hint"]`)).toHaveCount(0)

      // The inner folder kept its expansion, so the subtree comes back as it was.
      await page.keyboard.press('ArrowRight')
      expect(await treeRows(page, mode)).toEqual([
        'sources',
        'repo-a',
        'repo-a-hint',
        'repo-b',
        'notes',
      ])
      await expect(row(page, mode, 'repo-a')).toHaveAttribute('aria-expanded', 'true')
    }
  })

  test('the chevron hides the whole subtree of the row it collapses', async ({ page }) => {
    await marker(page, 'marker', 'sources').click()
    expect(await treeRows(page, 'marker')).toEqual(['sources'])
    await marker(page, 'marker', 'sources').click()
    expect(await treeRows(page, 'marker')).toEqual([
      'sources',
      'repo-a',
      'repo-a-hint',
      'repo-b',
      'notes',
    ])
  })

  test('Left up a branch never hides the focused row, and focus stays on the row Left acts on', async ({
    page,
  }) => {
    const steps = [
      // key, focused row, tab stops, rows left in the tree
      ['ArrowLeft', 'repo-a', ['repo-a'], 5], // hint -> its parent
      ['ArrowLeft', 'repo-a', ['repo-a'], 4], // collapse repo-a; its hint goes
      ['ArrowLeft', 'sources', ['sources'], 4], // up to the parent
      ['ArrowLeft', 'sources', ['sources'], 1], // collapse sources; the rest goes
    ] as const
    for (const mode of modes) {
      await row(page, mode, 'repo-a-hint').focus()
      for (const [key, focused, stops, rows] of steps) {
        await page.keyboard.press(key)
        await expect(row(page, mode, focused)).toBeFocused()
        expect(await tabStops(page, mode)).toEqual(stops)
        expect(await treeRows(page, mode)).toHaveLength(rows)
      }
      expect(await logs(page, mode)).toEqual([
        'active:repo-a-hint',
        'active:repo-a',
        'expand:repo-a:false',
        'active:sources',
        'expand:sources:false',
      ])
    }
  })

  test('marker: the chevron on an ancestor of the focused row lands focus on the first visible row', async ({
    page,
  }) => {
    await row(page, 'marker', 'repo-a-hint').focus()
    await marker(page, 'marker', 'sources').click()

    expect(await treeRows(page, 'marker')).toEqual(['sources'])
    await expect(row(page, 'marker', 'sources')).toBeFocused()
    expect(await focusOwner(page)).toBe('sources')
    expect(await tabStops(page, 'marker')).toEqual(['sources'])
    await expect(row(page, 'marker', 'sources')).toHaveAttribute('tabindex', '0')
    expect(await logs(page, 'marker')).toEqual([
      'active:repo-a-hint',
      'expand:sources:false',
      'active:sources',
    ])
    // `onActiveIdChange` named only the row that was focused and the row that took over.
    const calls = await activeCalls(page, 'marker')
    expect(new Set(calls)).toEqual(new Set(['repo-a-hint', 'sources']))
    expect(calls.at(-1)).toBe('sources')

    // And the keyboard works from there.
    expect(await keysAfterRecovery(page, 'marker')).toEqual(expectedKeys)
  })

  test('marker: the chevron on the parent of the focused row lands focus on the first visible row, not on that parent', async ({
    page,
  }) => {
    await row(page, 'marker', 'repo-a-hint').focus()
    await marker(page, 'marker', 'repo-a').click()

    expect(await treeRows(page, 'marker')).toEqual(['sources', 'repo-a', 'repo-b', 'notes'])
    await expect(row(page, 'marker', 'sources')).toBeFocused()
    expect(await tabStops(page, 'marker')).toEqual(['sources'])
    await expect(row(page, 'marker', 'repo-a')).toHaveAttribute('tabindex', '-1')
    expect(await logs(page, 'marker')).toEqual([
      'active:repo-a-hint',
      'expand:repo-a:false',
      'active:sources',
    ])
  })

  for (const mode of ['omitted', 'row'] as const) {
    test(`${mode}: a host collapse of an ancestor recovers focus the same way`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()
      await host(page, mode, 'setExpanded', 'sources', false)

      expect(await treeRows(page, mode)).toEqual(['sources'])
      await expect(row(page, mode, 'sources')).toBeFocused()
      expect(await tabStops(page, mode)).toEqual(['sources'])
      expect(await logs(page, mode)).toEqual([
        'active:repo-a-hint',
        'host-expand:sources:false',
        'active:sources',
      ])
      const calls = await activeCalls(page, mode)
      expect(new Set(calls)).toEqual(new Set(['repo-a-hint', 'sources']))
      expect(calls.at(-1)).toBe('sources')
      expect(await keysAfterRecovery(page, mode)).toEqual(expectedKeys)
    })

    test(`${mode}: a click on an ancestor's chevron focuses that ancestor, then the host collapses it`, async ({
      page,
    }) => {
      // The file-explorer convention: onActivate toggles the folder. The chevron is
      // part of the row here, so the press focuses the row (default mode only).
      await host(page, mode, 'setToggleOnActivate', true)
      await row(page, mode, 'repo-a-hint').focus()
      await marker(page, mode, 'sources').click()

      expect(await treeRows(page, mode)).toEqual(['sources'])
      await expect(row(page, mode, 'sources')).toBeFocused()
      expect(await tabStops(page, mode)).toEqual(['sources'])
      expect(await logs(page, mode)).toEqual([
        'active:repo-a-hint',
        'active:sources',
        'activate:sources:click',
        'toggle:sources:false',
      ])
    })
  }

  test('the roving stop moves to the first visible row without taking focus', async ({ page }) => {
    for (const mode of modes) {
      await host(page, mode, 'setActiveId', 'repo-a-hint')
      expect(await tabStops(page, mode)).toEqual(['repo-a-hint'])
      expect(await focusOwner(page)).toBe('BODY')

      await collapse(page, mode, 'sources')
      await expect(row(page, mode, 'sources')).toHaveAttribute('tabindex', '0')
      expect(await tabStops(page, mode)).toEqual(['sources'])
      expect(await focusOwner(page)).toBe('BODY')
      expect((await activeCalls(page, mode)).at(-1)).toBe('sources')
      expect((await logs(page, mode)).filter((entry) => entry.startsWith('active:'))).toEqual([
        'active:sources',
      ])
    }
  })

  test('marker: a chevron press that hides no focused row leaves focus in a control outside the tree', async ({
    page,
  }) => {
    await row(page, 'marker', 'repo-a').focus()
    await page.locator('#outside').focus()
    await marker(page, 'marker', 'repo-b').click()

    expect(await treeRows(page, 'marker')).toContain('repo-b-hint')
    expect(await focusOwner(page)).toBe('INPUT')
    expect(await tabStops(page, 'marker')).toEqual(['repo-a'])
    expect(await logs(page, 'marker')).toEqual(['active:repo-a', 'expand:repo-b:true'])
  })

  // Focus that has gone to a control outside the tree is not pulled back when the
  // last row the tree saw focused is hidden. Only the roving stop moves. This holds
  // with the prop omitted, as it does for `row` and `marker`.
  for (const mode of ['marker', 'omitted'] as const) {
    test(`${mode}: hiding the last-focused row leaves focus in a control outside the tree`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()
      await page.locator('#outside').focus()
      expect(await focusOwner(page)).toBe('INPUT')

      await collapse(page, mode, 'sources')

      expect(await focusOwner(page)).toBe('INPUT')
      expect(await tabStops(page, mode)).toEqual(['sources'])
      expect((await activeCalls(page, mode)).at(-1)).toBe('sources')
    })

    test(`${mode}: the outside control keeps focus when it is reached by a pointer press`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()
      await page.locator('#outside').click()

      await collapse(page, mode, 'sources')

      expect(await focusOwner(page)).toBe('INPUT')
      expect(await tabStops(page, mode)).toEqual(['sources'])
    })

    test(`${mode}: focus that fell to the body when the row was removed still recovers into the tree`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()
      await page.evaluate(() => (document.activeElement as HTMLElement).blur())
      expect(await focusOwner(page)).toBe('BODY')

      await collapse(page, mode, 'sources')

      await expect(row(page, mode, 'sources')).toBeFocused()
      expect(await tabStops(page, mode)).toEqual(['sources'])
    })

    test(`${mode}: focus handed to an outside control in the same turn the row is hidden is not reclaimed`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()

      // The host hides the focused row and focus goes to a control outside the tree
      // before any queued recovery has run.
      await page.evaluate((m) => {
        window.treeDisclosureHost[m]!.setExpanded('repo-a', false)
        document.getElementById('outside')!.focus()
      }, mode)
      await page.evaluate(() => new Promise<void>((done) => setTimeout(done, 50)))

      expect(await focusOwner(page)).toBe('INPUT')
      expect(await tabStops(page, mode)).toEqual(['sources'])
    })

    test(`${mode}: moving focus out of the tree forgets the last row, so a later hide does not reclaim focus`, async ({
      page,
    }) => {
      await row(page, mode, 'repo-a-hint').focus()
      await page.locator('#outside').focus()
      await page.evaluate(() => (document.activeElement as HTMLElement).blur())
      expect(await focusOwner(page)).toBe('BODY')

      await collapse(page, mode, 'sources')

      expect(await focusOwner(page)).toBe('BODY')
      expect(await tabStops(page, mode)).toEqual(['sources'])
    })
  }
})
