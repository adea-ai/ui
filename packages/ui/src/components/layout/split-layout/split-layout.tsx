import Resizable from '@corvu/resizable'
import {
  For,
  createMemo,
  createComputed,
  createUniqueId,
  onCleanup,
  on,
  type Accessor,
  type JSX,
} from 'solid-js'
import { X } from 'lucide-solid'
import { Button } from '../../ui/button'
import { cn } from '#lib/utils'
import { computeLayoutFrames, type LayoutRect } from './geometry'
import {
  listLeaves,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  type SplitLayoutBranch,
  type SplitLayoutLeaf,
  type SplitLayoutState,
} from './model'

export type SplitLayoutProps<L extends SplitLayoutLeaf> = {
  state: SplitLayoutState<L>
  label: string
  labelForLeaf: (leaf: L) => string
  /** Called once per stable leaf owner; the accessor tracks opaque payload replacement. */
  renderLeaf: (leaf: Accessor<L>) => JSX.Element
  onResize: (splitId: string, ratio: number) => void
  onFocus?: (leafId: string) => void
  /** Host performs the model transition and returns the surviving focus destination. */
  onClose?: (leafId: string) => string | undefined
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
  const refs = new Map<string, HTMLElement>()
  const domIds = new Map<string, string>()
  const prefix = createUniqueId()
  let nextDomId = 0
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
    if (pendingFrame !== undefined) cancelAnimationFrame(pendingFrame)
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
      <For each={leaves().map((leaf) => leaf.id)}>
        {(id) => {
          const initial = leafMap().get(id)!
          const leaf = () => leafMap().get(id) ?? initial
          const content = props.renderLeaf(leaf)
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
              tabIndex={-1}
              data-pane-id={id}
              data-focused={props.state.focusedLeafId === id ? '' : undefined}
              style={rectStyle(frames().get(id)?.rect ?? { x: 0, y: 0, width: 0, height: 0 })}
              class="absolute flex min-h-0 min-w-0 flex-col overflow-hidden border border-border data-[focused]:border-primary bg-background text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onFocusIn={() => props.onFocus?.(id)}
            >
              <header class="flex min-w-0 shrink-0 items-center gap-2 bg-surface px-2">
                <span class="min-w-0 flex-1 truncate text-sm">{props.labelForLeaf(leaf())}</span>
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
              <div class="min-h-0 min-w-0 flex-1 overflow-auto">{content}</div>
            </section>
          )
        }}
      </For>
      <For each={branches().map((branch) => branch.id)}>
        {(id) => {
          const initial = branchMap().get(id)!
          const branch: Accessor<SplitLayoutBranch<L>> = () => branchMap().get(id) ?? initial
          return (
            <Resizable
              orientation={branch().direction === 'row' ? 'horizontal' : 'vertical'}
              sizes={[branch().ratio, 1 - branch().ratio]}
              keyboardDelta={0.05}
              onSizesChange={(sizes) => {
                if (sizes[0] !== undefined && Math.abs(sizes[0] - branch().ratio) > 0.000001)
                  props.onResize(id, sizes[0])
              }}
              style={rectStyle(frames().get(id)?.rect ?? { x: 0, y: 0, width: 0, height: 0 })}
              class="pointer-events-none absolute flex min-h-0 min-w-0 data-[orientation=vertical]:flex-col"
            >
              <Resizable.Panel
                minSize={MIN_SPLIT_RATIO}
                maxSize={MAX_SPLIT_RATIO}
                aria-hidden="true"
              />
              <Resizable.Handle
                aria-label={
                  branch().direction === 'row' ? 'Resize pane columns' : 'Resize pane rows'
                }
                aria-orientation={branch().direction === 'row' ? 'vertical' : 'horizontal'}
                aria-controls={listLeaves(branch())
                  .map((leaf) => domId(leaf.id))
                  .join(' ')}
                aria-valuemin={10}
                aria-valuemax={90}
                aria-valuenow={Math.round(branch().ratio * 100)}
                class="pointer-events-auto relative w-px shrink-0 bg-border after:absolute after:inset-y-0 after:-inset-x-1 after:w-3 focus-visible:bg-primary focus-visible:outline-none hover:bg-primary data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full"
              />
              <Resizable.Panel
                minSize={MIN_SPLIT_RATIO}
                maxSize={MAX_SPLIT_RATIO}
                aria-hidden="true"
              />
            </Resizable>
          )
        }}
      </For>
    </div>
  )
}
