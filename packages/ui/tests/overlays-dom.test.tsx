import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../src/components/ui/dialog/dialog'
import {
  Popover,
  PopoverCloseButton,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '../src/components/ui/popover/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../src/components/ui/tooltip/tooltip'
import { useDom } from './helpers/dom'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const byRole = (role: string) => doc().querySelector(`[role="${role}"]`) as HTMLElement | null
const press = (target: Element, key: string) =>
  target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true }) as never)

function DialogExample(props: { onClose?: () => void; size?: 'sm' | 'xl'; closeButton?: false }) {
  const [open, setOpen] = createSignal(false)
  return (
    <Dialog
      open={open()}
      onOpenChange={(next: boolean) => {
        setOpen(next)
        if (!next) props.onClose?.()
      }}
    >
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent size={props.size} closeButton={props.closeButton}>
        <DialogHeader band>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Pick a new name.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogCloseButton>Cancel</DialogCloseButton>
          <DialogClose>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog', () => {
  test('opens from its trigger as a modal dialog named and described by its parts', async () => {
    dom.mount(() => <DialogExample />)
    expect(byRole('dialog')).toBeNull()
    doc().querySelector('button')!.click()
    await tick()
    const dialog = byRole('dialog')!
    expect(dialog).not.toBeNull()
    const title = dialog.querySelector('h2')!
    expect(title.textContent).toBe('Rename')
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id)
    const description = dialog.getAttribute('aria-describedby')!
    expect(doc().getElementById(description)?.textContent).toBe('Pick a new name.')
    expect(dialog.getAttribute('data-expanded')).not.toBeNull()
  })

  test('the header band, footer and size shape the surface', async () => {
    dom.mount(() => <DialogExample size="xl" />)
    doc().querySelector('button')!.click()
    await tick()
    expect(byRole('dialog')!.classList.contains('max-w-3xl')).toBe(true)
    expect(doc().querySelector('[data-slot="dialog-header"]')!.classList.contains('bg-muted')).toBe(
      true
    )
    expect(doc().querySelector('[data-slot="dialog-footer"]')!.classList.contains('flex')).toBe(
      true
    )
  })

  test('a footer button closes it and reports the change', async () => {
    let closed = 0
    dom.mount(() => <DialogExample onClose={() => (closed += 1)} />)
    doc().querySelector('button')!.click()
    await tick()
    const done = [...doc().querySelectorAll('button')].find((b) => b.textContent === 'Done')!
    done.click()
    await tick(60)
    expect(closed).toBe(1)
    expect(byRole('dialog')).toBeNull()
  })

  test('Escape closes it', async () => {
    let closed = 0
    dom.mount(() => <DialogExample onClose={() => (closed += 1)} />)
    doc().querySelector('button')!.click()
    await tick()
    press(byRole('dialog')!, 'Escape')
    await tick(60)
    expect(closed).toBe(1)
  })

  test('the corner close button is labelled Close, and can be turned off', async () => {
    dom.mount(() => <DialogExample />)
    doc().querySelector('button')!.click()
    await tick()
    expect(doc().querySelector('button[aria-label="Close"]')).not.toBeNull()
  })

  test('closeButton={false} leaves no corner close', async () => {
    dom.mount(() => <DialogExample closeButton={false} />)
    doc().querySelector('button')!.click()
    await tick()
    expect(byRole('dialog')).not.toBeNull()
    expect(doc().querySelector('button[aria-label="Close"]')).toBeNull()
  })

  test('returns focus to the control that opened it when it closes', async () => {
    // The restore skips an opener it cannot see; the DOM has no layout, so say it is laid out.
    const original = dom.window.HTMLElement.prototype.getClientRects
    dom.window.HTMLElement.prototype.getClientRects = (() => [{}]) as never
    try {
      dom.mount(() => <DialogExample />)
      const opener = doc().querySelector('button') as HTMLButtonElement
      opener.focus()
      opener.click()
      await tick()
      const done = [...doc().querySelectorAll('button')].find((b) => b.textContent === 'Done')!
      done.focus()
      expect(doc().activeElement === done).toBe(true)
      done.click()
      await tick(120)
      expect(doc().activeElement === opener).toBe(true)
    } finally {
      dom.window.HTMLElement.prototype.getClientRects = original
    }
  })
})

