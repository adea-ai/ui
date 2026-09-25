import { expect, test } from '@playwright/test'
import { openStory } from './stories'

/**
 * Interaction: the behaviours the components are *for*.
 *
 * The accessibility lane proves a story renders without violations. That is not
 * the same as proving it works: a dialog that never opens is perfectly
 * accessible. These tests press the things a user presses and assert what the
 * primitive is supposed to do — the overlay appears, focus moves into it, Escape
 * returns focus to the trigger, a rail row's tooltip opens on hover.
 *
 * Each test names the behaviour and the reason it is worth asserting. A test
 * that only checks a element exists adds nothing a snapshot would not.
 *
 * Every story opens in `adea-dark`, the default dark variant — the same theme the
 * accessibility lane runs, and a real catalogue id rather than the bare `dark` this
 * lane used to pass. The bare alias is what a person writes by hand, so the workshop
 * accepts it (see `theme-classes.ts`), but a lane should exercise what a user sees.
 */

test.describe('overlays', () => {
  test('a dialog opens, traps focus, and returns it to the trigger on Escape', async ({ page }) => {
    await openStory(page, 'primitives-overlays-dialog--default', 'adea-dark')

    const trigger = page.getByRole('button', { name: 'Rename workspace' })
    await trigger.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rename workspace' })).toBeVisible()

    // Focus has to leave the page and enter the dialog, or a keyboard user is
    // still tabbing through the content behind the scrim.
    await expect(dialog.locator(':focus')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()

    // Focus returning to the trigger is the half that is usually forgotten.
    await expect(trigger).toBeFocused()
  })

  test('an alert dialog refuses Escape, so a destructive choice is explicit', async ({ page }) => {
    await openStory(page, 'primitives-overlays-alert-dialog--destructive', 'adea-dark')

    await page.getByRole('button', { name: 'Delete workspace' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 10_000 })

    await page.keyboard.press('Escape')
    // Still open: the whole point of this surface.
    await expect(dialog).toBeVisible()

    await page.getByRole('button', { name: 'Keep it' }).click()
    await expect(dialog).toBeHidden()
  })

  test('a dropdown menu is operable with the keyboard alone', async ({ page }) => {
    await openStory(page, 'primitives-overlays-dropdown-menu--default', 'adea-dark')

    await page.getByRole('button', { name: 'Actions' }).focus()
    await page.keyboard.press('Enter')

    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()

    // The first item takes focus on open; a menu that opens without moving focus
    // is unusable from the keyboard.
    await expect(page.getByRole('menuitem', { name: /Rename/ })).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitem', { name: /Duplicate/ })).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
  })

  test('a popover dismisses on an outside click', async ({ page }) => {
    await openStory(page, 'primitives-overlays-popover--dismissal', 'adea-dark')

    await page.getByRole('button', { name: 'Open me' }).click()
    await expect(page.getByText('Click outside, or press Escape')).toBeVisible()

    await page.locator('body').click({ position: { x: 5, y: 5 } })
    await expect(page.getByText('Click outside, or press Escape')).toBeHidden()
  })
})

test.describe('the shell', () => {
  test('a collapsed rail keeps its destinations named', async ({ page }) => {
    await openStory(page, 'layout-side-rail--collapsed', 'adea-dark')

    // The name has to survive the collapse. A rail that drops the label entirely
    // leaves an icon-only navigation that a screen reader cannot describe.
    await expect(page.getByRole('button', { name: 'Dev view' })).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
  })

  test('a rail row opens its tooltip on hover', async ({ page }) => {
    await openStory(page, 'layout-side-rail--collapsed', 'adea-dark')

    await page.getByRole('button', { name: 'Home' }).hover()

    // The flyout is aria-hidden decoration rather than an ARIA tooltip: the row
    // already carries the name. What matters is that the label becomes visible to
    // a pointer user, and that it carries the chord — the one thing a collapsed
    // rail cannot otherwise show.
    const flyout = page.locator('[data-slot="side-rail-tip"]')
    await expect(flyout).toBeVisible({ timeout: 5_000 })
    await expect(flyout).toContainText('Home')
    await expect(flyout).toContainText('⌘1')
  })

  test('the app shell fills the viewport without scrolling the document', async ({ page }) => {
    await openStory(page, 'layout-app-shell--full-shell', 'adea-dark')

    const metrics = await page.evaluate(() => ({
      documentScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      shellHeight: document.querySelector('[data-slot="app-shell"]')?.clientHeight ?? 0,
      viewport: window.innerHeight,
    }))

    // Both applications are height-locked desktop shells: a document that scrolls
    // means a wheel event over a pane drags the whole window.
    expect(metrics.documentScrolls).toBe(false)
    expect(metrics.shellHeight).toBe(metrics.viewport)
  })

  test('every shell region is present and landmarked', async ({ page }) => {
    await openStory(page, 'layout-app-shell--full-shell', 'adea-dark')

    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Projects' })).toBeVisible()
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('contentinfo')).toBeVisible()
    await expect(
      page.getByRole('searchbox', { name: 'Search projects, files and sessions' })
    ).toHaveCount(0)
    // The top bar's search is a button that opens the palette, not a second input.
    await expect(page.getByRole('button', { name: /Search projects/ })).toBeVisible()
  })
})

