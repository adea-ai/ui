import type { Accessor, ComponentProps, JSX } from 'solid-js'
import { Show, createEffect, createSignal, onCleanup, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import {
  createDialogFocusRestoration,
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
 *   5. **It keeps its own portal out of an enclosing layer's `aria-hidden`
 *      bookkeeping.** A non-modal dialog opened while a modal `Sheet` is alive would
 *      otherwise be aria-hidden one frame after it mounts — the enclosing layer's
 *      hide-outside observer walks late-arriving body children as background. The
 *      portal carries the marker that observer exempts; a modal layer opened above
 *      still hides it, because that path matches a different attribute.
 *
 * Use `Dialog` directly when you need its composition; use this when you want a
 * dialog that is correct by default. `size="settings"` supplies a wide, bounded
 * shell for a shared settings layout; ordinary dialogs keep their compact default.
 */
export type ModalDialogProps = Omit<
  ComponentProps<typeof DialogContent>,
  'children' | 'aria-label' | 'aria-labelledby' | 'positioner'
> & {
  /** Selects the bounded, scrollable shell used for grouped workspace settings. */
  size?: 'default' | 'settings'
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

export function ModalDialog(props: ModalDialogProps) {
  const [local, rest] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'modal',
    'size',
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
  const focusRestoration = createDialogFocusRestoration({
    open: () => local.open,
    restoreFocusRef: local.restoreFocusRef,
    onOpenAutoFocus: local.onOpenAutoFocus,
    onCloseAutoFocus: local.onCloseAutoFocus,
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

    // Kobalte's hide-outside observer walks body children added after its layer
    // opened and aria-hides them one frame later, so a non-modal dialog portaled
    // in during that window would land outside the accessibility tree — role
    // queries never resolve it again while the enclosing layer stays open. The
    // observer exempts added nodes carrying its top-layer marker (it checks the
    // React Aria spelling it ported; `data-kb-top-layer` is only matched by a
    // newer layer's initial walk, which must still hide this dialog).
    let portal = element
    while (portal.parentElement !== null && portal.parentElement !== document.body) {
      portal = portal.parentElement
    }
    portal.setAttribute('data-react-aria-top-layer', 'true')
    onCleanup(() => portal.removeAttribute('data-react-aria-top-layer'))
  })

  return (
    <Show when={local.open}>
      <Dialog open modal={local.modal ?? true} onOpenChange={(next) => !next && local.onClose()}>
        <DialogContent
          ref={setContent}
          positioner={local.size === 'settings' ? 'inset' : 'default'}
          class={cn(
            'gap-4',
            local.size === 'settings' &&
              'flex h-208 max-h-full min-h-0 max-w-6xl flex-col gap-0 overflow-hidden p-0',
            local.class
          )}
          aria-label={local['aria-label'] ?? local.title}
          aria-labelledby={
            local['aria-labelledby'] ?? (local['aria-label'] !== undefined ? '' : undefined)
          }
          {...rest}
          onOpenAutoFocus={focusRestoration.onOpenAutoFocus}
          onCloseAutoFocus={focusRestoration.onCloseAutoFocus}
        >
          <DialogHeader
            class={
              local.size === 'settings'
                ? 'shrink-0 gap-1 border-b border-border px-5 pt-4 pb-3 pe-14'
                : undefined
            }
          >
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
