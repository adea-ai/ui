import { ArrowDown } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { Show, createSignal, onCleanup, splitProps } from 'solid-js'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button/button'

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
 *     that returns them and says how much they have missed.
 *   - **`overscroll-contain`.** The transcript scrolls to its end and stops, rather
 *     than dragging the pane behind it — which in a desktop shell means the whole
 *     window moves.
 */
export type ConversationSurfaceProps = ComponentProps<'div'> & {
  /** How far from the bottom still counts as "at the bottom", in px. */
  threshold?: number
  /** Rendered above the transcript when there is nothing in it. */
  empty?: JSX.Element
  /** A header that scrolls with the transcript, e.g. a day divider or a banner. */
  header?: JSX.Element
}

/** How far the reader is from the end of the transcript, in px. */
function distanceFromBottom(element: HTMLDivElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight
}

export function ConversationSurface(props: ConversationSurfaceProps) {
  const [local, rest] = splitProps(props, ['class', 'threshold', 'empty', 'header', 'children'])

  const [atBottom, setAtBottom] = createSignal(true)
  const [missed, setMissed] = createSignal(0)
  let scroller: HTMLDivElement | undefined

  const onScroll = () => {
    if (!scroller) return
    const distance = distanceFromBottom(scroller)
    const threshold = local.threshold ?? 80
    setAtBottom(distance <= threshold)
    setMissed(distance <= threshold ? 0 : Math.round(distance / 96))
  }

  const jumpToLatest = () => {
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' })
    setAtBottom(true)
    setMissed(0)
  }

  // An arriving message while the reader is at the bottom should follow it. While
  // they are not, it must not.
  const observer = () => {
    if (!scroller) return
    const mutation = new MutationObserver(() => {
      if (atBottom()) scroller?.scrollTo({ top: scroller.scrollHeight })
      else onScroll()
    })
    mutation.observe(scroller, { childList: true, subtree: true })
    onCleanup(() => mutation.disconnect())
  }

  return (
    <div
      data-slot="conversation-surface"
      class={cn('relative flex min-h-0 flex-1 flex-col', local.class)}
    >
      <div
        ref={(element) => {
          scroller = element
          observer()
        }}
        onScroll={onScroll}
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        {...rest}
      >
        <Show when={local.header}>{local.header}</Show>
        <Show when={local.children} fallback={<div class="p-4">{local.empty}</div>}>
          {local.children}
        </Show>
      </div>

      <Show when={!atBottom()}>
        <div class="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button
            size="sm"
            variant="secondary"
            class="pointer-events-auto gap-1.5 shadow-md"
            onClick={jumpToLatest}
          >
            <ArrowDown />
            <Show when={missed() > 0} fallback={<>Jump to latest</>}>
              {missed()} new
            </Show>
          </Button>
        </div>
      </Show>
    </div>
  )
}
