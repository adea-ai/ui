import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

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

export function AspectRatio(props: AspectRatioProps) {
  const [local, rest] = splitProps(props, ['class', 'ratio', 'children'])

  return (
    <div
      data-slot="aspect-ratio"
      style={{ 'aspect-ratio': String(local.ratio ?? 16 / 9) }}
      class={cn('relative w-full [&>*]:absolute [&>*]:inset-0 [&>*]:size-full', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  )
}
