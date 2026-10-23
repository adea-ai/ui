import { describe, expect, test } from 'bun:test'

import {
  SideRail,
  SideRailButton,
  SideRailContent,
  SideRailFooter,
  SideRailHeader,
  SideRailItem,
  SideRailSection,
} from '../src/components/layout/side-rail/side-rail'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const slot = (name: string) => doc().querySelector(`[data-slot="${name}"]`) as HTMLElement | null
const pointer = (target: Element, type: string) =>
  target.dispatchEvent(new dom.window.PointerEvent(type, { bubbles: true }))

/** Give a row a laid-out box: the DOM has no layout, and the tip is placed from it. */
function layOut(element: Element, rect: { top: number; right: number; height: number }) {
  ;(element as HTMLElement).getBoundingClientRect = () =>
    ({
      ...rect,
      left: 0,
      bottom: rect.top + rect.height,
      width: rect.right,
      x: 0,
      y: rect.top,
    }) as DOMRect
}

describe('SideRail', () => {
  test('is a labelled navigation landmark that records whether it is collapsed', () => {
    const root = dom.mount(() => (
      <SideRail>
        <SideRailHeader>Head</SideRailHeader>
        <SideRailContent>Body</SideRailContent>
        <SideRailFooter>Foot</SideRailFooter>
      </SideRail>
    ))
    const rail = root.querySelector('nav')!
    expect(rail.getAttribute('aria-label')).toBe('Primary')
    expect(rail.getAttribute('data-collapsed')).toBe('false')
    expect(rail.classList.contains('w-rail-expanded')).toBe(true)
    expect([...rail.children].map((child) => child.getAttribute('data-slot'))).toEqual([
      'side-rail-header',
      'side-rail-content',
      'side-rail-footer',
    ])
  })

  test('collapsed narrows the rail, and a caller label and class apply', () => {
    const rail = dom
      .mount(() => (
        <SideRail collapsed aria-label="Workspace" class="opacity-90">
          <SideRailContent>Body</SideRailContent>
        </SideRail>
      ))
      .querySelector('nav')!
    expect(rail.getAttribute('data-collapsed')).toBe('true')
    expect(rail.getAttribute('aria-label')).toBe('Workspace')
    expect(rail.classList.contains('w-rail')).toBe(true)
    expect(rail.classList.contains('w-rail-expanded')).toBe(false)
    expect(rail.classList.contains('opacity-90')).toBe(true)
  })

  test('a section shows its label only when it has one', () => {
    const root = dom.mount(() => (
      <SideRail>
        <SideRailSection label="Projects">items</SideRailSection>
        <SideRailSection class="opacity-90">bare</SideRailSection>
      </SideRail>
    ))
    const sections = [...root.querySelectorAll('[data-slot="side-rail-section"]')]
    expect(sections[0]?.textContent).toBe('Projectsitems')
    expect(sections[1]?.textContent).toBe('bare')
    expect(sections[1]?.classList.contains('opacity-90')).toBe(true)
  })
})

