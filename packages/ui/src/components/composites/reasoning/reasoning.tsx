import { Brain } from 'lucide-solid'
import { createEffect, createSignal, on, splitProps, type JSX } from 'solid-js'
import { MessageText } from '../../ui/message'
import { ScrollArea } from '../../ui/scroll-area'
import { TraceDetail, TraceLine, type TraceLineProps } from '../../ui/trace'

// A function child runs once, when the content mounts (see `deferred` in `tool.tsx`).
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Reasoning.
 *
 * The agent's thinking, as a `TraceLine`: a title that says what state it is in,
 * and a body that is the text the host chose to show. Reach for `ChainOfThought`
 * when the thinking is a sequence of discrete steps with their own status, and
 * for a plain `MessageText` when the text is simply part of the answer.
 *
 * ## It shows what it is given, and nothing else
 *
 * `text` is whatever the host has decided is user-visible — a provider's reasoning
 * summary, a model's visible scratchpad. This component never implies there is
 * more behind it: no "show full reasoning" control, no placeholder body, no
 * ellipsis standing in for hidden content. With no `text` and no `streaming` the
 * line is a plain, non-expandable line titled "Reasoning", because there is
 * nothing to open.
 *
 * ## The title is the state
 *
 * - `streaming` — "Thinking…", with the running mark and shimmer.
 * - finished with a `duration` (seconds) — "Thought for 4s".
 * - finished without one — "Reasoning". A duration the host did not measure is
 *   not invented.
 *
 * ## Open while it is arriving, closed once it is done
 *
 * While streaming the body is open so the reader can follow along; when the
 * stream ends it folds away so the settled transcript stays one quiet column. The
 * reader's own toggle wins in both directions and is remembered until the next
 * stream begins, so someone who closed it mid-stream is not re-opened and
 * someone who opened it afterwards is not folded. Pass `open` and `onOpenChange`
 * to own the state instead.
 *
 * ## Bounded, and stable while it grows
 *
 * The body is `MessageText`, so the text is untrusted and rendered as text (see
 * its doc comment), and earlier paragraphs keep their DOM while the last one
 * grows. The scroller is capped; while streaming it follows the newest text only
 * if the reader has not scrolled up, so reading the start of a long thought is
 * not interrupted by the end of it.
 */

/** `4` → `4s`, `65` → `1m 5s`. Nothing for a value that is not a finite duration. */
export function formatDuration(seconds: number | undefined): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return undefined
  const total = Math.round(seconds)
  if (total === 0) return '<1s'
  if (total < 60) return `${total}s`
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
}

/** The line's title for a state. Exported so a host can say the same thing elsewhere. */
export function reasoningTitle(state: { streaming?: boolean; duration?: number }): string {
  if (state.streaming) return 'Thinking…'
  const duration = formatDuration(state.duration)
  return duration ? `Thought for ${duration}` : 'Reasoning'
}

/** Within this many pixels of the end counts as "following". */
const FOLLOW_SLOP = 16

export type ReasoningProps = Omit<
  TraceLineProps,
  | 'title'
  | 'description'
  | 'status'
  | 'statusLabel'
  | 'defaultOpen'
  | 'children'
  | 'href'
  | 'onSelect'
  | 'selectHaspopup'
> & {
  /** The reasoning the host marked as user-visible. Untrusted text. */
  text?: string
  /** True while text may still arrive. */
  streaming?: boolean
  /** Seconds the thinking took, if the host measured it. */
  duration?: number
  /** Replaces the state-derived title, e.g. for another language. */
  title?: JSX.Element
}

function ReasoningBody(props: { text: string; streaming?: boolean }) {
  let scroller: HTMLDivElement | undefined
  let following = true

  createEffect(() => {
    // Read for the dependency: new text is the event that may need following.
    void props.text
    if (props.streaming && following && scroller) scroller.scrollTop = scroller.scrollHeight
  })

  return (
    <TraceDetail>
      <ScrollArea
        ref={(element) => (scroller = element)}
        role="region"
        aria-label="Reasoning text"
        class="max-h-72"
        onScroll={(event) => {
          const element = event.currentTarget
          following = element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLOP
        }}
      >
        <MessageText
          text={props.text}
          streaming={props.streaming}
          codeBlockProps={{ maxHeight: '16rem', wrap: true }}
        />
      </ScrollArea>
    </TraceDetail>
  )
}

export function Reasoning(props: ReasoningProps) {
  const [local, rest] = splitProps(props, [
    'text',
    'streaming',
    'duration',
    'title',
    'icon',
    'open',
    'onOpenChange',
  ])
  // `undefined` means "the reader has not decided", which is what lets the stream
  // open and close the line on its own.
  const [chosen, setChosen] = createSignal<boolean>()
  const open = () => local.open ?? chosen() ?? local.streaming === true
  const hasBody = () => (local.text ?? '').trim() !== '' || local.streaming === true

  createEffect(
    on(
      () => local.streaming,
      (streaming) => {
        if (streaming) setChosen(undefined)
      },
      { defer: true }
    )
  )

  // A function child runs only when the content mounts, so a folded line parses nothing.
  const body = () => <ReasoningBody text={local.text ?? ''} streaming={local.streaming} />

  return (
    <TraceLine
      icon={local.icon ?? <Brain />}
      title={
        local.title ?? reasoningTitle({ streaming: local.streaming, duration: local.duration })
      }
      status={local.streaming ? 'running' : undefined}
      statusLabel="In progress"
      open={open()}
      onOpenChange={(value) => {
        setChosen(value)
        local.onOpenChange?.(value)
      }}
      {...rest}
    >
      {hasBody() ? deferred(body) : undefined}
    </TraceLine>
  )
}
