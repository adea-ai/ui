import { ChevronLeft, ChevronRight } from 'lucide-solid'
import { createSignal, onCleanup, Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { ActionButton } from '../action-button'
import { Button } from '../../ui/button'
import type { MessageCitations } from '../../ui/message'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../../ui/popover'
import { TextLink } from '../../ui/text-link'
import {
  SOURCE_SNIPPET_LIMIT,
  boundText,
  safeSourceUrl,
  sourceHost,
  sourceTitle,
  type Source,
} from '../sources/source'
import {
  citationLabel,
  citationName,
  nextCitationMode,
  wrapIndex,
  type CitationEvent,
  type CitationMode,
} from './citation'

/**
 * InlineCitation.
 *
 * A small badge inside a sentence — "1", or a host — that opens the source(s)
 * behind the claim: title, host, address, snippet, and Previous/Next when several
 * sources share one marker. It is an inline element for prose such as
 * `MessageText`: it never breaks across lines, stays on the text baseline, and
 * adds no block of its own. For the list of everything a reply used, reach for
 * `Sources`; the two number sources the same way.
 *
 * ## One popover, two ways to open it
 *
 * A hover card would exclude everyone who is not holding a mouse, so this is a
 * `Popover` that a pointer can also *peek* at:
 *
 * - **Hover or keyboard focus peeks.** The popover opens without taking focus
 *   and closes when the pointer or focus leaves. Touch has no hover, so a touch
 *   never peeks.
 * - **Click, tap, Enter or Space pins.** Focus moves into the popover so its
 *   link and Previous/Next are reachable; it stays until Escape, an outside press,
 *   or the badge is pressed again, and focus returns to the badge. Pressing a badge
 *   that is only peeking pins it rather than toggling it shut — the transitions
 *   are the pure `nextCitationMode`.
 *
 * Kobalte's trigger toggles on every press, so `open` is controlled and its own
 * close request is ignored for the press that we already decided (`pressing`).
 * Without that, hover-then-click, the commonest pointer path, would close the card.
 *
 * ## It makes no claim without sources
 *
 * No sources renders nothing: a marker that points nowhere is not a citation.
 * The address is a link only when `safeSourceUrl` allows it; the host comes from
 * the parsed URL; titles and snippets are clipped, cleaned of direction
 * overrides and rendered as text. The badge's accessible name carries the title
 * and host (the visible label is only a number or a host), so a reader hears
 * what is cited without opening anything.
 */
export type InlineCitationProps = {
  /** One source, or several that support the same claim. */
  sources: readonly Source[]
  /**
   * The 1-based number to show, matching the source's position in `Sources`.
   * Omit it to show the host instead; a number is never guessed.
   */
  index?: number
  /** Milliseconds a pointer rests before the peek opens. */
  hoverDelay?: number
  class?: string
}

const LEAVE_DELAY = 200

export function InlineCitation(props: InlineCitationProps) {
  const [local] = splitProps(props, ['sources', 'index', 'hoverDelay', 'class'])
  const [mode, setMode] = createSignal<CitationMode>('closed')
  const [position, setPosition] = createSignal(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let content: HTMLElement | undefined
  let pressing = false
  // Focus handed back to the badge as the popover closes is not a request to
  // peek again; without this, Escape from a pinned card reopens it as a preview.
  let restoringFocus = false

  const count = () => local.sources.length
  const active = () => local.sources[wrapIndex(position(), count())]
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  onCleanup(clear)

  const dispatch = (event: CitationEvent) => setMode((current) => nextCitationMode(current, event))
  const schedule = (event: CitationEvent, delay: number) => {
    clear()
    timer = setTimeout(() => dispatch(event), delay)
  }

  const onPointerEnter = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    schedule('enter', local.hoverDelay ?? 150)
  }
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    schedule('leave', LEAVE_DELAY)
  }

  const onClick = () => {
    clear()
    const wasPeeking = mode() === 'peek'
    dispatch('press')
    // Kobalte toggles right after this handler; its request is not a dismissal.
    pressing = true
    queueMicrotask(() => {
      pressing = false
    })
    // The peek never took focus; a deliberate press must hand it over.
    if (wasPeeking) queueMicrotask(() => content?.focus())
  }

  return (
    <Show when={count() > 0}>
      <Popover
        open={mode() !== 'closed'}
        onOpenChange={(next) => {
          if (!next && !pressing) dispatch('dismiss')
        }}
        placement="bottom"
        gutter={6}
      >
        <PopoverTrigger
          as={Button}
          variant="subtle"
          size="2xs"
          touchTarget="comfortable"
          data-slot="inline-citation"
          aria-label={citationName(local.sources, local.index)}
          class={cn('mx-0.5 align-baseline tabular-nums', local.class)}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={(event: FocusEvent & { currentTarget: HTMLElement }) => {
            // Mouse focus follows the press; only keyboard focus peeks.
            if (restoringFocus) return
            if (event.currentTarget.matches(':focus-visible')) dispatch('focus')
          }}
          onBlur={() => dispatch('blur')}
        >
          <span aria-hidden="true" class="max-w-32 truncate">
            {citationLabel(local.index, local.sources[0])}
          </span>
          <Show when={count() > 1}>
            <span aria-hidden="true">+{count() - 1}</span>
          </Show>
        </PopoverTrigger>
        <PopoverContent
          ref={(element: HTMLElement) => (content = element)}
          class="w-72 max-w-full"
          onOpenAutoFocus={(event: Event) => {
            if (mode() === 'peek') event.preventDefault()
          }}
          onCloseAutoFocus={() => {
            // The focus move that follows is synchronous; the microtask ends the window.
            restoringFocus = true
            queueMicrotask(() => {
              restoringFocus = false
            })
          }}
          onPointerEnter={(event: PointerEvent) => {
            if (event.pointerType !== 'touch') clear()
          }}
          onPointerLeave={onPointerLeave}
        >
          <Show when={active()}>
            {(source) => (
              <div class="flex min-w-0 flex-col gap-1.5 px-2 py-1.5">
                <Show when={count() > 1}>
                  <div class="flex items-center justify-between gap-2">
                    <span
                      role="status"
                      aria-live="polite"
                      class="text-xs text-muted-foreground tabular-nums"
                    >
                      Source {wrapIndex(position(), count()) + 1} of {count()}
                    </span>
                    <span class="flex items-center gap-0.5">
                      <ActionButton
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Previous source"
                        tooltip="Previous source"
                        onClick={() => setPosition((value) => wrapIndex(value - 1, count()))}
                      >
                        <ChevronLeft />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Next source"
                        tooltip="Next source"
                        onClick={() => setPosition((value) => wrapIndex(value + 1, count()))}
                      >
                        <ChevronRight />
                      </ActionButton>
                    </span>
                  </div>
                </Show>
                <PopoverTitle class="p-0 [overflow-wrap:anywhere]">
                  {sourceTitle(source())}
                </PopoverTitle>
                <CitationDetails source={source()} />
              </div>
            )}
          </Show>
        </PopoverContent>
      </Popover>
    </Show>
  )
}

