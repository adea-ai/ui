import { AlertDialog as KobalteAlertDialog } from '@kobalte/core/alert-dialog'
import type { ComponentProps } from 'solid-js'
import { createEffect, createSignal, splitProps } from 'solid-js'
import { overlayMotion, overlayPositioner, overlayScrim, overlaySurface } from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * AlertDialog.
 *
 * A dialog that cannot be dismissed by accident: Escape and a click on the scrim
 * do nothing, and the user must choose one of the actions. That is the whole
 * difference from Dialog, and it is why this exists as its own component rather
 * than a prop — a caller has to reach for it deliberately.
 *
 * The consequence is a rule of use: this is for confirming a destructive or
 * irreversible step. Wrapping an ordinary form in an AlertDialog traps someone who
 * wants to back out.
 *
 * There is deliberately no close button in the corner. An X has no label, and the
 * point of this surface is that every exit is a named choice.
 */
export function AlertDialog(props: ComponentProps<typeof KobalteAlertDialog>) {
  return <KobalteAlertDialog {...props} />
}

export function AlertDialogTrigger(props: ComponentProps<typeof KobalteAlertDialog.Trigger>) {
  return <KobalteAlertDialog.Trigger {...props} />
}

export function AlertDialogPortal(props: ComponentProps<typeof KobalteAlertDialog.Portal>) {
  return <KobalteAlertDialog.Portal {...props} />
}

export function AlertDialogOverlay(props: ComponentProps<typeof KobalteAlertDialog.Overlay>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteAlertDialog.Overlay
      class={cn(
        overlayScrim,
        'data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        local.class
      )}
      {...rest}
    />
  )
}

/**
 * The panel.
 *
 * Kobalte's `AlertDialog.Content` is `Dialog.Content` with `role="alertdialog"`
 * and nothing else — Escape and an outside click dismiss it exactly as they
 * dismiss a Dialog. That is a real gap in the primitive, so the blocking is
 * implemented here, and it is the whole difference between this component and a
 * Dialog:
 *
 *   - Escape is prevented, because a key that closes a confirmation is a key that
 *     makes "confirm" meaningless.
 *   - Pointer and focus interactions outside are prevented, including the scrim
 *     click, for the same reason.
 *
 * There is deliberately no prop to turn this off. A surface that can be escaped
 * accidentally does not need to be an AlertDialog; it is a Dialog, and using this
 * one would be a claim about the flow that is not true.
 */
const blockDismissal = {
  onEscapeKeyDown: (event: KeyboardEvent) => event.preventDefault(),
  onPointerDownOutside: (event: Event) => event.preventDefault(),
  onFocusOutside: (event: Event) => event.preventDefault(),
  onInteractOutside: (event: Event) => event.preventDefault(),
} as const

export function AlertDialogContent(props: ComponentProps<typeof KobalteAlertDialog.Content>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteAlertDialog.Portal>
      <AlertDialogOverlay />
      <div class={overlayPositioner}>
        <KobalteAlertDialog.Content
          {...blockDismissal}
          class={cn(overlaySurface, overlayMotion, 'grid w-full max-w-md gap-4 p-5', local.class)}
          {...rest}
        />
      </div>
    </KobalteAlertDialog.Portal>
  )
}

export function AlertDialogHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="alert-dialog-header"
      class={cn('flex flex-col gap-1.5 text-start', local.class)}
      {...rest}
    />
  )
}

export function AlertDialogFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="alert-dialog-footer"
      class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', local.class)}
      {...rest}
    />
  )
}

export function AlertDialogTitle(props: ComponentProps<typeof KobalteAlertDialog.Title>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteAlertDialog.Title
      class={cn('text-base leading-none font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function AlertDialogDescription(
  props: ComponentProps<typeof KobalteAlertDialog.Description>
) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteAlertDialog.Description
      class={cn('text-muted-foreground text-sm', local.class)}
      {...rest}
    />
  )
}

/**
 * One of the dialog's two named choices.
 *
 * Kobalte labels its close button "Dismiss" by default, because a generic close
 * button is usually an icon with no text of its own. In an AlertDialog it is
 * something else: the named choices. An `aria-label` there *replaces* the visible
 * text, so a screen reader hears "Dismiss" twice and the user cannot tell the
 * destructive action from the safe one.
 *
 * The injected label is removed rather than overridden with an empty one. An empty
 * `aria-label` is not reliably ignored — some name computations treat its presence
 * as an explicit empty name, which leaves the button unnamed — so the attribute
 * has to go, and the visible text becomes the name. A caller whose button is an
 * icon passes its own `aria-label`, and that one is left alone.
 *
 * Applied through a layout-neutral wrapper because Kobalte keeps the `ref` for its
 * own dismissable layer and does not forward it. The wrapper is `display: contents`
 * so the button remains the flex item its parent lays out.
 */
function AlertDialogChoice(props: ComponentProps<typeof KobalteAlertDialog.CloseButton>) {
  const [local, rest] = splitProps(props, ['class', 'aria-label'])
  const [wrapper, setWrapper] = createSignal<HTMLSpanElement>()

  createEffect(() => {
    const root = wrapper()
    if (!root || local['aria-label'] !== undefined) return
    root.querySelector('button')?.removeAttribute('aria-label')
  })

  return (
    <span ref={setWrapper} class="contents">
      <KobalteAlertDialog.CloseButton class={cn(local.class)} {...rest} />
    </span>
  )
}

export function AlertDialogAction(props: ComponentProps<typeof KobalteAlertDialog.CloseButton>) {
  return <AlertDialogChoice {...props} />
}

export function AlertDialogCancel(props: ComponentProps<typeof KobalteAlertDialog.CloseButton>) {
  return <AlertDialogChoice {...props} />
}
