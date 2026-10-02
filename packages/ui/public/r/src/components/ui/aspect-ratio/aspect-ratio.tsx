import type { ComponentProps, JSX } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * AspectRatio.
 *
 * Holds a box to a ratio so its content cannot change the layout as it loads. The
 * problem it solves is a specific one: an image or an embed whose intrinsic size is
 * unknown until it arrives pushes everything below it down when it does, and a
 * preview or a grid of cards is where that is most visible.
 *
 * CSS `aspect-ratio` rather than the padding-top trick a decade of libraries used:
 * the property is supported everywhere this system runs, it does not require a
 * wrapper element, and it does not break when the child is positioned.
 *
 * The child fills the box, so a caller passes the image, video or iframe directly
 * and never sizes it.
 */
export type AspectRatioProps = ComponentProps<'div'> & {
  /** Width divided by height, e.g. `16 / 9` or `1`. */
  ratio?: number
}

/**
 * The caller's style with the ratio laid over it. A spread `style` replaces the
 * element's rather than merging, so passing any style used to drop the ratio and
 * collapse the box to zero height. `ratio` is the API for the ratio, so it wins.
 */
function withRatio(style: AspectRatioProps['style'], ratio: number): JSX.CSSProperties | string {
  const value = String(ratio)
  if (typeof style === 'string') return `${style};aspect-ratio:${value}`
  return { ...style, 'aspect-ratio': value }
}

export function AspectRatio(props: AspectRatioProps) {
  const [local, rest] = splitProps(props, ['class', 'ratio', 'style', 'children'])

  return (
    <div
      data-slot="aspect-ratio"
      style={withRatio(local.style, local.ratio ?? 16 / 9)}
      class={cn('relative w-full [&>*]:absolute [&>*]:inset-0 [&>*]:size-full', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  )
}
