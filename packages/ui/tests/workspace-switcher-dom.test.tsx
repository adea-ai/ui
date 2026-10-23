import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import { WorkspaceReorderDialog } from '../src/components/composites/workspace-switcher/workspace-reorder-dialog'
import {
  WorkspaceSwitcher,
  type WorkspaceSwitcherItem,
} from '../src/components/composites/workspace-switcher/workspace-switcher'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
  )
const choose = (item: Element) =>
  item.dispatchEvent(
    new dom.window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
  )
const menuItem = (text: string) =>
  [...doc().querySelectorAll('[role^="menuitem"]')].find((item) =>
    item.textContent?.includes(text)
  ) as HTMLElement
const byText = (selector: string, text: string) =>
  [...doc().querySelectorAll(selector)].find((node) => node.textContent?.includes(text)) as
    | HTMLElement
    | undefined

const workspaces: WorkspaceSwitcherItem[] = [
  { id: 'home', name: 'Home', mark: <i data-testid="mark-home" />, fixed: true },
  { id: 'work', name: 'Work', mark: () => <i data-testid="mark-work" />, detail: <b>3</b> },
  { id: 'play', name: 'Play', mark: <i data-testid="mark-play" /> },
]

async function openMenu() {
  key(doc().querySelector('[data-slot="workspace-switcher"]')!, 'Enter')
  await tick()
}

