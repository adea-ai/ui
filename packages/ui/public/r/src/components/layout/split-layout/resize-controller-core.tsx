import { createSignal, type Accessor, type JSX } from 'solid-js'
import {
  listLeaves,
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  type SplitLayoutBranch,
  type SplitLayoutLeaf,
} from './model'

export type SplitLayoutResizeControllerProps<L extends SplitLayoutLeaf> = {
  branch: Accessor<SplitLayoutBranch<L>>
  rect: Accessor<JSX.CSSProperties>
  domId: (id: string) => string
  root: () => HTMLDivElement | undefined
  labelForSeparator?: (branch: SplitLayoutBranch<L>) => string
  onResize: (splitId: string, ratio: number) => void
}

const KEYBOARD_DELTA = 0.05

/** The divider stays behind the first real split while the pane owners remain mounted. */
export default function SplitLayoutResizeController<L extends SplitLayoutLeaf>(
  props: SplitLayoutResizeControllerProps<L>
) {
  const [container, setContainer] = createSignal<HTMLDivElement>()
  let activePointer: number | undefined
  const horizontal = () => props.branch().direction === 'row'

  const resizeTo = (ratio: number) => {
    // A hidden or detached host reports no usable geometry; that is not
    // user resize intent.
    const root = props.root()
    if (!root?.isConnected || root.getClientRects().length === 0) return
    const next = Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, ratio))
    if (Number.isFinite(next) && Math.abs(next - props.branch().ratio) > 0.000001)
      props.onResize(props.branch().id, next)
  }
  const stopDrag = (handle: HTMLElement, event: PointerEvent) => {
    if (activePointer !== event.pointerId) return
    activePointer = undefined
    handle.removeAttribute('data-dragging')
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      ref={setContainer}
      style={props.rect()}
      class="pointer-events-none absolute min-h-0 min-w-0"
    >
      <div
        role="separator"
        tabIndex={0}
        data-split-layout-handle=""
        data-orientation={horizontal() ? 'horizontal' : 'vertical'}
        aria-label={
          props.labelForSeparator?.(props.branch()) ??
          (horizontal() ? 'Resize pane columns' : 'Resize pane rows')
        }
        aria-orientation={horizontal() ? 'vertical' : 'horizontal'}
        aria-controls={listLeaves(props.branch())
          .map((leaf) => props.domId(leaf.id))
          .join(' ')}
        aria-valuemin={10}
        aria-valuemax={90}
        aria-valuenow={Math.round(props.branch().ratio * 100)}
        style={
          horizontal()
            ? { left: `${props.branch().ratio * 100}%`, top: 0, bottom: 0, width: '1px' }
            : { top: `${props.branch().ratio * 100}%`, left: 0, right: 0, height: '1px' }
        }
        onKeyDown={(event) => {
          const forward = horizontal() ? 'ArrowRight' : 'ArrowDown'
          const backward = horizontal() ? 'ArrowLeft' : 'ArrowUp'
          const current = props.branch().ratio
          let next: number
          if (event.key === forward) next = current + KEYBOARD_DELTA
          else if (event.key === backward) next = current - KEYBOARD_DELTA
          else if (event.key === 'Home') next = MIN_SPLIT_RATIO
          else if (event.key === 'End') next = MAX_SPLIT_RATIO
          else return
          event.preventDefault()
          resizeTo(next)
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || activePointer !== undefined) return
          activePointer = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.setAttribute('data-dragging', '')
          event.preventDefault()
        }}
        onPointerMove={(event) => {
          const element = container()
          if (activePointer !== event.pointerId || !element) return
          const box = element.getBoundingClientRect()
          const size = horizontal() ? box.width : box.height
          if (size <= 0) return
          resizeTo((horizontal() ? event.clientX - box.left : event.clientY - box.top) / size)
        }}
        onPointerUp={(event) => stopDrag(event.currentTarget, event)}
        onPointerCancel={(event) => stopDrag(event.currentTarget, event)}
        onLostPointerCapture={(event) => stopDrag(event.currentTarget, event)}
        class="pointer-events-auto absolute shrink-0 bg-border after:absolute after:inset-y-0 after:-inset-x-1 after:w-3 focus-visible:bg-primary focus-visible:outline-none hover:bg-primary data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full"
      />
    </div>
  )
}
