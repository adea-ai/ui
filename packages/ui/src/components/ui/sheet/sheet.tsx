import {
  Dialog as KobalteDialog,
  Content as KobalteDialogContent,
  useDialogContext,
} from '@kobalte/core/dialog'
// AlertDialog shares DialogRoot.Content; Sheet uses the stable named primitive.
import { X } from 'lucide-solid'
import type { Accessor, ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { overlayTitle } from '#lib/overlay'
import { cn } from '#lib/utils'
import { createDialogFocusRestoration, DialogOverlay } from '../dialog/dialog'

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
 *
 * `variant` decides how it meets that edge. `inset` — the default for `end` —
 * docks the panel inside the main view: below the top bar, one equal gap from
 * the top bar, the end edge and the bottom, with no scrim, so the work it edits
 * stays visible and the top bar stays reachable. It is the shape for editing one
 * thing beside its context (appearance settings, a task, a record). `edge` runs
 * edge to edge over a scrim — the shape of a navigation drawer, and the default
 * for every other side.
 *
 * Its parts read alike everywhere: `SheetHeader` holds a heading, a description
 * and a full-width rule beneath, with the close button in the corner;
 * `SheetBody` scrolls on its own; `SheetFooter` is a full-width band that holds
 * the decision. Pass `band` to the header, the footer, or both to step those
 * parts onto the ladder's subtle-fill rung (see `SheetFooter`).
 *
 * Controlled sheets opened from outside a `SheetTrigger` restore focus to the
 * element focused before opening. Pass `restoreFocusRef` when a stable external
 * opener must be used instead, such as when another layer closes before the
 * sheet opens.
 */
// `overflow-clip`, not `overflow-hidden`: a hidden overflow can still be
// scrolled programmatically (focus, scrollIntoView, scrollTop), which slid the
// pinned footer out of view. Only SheetBody scrolls.
const sheetVariants = cva(
  'bg-background text-foreground fixed z-(--z-dialog) flex flex-col overflow-clip border-border shadow-lg',
  {
    variants: {
      side: {
        top: 'data-expanded:slide-in-from-top data-closed:slide-out-to-top',
        bottom: 'data-expanded:slide-in-from-bottom data-closed:slide-out-to-bottom',
        start: 'data-expanded:slide-in-from-left data-closed:slide-out-to-left',
        end: 'data-expanded:slide-in-from-right data-closed:slide-out-to-right',
      },
      variant: {
        edge: '',
        inset: 'panel-dialog-inset w-lg rounded-xl border',
      },
      /**
       * `panel` gives a start or end sheet the shell's panel width
       * (`--panel-width`, 390px) — the width a pane that collapses into a sheet
       * on a narrow window already had beside the work, so its content does not
       * reflow when it moves. Top and bottom sheets span the window either way.
       */
      size: {
        default: '',
        panel: '',
      },
    },
    compoundVariants: [
      {
        side: 'top',
        variant: 'edge',
        class: 'inset-x-0 top-0 h-auto max-h-[85vh] rounded-b-xl border-b',
      },
      {
        side: 'bottom',
        variant: 'edge',
        class: 'inset-x-0 bottom-0 h-auto max-h-[85vh] rounded-t-xl border-t',
      },
      {
        side: 'start',
        variant: 'edge',
        class: 'inset-y-0 start-0 h-full w-80 max-w-[85vw] rounded-e-xl border-e',
      },
      {
        side: 'end',
        variant: 'edge',
        class: 'inset-y-0 end-0 h-full w-80 max-w-[85vw] rounded-s-xl border-s',
      },
      {
        side: ['start', 'end'],
        variant: 'edge',
        size: 'panel',
        class: 'w-panel max-w-[92vw]',
      },
      { side: ['start', 'end'], variant: 'inset', size: 'panel', class: 'w-panel' },
    ],
    defaultVariants: { side: 'end', variant: 'edge', size: 'default' },
  }
)

/** `inset` for the end edge, `edge` for every other side, unless the caller says. */
const sheetVariantFor = (
  side: SheetContentProps['side'],
  variant: SheetContentProps['variant']
): 'edge' | 'inset' => variant ?? ((side ?? 'end') === 'end' ? 'inset' : 'edge')

export type SheetContentProps = ComponentProps<typeof KobalteDialogContent> &
  VariantProps<typeof sheetVariants> & {
    closeButton?: JSX.Element | false
    /** The close button's accessible name. Defaults to "Close". */
    closeLabel?: string
    /** Supplies the stable external element to focus when the controlled sheet closes. */
    restoreFocusRef?: Accessor<HTMLElement | undefined>
  }

export function SheetContent(props: SheetContentProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'side',
    'variant',
    'size',
    'children',
    'closeButton',
    'closeLabel',
    'restoreFocusRef',
    'onOpenAutoFocus',
    'onCloseAutoFocus',
  ])
  const dialog = useDialogContext()
  const focusRestoration = createDialogFocusRestoration({
    open: dialog.isOpen,
    restoreFocusRef: local.restoreFocusRef,
    onOpenAutoFocus: local.onOpenAutoFocus,
    onCloseAutoFocus: local.onCloseAutoFocus,
  })

  const variant = () => sheetVariantFor(local.side, local.variant)

  return (
    <KobalteDialog.Portal>
      {/* An inset panel is beside the work, so the work stays in view: no scrim.
          It is still modal — focus stays inside and an outside click dismisses. */}
      <Show when={variant() === 'edge'}>
        <DialogOverlay />
      </Show>
      <KobalteDialogContent
        data-variant={variant()}
        class={cn(
          sheetVariants({ side: local.side, variant: variant(), size: local.size }),
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:duration-200',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150',
          local.class
        )}
        {...rest}
        onOpenAutoFocus={focusRestoration.onOpenAutoFocus}
        onCloseAutoFocus={focusRestoration.onCloseAutoFocus}
      >
        {local.children}
        <Show when={local.closeButton !== false}>
          {/* The close action opts into the tab order explicitly. Engines that
              derive tabbability from the DOM instead of the host (Playwright's
              WebKit walks only explicit tabindex and form controls) would skip
              an implicitly-tabbable button and jump past the sheet's end. */}
          <KobalteDialog.CloseButton
            aria-label={local.closeLabel ?? 'Close'}
            tabindex="0"
            class="absolute top-3.5 end-3.5 rounded-md p-1 text-muted-foreground transition-colors ease-out outline-none hover:bg-surface-hover hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle"
          >
            {local.closeButton ?? <X class="size-4" />}
          </KobalteDialog.CloseButton>
        </Show>
      </KobalteDialogContent>
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

/**
 * The sheet's title band: a heading, a description and the full-width rule
 * beneath, with the close button in the corner. `band` steps the band onto the
 * subtle-fill rung (see `SheetFooter`) — the two-toned anatomy of a sheet that
 * reads as a panel beside the work rather than one flat canvas.
 */
export function SheetHeader(props: ComponentProps<'div'> & { band?: boolean }) {
  const [local, rest] = splitProps(props, ['class', 'band'])
  return (
    <div
      data-slot="sheet-header"
      class={cn(
        'flex shrink-0 flex-col gap-1.5 border-b border-border p-4 pe-12 text-start',
        { 'bg-muted': local.band },
        local.class
      )}
      {...rest}
    />
  )
}

export function SheetBody(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="sheet-body"
      class={cn('min-h-0 flex-1 overflow-y-auto p-4', local.class)}
      {...rest}
    />
  )
}

