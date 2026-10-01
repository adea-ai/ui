import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { buildListRowBrowser } from './list-row-assets'

let script: string
let css: string

test.beforeAll(async () => {
  ;({ script, css } = await buildListRowBrowser())
})

async function mount(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 })
  await page.setContent(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>List row fixture</title></head><body><div id="list-row-root"></div></body></html>'
  )
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  return page.getByTestId('long-description-row')
}

async function geometry(row: import('@playwright/test').Locator) {
  return row.evaluate((element) => {
    const description = element.querySelector('[data-slot="list-row-description"]')
    const content = element.querySelector('[data-slot="list-row-label"]')
    const leading = element.querySelector('[data-slot="list-row-leading"]')
    const trailing = element.querySelector('[data-slot="list-row-trailing"]')
    const buttons = [...element.querySelectorAll('button')]
    if (!description || !content || !leading || !trailing || buttons.length !== 4)
      throw new Error('ListRow fixture slots were not rendered')

    const rowBox = element.getBoundingClientRect()
    const descriptionBox = description.getBoundingClientRect()
    const contentBox = content.getBoundingClientRect()
    const leadingBox = leading.getBoundingClientRect()
    const trailingChildBoxes = [...trailing.children].map((child) => child.getBoundingClientRect())
    const lineHeight = Number.parseFloat(getComputedStyle(description).lineHeight)
    return {
      contentWidth: contentBox.width,
      descriptionHeight: descriptionBox.height,
      descriptionLineHeight: lineHeight,
      descriptionWidth: descriptionBox.width,
      contentTop: contentBox.top,
      leadingBottom: leadingBox.bottom,
      leadingRight: leadingBox.right,
      contentLeft: contentBox.left,
      rowHeight: rowBox.height,
      controlsContained: trailingChildBoxes.every(
        (box) =>
          box.left >= rowBox.left - 1 &&
          box.right <= rowBox.right + 1 &&
          box.top >= rowBox.top - 1 &&
          box.bottom <= rowBox.bottom + 1
      ),
    }
  })
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze()
  expect(results.violations).toEqual([])
}

function navigationKey(browserName: string) {
  // macOS WebKit follows the system preference to skip buttons on Tab.
  return browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
}