/**
 * Citation markers for `MessageText`, from the sources a reply really used.
 *
 * `[^2]` in the text becomes the second source's badge; `[^1,3]` one badge for
 * sources 1 and 3. A number beyond the list leaves the marker as written, and an
 * empty list makes every marker literal, so text can never cite a source the host
 * did not supply.
 *
 *     <MessageText text={reply} citations={messageCitations(sources)} />
 */
export function messageCitations(sources: readonly Source[]): MessageCitations {
  return {
    count: sources.length,
    render: (numbers) => (
      <InlineCitation
        index={numbers[0]}
        sources={numbers.flatMap((number) => {
          const source = sources[number - 1]
          return source ? [source] : []
        })}
      />
    ),
  }
}

function CitationDetails(props: { source: Source }) {
  const href = () => safeSourceUrl(props.source.url)
  const host = () => sourceHost(props.source.url)
  const snippet = () =>
    props.source.snippet ? boundText(props.source.snippet, SOURCE_SNIPPET_LIMIT) : ''
  const withheld = () => props.source.url !== undefined && props.source.url !== '' && !href()

  return (
    <>
      <Show when={host()}>
        <p class="m-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">{host()}</p>
      </Show>
      <Show when={href()}>
        {(url) => (
          <TextLink
            href={url()}
            target="_blank"
            rel="noreferrer noopener"
            class="w-fit max-w-full text-xs [overflow-wrap:anywhere]"
          >
            {boundText(url(), 96)}
            <span class="visually-hidden"> (opens in a new tab)</span>
          </TextLink>
        )}
      </Show>
      <Show when={withheld()}>
        <p class="m-0 text-xs text-muted-foreground">Address not linked</p>
      </Show>
      <Show when={snippet()}>
        <p class="m-0 line-clamp-6 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {snippet()}
        </p>
      </Show>
    </>
  )
}
