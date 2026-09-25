import { Dialog as KobalteDialog } from '@kobalte/core/dialog'
import { X } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'
import { DialogOverlay } from '../dialog/dialog'

/**
 * Sheet.
 *
 * A dialog anchored to an edge of the window rather than centred. Use it when
 * the content is a *panel beside* the work — a details inspector, a filter rail,
 * a settings flyout — so the user keeps the context it belongs to in view.
 * A centred dialog interrupts; a sheet is inspected.
 *
 * `side` decides which edge; the panel is a full-height column for `start` and
 * `end`, and a full-width row for `top` and `bottom`. The slide-in direction
 * follows from the side, so a caller never pairs them by hand.
 */
const sheetVariants = cva(
  'bg-popover text-popover-foreground fixed z-(--z-dialog) flex flex-col gap-4 border-border shadow-lg',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 h-auto max-h-[85vh] rounded-b-xl border-b data-expanded:slide-in-from-top data-closed:slide-out-to-top',
        bottom:
          'inset-x-0 bottom-0 h-auto max-h-[85vh] rounded-t-xl border-t data-expanded:slide-in-from-bottom data-closed:slide-out-to-bottom',
        start:
          'inset-y-0 start-0 h-full w-80 max-w-[85vw] rounded-e-xl border-e data-expanded:slide-in-from-left data-closed:slide-out-to-left',
        end: 'inset-y-0 end-0 h-full w-80 max-w-[85vw] rounded-s-xl border-s data-expanded:slide-in-from-right data-closed:slide-out-to-right',
      },
    },
    defaultVariants: { side: 'end' },
  }
)

export type SheetContentProps = ComponentProps<typeof KobalteDialog.Content> &
  VariantProps<typeof sheetVariants> & {
    closeButton?: JSX.Element | false
  }

export function SheetContent(props: SheetContentProps) {
  const [local, rest] = splitProps(props, ['class', 'side', 'children', 'closeButton'])

  return (
    <KobalteDialog.Portal>
      <DialogOverlay />
      <KobalteDialog.Content
        class={cn(
          sheetVariants({ side: local.side }),
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:duration-200',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <Show when={local.closeButton !== false}>
          <KobalteDialog.CloseButton
            aria-label="Close"
            class="absolute top-3.5 end-3.5 rounded-md p-1 text-muted-foreground transition-colors ease-out outline-none hover:bg-surface-hover hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle"
          >
            {local.closeButton ?? <X class="size-4" />}
          </KobalteDialog.CloseButton>
        </Show>
      </KobalteDialog.Content>
    </KobalteDialog.Portal>
  )
}

export function Sheet(props: ComponentProps<typeof KobalteDialog>) {
  return <KobalteDialog {...props} />
}

export function SheetTrigger(props: ComponentProps<typeof KobalteDialog.Trigger>) {
  return <KobalteDialog.Trigger {...props} />
}

export function SheetCloseButton(props: ComponentProps<typeof KobalteDialog.CloseButton>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDialog.CloseButton class={cn(local.class)} {...rest} />
}

export function SheetHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sheet-header"
      class={cn('flex flex-col gap-1.5 border-b border-border p-4 pe-12 text-start', local.class)}
      {...rest}
    />
  )
}

export function SheetBody(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sheet-body"
      class={cn('flex-1 overflow-y-auto px-4 pb-4', local.class)}
      {...rest}
    />
  )
}

export function SheetFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sheet-footer"
      class={cn('flex items-center justify-end gap-2 border-t border-border p-4', local.class)}
      {...rest}
    />
  )
}

export function SheetTitle(props: ComponentProps<typeof KobalteDialog.Title>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Title class={cn('text-sm leading-none font-semibold', local.class)} {...rest} />
  )
}

export function SheetDescription(props: ComponentProps<typeof KobalteDialog.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Description class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
  )
}

export { sheetVariants }