test('action-heavy description rows preserve readable text and contained controls at narrow widths and 200% text', async ({
  page,
}) => {
  for (const width of [390, 320]) {
    for (const scale of [1, 2]) {
      const row = await mount(page, width)
      if (scale === 2)
        await page.evaluate(() => {
          document.documentElement.style.fontSize = '200%'
        })
      const measured = await geometry(row)
      expect(measured.contentWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(80)
      expect(measured.descriptionWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(80)
      expect(measured.descriptionHeight).toBeGreaterThan(measured.descriptionLineHeight)
      expect(measured.rowHeight).toBeGreaterThanOrEqual(36)
      expect(
        measured.leadingRight <= measured.contentLeft ||
          measured.contentTop >= measured.leadingBottom,
        JSON.stringify(measured)
      ).toBe(true)
      expect(measured.controlsContained, JSON.stringify(measured)).toBe(true)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true)
      await expectAccessible(page)
    }
  }
})

test('preserves native button and link semantics, refs, events, and keyboard tooltips', async ({
  page,
  browserName,
}) => {
  await mount(page, 640)
  const button = page.getByRole('button', { name: 'Open report' })
  const link = page.getByRole('link', { name: 'Details' })
  const defaultAction = page.getByRole('button', { name: 'Run action' })
  const explicitNegative = page.getByRole('button', { name: 'Skip tab order' })
  const staticRow = page.getByText('Static row')

  await expect(button).toHaveAttribute('tabindex', '0')
  await expect(link).toHaveAttribute('tabindex', '0')
  await expect(defaultAction).toHaveAttribute('tabindex', '0')
  await expect(explicitNegative).toHaveAttribute('tabindex', '-1')
  await expect(staticRow).not.toHaveAttribute('tabindex')
  await expect(page.locator('[aria-label="Static row"]')).toHaveAttribute(
    'aria-describedby',
    'static-row-help'
  )
  await expect(button).toHaveAttribute('type', 'button')
  await expect(link).toHaveAttribute('href', '#details')
  await expect(defaultAction).toHaveAttribute('type', 'button')
  await expect(page.getByLabel('Forwarded ref')).toHaveText('BUTTON')

  await page.setViewportSize({ width: 640, height: 1400 })
  await button.evaluate((trigger) => {
    const events: Record<string, string | number | null>[] = []
    const trackedEvents = [
      'pointermove',
      'pointerenter',
      'pointerleave',
      'pointerover',
      'pointerout',
      'mouseenter',
      'mouseleave',
      'mouseover',
      'mouseout',
      'focus',
      'focusin',
      'blur',
      'focusout',
      'keydown',
      'keyup',
      'scroll',
    ]
    document.documentElement.dataset['listRowEventTrace'] = '[]'
    for (const type of trackedEvents) {
      document.addEventListener(
        type,
        (event) => {
          const pointer = event instanceof PointerEvent ? event : undefined
          const keyboard = event instanceof KeyboardEvent ? event : undefined
          const relatedTarget =
            'relatedTarget' in event && event.relatedTarget instanceof HTMLElement
              ? event.relatedTarget
              : null
          events.push({
            time: Math.round(performance.now() * 10) / 10,
            type: event.type,
            target:
              event.target instanceof HTMLElement
                ? (event.target.getAttribute('aria-label') ?? event.target.tagName)
                : null,
            relatedTarget: relatedTarget
              ? (relatedTarget.getAttribute('aria-label') ?? relatedTarget.tagName)
              : null,
            key: keyboard?.key ?? null,
            pointerType: pointer?.pointerType ?? null,
            pointerX: pointer?.clientX ?? null,
            pointerY: pointer?.clientY ?? null,
            active:
              document.activeElement instanceof HTMLElement
                ? (document.activeElement.getAttribute('aria-label') ??
                  document.activeElement.tagName)
                : null,
            describedBy: trigger.getAttribute('aria-describedby'),
            expanded: trigger.getAttribute('data-expanded'),
            closed: trigger.getAttribute('data-closed'),
            scrollY: window.scrollY,
          })
          document.documentElement.dataset['listRowEventTrace'] = JSON.stringify(events)
        },
        true
      )
    }
  })
  const precedingAction = page.getByTestId('large-leading-description-row').getByRole('button', {
    name: 'Disable A Very Long Workspace Application Name for Shared Design Systems',
  })
  // Start from the preceding native control so keyboard focus reaches the row
  // without traversing distant content and causing Kobalte's scroll dismissal.
  await precedingAction.click()
  await page.mouse.move(0, 0)
  await button.scrollIntoViewIfNeeded()
  await expect(button).toBeInViewport()
  const initialScrollY = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => {
    document.documentElement.dataset['listRowScrollCount'] = '0'
    window.addEventListener(
      'scroll',
      () => {
        const count = Number(document.documentElement.dataset['listRowScrollCount'] ?? '0')
        document.documentElement.dataset['listRowScrollCount'] = String(count + 1)
      },
      true
    )
  })
  // Keep the pointer outside the controls so this assertion exercises keyboard focus only.
  await page.keyboard.press(navigationKey(browserName))
  await expect(button).toBeFocused()
  await expect(button).toBeInViewport()
  // A real pointer move outside the focused trigger must not dismiss its
  // keyboard tooltip or remove the live description relationship.
  await page.mouse.move(1, 1)
  const buttonTooltip = page.getByRole('tooltip', { name: 'Open the report' })
  const linkTooltip = page.getByRole('tooltip', { name: 'Read report details' })
  const triggerDiagnostic = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      describedBy: element.getAttribute('aria-describedby'),
      expanded: element.getAttribute('data-expanded'),
      closed: element.getAttribute('data-closed'),
      focused: document.activeElement === element,
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
      scrollY: window.scrollY,
      scrollEvents: document.documentElement.dataset['listRowScrollCount'],
      eventTrace: JSON.parse(document.documentElement.dataset['listRowEventTrace'] ?? '[]'),
    }
  })
  await expect(buttonTooltip, JSON.stringify(triggerDiagnostic)).toBeVisible()
  const buttonAssociation = await button.evaluate((element) => {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const tooltip = ids
      .map((id) => document.getElementById(id))
      .find((node) => node?.getAttribute('role') === 'tooltip')
    return {
      ids,
      tooltipId: tooltip?.id,
      tooltipText: tooltip?.textContent?.trim(),
      triggerFocused: document.activeElement === element,
      mountedTooltips: [...document.querySelectorAll('[role="tooltip"]')].map((node) => ({
        id: node.id,
        text: node.textContent?.trim(),
        state: node.getAttribute('data-expanded') ? 'expanded' : 'closed',
      })),
    }
  })
  expect(buttonAssociation.ids).toContain('report-help')
  expect(buttonAssociation.tooltipId, JSON.stringify(buttonAssociation)).toBeTruthy()
  expect(buttonAssociation.ids).toContain(buttonAssociation.tooltipId)
  expect(buttonAssociation.tooltipText).toBe('Open the report')
  expect(Number(triggerDiagnostic.scrollY)).toBe(initialScrollY)
  expect(Number(triggerDiagnostic.scrollEvents)).toBe(0)
  expect(buttonAssociation.triggerFocused).toBe(true)

  // Opening another tooltip closes the first even while its trigger remains
  // keyboard-focused. Moving focus back restores the first tooltip.
  await link.hover()
  await expect(button).toBeFocused()
  await expect(buttonTooltip).toBeHidden()
  await expect(linkTooltip).toBeVisible()
  await expect(button).toHaveAttribute('aria-describedby', 'report-help')
  await button.evaluate((element) => element.blur())
  await button.focus()
  await expect(buttonTooltip).toBeVisible()
  await expect(linkTooltip).toBeHidden()

  // Escape closes the tooltip while focus remains, and blur also closes it.
  await button.press('Escape')
  await expect(buttonTooltip).toBeHidden()
  await expect(button).toHaveAttribute('aria-describedby', 'report-help')
  await link.focus()
  await expect(buttonTooltip).toBeHidden()
  await expect(linkTooltip).toBeVisible()
  await button.focus()
  await expect(linkTooltip).toBeHidden()
  await expect(buttonTooltip).toBeVisible()

  await button.press('Enter')
  await button.press('Space')
  await expect(page.getByLabel('Activations')).toHaveText('2')
  await expect(page.getByLabel('Submissions')).toHaveText('0')
  await expect(buttonTooltip).toBeHidden()
  await expect(button).toHaveAttribute('aria-describedby', 'report-help')

  // Reopen through focus, then verify Kobalte's intentional scroll dismissal.
  await link.focus()
  await button.focus()
  await expect(linkTooltip).toBeHidden()
  await expect(buttonTooltip).toBeVisible()
  await page.evaluate(() => window.scrollBy(0, -1))
  await expect
    .poll(() =>
      page.evaluate(() => Number(document.documentElement.dataset['listRowScrollCount'] ?? '0'))
    )
    .toBeGreaterThan(0)
  await expect(buttonTooltip).toBeHidden()
  await expect(button).toHaveAttribute('aria-describedby', 'report-help')

  await page.keyboard.press(navigationKey(browserName))
  await expect(link).toBeFocused()
  await expect(button).toHaveAttribute('aria-describedby', 'report-help')
  await expect(linkTooltip).toBeVisible()
  const linkAssociation = await link.evaluate((element) => {
    const ids = element.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const tooltip = ids
      .map((id) => document.getElementById(id))
      .find((node) => node?.getAttribute('role') === 'tooltip')
    return {
      ids,
      tooltipId: tooltip?.id,
      tooltipText: tooltip?.textContent?.trim(),
      triggerFocused: document.activeElement === element,
      mountedTooltips: [...document.querySelectorAll('[role="tooltip"]')].map((node) => ({
        id: node.id,
        text: node.textContent?.trim(),
        state: node.getAttribute('data-expanded') ? 'expanded' : 'closed',
      })),
    }
  })
  expect(linkAssociation.tooltipId, JSON.stringify(linkAssociation)).toBeTruthy()
  expect(linkAssociation.ids).toEqual([linkAssociation.tooltipId])
  expect(linkAssociation.tooltipText).toBe('Read report details')
  await defaultAction.click()
  await expect(link).not.toHaveAttribute('aria-describedby', /list-row-tooltip/)
  await expect(page.getByLabel('Activations')).toHaveText('3')
  await expect(page.getByLabel('Submissions')).toHaveText('0')
  await expectAccessible(page)
})

