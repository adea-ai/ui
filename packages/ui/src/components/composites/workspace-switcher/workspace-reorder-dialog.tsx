import { ArrowDown, ArrowUp } from 'lucide-solid'
import { For, Show, createEffect, createSignal, on, type Accessor } from 'solid-js'
import { Button } from '../../ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import { createDialogFocusRestoration } from '../../ui/dialog/dialog'
import { ActionButton } from '../action-button'
import { moveTarget, moveWorkspace, type WorkspaceMoveDirection } from './workspace-order'

export type WorkspaceReorderItem = {
  id: string
  name: string
  fixed?: boolean
}

export type WorkspaceReorderDialogProps = {
  open: boolean
  onOpenChange(open: boolean): void
  workspaces: readonly WorkspaceReorderItem[]
  /** Receives the full id order after one move. May be async; a rejection shows an error. */
  onReorder(ids: readonly string[]): void | Promise<void>
  title?: string
  /** Where focus returns on close; the menu item that opened the dialog is gone by then. */
  restoreFocusRef?: Accessor<HTMLElement | undefined>
}

/**
 * WorkspaceReorderDialog.
 *
 * Ordering by buttons, not by dragging, so it works from the keyboard and with
 * a screen reader: every row has a labelled Move up and Move down. Each move is
 * reported to the host straight away (there is no Save), the moved row keeps
 * focus on the control that was used, and the new position is announced.
 */
export function WorkspaceReorderDialog(props: WorkspaceReorderDialogProps) {
  const [status, setStatus] = createSignal('')
  const [error, setError] = createSignal('')
  const [pending, setPending] = createSignal(false)
  let list: HTMLOListElement | undefined

  createEffect(
    on(
      () => props.open,
      () => {
        setStatus('')
        setError('')
        setPending(false)
      }
    )
  )

  const focus = createDialogFocusRestoration({
    open: () => props.open,
    restoreFocusRef: props.restoreFocusRef,
  })

  const focusMove = (id: string, direction: WorkspaceMoveDirection) => {
    // The host re-renders the rows with the new order; focus the same control
    // once it exists, or its sibling when the move reached an edge.
    requestAnimationFrame(() => {
      const row = list?.querySelector<HTMLElement>(`[data-reorder-id="${CSS.escape(id)}"]`)
      const wanted = row?.querySelector<HTMLElement>(`[data-move="${direction}"]`)
      const other = row?.querySelector<HTMLElement>(
        `[data-move="${direction === 'up' ? 'down' : 'up'}"]`
      )
      const target = wanted?.getAttribute('aria-disabled') === 'true' ? other : wanted
      target?.focus({ preventScroll: true })
    })
  }

  const move = async (item: WorkspaceReorderItem, direction: WorkspaceMoveDirection) => {
    if (pending()) return
    const next = moveWorkspace(props.workspaces, item.id, direction)
    if (!next) return
    setError('')
    setPending(true)
    try {
      await props.onReorder(next)
      setStatus(`Moved ${item.name} to position ${next.indexOf(item.id) + 1} of ${next.length}.`)
    } catch {
      setStatus('')
      setError('Could not save the order. Try again.')
    } finally {
      setPending(false)
      focusMove(item.id, direction)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        class="w-full max-w-sm"
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{props.title ?? 'Reorder workspaces'}</DialogTitle>
          <DialogDescription>
            Move a workspace up or down. The order is saved as you go.
          </DialogDescription>
        </DialogHeader>
        <ol ref={(el) => (list = el)} class="flex flex-col gap-1" aria-label="Workspace order">
          <For each={props.workspaces}>
            {(item) => (
              <li
                data-reorder-id={item.id}
                class="flex items-center gap-2 rounded-md border border-border px-3 py-1.5"
              >
                <span class="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                <Show
                  when={!item.fixed}
                  fallback={<span class="text-xs text-muted-foreground">Always first</span>}
                >
                  <For each={['up', 'down'] as const}>
                    {(direction) => (
                      <ActionButton
                        variant="ghost"
                        size="icon-sm"
                        data-move={direction}
                        aria-label={`Move ${item.name} ${direction}`}
                        tooltip={`Move ${direction}`}
                        disabled={moveTarget(props.workspaces, item.id, direction) === undefined}
                        onClick={() => void move(item, direction)}
                      >
                        <Show when={direction === 'up'} fallback={<ArrowDown aria-hidden="true" />}>
                          <ArrowUp aria-hidden="true" />
                        </Show>
                      </ActionButton>
                    )}
                  </For>
                </Show>
              </li>
            )}
          </For>
        </ol>
        <p role="status" aria-live="polite" class="min-h-5 text-xs text-muted-foreground">
          {status()}
        </p>
        <Show when={error()}>
          <p role="alert" class="text-xs text-destructive">
            {error()}
          </p>
        </Show>
        <DialogFooter>
          <DialogClose as={Button} variant="outline" size="sm">
            Done
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