/**
 * The sheet's decision band: a full-width, hairline-ruled strip that holds the
 * actions. `band` paints it with `--muted` — the elevation ladder's
 * subtle-fill rung, one step up from the panel's `--background` — so the sheet
 * reads two-toned: title band and decision band on the raised rung, scrolling
 * body on the panel surface. The rung already exists for cards, sidebars and
 * input fills; this is the panel-shaped overlay family claiming it. Opt-in
 * because the flat panel is the documented default: the centred modal
 * separates with veil, hairline and shadow instead (the elevated overlay rung
 * amplifies the canvas chroma, which reads as a cast across a large panel),
 * and a host opts a whole sheet family in by passing the prop where it composes
 * the parts — not by restyling them from the outside.
 */
export function SheetFooter(props: ComponentProps<'div'> & { band?: boolean }) {
  const [local, rest] = splitProps(props, ['class', 'band'])
  return (
    <div
      data-slot="sheet-footer"
      class={cn(
        'flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-3',
        { 'bg-muted': local.band },
        local.class
      )}
      {...rest}
    />
  )
}

export function SheetTitle(props: ComponentProps<typeof KobalteDialog.Title>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDialog.Title class={cn(overlayTitle, local.class)} {...rest} />
}

export function SheetDescription(props: ComponentProps<typeof KobalteDialog.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialog.Description class={cn('text-muted-foreground text-sm', local.class)} {...rest} />
  )
}

export { sheetVariants }
