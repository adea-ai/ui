import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

export type PixelPaneProps = ComponentProps<'div'> & {
  /**
   * The pane's width in CSS pixels, owned by the host. Without it the pane
   * takes the space the fixed panes leave.
   */
  width?: number
}

/**
 * PixelPane.
 *
 * One pane of a row whose widths the host keeps (for example beside a
 * `PixelResizeHandle`): a fixed pixel width, or the remaining space. It exists
 * so a consumer can give a pane a computed width without a style attribute of
 * its own, and so every such pane behaves the same way: it never grows past its
 * width, clips what does not fit, and gives way before the row overflows if the
 * host's widths briefly exceed the space (a window being resized).
 */
export function PixelPane(props: PixelPaneProps) {
  const [local, rest] = splitProps(props, ['width', 'class', 'style'])

  return (
    <div
      data-slot="pixel-pane"
      {...rest}
      class={cn(
        'min-h-0 min-w-0 overflow-hidden',
        local.width === undefined ? 'flex-1' : 'grow-0 shrink',
        local.class
      )}
      style={
        local.width === undefined
          ? local.style
          : {
              ...(typeof local.style === 'object' ? local.style : {}),
              'flex-basis': `${Math.max(0, Math.round(local.width))}px`,
            }
      }
    />
  )
}