test('interactive native rows participate in sequential Tab navigation', async ({
  page,
  browserName,
}) => {
  await mount(page, 640)
  const focusSequence = [
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Open A Very Long Workspace Application Name for Shared Design Systems',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems up',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems down',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Disable A Very Long Workspace Application Name for Shared Design Systems',
    }),
    page.getByTestId('large-leading-description-row').getByRole('button', {
      name: 'Open A Very Long Workspace Application Name for Shared Design Systems',
    }),
    page.getByTestId('large-leading-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems up',
    }),
    page.getByTestId('large-leading-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems down',
    }),
    page.getByTestId('large-leading-description-row').getByRole('button', {
      name: 'Disable A Very Long Workspace Application Name for Shared Design Systems',
    }),
    page.getByRole('button', { name: 'Open report' }),
    page.getByRole('link', { name: 'Details' }),
    page.getByRole('button', { name: 'Run action' }),
  ]
  for (const control of focusSequence) {
    await page.keyboard.press(navigationKey(browserName))
    await expect(control).toBeFocused()
  }
})

test('a large leading slot wraps above readable described content at 150px and 200% text', async ({
  page,
}) => {
  await mount(page, 320)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  const largeRow = page.getByTestId('large-leading-description-row')
  await largeRow.evaluate((element) => {
    element.style.width = '150px'
  })
  const measured = await geometry(largeRow)
  expect(measured.contentWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(80)
  expect(measured.descriptionWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(80)
  expect(measured.contentTop).toBeGreaterThanOrEqual(measured.leadingBottom)
  expect(measured.controlsContained, JSON.stringify(measured)).toBe(true)
  expect(measured.rowHeight).toBeGreaterThan(measured.descriptionHeight)
  expect(await largeRow.evaluate((element) => element.getBoundingClientRect().width)).toBe(150)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  )
  await expectAccessible(page)
})

test('description rows grow to contain both lines without overlapping neighbors', async ({
  page,
}) => {
  await mount(page, 640)
  const rows = [
    page.getByTestId('description-row-regular'),
    page.getByTestId('description-row-dense'),
  ]
  const descriptions = page.locator('[data-slot="list-row-description"]')
  const rowBoxes = await Promise.all(rows.map((row) => row.boundingBox()))
  const descriptionBoxes = await Promise.all(
    [0, 1].map((index) => descriptions.nth(index).boundingBox())
  )
  expect(rowBoxes.every((box) => box !== null)).toBe(true)
  expect(descriptionBoxes.every((box) => box !== null)).toBe(true)
  expect(descriptionBoxes[0]!.y + descriptionBoxes[0]!.height).toBeLessThanOrEqual(
    rowBoxes[0]!.y + rowBoxes[0]!.height
  )
  expect(descriptionBoxes[1]!.y + descriptionBoxes[1]!.height).toBeLessThanOrEqual(
    rowBoxes[1]!.y + rowBoxes[1]!.height
  )
  expect(rowBoxes[1]!.y).toBeGreaterThanOrEqual(rowBoxes[0]!.y + rowBoxes[0]!.height)
})

test('plain ListRowControl preserves div and li semantics while described trailing rows reflow', async ({
  page,
}) => {
  await mount(page, 320)
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%'
  })

  const rows = [
    { locator: page.getByTestId('plain-row-div'), tagName: 'div' },
    { locator: page.getByTestId('plain-row-li'), tagName: 'li' },
  ]
  for (const { locator, tagName } of rows) {
    await locator.evaluate((element) => {
      element.style.width = '150px'
    })
    const measured = await locator.evaluate((element) => {
      const leading = element.querySelector('[data-slot="list-row-leading"]')
      const content = element.querySelector('[data-slot="list-row-content"]')
      const label = element.querySelector('[data-slot="list-row-label"]')
      const description = element.querySelector('[data-slot="list-row-description"]')
      const trailing = element.querySelector('[data-slot="list-row-trailing"]')
      if (!leading || !content || !label || !description || !trailing)
        throw new Error('Plain ListRowControl slots were not rendered')
      const leadingBox = leading.getBoundingClientRect()
      const contentBox = content.getBoundingClientRect()
      const descriptionBox = description.getBoundingClientRect()
      const rowBox = element.getBoundingClientRect()
      const trailingBox = trailing.getBoundingClientRect()
      return {
        tagName: element.tagName.toLowerCase(),
        descriptionWidth: descriptionBox.width,
        contentTop: contentBox.top,
        leadingBottom: leadingBox.bottom,
        rowLeft: rowBox.left,
        rowRight: rowBox.right,
        trailingLeft: trailingBox.left,
        trailingRight: trailingBox.right,
      }
    })

    expect(measured.tagName).toBe(tagName)
    expect(measured.descriptionWidth, JSON.stringify(measured)).toBeGreaterThanOrEqual(80)
    expect(measured.contentTop, JSON.stringify(measured)).toBeGreaterThanOrEqual(
      measured.leadingBottom
    )
    expect(measured.trailingLeft).toBeGreaterThanOrEqual(measured.rowLeft)
    expect(measured.trailingRight).toBeLessThanOrEqual(measured.rowRight)
    await expect(locator.locator('[data-slot="list-row-trailing"]')).toContainText('Ready')
  }
  await expectAccessible(page)
})

test('interactive row composition has no serious or critical accessibility violations', async ({
  page,
}) => {
  await mount(page, 640)
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? '')
    )
  ).toEqual([])
})

test('compact rows keep their fixed height and row actions remain keyboard reachable', async ({
  page,
}) => {
  await mount(page, 640)
  const selected = page.getByRole('link', { name: 'Selected worktree' })
  const actions = [
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Open A Very Long Workspace Application Name for Shared Design Systems',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems up',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Move A Very Long Workspace Application Name for Shared Design Systems down',
    }),
    page.getByTestId('long-description-row').getByRole('button', {
      name: 'Disable A Very Long Workspace Application Name for Shared Design Systems',
    }),
  ]
  await expect(selected).toHaveAttribute('aria-current', 'true')
  await expect(selected).toHaveClass(/h-row-md/)
  for (const action of actions) {
    await action.focus()
    await expect(action).toBeFocused()
    await page.keyboard.press('Enter')
  }
  await expect(page.getByTestId('action-count')).toHaveText('4')
  await selected.focus()
  await expect(selected).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#selected-row$/)
  await expectAccessible(page)
})
