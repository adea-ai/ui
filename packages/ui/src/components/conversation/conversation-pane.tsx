import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'

export type ConversationPaneProps = ComponentProps<'section'> & {
  /** Above the transcript: the conversation's identity and its actions. */
  header?: JSX.Element
  /** The transcript — typically a `ConversationSurface` with `gutter`. */
  children: JSX.Element
  /** Below the transcript: the composer. */
  composer?: JSX.Element
  /**
   * The thread side panel. Its presence opens the second column; at narrow
   * widths the panel overlays the conversation instead of squeezing it, and
   * the conversation chrome steps aside — out of the accessibility tree with
   * it, which is why the overlay hides with `visibility` rather than paint.
   */
  thread?: JSX.Element
  /**
   * Apply the shared page gutters to the composer, tracking the transcript's
   * own gutter (`ConversationSurface`'s `gutter`) so the two read as one pane.
   */
  gutter?: boolean
}

/**
 * ConversationPane.
 *
 * The frame a conversation lives in: a header above, the transcript, a composer
 * below, and — while a thread is open — the thread panel beside all of it.
 *
 * The layout earns its place in the library because the thread is where
 * applications get it wrong. Two impulses both fail: shrinking the transcript
 * to make room turns a busy thread into a one-word-per-line stripe, and
 * *hiding* the transcript with `display: none` unmounts it, losing scroll
 * position and DOM. So the desktop layout gives the thread a fixed column and
 * leaves the transcript fluid; below the collapse width the panel overlays the
 * conversation in full and the conversation steps aside invisibly — still
 * mounted, still in the DOM, gone from the accessibility tree.
 */
export function ConversationPane(props: ConversationPaneProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'header',
    'composer',
    'thread',
    'gutter',
    'children',
  ])
  const threadOpen = () => local.thread !== undefined

  return (
    <section
      data-slot="conversation-pane"
      data-conversation-thread-open={threadOpen() || undefined}
      class={cn(
        'relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]',
        threadOpen()
          ? 'grid-cols-1 md:grid-cols-[minmax(20rem,1fr)_minmax(18rem,22rem)] lg:grid-cols-[minmax(24rem,1fr)_minmax(20rem,26rem)]'
          : 'grid-cols-1',
        local.class
      )}
      {...rest}
    >
      <Show when={local.header}>
        {(header) => (
          <div class={cn('col-start-1 row-start-1 min-w-0', threadOpen() && 'max-md:invisible')}>
            {header()}
          </div>
        )}
      </Show>

      <div
        class={cn(
          'col-start-1 row-start-2 flex min-h-0 min-w-0 flex-col',
          threadOpen() && 'max-md:invisible'
        )}
      >
        {local.children}
      </div>

      <Show when={local.composer}>
        {(composer) => (
          <div
            class={cn(
              'col-start-1 row-start-3 min-w-0',
              local.gutter && 'mx-[clamp(0.8rem,3vw,2.5rem)] mb-[1.15rem] max-[30rem]:mx-2',
              threadOpen() && 'max-md:invisible'
            )}
          >
            {composer()}
          </div>
        )}
      </Show>

      <Show when={local.thread}>
        {(thread) => (
          <div
            class={cn(
              'min-h-0 min-w-0',
              threadOpen() &&
                'max-md:absolute max-md:inset-0 max-md:z-(--z-docked) max-md:*:border-s-0 md:col-start-2 md:row-span-3 md:row-start-1'
            )}
          >
            {thread()}
          </div>
        )}
      </Show>
    </section>
  )
}
