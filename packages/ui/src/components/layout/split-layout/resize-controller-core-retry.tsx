import Resizable from '@corvu/resizable'
import { type Accessor, type JSX } from 'solid-js'
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

/** Corvu stays behind the first real split while the pane owners remain mounted. */
export default function SplitLayoutResizeController<L extends SplitLayoutLeaf>(
  props: SplitLayoutResizeControllerProps<L>
) {
  const id = () => props.branch().id
  return (
    <Resizable
      orientation={props.branch().direction === 'row' ? 'horizontal' : 'vertical'}
      sizes={[props.branch().ratio, 1 - props.branch().ratio]}
      keyboardDelta={0.05}
      onSizesChange={(sizes) => {
        // Corvu also reports panel registration/unregistration while
        // mounting or disposing a controller. Those incomplete or
        // hidden-host sizes are not user resize intent.
        const root = props.root()
        if (!root?.isConnected || root.getClientRects().length === 0) return
        if (
          sizes.length !== 2 ||
          sizes.some((size) => !Number.isFinite(size)) ||
          Math.abs(sizes[0]! + sizes[1]! - 1) > 0.000001
        )
          return
        if (sizes[0] !== undefined && Math.abs(sizes[0] - props.branch().ratio) > 0.000001)
          props.onResize(id(), sizes[0])
      }}
      style={props.rect()}
      class="pointer-events-none absolute flex min-h-0 min-w-0 data-[orientation=vertical]:flex-col"
    >
      <Resizable.Panel minSize={MIN_SPLIT_RATIO} maxSize={MAX_SPLIT_RATIO} aria-hidden="true" />
      <Resizable.Handle
        aria-label={
          props.labelForSeparator?.(props.branch()) ??
          (props.branch().direction === 'row' ? 'Resize pane columns' : 'Resize pane rows')
        }
        aria-orientation={props.branch().direction === 'row' ? 'vertical' : 'horizontal'}
        aria-controls={listLeaves(props.branch())
          .map((leaf) => props.domId(leaf.id))
          .join(' ')}
        aria-valuemin={10}
        aria-valuemax={90}
        aria-valuenow={Math.round(props.branch().ratio * 100)}
        class="pointer-events-auto relative w-px shrink-0 bg-border after:absolute after:inset-y-0 after:-inset-x-1 after:w-3 focus-visible:bg-primary focus-visible:outline-none hover:bg-primary data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full"
      />
      <Resizable.Panel minSize={MIN_SPLIT_RATIO} maxSize={MAX_SPLIT_RATIO} aria-hidden="true" />
    </Resizable>
  )
}
