import {
  For,
  createMemo,
  createComputed,
  createEffect,
  createUniqueId,
  createSignal,
  onCleanup,
  on,
  Show,
  type Accessor,
  type JSX,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { X, GripVertical } from 'lucide-solid'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { computeLayoutFrames, type LayoutRect } from './geometry'
import { paneDropIntent, type PaneDropIntent } from './drop'
export type { PaneDropIntent } from './drop'
const PANE_DRAG_TYPE = 'application/x-adea-pane-move'
import {
  separatorAccessibilityProps,
  type SplitLayoutBranch,
  type SplitLayoutLeaf,
  type SplitLayoutState,
} from './model'

type ResizeController = (typeof import('./resize-controller'))['default']
type ResizeControllerState = ResizeController | false | 'error'

export type SplitLayoutProps<L extends SplitLayoutLeaf> = {
  state: SplitLayoutState<L>
  label: string
  /** Accessible name for a pane region and its close button. */
  labelForLeaf: (leaf: L) => string
  /** Called once per stable leaf owner; the accessor tracks opaque payload replacement. */
  renderLeaf: (leaf: Accessor<L>) => JSX.Element
  /** Inline visible header composition, separate from the region and close-button name. */
  renderPaneLabel?: (leaf: Accessor<L>) => JSX.Element
  /** Whether pane regions participate in sequential keyboard navigation; defaults to programmatic focus only. */
  paneTabIndex?: 0 | -1
  /** Accessible splitter name; defaults to the current orientation-specific label. */
  labelForSeparator?: (branch: SplitLayoutBranch<L>) => string
  onResize: (splitId: string, ratio: number) => void
  onFocus?: (leafId: string) => void
  /** Host performs the model transition and returns the surviving focus destination. */
  onClose?: (leafId: string) => string | undefined
  /** Pointer placement only; the host supplies keyboard commands and performs the model transition. */
  onMove?: (leafId: string, targetId: string, intent: PaneDropIntent) => void
  /** Stable header composition for host-owned keyboard actions/capability feedback. */
  renderPaneActions?: (leaf: Accessor<L>) => JSX.Element
  class?: string
}
function rectStyle(rect: LayoutRect): JSX.CSSProperties {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}
/** Muxy frame geometry keeps leaf owners stable; Corvu owns constrained separator interactions. */
export function SplitLayout<L extends SplitLayoutLeaf>(props: SplitLayoutProps<L>) {
  let root: HTMLDivElement | undefined
  let pendingFrame: number | undefined
  let disposed = false
  let focusHandleAfterRetry = false
  let retryControllerImport = false
  const refs = new Map<string, HTMLElement>()
  const domIds = new Map<string, string>()
  const prefix = createUniqueId()
  let nextDomId = 0
  let nextDragId = 0
  const [drag, setDrag] = createSignal<{ id: string; token: string }>()
  const [drop, setDrop] = createSignal<{ id: string; intent: PaneDropIntent }>()
  const clearDrag = () => {
    setDrag(undefined)
    setDrop(undefined)
  }
  const domId = (id: string) => {
    const existing = domIds.get(id)
    if (existing) return existing
    const created = `${prefix}-pane-${nextDomId++}`
    domIds.set(id, created)
    return created
  }
  const frames = createMemo(() => computeLayoutFrames(props.state.center))
  const nodeIds = createMemo(() => {
    const leaves: string[] = []
    const branches: string[] = []
    for (const [id, frame] of frames()) {
      if (frame.node.kind === 'split') branches.push(id)
      else leaves.push(id)
    }
    return [leaves, branches] as const
  })
  const leafById = (id: string): L | undefined => {
    const node = frames().get(id)?.node
    return node?.kind === 'leaf' ? node : undefined
  }
  const [resizeController, setResizeController] = createSignal<ResizeControllerState>()
  createEffect(() => {
    if (nodeIds()[1].length === 0 || resizeController() !== undefined) return
    setResizeController(false)
    const controllerImport = retryControllerImport
      ? import('./resize-controller-retry')
      : import('./resize-controller')
    retryControllerImport = false
    void controllerImport.then(
      ({ default: Controller, retried }) => {
        if (disposed) return
        setResizeController(() => Controller)
        if (focusHandleAfterRetry && retried)
          requestAnimationFrame(() =>
            root?.querySelector<HTMLElement>('[data-corvu-resizable-handle]')?.focus({
              preventScroll: true,
            })
          )
        focusHandleAfterRetry = false
      },
      () => {
        if (!disposed) setResizeController('error')
      }
    )
  })
  createComputed(() => {
    const current = drag()
    if (current && (!props.onMove || !leafById(current.id))) clearDrag()
    const target = drop()
    if (target && !leafById(target.id)) setDrop(undefined)
  })
  const allowedTarget = (id: string, transfer: DataTransfer | null) => {
    const current = drag()
    return props.onMove &&
      current &&
      current.id !== id &&
      leafById(current.id) &&
      leafById(id) &&
      transfer?.types.includes(PANE_DRAG_TYPE)
      ? current
      : undefined
  }
  const dropLabel = createMemo(() => {
    const target = drop()
    const leaf = target ? leafById(target.id) : undefined
    return target && leaf
      ? `Drop to place pane ${target.intent.placement} ${props.labelForLeaf(leaf)}`
      : ''
  })
  const schedule = (action: () => void) => {
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = undefined
      action()
    })
  }
  // Register before keyed children update: capture a focused editor before an
  // ordered DOM move can blur it. Never override a newer focus outside this root.
  createComputed(
    on(
      () => props.state.center,
      () => {
        const active = root?.ownerDocument.activeElement
        if (!root || !(active instanceof HTMLElement) || !root.contains(active)) return
        const field =
          active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement
            ? active
            : undefined
        const selection = field
          ? {
              start: field.selectionStart,
              end: field.selectionEnd,
              direction: field.selectionDirection,
            }
          : undefined
        schedule(() => {
          if (!active.isConnected || !root?.contains(active)) return
          const current = active.ownerDocument.activeElement
          if (current !== active && current !== active.ownerDocument.body) return
          active.focus({ preventScroll: true })
          if (field && selection?.start !== null && selection?.end !== null && selection)
            field.setSelectionRange(
              selection.start,
              selection.end,
              selection.direction ?? undefined
            )
        })
      }
    )
  )
  onCleanup(() => {
    disposed = true
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
    clearDrag()
    refs.clear()
    domIds.clear()
  })
  const close = (id: string) => {
    const next = props.onClose?.(id)
    if (next) schedule(() => refs.get(next)?.focus({ preventScroll: true }))
  }
  return (
    <div
      ref={(el) => {
        root = el
      }}
      role="group"
      aria-label={props.label}
      data-slot="split-layout"
      class={cn('relative size-full min-h-0 min-w-0', props.class)}
    >
      <For each={nodeIds()[0]}>
        {(id) => {
          const initial = leafById(id)!
          const leaf = () => leafById(id) ?? initial
          const content = props.renderLeaf(leaf)
          const paneLabel = props.renderPaneLabel?.(leaf)
          const actions = props.renderPaneActions?.(leaf)
          const intent = () => (drop()?.id === id ? drop()?.intent : undefined)
          onCleanup(() => {
            refs.delete(id)
            domIds.delete(id)
          })
          return (
            <section
              ref={(el) => refs.set(id, el)}
              id={domId(id)}
              role="region"
              aria-label={props.labelForLeaf(leaf())}
              tabIndex={props.paneTabIndex ?? -1}
              data-pane-id={id}
              data-focused={props.state.focusedLeafId === id ? '' : undefined}
              data-drop-direction={intent()?.direction}
              data-drop-placement={intent()?.placement}
              onDragOver={(event) => {
                if (!allowedTarget(id, event.dataTransfer)) return
                const next = paneDropIntent(
                  event.clientX,
                  event.clientY,
                  event.currentTarget.getBoundingClientRect()
                )
                if (!next) {
                  setDrop(undefined)
                  return
                }
                event.preventDefault()
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
                setDrop({ id, intent: next })
              }}
              onDragLeave={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                )
                  return
                if (drop()?.id === id) setDrop(undefined)
              }}
              onDrop={(event) => {
                const current = allowedTarget(id, event.dataTransfer)
                const next = paneDropIntent(
                  event.clientX,
                  event.clientY,
                  event.currentTarget.getBoundingClientRect()
                )
                const accepted =
                  current && next && event.dataTransfer?.getData(PANE_DRAG_TYPE) === current.token
                clearDrag()
                if (!accepted) return
                event.preventDefault()
                props.onMove?.(current.id, id, next)
              }}
              style={rectStyle(frames().get(id)?.rect ?? { x: 0, y: 0, width: 0, height: 0 })}
              onFocusIn={() => props.onFocus?.(id)}
            >
              <header>
                <span
                  data-pane-drag-handle=""
                  draggable={Boolean(props.onMove)}
                  title={props.onMove ? `Drag ${props.labelForLeaf(leaf())} to move` : undefined}
                  onDragStart={(event) => {
                    if (!props.onMove || !event.dataTransfer) {
                      event.preventDefault()
                      return
                    }
                    const token = `${prefix}-${++nextDragId}`
                    setDrag({ id, token })
                    event.dataTransfer.setData(PANE_DRAG_TYPE, token)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={clearDrag}
                >
                  {props.onMove ? (
                    <GripVertical class="size-3 shrink-0" aria-hidden="true" />
                  ) : null}
                  <span>{paneLabel ?? props.labelForLeaf(leaf())}</span>
                </span>
                {actions}
                {props.onClose ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Close ${props.labelForLeaf(leaf())}`}
                    onClick={() => close(id)}
                  >
                    <X />
                  </Button>
                ) : null}
              </header>
              <div>{content}</div>
              {intent() ? <div aria-hidden="true" /> : null}
            </section>
          )
        }}
      </For>
      <span class="sr-only" role="status">
        {dropLabel() || (resizeController() === 'error' && 'Resize controls did not load.')}
      </span>
      <For each={nodeIds()[1]}>
        {(id) => {
          const initial = frames().get(id)!.node as SplitLayoutBranch<L>
          const branch: Accessor<SplitLayoutBranch<L>> = () => {
            const current = frames().get(id)?.node
            return current?.kind === 'split' ? current : initial
          }
          const frame = () => frames().get(id)?.rect ?? { x: 0, y: 0, width: 0, height: 0 }
          const rect = () => rectStyle(frame())
          const placeholderStyle = () => {
            const current = branch()
            const currentFrame = frame()
            const row = current.direction === 'row'
            const ratio = current.ratio
            return {
              left: `${(row ? currentFrame.x + currentFrame.width * ratio : currentFrame.x) * 100}%`,
              top: `${(row ? currentFrame.y : currentFrame.y + currentFrame.height * ratio) * 100}%`,
              '--split-layout-separator-length': `${(row ? currentFrame.height : currentFrame.width) * 100}%`,
            }
          }
          const separatorProps = separatorAccessibilityProps(branch, domId, (current) =>
            props.labelForSeparator?.(current)
          )
          return (
            <Show
              when={typeof resizeController() === 'function'}
              fallback={
                <div
                  {...separatorProps}
                  role="separator"
                  aria-disabled="true"
                  tabIndex={-1}
                  data-direction={branch().direction}
                  style={placeholderStyle()}
                />
              }
            >
              <Dynamic
                component={resizeController() as ResizeController}
                branch={branch}
                rect={rect}
                separatorProps={separatorProps}
                root={() => root}
                onResize={(splitId, ratio) => props.onResize(splitId, ratio)}
              />
            </Show>
          )
        }}
      </For>
      {resizeController() === 'error' && nodeIds()[1].length > 0 ? (
        <Button
          variant="outline"
          size="sm"
          class="absolute top-2 right-2 z-(--z-menu)"
          onClick={() => {
            focusHandleAfterRetry = true
            retryControllerImport = true
            setResizeController(undefined)
          }}
        >
          Retry pane resizing
        </Button>
      ) : null}
    </div>
  )
}
