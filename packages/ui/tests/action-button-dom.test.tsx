import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import { ActionButton } from '../src/components/composites/action-button/action-button'
import { TooltipProvider } from '../src/components/ui/tooltip/tooltip'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const tip = () => doc().querySelector('[role="tooltip"]') as HTMLElement | null
const pointer = (target: Element, type: string) =>
  target.dispatchEvent(new dom.window.PointerEvent(type, { bubbles: true, pointerType: 'mouse' }))

describe('ActionButton', () => {
  test('is a Button marked as an action button, passing its variant and size through', () => {
    const root = dom.mount(() => (
      <ActionButton variant="destructive" size="sm" class="opacity-90">
        Delete
      </ActionButton>
    ))
    const button = root.querySelector('button')!
    expect(button.getAttribute('data-slot')).toBe('action-button')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.classList.contains('bg-destructive-action')).toBe(true)
    expect(button.classList.contains('opacity-90')).toBe(true)
    expect(button.textContent).toBe('Delete')
  })

  test('a caller data-slot wins over the default', () => {
    const button = dom
      .mount(() => <ActionButton data-slot="mine">Go</ActionButton>)
      .querySelector('button')!
    expect(button.getAttribute('data-slot')).toBe('mine')
  })

  test('runs the click handler, in function and bound-tuple form', () => {
    const seen: string[] = []
    const root = dom.mount(() => (
      <>
        <ActionButton id="fn" onClick={() => seen.push('fn')}>
          A
        </ActionButton>
        <ActionButton id="tuple" onClick={[(data: string) => seen.push(data), 'tuple'] as never}>
          B
        </ActionButton>
      </>
    ))
    ;(root.querySelector('#fn') as HTMLElement).click()
    ;(root.querySelector('#tuple') as HTMLElement).click()
    expect(seen).toEqual(['fn', 'tuple'])
  })

  test('a disabled button cannot be clicked and says so', () => {
    let clicks = 0
    const button = dom
      .mount(() => (
        <ActionButton disabled onClick={() => (clicks += 1)}>
          Save
        </ActionButton>
      ))
      .querySelector('button')!
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    button.click()
    expect(clicks).toBe(0)
  })

  test('a busy button is disabled, announces it, and shows a spinner and a status', () => {
    const root = dom.mount(() => (
      <ActionButton busy busyLabel="Saving">
        Save
      </ActionButton>
    ))
    const button = root.querySelector('button')!
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.disabled).toBe(true)
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull()
    expect(root.querySelector('span[role="status"]')?.textContent).toBe('Saving')
  })

  test('a busy button announces "Working" unless told otherwise', () => {
    const root = dom.mount(() => <ActionButton busy>Save</ActionButton>)
    expect(root.querySelector('span[role="status"]')?.textContent).toBe('Working')
  })

  test('an idle button has no spinner or status', () => {
    const root = dom.mount(() => <ActionButton>Save</ActionButton>)
    expect(root.querySelector('[data-slot="spinner"]')).toBeNull()
    expect(root.querySelector('span[role="status"]')).toBeNull()
    expect(root.querySelector('button')!.hasAttribute('aria-busy')).toBe(false)
  })

  test('a disabled link drops its href and is announced as a link that cannot be followed', () => {
    const [disabled, setDisabled] = createSignal(true)
    const root = dom.mount(() => (
      <ActionButton as="a" href="/next" disabled={disabled()}>
        Next
      </ActionButton>
    ))
    const link = root.querySelector('a')!
    expect(link.hasAttribute('href')).toBe(false)
    expect(link.getAttribute('role')).toBe('link')
    expect(link.getAttribute('tabindex')).toBe('-1')
    expect(link.getAttribute('aria-disabled')).toBe('true')
    setDisabled(false)
    expect(link.getAttribute('href')).toBe('/next')
    expect(link.hasAttribute('tabindex')).toBe(false)
  })
})

describe('ActionButton with a tooltip', () => {
  test('keeps a disabled button focusable and inert so the tooltip can still explain it', () => {
    let clicks = 0
    const button = dom
      .mount(() => (
        <ActionButton disabled tooltip="Nothing to save" onClick={() => (clicks += 1)}>
          Save
        </ActionButton>
      ))
      .querySelector('button')!
    expect(button.disabled).toBe(false)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.getAttribute('tabindex')).toBe('0')
    expect(button.classList.contains('aria-disabled:pointer-events-auto')).toBe(true)
    button.click()
    expect(clicks).toBe(0)
  })

  test('a disabled link with a tooltip stays in the tab order', () => {
    const link = dom
      .mount(() => (
        <ActionButton as="a" href="/x" disabled tooltip="Unavailable">
          Go
        </ActionButton>
      ))
      .querySelector('a')!
    expect(link.getAttribute('tabindex')).toBe('0')
  })

  test('shows the tooltip text on hover, with an optional icon', async () => {
    dom.mount(() => (
      <TooltipProvider openDelay={0}>
        <ActionButton tooltip="Save the file" tooltipIcon={<i data-testid="icon" />}>
          Save
        </ActionButton>
      </TooltipProvider>
    ))
    expect(tip()).toBeNull()
    pointer(doc().querySelector('button')!, 'pointerenter')
    pointer(doc().querySelector('button')!, 'pointermove')
    await tick(60)
    expect(tip()?.textContent).toBe('Save the file')
    expect(tip()?.querySelector('[data-testid="icon"]')).not.toBeNull()
  })

  test('a click dismisses the tooltip and it stays away until the pointer leaves', async () => {
    let clicks = 0
    dom.mount(() => (
      <TooltipProvider openDelay={0} closeDelay={0}>
        <ActionButton tooltip="Save the file" onClick={() => (clicks += 1)}>
          Save
        </ActionButton>
      </TooltipProvider>
    ))
    const button = doc().querySelector('button') as HTMLButtonElement
    pointer(button, 'pointerenter')
    pointer(button, 'pointermove')
    await tick(60)
    expect(tip()).not.toBeNull()
    button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, detail: 1 }))
    await tick(60)
    expect(clicks).toBe(1)
    expect(tip()).toBeNull()
    pointer(button, 'pointerenter')
    pointer(button, 'pointermove')
    await tick(60)
    expect(tip()).toBeNull()
    pointer(button, 'pointerleave')
    pointer(button, 'pointerenter')
    pointer(button, 'pointermove')
    await tick(60)
    expect(tip()).not.toBeNull()
  })

  test('the caller pointer-leave and blur handlers still run', () => {
    const seen: string[] = []
    const button = dom
      .mount(() => (
        <ActionButton
          tooltip="Hint"
          onPointerLeave={() => seen.push('leave')}
          onBlur={() => seen.push('blur')}
        >
          Go
        </ActionButton>
      ))
      .querySelector('button')!
    pointer(button, 'pointerleave')
    button.dispatchEvent(new dom.window.FocusEvent('blur'))
    expect(seen).toEqual(['leave', 'blur'])
  })
})
