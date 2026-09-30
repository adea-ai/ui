import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * VirtualWindow.
 *
 * Supplies the two geometry wrappers a virtualized viewport needs: a full-height
 * scroll space and a translated window containing the mounted rows. The caller
 * owns the scroll region, its semantics, keyboard model, and range calculation;
 * this component only keeps those rows at their measured position.
 */
export type VirtualWindowProps = Omit<ComponentProps<'div'>, 'children' | 'style'> & {
  /** JSX style props are owned by this geometry primitive. */
  style?: never
  /** The full scrollable height, in pixels. */
  totalSize: number
  /** The mounted window's top offset from the start of the full list, in pixels. */
  offset?: number
  /** Optional layout classes for the translated row container. */
  contentClass?: string
  children?: JSX.Element
}

function finitePixels(value: number): string {
  return `${Number.isFinite(value) ? value : 0}px`
}

export function VirtualWindow(props: VirtualWindowProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'totalSize',
    'offset',
    'contentClass',
    'style',
  ])

  return (
    <div
      {...rest}
      data-slot="virtual-window-space"
      class={cn('relative', local.class)}
      style={{ height: finitePixels(Math.max(0, local.totalSize)) }}
    >
      <div
        data-slot="virtual-window-content"
        class={local.contentClass}
        style={{ transform: `translateY(${finitePixels(local.offset ?? 0)})` }}
      >
        {local.children}
      </div>
    </div>
  )
}
