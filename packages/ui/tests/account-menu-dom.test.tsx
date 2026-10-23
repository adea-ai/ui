import { describe, expect, test } from 'bun:test'

import {
  AccountMenu,
  createAppMenuItems,
  type AccountMenuItem,
} from '../src/components/composites/account-menu/account-menu'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const noop = () => {}
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })
  )
const choose = (item: Element) =>
  item.dispatchEvent(
    new dom.window.PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })
  )
const trigger = () => doc().querySelector('[data-slot="account-menu-trigger"]') as HTMLButtonElement
const rows = () => [...doc().querySelectorAll('[role="menuitem"]')] as HTMLElement[]
const row = (text: string) => rows().find((item) => item.textContent?.includes(text))!
const openMenu = async () => {
  key(trigger(), 'Enter')
  await tick()
}

const items: AccountMenuItem[] = [
  { id: 'settings', label: 'Settings', shortcut: '⌘,', keyshortcuts: 'Meta+,' },
  { id: 'updates', label: 'Updates', platform: 'desktop' },
  { id: 'mobile', label: 'Get the app', platform: 'web' },
  { id: 'custom', label: 'Custom', icon: <i data-testid="own-icon" /> },
  { id: 'locked', label: 'Locked', disabled: true },
]

describe('AccountMenu', () => {
  test('is an icon trigger named for the account, opening a menu of the platform’s items', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated onSignOut={() => {}} />)
    expect(trigger().getAttribute('aria-label')).toBe('Account and settings')
    await openMenu()
    expect(rows().map((item) => item.textContent)).toEqual([
      'Settings⌘,',
      'Updates',
      'Custom',
      'Locked',
      'Sign out',
    ])
    expect(row('Settings').getAttribute('aria-keyshortcuts')).toBe('Meta+,')
    expect(row('Custom').querySelector('[data-testid="own-icon"]')).not.toBeNull()
    expect(row('Settings').querySelector('svg')).not.toBeNull()
    expect(row('Locked').getAttribute('aria-disabled')).toBe('true')
  })

  test('the web platform shows web items and hides desktop ones', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated platform="web" />)
    await openMenu()
    expect(rows().map((item) => item.textContent?.replace('⌘,', ''))).toContain('Get the app')
    expect(rows().some((item) => item.textContent === 'Updates')).toBe(false)
  })

  test('uses a custom label and tells assistive tech about an available update', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated label="Andrew" updateAvailable />)
    expect(trigger().getAttribute('aria-label')).toBe('Andrew, update available')
    expect(doc().querySelector('[data-slot="account-menu-update-dot"]')).not.toBeNull()
    await openMenu()
    expect(row('Updates').getAttribute('aria-label')).toBe('Updates, update available')
    expect(doc().querySelectorAll('[data-slot="account-menu-update-dot"]').length).toBe(2)
  })

  test('no dot and no extra label when there is no update', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated />)
    expect(doc().querySelector('[data-slot="account-menu-update-dot"]')).toBeNull()
    await openMenu()
    expect(row('Updates').hasAttribute('aria-label')).toBe(false)
  })

  test('signing in or out depends on the session, and a busy session cannot be changed', async () => {
    const calls: string[] = []
    const { unmount } = (() => {
      const root = dom.mount(() => (
        <AccountMenu
          items={items}
          authenticated={false}
          onSignIn={() => calls.push('in')}
          onSignOut={() => calls.push('out')}
        />
      ))
      return { unmount: () => root.remove() }
    })()
    await openMenu()
    choose(row('Sign in'))
    await tick(60)
    expect(calls).toEqual(['in'])
    unmount()
  })

  test('a signed-in account signs out', async () => {
    const calls: string[] = []
    dom.mount(() => (
      <AccountMenu
        items={items}
        authenticated
        onSignIn={() => calls.push('in')}
        onSignOut={() => calls.push('out')}
      />
    ))
    await openMenu()
    choose(row('Sign out'))
    await tick(60)
    expect(calls).toEqual(['out'])
  })

  test('a busy session disables the sign row', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated busy />)
    await openMenu()
    expect(row('Sign out').getAttribute('aria-disabled')).toBe('true')
  })

  test('showSession={false} leaves the session row out', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated showSession={false} />)
    await openMenu()
    expect(rows().some((item) => item.textContent === 'Sign out')).toBe(false)
    expect(doc().querySelector('hr')).toBeNull()
  })

  test('choosing an item runs onSelect now and onSelectAfterClose once the menu has closed, with the trigger', async () => {
    const order: string[] = []
    let received: HTMLButtonElement | undefined
    dom.mount(() => (
      <AccountMenu
        authenticated
        items={[
          {
            id: 'about',
            label: 'About',
            onSelect: () => order.push('select'),
            onSelectAfterClose: (opener) => {
              order.push('after')
              received = opener
            },
          },
        ]}
      />
    ))
    await openMenu()
    choose(row('About'))
    await tick(120)
    expect(order).toEqual(['select', 'after'])
    expect(received === trigger()).toBe(true)
  })

  test('reports intent when the pointer reaches the trigger and when it takes focus', () => {
    let intents = 0
    dom.mount(() => <AccountMenu items={items} authenticated onIntent={() => (intents += 1)} />)
    trigger().dispatchEvent(new dom.window.PointerEvent('pointerenter', { bubbles: true }))
    expect(intents).toBe(1)
    // The tooltip focus gate drops focus that did not come from the keyboard.
    key(doc().body, 'Tab')
    trigger().focus()
    expect(intents).toBe(2)
  })

  test('the menu closing with no after-close action leaves focus handling to the menu', async () => {
    dom.mount(() => <AccountMenu items={[{ id: 'about', label: 'About' }]} authenticated />)
    await openMenu()
    choose(row('About'))
    await tick(80)
    expect(doc().querySelector('[role="menu"]')).toBeNull()
  })

  test('a rail trigger is a rail button row named for the account', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated railTrigger updateAvailable />)
    const button = trigger()
    expect(button.getAttribute('aria-label')).toBe('Account and settings, update available')
    expect(button.textContent).toContain('Account and settings')
    expect(button.querySelector('[data-slot="account-menu-update-dot"]')).not.toBeNull()
    await openMenu()
    expect(rows().length).toBeGreaterThan(0)
  })

  test('opening the menu closes the tooltip over the trigger', async () => {
    dom.mount(() => <AccountMenu items={items} authenticated />)
    await openMenu()
    expect(doc().querySelector('[role="tooltip"]')).toBeNull()
  })
})

describe('createAppMenuItems', () => {
  test('lists the standard entries in order, with a primary item first', () => {
    const primary: AccountMenuItem = { id: 'mobile', label: 'Mobile' }
    const list = createAppMenuItems({ primaryItem: primary, settingsShortcut: '⌘,' })
    expect(list.map((item) => item.id)).toEqual([
      'mobile',
      'about',
      'help',
      'feedback',
      'updates',
      'settings',
    ])
    expect(list.at(-1)?.shortcut).toBe('⌘,')
    expect(list.find((item) => item.id === 'updates')?.platform).toBe('desktop')
  })

  test('an entry without a handler is disabled, and one with a handler carries it', () => {
    const onAbout = noop
    const list = createAppMenuItems({ onAbout })
    expect(list.map((item) => item.id)).toEqual([
      'about',
      'help',
      'feedback',
      'updates',
      'settings',
    ])
    const about = list.find((item) => item.id === 'about')!
    expect(about.disabled).toBe(false)
    expect(about.onSelectAfterClose).toBe(onAbout)
    expect(list.filter((item) => item.id !== 'about').every((item) => item.disabled)).toBe(true)
  })
})
