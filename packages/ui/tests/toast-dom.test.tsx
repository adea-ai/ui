import { afterEach, describe, expect, test } from 'bun:test'

import { Toaster, toast } from '../src/components/ui/toast/toast'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const failing = () => Promise.reject(new Error('disk full'))
const text = () => doc().querySelector('[role="region"]')?.textContent ?? ''
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  toast.clear()
})

describe('Toaster and toast', () => {
  test('renders a fixed region at the chosen corner', () => {
    dom.mount(() => <Toaster position="top-left" class="opacity-90" />)
    const region = doc().querySelector('[role="region"]')!
    expect(region.classList.contains('top-0')).toBe(true)
    expect(region.classList.contains('left-0')).toBe(true)
    expect(region.classList.contains('opacity-90')).toBe(true)
    expect(region.querySelector('ol')?.classList.contains('items-start')).toBe(true)
  })

  test('defaults to the bottom right', () => {
    dom.mount(() => <Toaster />)
    const region = doc().querySelector('[role="region"]')!
    expect(region.classList.contains('bottom-0')).toBe(true)
    expect(region.classList.contains('right-0')).toBe(true)
    expect(region.querySelector('ol')?.classList.contains('items-end')).toBe(true)
  })

  test('shows a toast with its title, description and action', async () => {
    dom.mount(() => <Toaster />)
    toast.show({
      title: 'Saved',
      description: 'Your changes are stored.',
      action: <button type="button">Undo</button>,
    })
    await tick()
    const region = doc().querySelector('[role="region"]')!
    expect(region.textContent).toContain('Saved')
    expect(region.textContent).toContain('Your changes are stored.')
    expect(region.querySelector('button')?.textContent).toBe('Undo')
  })

  test('each tone paints its own accent', async () => {
    dom.mount(() => <Toaster />)
    toast.success('Done')
    toast.warning('Careful')
    toast.info('FYI')
    await tick()
    const cards = [...doc().querySelectorAll('li')] as HTMLElement[]
    const tones = cards.map((card) => card.getAttribute('style') ?? '')
    expect(cards.length).toBe(3)
    expect(tones.join('|')).toContain('var(--success)')
    expect(tones.join('|')).toContain('var(--warning)')
    expect(tones.join('|')).toContain('var(--info)')
  })

  test('an error toast stays until it is dismissed', async () => {
    dom.mount(() => <Toaster />)
    toast.error('Sync failed', { duration: 10 })
    await tick(80)
    expect(doc().querySelector('[role="region"]')?.textContent).toContain('Sync failed')
  })

  test('an ordinary toast leaves after its duration', async () => {
    dom.mount(() => <Toaster />)
    toast.info('Brief', { duration: 20 })
    await tick(10)
    expect(doc().querySelector('[role="region"]')?.textContent).toContain('Brief')
    await tick(150)
    expect(doc().querySelector('[role="region"]')?.textContent).not.toContain('Brief')
  })

  test('the dismiss button removes the toast', async () => {
    dom.mount(() => <Toaster />)
    toast.show({ title: 'Closable', persistent: true })
    await tick()
    const dismiss = doc().querySelector('button[aria-label="Dismiss notification"]') as HTMLElement
    dismiss.click()
    await tick(100)
    expect(doc().querySelector('[role="region"]')?.textContent).not.toContain('Closable')
  })

  test('dismiss by id removes one toast and clear removes the rest', async () => {
    dom.mount(() => <Toaster />)
    const first = toast.show({ title: 'First', persistent: true })
    toast.show({ title: 'Second', persistent: true })
    await tick()
    toast.dismiss(first)
    await tick(100)
    expect(text()).not.toContain('First')
    expect(text()).toContain('Second')
    toast.clear()
    await tick(100)
    expect(text()).not.toContain('Second')
  })

  test('shows at most three at a time', async () => {
    dom.mount(() => <Toaster />)
    for (const name of ['One', 'Two', 'Three', 'Four'])
      toast.show({ title: name, persistent: true })
    await tick()
    expect(doc().querySelectorAll('li').length).toBeLessThanOrEqual(3)
  })

  test('a named region receives only toasts sent to it', async () => {
    dom.mount(() => (
      <>
        <Toaster region="left" />
        <Toaster region="right" />
      </>
    ))
    toast.show({ title: 'For the right', region: 'right', persistent: true })
    await tick()
    const regions = [...doc().querySelectorAll('[role="region"]')]
    expect(regions.map((region) => region.textContent?.includes('For the right'))).toEqual([
      false,
      true,
    ])
  })

  test('a promise toast moves from pending to its success message and returns the value', async () => {
    dom.mount(() => <Toaster />)
    let resolve!: (value: number) => void
    const pending = new Promise<number>((r) => (resolve = r))
    const returned = toast.promise(pending, {
      pending: 'Saving…',
      success: (value) => `Saved ${value}`,
      error: 'Failed',
    })
    await tick()
    expect(text()).toContain('Saving…')
    resolve(3)
    expect(await returned).toBe(3)
    await tick()
    expect(text()).toContain('Saved 3')
  })

  test('a promise toast reports a failure with the error message and keeps it', async () => {
    dom.mount(() => <Toaster />)
    const returned = toast.promise(failing, {
      pending: 'Saving…',
      success: 'Saved',
      error: (error) => `Failed: ${(error as Error).message}`,
    })
    await returned.catch(() => {})
    await tick(80)
    expect(doc().querySelector('[role="region"]')?.textContent).toContain('Failed: disk full')
  })

  test('a promise toast takes plain success and error strings', async () => {
    dom.mount(() => <Toaster />)
    await toast.promise(Promise.resolve('ok'), { pending: 'Wait', success: 'Fine', error: 'Bad' })
    await tick()
    expect(doc().querySelector('[role="region"]')?.textContent).toContain('Fine')
  })
})
