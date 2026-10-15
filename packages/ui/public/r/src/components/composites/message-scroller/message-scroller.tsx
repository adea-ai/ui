import { History, LoaderCircle } from 'lucide-solid'
import { createEffect, onCleanup, Show, splitProps, createSignal, type JSX } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import {
  ConversationSurface,
  type ConversationSurfaceProps,
} from '../../conversation/conversation-surface'
import { captureAnchor, restoreAnchor, type ScrollAnchor } from './scroll-anchor'

/**
 * MessageScroller.
 *
 * The thread. It owns the three scroll behaviours a chat gets wrong when each
 * is bolted on separately, and keeps them from fighting:
 *
 * 1. **Follow the reply only while the reader is at the bottom.** New and
 *    streaming content scrolls into view when the reader is already at the end,
 *    and never otherwise. Scrolling up parks the view; the "Jump to latest"
 *    control brings it back. (This is `ConversationSurface`'s follow contract,
 *    which this component wraps rather than reimplements.)
 * 2. **Load history without moving what the reader is looking at.** When the
 *    reader reaches the top, `onLoadOlder` is asked for earlier turns. Turns
 *    inserted *above* the viewport would normally push the visible content down
 *    by exactly their height; here the first visible turn (found by
 *    `data-anchor-id`, which `Message` sets from `anchorId`) is measured before
 *    the load and put back to the same offset after it, on every layout change
 *    until the load settles — so images and code blocks that size themselves
 *    late do not jolt the view either. A "Load earlier" button is always present
 *    while there is more, because the scroll trigger alone is unreachable to a
 *    keyboard or switch user and fires nothing in a short pane.
 * 3. **Announce without flooding.** The scroller is a polite log, and a turn that
 *    is still arriving marks itself `aria-busy`, so a screen reader waits for the
 *    settled turn instead of reading every token. `announcement` is a separate
 *    status region for the two moments that matter: a response starting and a
 *    response finishing.
 *
 * What it does not own: which turns exist, their identity, or what "older"
 * means. The host passes children and a loader; a session switch is
 * `resetKey`, which re-arms follow and discards any in-flight anchor.
 */
export type MessageScrollerProps = Omit<ConversationSurfaceProps, 'header' | 'empty'> & {
  /** There are earlier turns the host can load. */
  hasOlder?: boolean
  /** The host is loading earlier turns right now. */
  loadingOlder?: boolean
  /**
   * Load earlier turns. The scroller preserves the reader's position across the
   * resulting insert whether the host resolves before or after rendering them.
   */
  onLoadOlder?: () => void | Promise<void>
  /** Words for the loader row; override for another language. */
  olderLabel?: string
  loadingOlderLabel?: string
  /** Rendered above the first turn, below the history control. */
  header?: JSX.Element
  /** Rendered when there are no turns. */
  empty?: JSX.Element
  /** A short sentence for the live status region ("Assistant is responding"). */
  announcement?: string
}

/** How far from the top counts as "reached the top", in px. */
const TOP_MARGIN = 160

/** How long a host that still reports `loadingOlder` is waited for, in frames (~10 s). */
const MAX_HOST_WAIT_FRAMES = 600

