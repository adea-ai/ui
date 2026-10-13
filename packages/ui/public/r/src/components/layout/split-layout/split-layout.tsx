import {
  For,
  createEffect,
  createComputed,
  createMemo,
  createUniqueId,
  createSignal,
  onMount,
  onCleanup,
  on,
  Show,
  type Accessor,
  type JSX,
} from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { X, GripVertical } from 'lucide-solid'
import { ActionButton } from '../../composites/action-button'
import { Button } from '../../ui/button'
import { cn } from '../../../lib/utils'
import { computeLayoutFrames, type LayoutRect } from './geometry'
import { paneDropIntent, type PaneDropIntent } from './drop'
export type { PaneDropIntent } from './drop'
const PANE_DRAG_TYPE = 'application/x-adea-pane-move'
const DRAG_PREVIEW_MAX_WIDTH = 384
const DRAG_PREVIEW_MAX_HEIGHT = 256
import {
  listLeaves,
  type SplitLayoutBranch,
  type SplitLayoutLeaf,
  type SplitLayoutState,
} from './model'
import type { SplitLayoutResizeControllerProps } from './resize-controller-core'

type ResizeController<L extends SplitLayoutLeaf> = (
  props: SplitLayoutResizeControllerProps<L>
) => JSX.Element
type ResizeControllerState<L extends SplitLayoutLeaf> = ResizeController<L> | false | 'error'

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
function separatorPlaceholderStyle(branch: SplitLayoutBranch, rect: LayoutRect): JSX.CSSProperties {
  const horizontal = branch.direction === 'row'
  return {
    left: `${(rect.x + (horizontal ? rect.width * branch.ratio : 0)) * 100}%`,
    top: `${(rect.y + (horizontal ? 0 : rect.height * branch.ratio)) * 100}%`,
    width: horizontal ? '1px' : `${rect.width * 100}%`,
    height: horizontal ? `${rect.height * 100}%` : '1px',
    transform: horizontal ? 'translateX(-50%)' : 'translateY(-50%)',
  }
}
function dragPreviewPlaceholder(source: HTMLElement, message: string) {
  const placeholder = document.createElement('div')
  placeholder.className = cn(
    source.getAttribute('class'),
    'flex min-h-8 min-w-0 items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground'
  )
  placeholder.setAttribute('data-split-drag-placeholder', source.localName)
  placeholder.textContent = message
  return placeholder
}
function boundedSnapshotSize(width: number, height: number) {
  const sourceWidth = Math.max(1, width)
  const sourceHeight = Math.max(1, height)
  const scale = Math.min(
    1,
    DRAG_PREVIEW_MAX_WIDTH / sourceWidth,
    DRAG_PREVIEW_MAX_HEIGHT / sourceHeight
  )
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  }
}
function cloneDragPreviewNode(source: Node): Node | undefined {
  if (source.nodeType === Node.TEXT_NODE) return source.cloneNode(false)
  if (!(source instanceof HTMLElement || source instanceof SVGElement))
    return source.cloneNode(false)

  if (['script', 'style', 'link', 'source', 'track', 'meta'].includes(source.localName))
    return undefined
  if (['iframe', 'video', 'audio', 'object', 'embed'].includes(source.localName))
    return dragPreviewPlaceholder(
      source as HTMLElement,
      'Embedded content unavailable while moving'
    )
  if (source instanceof HTMLImageElement) {
    const snapshot = document.createElement('canvas')
    const size = boundedSnapshotSize(
      source.naturalWidth || source.width,
      source.naturalHeight || source.height
    )
    snapshot.width = size.width
    snapshot.height = size.height
    snapshot.className = source.getAttribute('class') ?? ''
    snapshot.setAttribute('data-split-drag-image', '')
    try {
      if (!source.complete || source.naturalWidth === 0)
        throw new Error('image has no decoded pixels')
      const context = snapshot.getContext('2d')
      if (!context) throw new Error('canvas snapshot context is unavailable')
      context.drawImage(source, 0, 0, snapshot.width, snapshot.height)
      return snapshot
    } catch {
      return dragPreviewPlaceholder(source, 'Image preview unavailable')
    }
  }

  // Copying a defined custom element can run its constructor; inserting it can
  // also reconnect a stream or terminal session. Flatten its display tree.
  if (source instanceof HTMLElement && source.localName.includes('-')) {
    const children = document.createDocumentFragment()
    for (const child of source.childNodes) {
      const clone = cloneDragPreviewNode(child)
      if (clone) children.append(clone)
    }
    return children.childNodes.length > 0
      ? children
      : dragPreviewPlaceholder(source, 'Live component preview unavailable while moving')
  }

  const clone = source.cloneNode(false) as HTMLElement | SVGElement
  for (const attribute of [
    'id',
    'style',
    'draggable',
    'data-pane-drag-handle',
    'data-pane-id',
    'src',
    'srcset',
    'href',
    'xlink:href',
    'data',
    'poster',
  ])
    clone.removeAttribute(attribute)
  for (const attribute of Array.from(clone.attributes))
    if (/^on/i.test(attribute.name)) clone.removeAttribute(attribute.name)

  if (source instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
    const size = boundedSnapshotSize(source.width, source.height)
    clone.width = size.width
    clone.height = size.height
    try {
      const context = clone.getContext('2d')
      if (!context) throw new Error('canvas snapshot context is unavailable')
      context.drawImage(source, 0, 0, clone.width, clone.height)
    } catch {
      return dragPreviewPlaceholder(source, 'Canvas preview unavailable while moving')
    }
    return clone
  }

  for (const child of source.childNodes) {
    const childClone = cloneDragPreviewNode(child)
    if (childClone) clone.append(childClone)
  }
  return clone
}
/** Muxy frame geometry keeps leaf owners stable; the lazy resize controller owns constrained separator interactions. */
export function SplitLayout<L extends SplitLayoutLeaf>(props: SplitLayoutProps<L>) {
  let root: HTMLDivElement | undefined
  let pendingFrame: number | undefined
  let disposed = false
  let resizeLoadGeneration = 0
  let retryWithAlternateImport = false
  let alternateImportAttempts = 0
  let focusHandleAfterRetry = false
  let focusRecoveryButtonAfterError = false
  let focusRestoreEpoch = 0
  let focusEpoch = 0
  let pendingFocusFrame: number | undefined
  const refs = new Map<string, HTMLElement>()
  const domIds = new Map<string, string>()
  const prefix = createUniqueId()
  const resizeReloadWarningId = `${prefix}-resize-reload-warning`
  let nextDomId = 0
  let nextDragId = 0
  let dragPreview: HTMLElement | undefined
  const [drag, setDrag] = createSignal<{ id: string; token: string }>()
  const [drop, setDrop] = createSignal<{ id: string; intent: PaneDropIntent }>()
  const [resizeController, setResizeController] = createSignal<ResizeControllerState<L>>()
  const cancelPendingFocusRestore = () => {
    if (pendingFocusFrame !== undefined) cancelAnimationFrame(pendingFocusFrame)
    pendingFocusFrame = undefined
  }
  const trackFocusChange = (event: FocusEvent) => {
    if (event.target === document.body) return
    focusEpoch += 1
    focusHandleAfterRetry = false
    focusRecoveryButtonAfterError = false
    cancelPendingFocusRestore()
  }
  onMount(() => {
    document.addEventListener('focusin', trackFocusChange)
    onCleanup(() => document.removeEventListener('focusin', trackFocusChange))
  })
  const clearDrag = () => {
    setDrag(undefined)
    setDrop(undefined)
    dragPreview?.remove()
    dragPreview = undefined
  }
  const createDragPreview = (source: HTMLElement) => {
    dragPreview?.remove()
    const preview = cloneDragPreviewNode(source) as HTMLElement
    preview.className =
      'pointer-events-none fixed -left-full top-0 z-(--z-dialog) flex h-64 max-h-screen w-96 max-w-screen min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-xl'
    preview.removeAttribute('id')
    preview.removeAttribute('style')
    preview.removeAttribute('role')
    preview.removeAttribute('aria-label')
    preview.removeAttribute('data-pane-id')
    preview.removeAttribute('data-focused')
    preview.removeAttribute('data-drag-source')
    preview.removeAttribute('data-drop-direction')
    preview.removeAttribute('data-drop-placement')
    preview.setAttribute('data-split-drag-preview', '')
    preview.setAttribute('aria-hidden', 'true')
    preview.inert = true
    document.body.append(preview)
    dragPreview = preview
    return preview
  }
  const domId = (id: string) => {
    const existing = domIds.get(id)
    if (existing) return existing
    const created = `${prefix}-pane-${nextDomId++}`
    domIds.set(id, created)
    return created
  }
  const leaves = createMemo(() => listLeaves(props.state.center))
  const leafMap = createMemo(() => new Map(leaves().map((leaf) => [leaf.id, leaf])))
  const frames = createMemo(() => computeLayoutFrames(props.state.center))
  const branches = createMemo(() =>
    Array.from(frames().values()).flatMap((frame) =>
      frame.node.kind === 'split' ? [frame.node] : []
    )
  )
  createEffect(() => {
    if (branches().length === 0) {
      resizeLoadGeneration += 1
      focusHandleAfterRetry = false
      focusRecoveryButtonAfterError = false
      cancelPendingFocusRestore()
      // Keep a loaded controller so a later split does not re-import a facade
      // that may have failed before recovery. Clear only transient UI state.
      if (resizeController() === false || resizeController() === 'error')
        setResizeController(undefined)
      return
    }
    if (resizeController() !== undefined) return
    const retry = retryWithAlternateImport
    const generation = ++resizeLoadGeneration
    setResizeController(false)
    const controllerImport = retry
      ? alternateImportAttempts++ === 0
        ? import('./resize-controller-retry')
        : import('./resize-controller-retry-2')
      : import('./resize-controller')
    void controllerImport.then(
      ({ default: Controller }) => {
        if (disposed || generation !== resizeLoadGeneration || branches().length === 0) return
        const shouldFocusHandle = focusHandleAfterRetry && focusEpoch === focusRestoreEpoch
        focusHandleAfterRetry = false
        focusRecoveryButtonAfterError = false
        retryWithAlternateImport = false
        alternateImportAttempts = 0
        setResizeController(() => Controller)
        if (shouldFocusHandle)
          pendingFocusFrame = requestAnimationFrame(() => {
            pendingFocusFrame = undefined
            if (
              disposed ||
              generation !== resizeLoadGeneration ||
              branches().length === 0 ||
              focusEpoch !== focusRestoreEpoch
            )
              return
            const currentFocus = root?.ownerDocument.activeElement
            if (currentFocus && currentFocus !== root?.ownerDocument.body && currentFocus !== root)
              return
            root?.querySelector<HTMLElement>('[data-split-layout-handle]')?.focus({
              preventScroll: true,
            })
          })
      },
      () => {
        // A rejected dynamic import can remain cached under its specifier.
        // The next split must start from the alternate module entry as well.
        retryWithAlternateImport = true
        if (!disposed && generation === resizeLoadGeneration && branches().length > 0) {
          setResizeController('error')
          const shouldFocusRetry = focusRecoveryButtonAfterError && focusEpoch === focusRestoreEpoch
          if (shouldFocusRetry)
            pendingFocusFrame = requestAnimationFrame(() => {
              pendingFocusFrame = undefined
              if (
                disposed ||
                generation !== resizeLoadGeneration ||
                branches().length === 0 ||
                focusEpoch !== focusRestoreEpoch
              )
                return
              root?.querySelector<HTMLButtonElement>('[data-resize-retry]')?.focus({
                preventScroll: true,
              })
            })
        }
      }
    )
  })
  createComputed(() => {
    const current = drag()
    if (current && (!props.onMove || !leafMap().has(current.id))) clearDrag()
    const target = drop()
    if (target && !leafMap().has(target.id)) setDrop(undefined)
  })
  const allowedTarget = (id: string, transfer: DataTransfer | null) => {
    const current = drag()
    return props.onMove &&
      current &&
      current.id !== id &&
      leafMap().has(current.id) &&
      leafMap().has(id) &&
      transfer?.types.includes(PANE_DRAG_TYPE)
      ? current
      : undefined
  }
  const dropLabel = createMemo(() => {
    const target = drop()
    const leaf = target ? leafMap().get(target.id) : undefined
    return target && leaf
      ? `Drop to place pane ${target.intent.placement} ${props.labelForLeaf(leaf)}`
      : ''
  })
  const branchMap = createMemo(() => new Map(branches().map((branch) => [branch.id, branch])))
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
    focusHandleAfterRetry = false
    focusRecoveryButtonAfterError = false
    cancelPendingFocusRestore()
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
      data-dragging={drag() ? '' : undefined}
      class={cn('relative size-full min-h-0 min-w-0 data-[dragging]:cursor-grabbing', props.class)}
    >
      <For each={leaves().map((leaf) => leaf.id)}>
        {(id) => {
          const initial = leafMap().get(id)!
          const leaf = () => leafMap().get(id) ?? initial
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
              data-drag-source={drag()?.id === id ? '' : undefined}
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
              class="absolute flex min-h-0 min-w-0 flex-col overflow-hidden border border-border transition-opacity motion-reduce:transition-none data-[drag-source]:opacity-40 data-[focused]:border-primary bg-background text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onFocusIn={() => props.onFocus?.(id)}
            >
              <header class="flex min-w-0 shrink-0 items-center gap-2 bg-surface px-2">
                <span
                  data-pane-drag-handle=""
                  draggable={Boolean(props.onMove)}
                  class={cn('flex min-w-0 flex-1 items-center gap-2 truncate text-sm', {
                    'cursor-grab': Boolean(props.onMove),
                    'cursor-grabbing': drag()?.id === id,
                  })}
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
                    // The native drag image carries this pane's actual content
                    // in a bounded floating-window frame; the source recedes
                    // independently as the browser follows the image pointer.
                    const source = refs.get(id)
                    const frame = source?.getBoundingClientRect()
                    if (source && frame && typeof event.dataTransfer.setDragImage === 'function') {
                      const preview = createDragPreview(source)
                      const previewFrame = preview.getBoundingClientRect()
                      const scaleX = previewFrame.width / frame.width
                      const scaleY = previewFrame.height / frame.height
                      event.dataTransfer.setDragImage(
                        preview,
                        Math.max(0, Math.round((event.clientX - frame.left) * scaleX)),
                        Math.max(0, Math.round((event.clientY - frame.top) * scaleY))
                      )
                      preview.setAttribute('data-native-drag-image', '')
                    }
                  }}
                  onDragEnd={clearDrag}
                >
                  {props.onMove ? (
                    <GripVertical class="size-3 shrink-0" aria-hidden="true" />
                  ) : null}
                  <span class="min-w-0 flex-1 truncate">
                    {paneLabel ?? props.labelForLeaf(leaf())}
                  </span>
                </span>
                {actions}
                {props.onClose ? (
                  <ActionButton
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Close ${props.labelForLeaf(leaf())}`}
                    tooltip={`Close ${props.labelForLeaf(leaf())}.`}
                    onClick={() => close(id)}
                  >
                    <X />
                  </ActionButton>
                ) : null}
              </header>
              <div class="min-h-0 min-w-0 flex-1 overflow-auto">{content}</div>
              {intent() ? (
                <div
                  aria-hidden="true"
                  class={cn('pointer-events-none absolute border-2 border-primary bg-primary/10', {
                    'inset-y-0 left-0 w-1/2':
                      intent()?.direction === 'row' && intent()?.placement === 'before',
                    'inset-y-0 right-0 w-1/2':
                      intent()?.direction === 'row' && intent()?.placement === 'after',
                    'inset-x-0 top-0 h-1/2':
                      intent()?.direction === 'column' && intent()?.placement === 'before',
                    'inset-x-0 bottom-0 h-1/2':
                      intent()?.direction === 'column' && intent()?.placement === 'after',
                  })}
                />
              ) : null}
            </section>
          )
        }}
      </For>
      <span class="sr-only" role="status">
        {dropLabel() ||
          (resizeController() === 'error'
            ? alternateImportAttempts >= 2
              ? 'Resize controls did not load after repeated attempts. Reloading may discard unsaved pane content.'
              : 'Resize controls did not load.'
            : '')}
      </span>
      <For each={branches().map((branch) => branch.id)}>
        {(id) => {
          const initial = branchMap().get(id)!
          const branch: Accessor<SplitLayoutBranch<L>> = () => branchMap().get(id) ?? initial
          const rect = () => frames().get(id)?.rect ?? { x: 0, y: 0, width: 0, height: 0 }
          return (
            <Show
              when={typeof resizeController() === 'function'}
              fallback={
                <div
                  role="separator"
                  aria-label={
                    props.labelForSeparator?.(branch()) ??
                    (branch().direction === 'row' ? 'Resize pane columns' : 'Resize pane rows')
                  }
                  aria-orientation={branch().direction === 'row' ? 'vertical' : 'horizontal'}
                  aria-controls={listLeaves(branch())
                    .map((leaf) => domId(leaf.id))
                    .join(' ')}
                  aria-valuemin={10}
                  aria-valuemax={90}
                  aria-valuenow={Math.round(branch().ratio * 100)}
                  aria-disabled="true"
                  tabIndex={-1}
                  data-direction={branch().direction}
                  style={separatorPlaceholderStyle(branch(), rect())}
                  class="pointer-events-none absolute bg-border"
                />
              }
            >
              <Dynamic
                component={resizeController() as ResizeController<L>}
                branch={branch}
                rect={() => rectStyle(rect())}
                domId={domId}
                root={() => root}
                labelForSeparator={props.labelForSeparator}
                onResize={props.onResize}
              />
            </Show>
          )
        }}
      </For>
      {resizeController() === 'error' ? (
        <div class="absolute top-2 right-2 z-(--z-menu) flex max-w-sm flex-col items-end gap-2">
          {alternateImportAttempts >= 2 ? (
            <p
              id={resizeReloadWarningId}
              role="alert"
              class="rounded-md border bg-background p-2 text-sm shadow-md"
            >
              Reloading may discard unsaved pane content.
            </p>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            data-resize-retry
            aria-describedby={alternateImportAttempts >= 2 ? resizeReloadWarningId : undefined}
            onClick={(event) => {
              if (alternateImportAttempts >= 2) {
                window.location.reload()
                return
              }
              const ownsFocus = document.activeElement === event.currentTarget
              focusHandleAfterRetry = ownsFocus
              focusRecoveryButtonAfterError = ownsFocus
              focusRestoreEpoch = focusEpoch
              retryWithAlternateImport = true
              setResizeController(undefined)
            }}
          >
            {alternateImportAttempts >= 2 ? 'Reload page to retry resizing' : 'Retry pane resizing'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