describe('WorkspaceSwitcher', () => {
  test('shows the current workspace in a trigger that names the choice', () => {
    dom.mount(() => (
      <WorkspaceSwitcher workspaces={workspaces} value="work" onValueChange={() => {}} />
    ))
    const trigger = doc().querySelector('[data-slot="workspace-switcher"]')!
    expect(trigger.textContent).toContain('Work')
    expect(trigger.getAttribute('aria-label')).toBe('Switch workspace, current: Work')
    expect(trigger.querySelector('[data-testid="mark-work"]')).not.toBeNull()
  })

  test('falls back to a placeholder when no workspace is current', () => {
    dom.mount(() => (
      <WorkspaceSwitcher
        workspaces={workspaces}
        value={undefined}
        placeholder="Pick one"
        onValueChange={() => {}}
        disabled
        class="opacity-90"
      />
    ))
    const trigger = doc().querySelector('[data-slot="workspace-switcher"]') as HTMLButtonElement
    expect(trigger.textContent).toContain('Pick one')
    expect(trigger.getAttribute('aria-label')).toBe('Switch workspace, current: none')
    expect(trigger.getAttribute('aria-disabled')).toBe('true')
    expect(trigger.classList.contains('opacity-90')).toBe(true)
  })

  test('lists every workspace as a radio row with the current one checked', async () => {
    dom.mount(() => (
      <WorkspaceSwitcher
        workspaces={workspaces}
        value="work"
        label="Your spaces"
        onValueChange={() => {}}
      />
    ))
    await openMenu()
    const rows = [...doc().querySelectorAll('[role="menuitemradio"]')]
    expect(rows.map((row) => row.textContent)).toEqual(['Home', 'Work3', 'Play'])
    expect(rows.map((row) => row.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(doc().body.textContent).toContain('Your spaces')
    expect(rows[1]?.getAttribute('data-workspace-id')).toBe('work')
  })

  test('choosing another workspace reports it and closes; choosing the current one reports nothing', async () => {
    const chosen: string[] = []
    dom.mount(() => (
      <WorkspaceSwitcher
        workspaces={workspaces}
        value="work"
        onValueChange={(id) => chosen.push(id)}
      />
    ))
    await openMenu()
    choose(menuItem('Work'))
    await tick(60)
    expect(chosen).toEqual([])
    await openMenu()
    choose(menuItem('Play'))
    await tick(60)
    expect(chosen).toEqual(['play'])
    expect(doc().querySelector('[role="menu"]')).toBeNull()
  })

  test('offers create and manage only when their handlers are given, with their own labels', async () => {
    const calls: string[] = []
    dom.mount(() => (
      <WorkspaceSwitcher
        workspaces={workspaces}
        value="work"
        onValueChange={() => {}}
        onCreate={() => calls.push('create')}
        createLabel="Add space"
        onManage={() => calls.push('manage')}
        manageLabel="Space settings"
      />
    ))
    await openMenu()
    expect(menuItem('Add space')).toBeDefined()
    expect(menuItem('Space settings')).toBeDefined()
    choose(menuItem('Add space'))
    await tick(60)
    await openMenu()
    choose(menuItem('Space settings'))
    await tick(60)
    expect(calls).toEqual(['create', 'manage'])
  })

  test('a menu with no actions has no separator or action rows', async () => {
    dom.mount(() => (
      <WorkspaceSwitcher workspaces={workspaces} value="work" onValueChange={() => {}} />
    ))
    await openMenu()
    expect(doc().querySelectorAll('[role="menuitem"]').length).toBe(0)
    expect(doc().querySelector('hr')).toBeNull()
  })

  test('reordering is offered only with a handler and two or more movable workspaces', async () => {
    dom.mount(() => (
      <WorkspaceSwitcher
        workspaces={workspaces.slice(0, 2)}
        value="work"
        onValueChange={() => {}}
        onReorder={() => {}}
      />
    ))
    await openMenu()
    expect(byText('[role="menuitem"]', 'Reorder')).toBeUndefined()
  })
})

async function openReorder(onReorder: (ids: readonly string[]) => void | Promise<void>) {
  dom.mount(() => (
    <WorkspaceSwitcher
      workspaces={workspaces}
      value="work"
      onValueChange={() => {}}
      onReorder={onReorder}
      reorderLabel="Reorder spaces"
    />
  ))
  await openMenu()
  // Opening the menu starts loading the dialog module.
  await tick(80)
  choose(menuItem('Reorder spaces'))
  await tick(120)
}

describe('WorkspaceSwitcher reordering', () => {
  test('opens the reorder dialog on demand and saves each move', async () => {
    const saved: Array<readonly string[]> = []
    await openReorder((ids) => void saved.push(ids))
    const dialog = doc().querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Reorder workspaces')
    expect(dialog.querySelector('[data-reorder-id="home"]')?.textContent).toContain('Always first')
    const down = dialog.querySelector('[data-reorder-id="work"] [data-move="down"]') as HTMLElement
    down.click()
    await tick(60)
    expect(saved).toEqual([['home', 'play', 'work']])
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe(
      'Moved Work to position 3 of 3.'
    )
  })

  test('an edge row cannot move further in that direction', async () => {
    await openReorder(() => {})
    const dialog = doc().querySelector('[role="dialog"]')!
    const upOfFirstMovable = dialog.querySelector(
      '[data-reorder-id="work"] [data-move="up"]'
    ) as HTMLButtonElement
    expect(upOfFirstMovable.getAttribute('aria-disabled')).toBe('true')
  })

  test('a failed save is reported and the order is left for another try', async () => {
    let attempts = 0
    await openReorder(() => {
      attempts += 1
      throw new Error('offline')
    })
    const dialog = doc().querySelector('[role="dialog"]')!
    ;(dialog.querySelector('[data-reorder-id="work"] [data-move="down"]') as HTMLElement).click()
    await tick(60)
    expect(attempts).toBe(1)
    expect(dialog.querySelector('[role="alert"]')?.textContent).toBe(
      'Could not save the order. Try again.'
    )
    expect(dialog.querySelector('[role="status"]')?.textContent).toBe('')
  })

  test('the Done button closes the dialog', async () => {
    await openReorder(() => {})
    const done = byText('button', 'Done')!
    done.click()
    await tick(80)
    expect(doc().querySelector('[role="dialog"]')).toBeNull()
  })

  test('Escape closes the dialog', async () => {
    await openReorder(() => {})
    key(doc().querySelector('[role="dialog"]')!, 'Escape')
    await tick(80)
    expect(doc().querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('WorkspaceReorderDialog', () => {
  const items = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ]

  test('a pending save disables every move and marks the list busy', async () => {
    let release!: () => void
    const saved: Array<readonly string[]> = []
    dom.mount(() => (
      <WorkspaceReorderDialog
        open
        onOpenChange={() => {}}
        workspaces={items}
        title="Order"
        onReorder={(ids) => {
          saved.push(ids)
          return new Promise<void>((resolve) => (release = resolve))
        }}
      />
    ))
    await tick()
    const list = doc().querySelector('ol')!
    expect(doc().querySelector('[role="dialog"]')?.textContent).toContain('Order')
    const down = list.querySelector('[data-reorder-id="a"] [data-move="down"]') as HTMLElement
    down.click()
    await tick()
    expect(list.getAttribute('aria-busy')).toBe('true')
    const other = list.querySelector('[data-reorder-id="b"] [data-move="down"]') as HTMLElement
    other.click()
    await tick()
    expect(saved).toEqual([['b', 'a', 'c']])
    release()
    await tick(60)
    expect(list.getAttribute('aria-busy')).toBe('false')
  })

  test('focus follows the moved row so the keyboard can keep going', async () => {
    const [order, setOrder] = createSignal(items)
    dom.mount(() => (
      <WorkspaceReorderDialog
        open
        onOpenChange={() => {}}
        workspaces={order()}
        onReorder={(ids) => void setOrder(ids.map((id) => items.find((item) => item.id === id)!))}
      />
    ))
    await tick()
    const down = doc().querySelector('[data-reorder-id="a"] [data-move="down"]') as HTMLElement
    down.focus()
    down.click()
    await tick(80)
    const moved = doc().querySelector('[data-reorder-id="a"] [data-move="down"]')
    expect(doc().activeElement === moved).toBe(true)
  })
})
