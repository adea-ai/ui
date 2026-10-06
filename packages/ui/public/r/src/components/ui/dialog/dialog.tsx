import {
  Dialog as KobalteDialog,
  Content as KobalteDialogContent,
  Overlay as KobalteDialogOverlay,
} from '@kobalte/core/dialog'
// AlertDialog assigns to the shared DialogRoot.Content object, so these named exports stay role-stable.
import { X } from 'lucide-solid'
import type { Accessor, ComponentProps, JSX } from 'solid-js'
import { createRenderEffect, onCleanup, Show, splitProps } from 'solid-js'
import {
  dialogSurface,
  overlayMotion,
  overlayPositioner,
  overlayScrim,
  overlayTitle,
} from '../../../lib/overlay'
import { cn } from '../../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip'

type FocusCycle = {
  content: HTMLElement
  opener: HTMLElement | null
  openerEligible: boolean
  closed: boolean
  focusMovedOutside: boolean
  closeAutoFocusScheduled: boolean
  frame?: number
  fallbackTimer?: number
  observer?: MutationObserver
  onFocusIn: (event: FocusEvent) => void
}

function canRestoreFocus(target: HTMLElement): boolean {
  return (
    target.isConnected &&
    target !== document.body &&
    target !== document.documentElement &&
    !target.closest('[inert], [aria-hidden="true"]') &&
    !target.matches(':disabled') &&
    target.getClientRects().length > 0
  )
}

function hasOtherOverlay(content: HTMLElement, opener: HTMLElement): boolean {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')].some(
    (overlay) =>
      overlay !== content &&
      !content.contains(overlay) &&
      !overlay.contains(opener) &&
      !overlay.closest('[aria-hidden="true"], [inert]') &&
      overlay.getClientRects().length > 0
  )
}

type DialogFocusRestorationOptions = {
  open: Accessor<boolean>
  restoreFocusRef?: Accessor<HTMLElement | undefined>
  onOpenAutoFocus?: ComponentProps<typeof KobalteDialogContent>['onOpenAutoFocus']
  onCloseAutoFocus?: ComponentProps<typeof KobalteDialogContent>['onCloseAutoFocus']
}

/**
 * Adds guarded opener capture and restoration to a Kobalte dialog content.
 * Composed surfaces use this internal helper; it is omitted from the public
 * dialog barrel so the restoration policy stays with the dialog components.
 */
export function createDialogFocusRestoration({
  open,
  restoreFocusRef,
  onOpenAutoFocus: callerOnOpenAutoFocus,
  onCloseAutoFocus: callerOnCloseAutoFocus,
}: DialogFocusRestorationOptions) {
  const focusCycles = new WeakMap<HTMLElement, FocusCycle>()
  let activeFocusCycle: FocusCycle | undefined
  let pendingOpener: HTMLElement | null = null
  let pendingOpenerEligible = false

  createRenderEffect(() => {
    if (!open() || typeof document === 'undefined') {
      pendingOpener = null
      pendingOpenerEligible = false
      return
    }
    const active = restoreFocusRef?.() ?? document.activeElement
    pendingOpener = active instanceof HTMLElement ? active : null
    pendingOpenerEligible = active instanceof HTMLElement && canRestoreFocus(active)
  })

  const finishFocusCycle = (cycle: FocusCycle) => {
    if (cycle.frame !== undefined) window.cancelAnimationFrame(cycle.frame)
    if (cycle.fallbackTimer !== undefined) window.clearTimeout(cycle.fallbackTimer)
    cycle.observer?.disconnect()
    document.removeEventListener('focusin', cycle.onFocusIn)
    if (activeFocusCycle === cycle) activeFocusCycle = undefined
  }

  const scheduleFocusRestore = (cycle: FocusCycle) => {
    if (cycle.frame !== undefined) return
    cycle.frame = window.requestAnimationFrame(() => {
      cycle.frame = undefined
      const opener = cycle.opener
      const active = document.activeElement
      const focusIsAvailable =
        active === document.body ||
        active === document.documentElement ||
        active === cycle.content ||
        (active instanceof Node && cycle.content.contains(active))
      if (
        activeFocusCycle !== cycle ||
        !cycle.closed ||
        cycle.focusMovedOutside ||
        !opener ||
        !opener.isConnected ||
        opener.matches(':disabled') ||
        opener.getClientRects().length === 0 ||
        !focusIsAvailable ||
        hasOtherOverlay(cycle.content, opener)
      ) {
        finishFocusCycle(cycle)
        return
      }

      // Inert and aria-hidden are removed by the dialog's containment cleanup.
      // Wait for that cleanup before returning focus to the original control.
      if (opener.closest('[inert], [aria-hidden="true"]')) return
      if (cycle.openerEligible && canRestoreFocus(opener)) {
        opener.focus({ preventScroll: true })
      }
      finishFocusCycle(cycle)
    })
  }

  const onOpenAutoFocus = (event: Event) => {
    const element = event.currentTarget
    if (element instanceof HTMLElement) {
      if (activeFocusCycle) finishFocusCycle(activeFocusCycle)

      const openerWasCaptured = pendingOpener !== null
      const opener = pendingOpener ?? document.activeElement
      const openerEligible = openerWasCaptured
        ? pendingOpenerEligible
        : opener instanceof HTMLElement && canRestoreFocus(opener)
      pendingOpener = null
      pendingOpenerEligible = false
      const cycle: FocusCycle = {
        content: element,
        opener: opener instanceof HTMLElement ? opener : null,
        openerEligible,
        closed: false,
        focusMovedOutside: false,
        closeAutoFocusScheduled: false,
        onFocusIn: (focusEvent) => {
          const target = focusEvent.target
          if (
            !(target instanceof HTMLElement) ||
            target === document.body ||
            target === document.documentElement
          ) {
            return
          }
          if (
            target === element ||
            element.contains(target) ||
            target === (opener instanceof HTMLElement ? opener : null)
          ) {
            if (!cycle.closed) cycle.focusMovedOutside = false
            return
          }
          cycle.focusMovedOutside = true
        },
      }
      focusCycles.set(element, cycle)
      activeFocusCycle = cycle
      document.addEventListener('focusin', cycle.onFocusIn)
    }
    callerOnOpenAutoFocus?.(event)
  }

  const onCloseAutoFocus = (event: Event) => {
    const element = event.currentTarget
    const cycle = element instanceof HTMLElement ? focusCycles.get(element) : undefined
    callerOnCloseAutoFocus?.(event)

    if (!cycle) return
    cycle.closed = true

    // A caller that prevents Kobalte's close autofocus owns the focus decision.
    if (event.defaultPrevented) {
      finishFocusCycle(cycle)
      return
    }

    if (cycle.fallbackTimer !== undefined) {
      window.clearTimeout(cycle.fallbackTimer)
      cycle.fallbackTimer = undefined
    }
    cycle.closeAutoFocusScheduled = true
    cycle.observer = new MutationObserver(() => scheduleFocusRestore(cycle))
    cycle.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['aria-hidden', 'inert'],
      childList: true,
      subtree: true,
    })
    scheduleFocusRestore(cycle)
  }

  onCleanup(() => {
    const cycle = activeFocusCycle
    if (!cycle) return
    cycle.closed = true

    // Kobalte dispatches unmount autofocus from a timer. This fallback only
    // releases the scoped focus listener if the content did not dispatch it.
    queueMicrotask(() => {
      if (cycle.closeAutoFocusScheduled) return
      cycle.fallbackTimer = window.setTimeout(() => {
        cycle.fallbackTimer = undefined
        if (!cycle.closeAutoFocusScheduled) finishFocusCycle(cycle)
      }, 0)
    })
  })

  return { onOpenAutoFocus, onCloseAutoFocus }
}

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

