import { ArrowDown } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button/button'
import { createScrollFollow } from './scroll-follow'

/**
 * ConversationSurface.
 *
 * The scrolling transcript. Its job is small and it is the difference between a
 * transcript that stays readable as it grows and one that fights the reader:
 *
 *   - **Stick to the bottom.** New messages scroll into view only when the reader is
 *     already at the bottom. Someone reading back through history must not be yanked
 *     to the end by an arriving message, and that is the single most common way a
 *     chat surface is made unusable.
 *   - **Offer a way back.** Once the reader is not at the bottom, a control appears
 *     that returns them. Pixel distance cannot prove an unread message count.
 *   - **`overscroll-contain`.** The transcript scrolls to its end and stops, rather
 *     than dragging the pane behind it — which in a desktop shell means the whole
 *     window moves.
 */
export type ConversationSurfaceProps = ComponentProps<'div'> & {
  /** How far from the bottom still counts as "at the bottom", in px. */
  threshold?: number
  /** Disable automatic positioning while the host owns scroll restoration. */
  follow?: boolean
  /** Optional conversation identity: changing it re-arms follow at the bottom. */
  resetKey?: string
  /** Rendered above the transcript when there is nothing in it. */
  empty?: JSX.Element
  /** A header that scrolls with the transcript, e.g. a day divider or a banner. */
  header?: JSX.Element
}

export function ConversationSurface(props: ConversationSurfaceProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'threshold',
    'follow',
    'resetKey',
    'empty',
    'header',
    'children',
    'onScroll',
    'ref',
    'tabindex',
  ])
  // Kobalte provides the control's semantics; transcript follow is a native
  // geometry contract. KiroCrew's plain-scroller controller handles streaming,
  // content collapse and pane resizing without treating them as user consent.
  const follow = createScrollFollow({
    enabled: () => local.follow !== false,
    resetKey: () => local.resetKey,
    threshold: () => local.threshold ?? 80,
  })
  const onScroll: JSX.EventHandlerUnion<HTMLDivElement, Event> = (event) => {
    follow.onScroll()
    const handler = local.onScroll
    if (typeof handler === 'function') handler(event)
    else if (handler) handler[0](handler[1], event)
  }

  return (
    <div
      data-slot="conversation-surface"
      class={cn('relative flex min-h-0 flex-1 flex-col', local.class)}
    >
      <div
        ref={(element) => {
          follow.bindScroller(element)
          if (typeof local.ref === 'function') local.ref(element)
        }}
        onScroll={onScroll}
        tabindex={local.tabindex ?? 0}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        {...rest}
      >
        <div ref={follow.bindContent} data-slot="conversation-content">
          <Show when={local.header}>{local.header}</Show>
          <Show when={local.children} fallback={<div class="p-4">{local.empty}</div>}>
            {local.children}
          </Show>
        </div>
      </div>

      <Show when={!follow.atBottom()}>
        <div class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            class="pointer-events-auto gap-1.5 shadow-md"
            onClick={follow.jump}
          >
            <ArrowDown />
            Jump to latest
          </Button>
        </div>
      </Show>
    </div>
  )
}
