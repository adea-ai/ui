import { Dialog as KobalteDialog } from '@kobalte/core/dialog'
import { X } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { overlayMotion, overlayPositioner, overlayScrim, overlaySurface } from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * Dialog.
 *
 * A modal surface for a decision or a short task. `Dialog.Portal` keeps the
 * panel out of the app's stacking and overflow contexts, `Dialog.Overlay`
 * dims what is behind it, and Kobalte handles the focus trap, the escape key,
 * scroll locking and returning focus to the trigger on close.
 *
 * The close button is part of the content rather than optional, because every
 * modal needs a way out that is not the keyboard. A dialog whose only exit is
 * Escape is a trap for anyone using a pointer.
 */
export function Dialog(props: ComponentProps<typeof KobalteDialog>) {
  return <KobalteDialog {...props} />
}

export function DialogTrigger(props: ComponentProps<typeof KobalteDialog.Trigger>) {
  return <KobalteDialog.Trigger {...props} />
}

export function DialogPortal(props: ComponentProps<typeof KobalteDialog.Portal>) {
  return <KobalteDialog.Portal {...props} />
}

export function DialogOverlay(props: ComponentProps<typeof KobalteDialog.Overlay>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Overlay
      class={cn(
        overlayScrim,
        'data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        local.class
      )}
      {...rest}
    />
  )
}

export type DialogContentProps = ComponentProps<typeof KobalteDialog.Content> & {
  /**
   * Replaces the default close button. Pass `false` to remove it — only for a
   * dialog that cannot be dismissed (an update that must finish); anything the
   * user can escape from needs the button.
   */
  closeButton?: JSX.Element | false
}

export function DialogContent(props: DialogContentProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'closeButton'])

  return (
    <KobalteDialog.Portal>
      <DialogOverlay />
      <div class={overlayPositioner}>
        <KobalteDialog.Content
          class={cn(overlaySurface, overlayMotion, 'grid w-full max-w-lg gap-4 p-5', local.class)}
          {...rest}
        >
          {local.children}
          <Show when={local.closeButton !== false}>
            <KobalteDialog.CloseButton
              aria-label="Close"
              class={cn(
                'absolute top-3.5 end-3.5 rounded-md p-1 text-muted-foreground',
                'transition-colors ease-out hover:bg-surface-hover hover:text-foreground',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle outline-none'
              )}
            >
              {local.closeButton ?? <X class="size-4" />}
            </KobalteDialog.CloseButton>
          </Show>
        </KobalteDialog.Content>
      </div>
    </KobalteDialog.Portal>
  )
}

export function DialogHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="dialog-header"
      class={cn('flex flex-col gap-1.5 pe-6 text-start', local.class)}
      {...rest}
    />
  )
}

export function DialogFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="dialog-footer"
      class={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', local.class)}
      {...rest}
    />
  )
}

export function DialogTitle(props: ComponentProps<typeof KobalteDialog.Title>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Title
      class={cn('text-base leading-none font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function DialogDescription(props: ComponentProps<typeof KobalteDialog.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Description class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
  )
}

export function DialogCloseButton(props: ComponentProps<typeof KobalteDialog.CloseButton>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDialog.CloseButton class={cn('focus-ring', local.class)} {...rest} />
}

/**
 * The close control, unstyled and polymorphic — for a footer's text "Cancel" or
 * "Close", which is a different control from the corner icon `DialogCloseButton`
 * draws. Take it as `as={Button}` so it carries the button's variants rather than
 * a copied class string.
 */
export function DialogClose(props: ComponentProps<typeof KobalteDialog.CloseButton>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDialog.CloseButton class={cn('focus-ring', local.class)} {...rest} />
}
