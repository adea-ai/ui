import type { ComponentProps, JSX } from 'solid-js'
import { Show, createEffect, createSignal, onCleanup, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
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
 * A dialog that owns three things `Dialog` leaves to its caller, each of which is a
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
 *   3. **It labels itself explicitly.** The title registers its id for
 *      `aria-labelledby` in a mount effect; if that registration is ever lost, the
 *      dialog renders with a heading and no name. Passing the label as well costs
 *      nothing and removes the race.
 *
 * Use `Dialog` directly when you need its composition; use this when you want a
 * dialog that is correct by default.
 */
export type ModalDialogProps = Omit<ComponentProps<typeof DialogContent>, 'children'> & {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  /** A mark or icon drawn before the title. */
  headerLeading?: JSX.Element
  children?: JSX.Element
}

export function ModalDialog(props: ModalDialogProps) {
  const [local, rest] = splitProps(props, [
    'open',
    'onClose',
    'title',
    'description',
    'headerLeading',
    'class',
    'children',
  ])

  const [content, setContent] = createSignal<HTMLElement>()

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
      <Dialog open onOpenChange={(next) => !next && local.onClose()}>
        <DialogContent ref={setContent} class={cn('gap-4', local.class)} {...rest}>
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