export function MessageScroller(props: MessageScrollerProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'hasOlder',
    'loadingOlder',
    'onLoadOlder',
    'olderLabel',
    'loadingOlderLabel',
    'header',
    'empty',
    'announcement',
    'ref',
    'resetKey',
    'children',
  ])
  let scroller: HTMLDivElement | undefined
  let epoch = 0
  const [inFlight, setInFlight] = createSignal(false)

  // A session switch invalidates a load that was started for the previous one.
  createEffect(() => {
    void local.resetKey
    epoch += 1
    setInFlight(false)
  })

  const settle = (
    anchor: ScrollAnchor | undefined,
    run: number,
    heightBefore: number,
    restoreFocus: boolean
  ) => {
    const finish = () => {
      if (run !== epoch) return
      if (scroller) restoreAnchor(scroller, anchor)
      observer?.disconnect()
      setInFlight(false)
      // The control that started the load was replaced by the loading line, which
      // takes focus with it. Put it back on the control (or the thread), so a
      // keyboard user is not dropped onto the page.
      if (restoreFocus && scroller && document.activeElement === document.body) {
        const again = scroller.querySelector<HTMLElement>(
          '[data-slot="message-scroller-older"] button'
        )
        ;(again ?? scroller).focus({ preventScroll: true })
      }
      // Still at the top after a load that added content: keep going, so a
      // pane taller than one page of history fills without a second scroll.
      if (
        scroller &&
        local.hasOlder &&
        scroller.scrollTop < TOP_MARGIN &&
        scroller.scrollHeight > heightBefore
      )
        void load()
    }
    // Two frames: the first lets the host's insert commit, the second lets
    // late-sizing content (images, highlighted code) report its height. A host
    // that says it is still loading (`loadingOlder`) after its promise resolved
    // is not finished either: its turns will land later, and the anchor must
    // still be held when they do.
    const wait = (waited: number) =>
      requestAnimationFrame(() => {
        if (run !== epoch) return
        if (local.loadingOlder && waited < MAX_HOST_WAIT_FRAMES) return void wait(waited + 1)
        finish()
      })
    requestAnimationFrame(() => wait(0))
  }

  let observer: MutationObserver | undefined
  const load = async (fromControl = false) => {
    if (!scroller || !local.onLoadOlder || !local.hasOlder || local.loadingOlder || inFlight())
      return
    const run = epoch
    const anchor = captureAnchor(scroller)
    const heightBefore = scroller.scrollHeight
    const restoreFocus =
      fromControl && document.activeElement?.closest('[data-slot="message-scroller-older"]') != null
    setInFlight(true)
    // Every layout change while the load is open re-pins the anchor *before
    // paint*, which is what makes the insert invisible.
    observer?.disconnect()
    observer = new MutationObserver(() => {
      if (run === epoch && scroller) restoreAnchor(scroller, anchor)
    })
    observer.observe(scroller, { childList: true, subtree: true })
    try {
      await local.onLoadOlder()
    } catch {
      // The host reports its own failure; the control stays so the reader can retry.
    }
    settle(anchor, run, heightBefore, restoreFocus)
  }

  onCleanup(() => {
    epoch += 1
    observer?.disconnect()
  })

  const watchTop = (element: HTMLDivElement) => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load()
      },
      { root: scroller ?? null, rootMargin: `${TOP_MARGIN}px 0px 0px 0px` }
    )
    io.observe(element)
    onCleanup(() => io.disconnect())
  }

  return (
    <div
      class={cn('relative flex min-h-0 flex-1 flex-col', local.class)}
      data-slot="message-scroller"
    >
      <ConversationSurface
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        resetKey={local.resetKey}
        {...rest}
        ref={(element) => {
          scroller = element
          if (typeof local.ref === 'function') local.ref(element)
        }}
        class="flex-1"
        header={
          <>
            <Show when={local.hasOlder || local.loadingOlder}>
              <div
                ref={watchTop}
                data-slot="message-scroller-older"
                class="flex justify-center py-2"
              >
                <Show
                  when={local.loadingOlder || inFlight()}
                  fallback={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="gap-1.5 text-muted-foreground"
                      onClick={() => void load(true)}
                    >
                      <History aria-hidden="true" />
                      {local.olderLabel ?? 'Load earlier messages'}
                    </Button>
                  }
                >
                  <p
                    role="status"
                    // The button's own height: swapping one for the other must not move
                    // the turns below it by even a pixel while the anchor is being held.
                    class="flex h-control-sm items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <LoaderCircle aria-hidden="true" class="size-3.5 motion-safe:animate-spin" />
                    {local.loadingOlderLabel ?? 'Loading earlier messages…'}
                  </p>
                </Show>
              </div>
            </Show>
            {local.header}
          </>
        }
        empty={local.empty}
      >
        {local.children}
      </ConversationSurface>
      <p role="status" class="sr-only">
        {local.announcement}
      </p>
    </div>
  )
}
