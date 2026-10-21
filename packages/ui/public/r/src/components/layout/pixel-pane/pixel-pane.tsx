import type { ComponentProps, JSX } from 'solid-js'
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
      style={fixedStyle(local.style, local.width)}
    />
  )
}

/**
 * The pane's style with its width applied last, so the host's width wins over a
 * `flex-basis` of the caller's own. A string style stays a string and an object
 * style stays an object; both keep every declaration they came with.
 */
function fixedStyle(
  style: JSX.CSSProperties | string | undefined,
  width: number | undefined
): JSX.CSSProperties | string | undefined {
  if (width === undefined) return style
  const basis = `${Math.max(0, Math.round(width))}px`
  if (typeof style === 'string') {
    const declarations = style.trim()
    const separator = declarations === '' || declarations.endsWith(';') ? '' : ';'
    return `${declarations}${separator}flex-basis:${basis}`
  }
  return { ...style, 'flex-basis': basis }
}