describe('SideRailItem', () => {
  test('is a link marking the current page, with its label, badge, shortcut hint and keyshortcuts', () => {
    const root = dom.mount(() => (
      <SideRail>
        <SideRailItem
          href="/inbox"
          label="Inbox"
          active
          shortcut="G I"
          keyshortcuts="g i"
          badge={<b data-testid="badge">3</b>}
        >
          <i data-testid="glyph" />
        </SideRailItem>
      </SideRail>
    ))
    const link = root.querySelector('a')!
    expect(link.getAttribute('href')).toBe('/inbox')
    expect(link.getAttribute('aria-current')).toBe('page')
    expect(link.hasAttribute('data-active')).toBe(true)
    expect(link.getAttribute('aria-keyshortcuts')).toBe('g i')
    expect(link.textContent).toContain('Inbox')
    expect(link.querySelector('[data-testid="glyph"]')).not.toBeNull()
    expect(slot('side-rail-badge')?.textContent).toBe('3')
    expect(link.querySelector('[aria-hidden="true"]')?.textContent).toBe('G I')
    expect(link.classList.contains('bg-primary-subtle')).toBe(true)
  })

  test('an idle item is not the current page', () => {
    const link = dom
      .mount(() => (
        <SideRail>
          <SideRailItem href="/b" label="Boards" />
        </SideRail>
      ))
      .querySelector('a')!
    expect(link.hasAttribute('aria-current')).toBe(false)
    expect(link.hasAttribute('data-active')).toBe(false)
    expect(link.classList.contains('text-sidebar-muted-foreground')).toBe(true)
  })

  test('trailing content replaces the shortcut hint', () => {
    const link = dom
      .mount(() => (
        <SideRail>
          <SideRailItem href="/b" label="Boards" shortcut="G B" trailing={<em>new</em>} />
        </SideRail>
      ))
      .querySelector('a')!
    expect(link.querySelector('em')?.textContent).toBe('new')
    expect(link.textContent).not.toContain('G B')
  })

  test('can be rendered as another element', () => {
    const button = dom
      .mount(() => (
        <SideRail>
          <SideRailItem as="button" label="Open" />
        </SideRail>
      ))
      .querySelector('button')!
    expect(button.textContent).toContain('Open')
  })

  test('a collapsed rail names the item in a tip beside it on hover and focus, and removes it on leave', () => {
    const root = dom.mount(() => (
      <SideRail collapsed>
        <SideRailItem href="/inbox" label="Inbox" active shortcut="G I">
          <i data-testid="glyph" />
        </SideRailItem>
      </SideRail>
    ))
    const link = root.querySelector('a')!
    layOut(link, { top: 40, right: 56, height: 36 })
    expect(slot('side-rail-tip')).toBeNull()
    pointer(link, 'pointerenter')
    const tip = slot('side-rail-tip')!
    expect(tip.getAttribute('aria-hidden')).toBe('true')
    expect(tip.textContent).toContain('Inbox')
    expect(tip.textContent).toContain('G I')
    expect(tip.style.top).toBe('40px')
    expect(tip.style.left).toBe('64px')
    expect(tip.style.height).toBe('36px')
    expect(tip.querySelector('.text-primary')).not.toBeNull()
    pointer(link, 'pointerleave')
    expect(slot('side-rail-tip')).toBeNull()
    link.dispatchEvent(new dom.window.FocusEvent('focus'))
    expect(slot('side-rail-tip')).not.toBeNull()
    link.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(slot('side-rail-tip')).toBeNull()
  })

  test('an expanded rail shows its label inline and never a tip', () => {
    const link = dom
      .mount(() => (
        <SideRail>
          <SideRailItem href="/inbox" label="Inbox" />
        </SideRail>
      ))
      .querySelector('a')!
    layOut(link, { top: 0, right: 200, height: 36 })
    pointer(link, 'pointerenter')
    expect(slot('side-rail-tip')).toBeNull()
  })
})

describe('SideRailButton', () => {
  test('is a labelled button that reports presses and its active state', () => {
    let pressed = 0
    const root = dom.mount(() => (
      <SideRail>
        <SideRailButton label="Search" shortcut="⌘K" active onClick={() => (pressed += 1)}>
          <i data-testid="glyph" />
        </SideRailButton>
      </SideRail>
    ))
    const button = root.querySelector('button')!
    expect(button.getAttribute('type')).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Search')
    expect(button.getAttribute('data-active')).toBe('true')
    expect(button.querySelector('[aria-hidden="true"]')?.textContent).toBe('⌘K')
    button.click()
    expect(pressed).toBe(1)
  })

  test('an idle button carries no active marker and no hint without a shortcut', () => {
    const button = dom
      .mount(() => (
        <SideRail>
          <SideRailButton label="Settings" />
        </SideRail>
      ))
      .querySelector('button')!
    expect(button.hasAttribute('data-active')).toBe(false)
    expect(button.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  test('a collapsed rail shows a tip for the button on hover and focus', () => {
    const root = dom.mount(() => (
      <SideRail collapsed>
        <SideRailButton label="Search">
          <i />
        </SideRailButton>
      </SideRail>
    ))
    const button = root.querySelector('button')!
    layOut(button, { top: 100, right: 56, height: 32 })
    pointer(button, 'pointerenter')
    expect(slot('side-rail-tip')?.textContent).toContain('Search')
    expect(slot('side-rail-tip')?.style.left).toBe('64px')
    pointer(button, 'pointerleave')
    expect(slot('side-rail-tip')).toBeNull()
    button.dispatchEvent(new dom.window.FocusEvent('focus'))
    expect(slot('side-rail-tip')).not.toBeNull()
    button.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(slot('side-rail-tip')).toBeNull()
  })
})
