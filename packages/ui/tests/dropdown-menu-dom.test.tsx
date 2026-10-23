import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../src/components/ui/dropdown-menu/dropdown-menu'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const menu = () => doc().querySelector('[role="menu"]') as HTMLElement | null
const itemsOf = (role: string) => [...doc().querySelectorAll(`[role="${role}"]`)] as HTMLElement[]
const named = (role: string, text: string) =>
  itemsOf(role).find((item) => item.textContent?.includes(text))!
// A menu row is chosen on pointer release, not on `click`.
const choose = (item: Element) =>
  item.dispatchEvent(
    new dom.window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
  )
const key = (target: Element, name: string, init: KeyboardEventInit = {}) =>
  target.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  )

describe('DropdownMenu', () => {
  test('opens from the keyboard on its trigger and lists its items as a menu', async () => {
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent hideArrow={false} class="opacity-90">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Edit</DropdownMenuLabel>
            <DropdownMenuItem shortcut="⌘R" keyshortcuts="Meta+R">
              Rename
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" swatch="info">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(menu()).toBeNull()
    key(trigger, 'Enter')
    await tick()
    expect(menu()).not.toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(menu()!.classList.contains('opacity-90')).toBe(true)
    expect(menu()!.querySelector('.fill-popover')).not.toBeNull()
    expect(itemsOf('menuitem').map((item) => item.textContent)).toEqual(['Rename⌘R', 'Delete'])
    expect(doc().body.textContent).toContain('Edit')
    const rename = named('menuitem', 'Rename')
    expect(rename.getAttribute('aria-keyshortcuts')).toBe('Meta+R')
    expect(rename.querySelector('[aria-hidden="true"]')?.textContent).toBe('⌘R')
    const del = named('menuitem', 'Delete')
    expect(del.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    expect(menu()!.querySelector('hr')).not.toBeNull()
  })

  test('choosing an item runs its handler and closes the menu', async () => {
    const chosen: string[] = []
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => chosen.push('rename')}>Rename</DropdownMenuItem>
          <DropdownMenuItem disabled onSelect={() => chosen.push('disabled')}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    key(doc().querySelector('button')!, 'Enter')
    await tick()
    choose(named('menuitem', 'Archive'))
    await tick()
    expect(chosen).toEqual([])
    expect(menu()).not.toBeNull()
    choose(named('menuitem', 'Rename'))
    await tick(60)
    expect(chosen).toEqual(['rename'])
    expect(menu()).toBeNull()
  })

  test('Escape closes it', async () => {
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    key(doc().querySelector('button')!, 'Enter')
    await tick()
    key(menu()!, 'Escape')
    await tick(60)
    expect(menu()).toBeNull()
  })

  test('a checkbox item toggles its checked state and shows an indicator only when checked', async () => {
    const [checked, setChecked] = createSignal(false)
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>View</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={checked()} onChange={setChecked} swatch="info">
            Show hidden
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    key(doc().querySelector('button')!, 'Enter')
    await tick()
    const item = named('menuitemcheckbox', 'Show hidden')
    expect(item.getAttribute('aria-checked')).toBe('false')
    expect(item.querySelector('[data-slot="dropdown-menu-indicator"]')).toBeNull()
    choose(item)
    await tick()
    expect(checked()).toBe(true)
    const again = named('menuitemcheckbox', 'Show hidden')
    expect(again.getAttribute('aria-checked')).toBe('true')
    expect(again.querySelector('[data-slot="dropdown-menu-indicator"]')).not.toBeNull()
  })

  test('radio items select one value at a time', async () => {
    const [value, setValue] = createSignal('list')
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>Layout</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={value()} onChange={setValue}>
            <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="grid" swatch="info">
              Grid
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    key(doc().querySelector('button')!, 'Enter')
    await tick()
    expect(named('menuitemradio', 'List').getAttribute('aria-checked')).toBe('true')
    expect(named('menuitemradio', 'Grid').getAttribute('aria-checked')).toBe('false')
    choose(named('menuitemradio', 'Grid'))
    await tick(60)
    expect(value()).toBe('grid')
  })

  test('a shortcut hint is hidden from assistive tech', async () => {
    dom.mount(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Copy <DropdownMenuShortcut class="opacity-90">⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    await tick()
    const hint = doc().querySelector('[data-slot="dropdown-menu-shortcut"]')!
    expect(hint.getAttribute('aria-hidden')).toBe('true')
    expect(hint.classList.contains('opacity-90')).toBe(true)
  })

  test('a submenu opens from its trigger with the arrow key', async () => {
    dom.mount(() => (
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="opacity-90">
              <DropdownMenuItem>Nested</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    await tick()
    const sub = named('menuitem', 'More')
    expect(sub.getAttribute('aria-haspopup')).toBe('true')
    expect(sub.querySelector('svg')).not.toBeNull()
    expect(doc().body.textContent).not.toContain('Nested')
    sub.focus()
    key(sub, 'ArrowRight')
    await tick(40)
    expect(doc().body.textContent).toContain('Nested')
    expect(itemsOf('menu').some((item) => item.classList.contains('opacity-90'))).toBe(true)
  })

  test('a primary pointer press focuses the trigger without letting the press steal it', () => {
    let pressed = 0
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger onPointerDown={() => (pressed += 1)}>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    const down = new dom.window.PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      isPrimary: true,
      pointerType: 'mouse',
    })
    trigger.dispatchEvent(down)
    expect(pressed).toBe(1)
    expect(doc().activeElement === trigger).toBe(true)
    expect(down.defaultPrevented).toBe(true)
  })

  test('a modified or touch press is left to the browser', () => {
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    const withShift = new dom.window.PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      isPrimary: true,
      shiftKey: true,
    })
    trigger.dispatchEvent(withShift)
    expect(doc().activeElement === trigger).toBe(false)
    const touch = new dom.window.PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      isPrimary: true,
      pointerType: 'touch',
    })
    trigger.dispatchEvent(touch)
    expect(doc().activeElement === trigger).toBe(true)
    expect(touch.defaultPrevented).toBe(false)
  })

  test('a disabled trigger ignores the keyboard', async () => {
    dom.mount(() => (
      <DropdownMenu>
        <DropdownMenuTrigger disabled>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    key(doc().querySelector('button')!, 'Enter')
    await tick()
    expect(menu()).toBeNull()
  })

  test('opening from the keyboard in a page whose root cannot scroll lets the menu measure its scroll parents, then restores them', async () => {
    const root = doc().documentElement
    root.style.overflow = 'hidden'
    dom.mount(() => (
      <div id="pane">
        <DropdownMenu>
          <DropdownMenuTrigger onKeyDown={() => {}}>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Rename</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ))
    const pane = doc().getElementById('pane') as HTMLElement
    pane.style.overflow = 'auto'
    key(doc().querySelector('button')!, 'Enter')
    expect(pane.style.getPropertyValue('overflow')).toBe('clip')
    expect(pane.style.getPropertyPriority('overflow')).toBe('important')
    await tick()
    expect(pane.style.getPropertyValue('overflow')).toBe('auto')
    root.style.removeProperty('overflow')
  })

  test('the opening arrow follows the menu orientation', async () => {
    dom.mount(() => (
      <DropdownMenu orientation="vertical">
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    key(trigger, 'ArrowDown')
    await tick()
    expect(menu()).toBeNull()
    key(trigger, 'ArrowRight')
    await tick()
    expect(menu()).not.toBeNull()
  })
})
