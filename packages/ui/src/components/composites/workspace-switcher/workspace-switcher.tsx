import { ArrowDownUp, ChevronDown, Plus, Settings } from 'lucide-solid'
import type { JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { For, Show, createSignal, onCleanup } from 'solid-js'
import { cn } from '#lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { ActionButton } from '../action-button'

// The dialog is only reachable from a menu item, so it stays out of the code
// that ships with the switcher and loads on demand.
const loadReorderDialog = () => import('./workspace-reorder-dialog')
type ReorderDialog = Awaited<ReturnType<typeof loadReorderDialog>>['WorkspaceReorderDialog']

/**
 * WorkspaceSwitcher.
 *
 * The workspace picker that sits in the top bar beside the sidebar toggle. One
 * ghost button shows the current workspace's mark and name; pressing it opens a
 * radio list of the others. Choosing one only changes what the window is
 * looking at: the switcher reports the id and the host decides what that means,
 * which is why it carries no status of its own and never closes, restarts or
 * moves anything.
 *
 * It is deliberately the simple interaction (a single menu, not a nested
 * accordion): the sidebar below it already shows what is inside the chosen
 * workspace, so the switcher's only job is to name the workspace and let the
 * user change it.
 */
export type WorkspaceSwitcherItem = {
  id: string
  name: string
  /**
   * The workspace's mark, drawn in the trigger and in its row. Decorative.
   *
   * A DOM node can sit in one place, so the current workspace's mark would have
   * to be in the trigger and its menu row at once. Pass a function to draw a
   * fresh mark in each place (the preferred form). A node built once is also
   * safe: the trigger keeps it and the current row gets a copy, which carries
   * no event handlers or reactive bindings, so keep marks static.
   */
  mark: JSX.Element | (() => JSX.Element)
  /** A quiet trailing readout in the row, e.g. an unread count. Optional. */
  detail?: JSX.Element
  /** Pinned to the top of the order, e.g. Home: it cannot be moved and nothing moves above it. */
  fixed?: boolean
}

export type WorkspaceSwitcherProps = {
  workspaces: readonly WorkspaceSwitcherItem[]
  /** The current workspace's id. */
  value: string | undefined
  onValueChange(id: string): void
  /** Offered at the foot of the menu when present. */
  onCreate?(): void
  createLabel?: string
  /** Offered beside the create action when present: open the current workspace's settings. */
  onManage?(): void
  manageLabel?: string
  /**
   * Offered when present and at least two workspaces can move: opens a dialog
   * with Move up and Move down on each row. Receives the full id order after
   * each move; the host saves it and passes the workspaces back in that order.
   */
  onReorder?(ids: readonly string[]): void | Promise<void>
  reorderLabel?: string
  /** Replaces the "Reorder workspaces…" item when the dialog could not be loaded. */
  reorderErrorLabel?: string
  /** The menu's heading; also the trigger's accessible-name prefix. */
  label?: string
  /** Shown while no workspace is current. */
  placeholder?: string
  disabled?: boolean
  class?: string
}

/**
 * Draws one placement of a mark. A function draws anew each time; a node that is
 * already placed elsewhere is copied so the original stays where it is.
 */
function drawMark(mark: WorkspaceSwitcherItem['mark'], copy: boolean): JSX.Element {
  if (typeof mark === 'function') return mark()
  return copy && mark instanceof Node ? mark.cloneNode(true) : mark
}

export function WorkspaceSwitcher(props: WorkspaceSwitcherProps) {
  const [open, setOpen] = createSignal(false)
  const [reordering, setReordering] = createSignal(false)
  const [reorderDialog, setReorderDialog] = createSignal<ReorderDialog>()
  const [reorderFailed, setReorderFailed] = createSignal(false)
  let cancelPending: (() => void) | undefined
  let trigger: HTMLElement | undefined
  const current = () => props.workspaces.find((item) => item.id === props.value)
  const label = () => props.label ?? 'Workspaces'
  const canReorder = () =>
    props.onReorder !== undefined && props.workspaces.filter((item) => !item.fixed).length > 1

  // Fetch the dialog's code. Safe to call early and often: the browser keeps one
  // copy, and a failure is remembered here instead of surfacing as an unhandled
  // rejection, so the switcher keeps working without reordering.
  const loadDialog = () =>
    loadReorderDialog().then(
      (module) => {
        setReorderDialog(() => module.WorkspaceReorderDialog)
        return true
      },
      () => {
        setReorderFailed(true)
        return false
      }
    )
  // Warm the chunk while the menu is open, so choosing the item rarely waits.
  const warm = (next: boolean) => {
    setOpen(next)
    if (next && canReorder() && !reorderDialog()) void loadDialog()
  }
  // Choosing the item while the code is still arriving must not open the dialog
  // late: nothing on screen can take Escape or an outside click yet, so either
  // of them withdraws the request, and the dialog opens only if the user waits.
  const requestReorder = () => {
    cancelPending?.()
    if (reorderDialog()) {
      setReordering(true)
      return
    }
    let waiting = true
    const stop = () => {
      waiting = false
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', stop, true)
      if (cancelPending === stop) cancelPending = undefined
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', stop, true)
    cancelPending = stop
    void loadDialog().then((loaded) => {
      const stillWanted = waiting
      stop()
      if (loaded && stillWanted) setReordering(true)
    })
  }
  onCleanup(() => cancelPending?.())

  return (
    <>
      <DropdownMenu modal={false} open={open()} onOpenChange={warm}>
        <DropdownMenuTrigger
          as={ActionButton}
          variant="ghost"
          size="sm"
          disabled={props.disabled}
          ref={(el: HTMLElement) => (trigger = el)}
          data-slot="workspace-switcher"
          tooltip={`Workspace: ${current()?.name ?? props.placeholder ?? 'Choose workspace'}`}
          aria-label={`Switch workspace, current: ${current()?.name ?? 'none'}`}
          class={cn('max-w-full min-w-0 shrink', props.class)}
        >
          <span aria-hidden="true" class="flex shrink-0">
            {current() && drawMark(current()!.mark, false)}
          </span>
          <span class="min-w-0 max-w-40 truncate">
            {current()?.name ?? props.placeholder ?? 'Choose workspace'}
          </span>
          <ChevronDown aria-hidden="true" class="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} class="min-w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{label()}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={props.value}
              onChange={(value) => {
                setOpen(false)
                const id = String(value)
                if (id !== props.value) props.onValueChange(id)
              }}
            >
              <For each={props.workspaces}>
                {(item) => (
                  <DropdownMenuRadioItem value={item.id} closeOnSelect data-workspace-id={item.id}>
                    <span aria-hidden="true" class="flex shrink-0">
                      {drawMark(item.mark, item.id === props.value)}
                    </span>
                    <span class="min-w-0 flex-1 truncate">{item.name}</span>
                    <Show when={item.detail}>{item.detail}</Show>
                  </DropdownMenuRadioItem>
                )}
              </For>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <Show when={props.onCreate || props.onManage || canReorder()}>
            <DropdownMenuSeparator />
            <Show when={props.onCreate}>
              <DropdownMenuItem onSelect={() => props.onCreate?.()}>
                <Plus aria-hidden="true" />
                {props.createLabel ?? 'New workspace'}
              </DropdownMenuItem>
            </Show>
            <Show when={canReorder()}>
              <DropdownMenuItem disabled={reorderFailed()} onSelect={requestReorder}>
                <ArrowDownUp aria-hidden="true" />
                {reorderFailed()
                  ? (props.reorderErrorLabel ?? 'Couldn’t load reordering. Reload to try again.')
                  : (props.reorderLabel ?? 'Reorder workspaces…')}
              </DropdownMenuItem>
            </Show>
            <Show when={props.onManage}>
              <DropdownMenuItem onSelect={() => props.onManage?.()}>
                <Settings aria-hidden="true" />
                {props.manageLabel ?? 'Workspace settings…'}
              </DropdownMenuItem>
            </Show>
          </Show>
        </DropdownMenuContent>
      </DropdownMenu>
      <Show when={reorderDialog() && props.onReorder}>
        {(onReorder) => (
          <Dynamic
            component={reorderDialog()}
            open={reordering()}
            onOpenChange={setReordering}
            workspaces={props.workspaces}
            onReorder={onReorder()}
            restoreFocusRef={() => trigger}
          />
        )}
      </Show>
    </>
  )
}
