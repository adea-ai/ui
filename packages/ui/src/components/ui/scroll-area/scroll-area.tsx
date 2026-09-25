import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * ScrollArea.
 *
 * A scroll container with the design system's scrollbar treatment, plus an
 * optional fade at each edge so a long list reads as continuing rather than
 * ending at the fold.
 *
 * This is a styled native scroller, not a reimplementation of scrolling. The
 * platform scroller already handles momentum, rubber-banding, keyboard paging,
 * trackpad gestures, `scrollIntoView`, focus-into-view and find-in-page. A
 * custom scrollbar over a transformed div gives up every one of those to gain
 * nothing but the scrollbar's appearance, which CSS already controls.
 *
 * `orientation` only decides which edges the fade appears on; `overflow-auto`
 * stays on both axes in `both` mode so a wide table can still be reached.
 */
export type ScrollAreaProps = ComponentProps<'div'> & {
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Draw a fade at the leading and trailing edges of the scrolled axis. */
  fade?: boolean
  /** Replace the browser's scrollbar with the system's thin treatment. */
  hideScrollbar?: boolean
}

export function ScrollArea(props: ScrollAreaProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'orientation',
    'fade',
    'hideScrollbar',
    'tabIndex',
  ])

  return (
    <div
      data-slot="scroll-area"
      /*
       * Focusable, because that is what makes a scroll region reachable from the
       * keyboard. A `div` with `overflow: auto` scrolls with a mouse or a
       * trackpad and not at all with the arrow keys until it can take focus, so
       * a long list inside one is unreachable without a pointer. The cost is a
       * focus ring around the region, which is correct: it *is* focusable, and
       * `outline-none` keeps the ring to the drawn one.
       */
      tabIndex={local.tabIndex ?? 0}
      class={cn(
        'relative min-h-0 min-w-0 outline-none focus-visible:ring-3 focus-visible:ring-primary-subtle',
        {
          'overflow-y-auto overflow-x-hidden':
            local.orientation === 'vertical' || local.orientation === undefined,
          'overflow-x-auto overflow-y-hidden': local.orientation === 'horizontal',
          'overflow-auto': local.orientation === 'both',
          'no-scrollbar': local.hideScrollbar,
          'scroll-shadow-y':
            local.fade && (local.orientation === 'vertical' || local.orientation === undefined),
        },
        local.class
      )}
      {...rest}
    />
  )
}