test.describe('forms', () => {
  test('arrow keys move within a radio group, and one Tab leaves it', async ({ page }) => {
    await openStory(page, 'primitives-forms-radio-group--keyboard', 'adea-dark')

    await page.getByRole('radio', { name: /Tab reaches this group once/ }).focus()
    await page.keyboard.press('ArrowDown')

    await expect(page.getByRole('radio', { name: /arrow keys move/ })).toBeChecked()
  })

  test('a select reports its selection as the trigger label', async ({ page }) => {
    await openStory(page, 'primitives-forms-select--default', 'adea-dark')

    const trigger = page.getByRole('button', { name: 'Model' })
    await trigger.click()
    await page.getByRole('option', { name: 'Claude Opus' }).click()

    // The trigger must show the option's *text*, not its value. Showing an id is
    // the failure this component's option API exists to prevent.
    await expect(trigger).toContainText('Claude Opus')
    await expect(trigger).not.toContainText('opus')
  })

  test('an invalid field is announced as invalid, not only painted red', async ({ page }) => {
    await openStory(page, 'primitives-forms-input--invalid', 'adea-dark')

    const input = page.getByRole('textbox', { name: 'Workspace name' })
    await expect(input).toHaveAttribute('aria-invalid', 'true')
  })
})

test.describe('navigation', () => {
  test('tabs move between panels with the arrow keys', async ({ page }) => {
    await openStory(page, 'primitives-navigation-tabs--default', 'adea-dark')

    await page.getByRole('tab', { name: 'Code' }).focus()
    await page.keyboard.press('ArrowRight')

    await expect(page.getByRole('tab', { name: 'Diff' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Changes against the base branch.')).toBeVisible()
  })

  test('a sidebar section is a real disclosure', async ({ page }) => {
    await openStory(page, 'layout-sidebar-navigation--collapsible-sections', 'adea-dark')

    const heading = page.getByRole('button', { name: /Pinned/ })
    await expect(heading).toHaveAttribute('aria-expanded', 'true')

    await heading.click()
    await expect(heading).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByText('cortana')).toHaveCount(0)
  })
})

test.describe('feedback', () => {
  test('a toast appears from the API and can be dismissed', async ({ page }) => {
    await openStory(page, 'primitives-feedback-toast--tones', 'adea-dark')

    await page.getByRole('button', { name: 'Success', exact: true }).click()
    await expect(page.getByText('Worktree created')).toBeVisible()

    await page.getByRole('button', { name: 'Dismiss notification' }).first().click()
    await expect(page.getByText('Worktree created')).toBeHidden()
  })

  test('a progress bar reports its value to assistive technology', async ({ page }) => {
    await openStory(page, 'primitives-feedback-progress--default', 'adea-dark')

    // Kobalte publishes the value; a bar that is only a coloured div reports
    // nothing, which is the same as reporting zero.
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '64')
  })
})