export function DialogOverlay(props: ComponentProps<typeof KobalteDialogOverlay>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteDialogOverlay
      class={cn(
        overlayScrim,
        'data-expanded:animate-in data-expanded:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        local.class
      )}
      {...rest}
    />
  )
}

export type DialogContentProps = ComponentProps<typeof KobalteDialogContent> & {
  /**
   * Replaces the default close button. Pass `false` to remove it — only for a
   * dialog that cannot be dismissed (an update that must finish); anything the
   * user can escape from needs the button.
   */
  closeButton?: JSX.Element | false
  /** Use a 1rem inset as the positioner bounds for tall, viewport-filling surfaces. */
  positioner?: 'default' | 'inset'
}

export function DialogContent(props: DialogContentProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'closeButton', 'positioner'])

  return (
    <KobalteDialog.Portal>
      <DialogOverlay />
      <div class={cn(overlayPositioner, local.positioner === 'inset' && 'inset-4 grid-rows-1 p-0')}>
        <KobalteDialogContent
          class={cn(
            dialogSurface,
            overlayMotion,
            'relative grid w-full max-w-lg gap-4 p-5',
            local.class
          )}
          {...rest}
        >
          {local.children}
          <Show when={local.closeButton !== false}>
            {/* The corner close is icon-only, so it carries the shared tooltip
               treatment while its accessible name stays "Close". */}
            <Tooltip>
              <TooltipTrigger
                as={KobalteDialog.CloseButton}
                aria-label="Close"
                class={cn(
                  'absolute top-3.5 end-3.5 rounded-md p-1 text-muted-foreground',
                  'transition-colors ease-out hover:bg-surface-hover hover:text-foreground',
                  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle outline-none'
                )}
              >
                {local.closeButton ?? <X class="size-4" />}
              </TooltipTrigger>
              <TooltipContent>Close dialog.</TooltipContent>
            </Tooltip>
          </Show>
        </KobalteDialogContent>
      </div>
    </KobalteDialog.Portal>
  )
}

/**
 * The dialog's title block. `band` steps it onto the elevation ladder's
 * subtle-fill rung (`--muted`), the same treatment as the sheet parts' band —
 * for the dialog family whose panel anatomy matches a sheet's (a title band
 * over a full-bleed shell, such as a settings dialog) rather than the centred
 * modal's documented flat surface. See `SheetFooter` for the rung's rationale.
 */
export function DialogHeader(props: ComponentProps<'div'> & { band?: boolean }) {
  const [local, rest] = splitProps(props, ['class', 'band'])
  return (
    <div
      data-slot="dialog-header"
      class={cn('flex flex-col gap-1.5 pe-6 text-start', { 'bg-muted': local.band }, local.class)}
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
  return <KobalteDialog.Title class={cn(overlayTitle, local.class)} {...rest} />
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
