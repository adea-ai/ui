import type { Accessor, ComponentProps, JSX } from 'solid-js'
import {
  Show,
  createEffect,
  createRenderEffect,
  createSignal,
  onCleanup,
  splitProps,
} from 'solid-js'
import { cn } from '../../../lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'

/**
 * ModalDialog.
 *
 * A dialog that owns four things `Dialog` leaves to its caller, each of which is a
 * real defect when it is missed:
 *
 *   1. **It unmounts while closed.** An always-mounted dialog that closes as a side
 *      effect of an async action can leave Kobalte's `aria-hidden` bookkeeping behind,
 *      which hides the rest of the application from assistive technology. Unmounting
 *      the whole owner makes cleanup the only way the layer can end.
 *   2. **It marks the background `inert`.** `inert` keeps the background out of the
 *      tab order and the accessibility tree without depending on that bookkeeping, and
 *      it restores exactly the elements that did not already have it — so a nested
 *      dialog does not un-inert its parent.
 *   3. **It sets an explicit accessible name.** The content receives `aria-label`
 *      from `title`, so its name does not depend on the title id registration effect.
 *      Pass `aria-label` to use a different name while keeping the visible title;
 *      pass `aria-labelledby` when another visible label should take precedence.
 *   4. **It returns focus to the opener.** The opener is captured before the dialog
 *      autofocuses and restored after the owner closes, unless a close-autofocus
 *      handler takes control or focus has moved to another layer. For controlled
 *      dialogs without a composed trigger, pass `restoreFocusRef` when the opener
 *      cannot be inferred from the focused element.
 *
 * Use `Dialog` directly when you need its composition; use this when you want a
 * dialog that is correct by default.
 */
export type ModalDialogProps = Omit<
  ComponentProps<typeof DialogContent>,
  'children' | 'aria-label' | 'aria-labelledby'
> & {
  open: boolean
  onClose: () => void
  title: string
  /**
   * Controls Kobalte's focus, scroll and accessibility modality. Defaults to `true`;
   * background body children remain inert in either mode.
   */
  modal?: boolean
  description?: string
  /** A mark or icon drawn before the title. */
  headerLeading?: JSX.Element
  /** Replaces `title` as the accessible name while keeping the visible title. */
  'aria-label'?: string
  /** Names the dialog from a visible element; ARIA gives it precedence over `aria-label`. */
  'aria-labelledby'?: string
  /**
   * Supplies the external control to focus when this controlled dialog closes.
   * Defaults to the element focused immediately before the dialog opens.
   */
  restoreFocusRef?: Accessor<HTMLElement | undefined>
  children?: JSX.Element
}

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

export function ModalDialog(props: ModalDialogProps) {
  const [local, rest] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'modal',
    'description',
    'headerLeading',
    'class',
    'children',
    'aria-label',
    'aria-labelledby',
    'restoreFocusRef',
    'onOpenAutoFocus',
    'onCloseAutoFocus',
  ])

  const [content, setContent] = createSignal<HTMLElement>()
  const focusCycles = new WeakMap<HTMLElement, FocusCycle>()
  let activeFocusCycle: FocusCycle | undefined
  let pendingOpener: HTMLElement | null = null
  let pendingOpenerEligible = false

  createRenderEffect(() => {
    if (!local.open || typeof document === 'undefined') {
      pendingOpener = null
      pendingOpenerEligible = false
      return
    }
    const active = local.restoreFocusRef?.() ?? document.activeElement
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
            target === document.documentElement ||
            target === element ||
            element.contains(target) ||
            target === (opener instanceof HTMLElement ? opener : null)
          ) {
            return
          }
          cycle.focusMovedOutside = true
        },
      }
      focusCycles.set(element, cycle)
      activeFocusCycle = cycle
      document.addEventListener('focusin', cycle.onFocusIn)
    }
    local.onOpenAutoFocus?.(event)
  }

  const onCloseAutoFocus = (event: Event) => {
    const element = event.currentTarget
    const cycle = element instanceof HTMLElement ? focusCycles.get(element) : undefined
    local.onCloseAutoFocus?.(event)

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

  createEffect(() => {
    if (!local.open) return
    const element = content()
    if (!element) return

    const background = [...document.body.children].filter(
      (child): child is HTMLElement => child instanceof HTMLElement && !child.contains(element)
    )
    const wasInert = background.map((node) => node.hasAttribute('inert'))
    for (const node of background) node.setAttribute('inert', '')

    onCleanup(() => {
      background.forEach((node, index) => {
        // Only the elements that were not already inert are restored, so a nested
        // dialog closing does not undo its parent's containment.
        if (!wasInert[index]) node.removeAttribute('inert')
      })
    })
  })

  return (
    <Show when={local.open}>
      <Dialog open modal={local.modal ?? true} onOpenChange={(next) => !next && local.onClose()}>
        <DialogContent
          ref={setContent}
          class={cn('gap-4', local.class)}
          aria-label={local['aria-label'] ?? local.title}
          aria-labelledby={
            local['aria-labelledby'] ?? (local['aria-label'] !== undefined ? '' : undefined)
          }
          {...rest}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
              <Show when={local.headerLeading}>{local.headerLeading}</Show>
              {local.title}
            </DialogTitle>
            <Show when={local.description}>
              <DialogDescription>{local.description}</DialogDescription>
            </Show>
          </DialogHeader>
          {local.children}
        </DialogContent>
      </Dialog>
    </Show>
  )
}