describe('Tooltip', () => {
  test('a tooltip held open shows its text as a tooltip tied to the trigger', async () => {
    dom.mount(() => (
      <TooltipProvider openDelay={0} closeDelay={0}>
        <Tooltip defaultOpen>
          <TooltipTrigger>Save</TooltipTrigger>
          <TooltipContent>Save the file</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ))
    await tick()
    const tip = byRole('tooltip')!
    expect(tip.textContent).toBe('Save the file')
    expect(tip.getAttribute('data-slot')).toBe('tooltip-content')
    expect(tip.getAttribute('aria-hidden')).toBeNull()
    const trigger = doc().querySelector('button')!
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id)
  })

  test('draws an optional icon beside the text, hidden from assistive tech', async () => {
    dom.mount(() => (
      <Tooltip defaultOpen>
        <TooltipTrigger>Info</TooltipTrigger>
        <TooltipContent icon={<i data-testid="glyph" />}>Details</TooltipContent>
      </Tooltip>
    ))
    await tick()
    const icon = doc().querySelector('[data-slot="tooltip-icon"]')!
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.querySelector('[data-testid="glyph"]')).not.toBeNull()
    expect(byRole('tooltip')!.classList.contains('whitespace-nowrap')).toBe(true)
  })

  test('Escape closes an open tooltip and tells the owner', async () => {
    const changes: boolean[] = []
    dom.mount(() => (
      <Tooltip defaultOpen onOpenChange={(open: boolean) => changes.push(open)}>
        <TooltipTrigger>Help</TooltipTrigger>
        <TooltipContent>Press for help</TooltipContent>
      </Tooltip>
    ))
    await tick()
    expect(byRole('tooltip')).not.toBeNull()
    press(doc().body, 'Escape')
    await tick(60)
    expect(changes).toEqual([false])
    expect(byRole('tooltip')).toBeNull()
  })

  test('a controlled tooltip follows its open prop and leaves the change to the owner', async () => {
    const [open, setOpen] = createSignal(false)
    const changes: boolean[] = []
    dom.mount(() => (
      <Tooltip open={open()} onOpenChange={(next: boolean) => changes.push(next)}>
        <TooltipTrigger>Owned</TooltipTrigger>
        <TooltipContent>Owned tip</TooltipContent>
      </Tooltip>
    ))
    await tick()
    expect(byRole('tooltip')).toBeNull()
    setOpen(true)
    await tick()
    expect(byRole('tooltip')?.textContent).toBe('Owned tip')
    press(doc().body, 'Escape')
    await tick()
    expect(changes.length).toBeGreaterThan(0)
    expect(changes.every((next) => next === false)).toBe(true)
    expect(byRole('tooltip')).not.toBeNull()
    setOpen(false)
    await tick(60)
    expect(byRole('tooltip')).toBeNull()
  })

  test('a disabled tooltip does not open from pointer or focus', async () => {
    dom.mount(() => (
      <TooltipProvider openDelay={0}>
        <Tooltip disabled>
          <TooltipTrigger>Quiet</TooltipTrigger>
          <TooltipContent>Never shown</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    trigger.dispatchEvent(new dom.window.PointerEvent('pointerenter', { bubbles: true }) as never)
    trigger.focus()
    await tick(50)
    expect(byRole('tooltip')).toBeNull()
  })

  test('opening one tooltip hands off the one that was open', async () => {
    const [first, setFirst] = createSignal<boolean | undefined>(undefined)
    dom.mount(() => (
      <TooltipProvider openDelay={0} closeDelay={0}>
        <Tooltip defaultOpen onOpenChange={setFirst}>
          <TooltipTrigger>One</TooltipTrigger>
          <TooltipContent>First</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>Two</TooltipTrigger>
          <TooltipContent>Second</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ))
    await tick()
    expect(byRole('tooltip')?.textContent).toBe('First')
    const second = [...doc().querySelectorAll('button')].find((b) => b.textContent === 'Two')!
    second.dispatchEvent(new dom.window.PointerEvent('pointerenter', { bubbles: true }) as never)
    await tick(60)
    expect(first()).toBe(false)
  })

  test('a tooltip opened by keyboard focus survives the pointer leaving the trigger', async () => {
    const changes: boolean[] = []
    dom.mount(() => (
      <TooltipProvider openDelay={0} closeDelay={10}>
        <Tooltip onOpenChange={(open: boolean) => changes.push(open)}>
          <TooltipTrigger>Focused</TooltipTrigger>
          <TooltipContent>Focus tip</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ))
    const trigger = doc().querySelector('button') as HTMLButtonElement
    // Keyboard modality first: a tooltip opens on focus only when focus came from the keyboard.
    press(doc().body, 'Tab')
    trigger.focus()
    await tick(30)
    expect(byRole('tooltip')).not.toBeNull()
    trigger.dispatchEvent(new dom.window.PointerEvent('pointerleave', { bubbles: true }) as never)
    await tick(80)
    expect(changes).not.toContain(false)
    expect(byRole('tooltip')).not.toBeNull()
  })

  test('the caller click handler runs, and the click closes an open tooltip', async () => {
    const changes: boolean[] = []
    let clicks = 0
    dom.mount(() => (
      <Tooltip defaultOpen onOpenChange={(open: boolean) => changes.push(open)}>
        <TooltipTrigger onClick={() => (clicks += 1)}>Press</TooltipTrigger>
        <TooltipContent>Press tip</TooltipContent>
      </Tooltip>
    ))
    await tick()
    ;(doc().querySelector('button') as HTMLButtonElement).click()
    await tick(60)
    expect(clicks).toBe(1)
  })
})

function PopoverExample(props: { hideArrow?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger>Details</PopoverTrigger>
      <PopoverContent hideArrow={props.hideArrow} class="opacity-90">
        <PopoverTitle>Heads up</PopoverTitle>
        <PopoverDescription>More to read.</PopoverDescription>
        <PopoverCloseButton>Dismiss</PopoverCloseButton>
      </PopoverContent>
    </Popover>
  )
}

describe('Popover', () => {
  test('opens from its trigger as a dialog named by its title', async () => {
    dom.mount(() => <PopoverExample />)
    const trigger = doc().querySelector('button') as HTMLButtonElement
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    trigger.click()
    await tick()
    const popover = byRole('dialog')!
    expect(popover.textContent).toContain('More to read.')
    expect(popover.classList.contains('opacity-90')).toBe(true)
    expect(popover.getAttribute('aria-labelledby')).toBe(popover.querySelector('h2')!.id)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  test('its close button dismisses it', async () => {
    dom.mount(() => <PopoverExample />)
    ;(doc().querySelector('button') as HTMLButtonElement).click()
    await tick()
    const dismiss = [...doc().querySelectorAll('button')].find((b) => b.textContent === 'Dismiss')!
    dismiss.click()
    await tick(60)
    expect(byRole('dialog')).toBeNull()
  })
})
