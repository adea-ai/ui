import Resizable from '@corvu/resizable'
import { type Accessor, type JSX } from 'solid-js'
import {
  MIN_SPLIT_RATIO,
  MAX_SPLIT_RATIO,
  type SplitLayoutBranch,
  type SplitLayoutLeaf,
  type separatorAccessibilityProps,
} from './model'

export type SplitLayoutResizeControllerProps<L extends SplitLayoutLeaf> = {
  branch: Accessor<SplitLayoutBranch<L>>
  rect: Accessor<JSX.CSSProperties>
  separatorProps: ReturnType<typeof separatorAccessibilityProps<L>>
  root: () => HTMLDivElement | undefined
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
    >
      <Resizable.Panel minSize={MIN_SPLIT_RATIO} maxSize={MAX_SPLIT_RATIO} aria-hidden="true" />
      <Resizable.Handle {...props.separatorProps} />
      <Resizable.Panel minSize={MIN_SPLIT_RATIO} maxSize={MAX_SPLIT_RATIO} aria-hidden="true" />
    </Resizable>
  )
}
