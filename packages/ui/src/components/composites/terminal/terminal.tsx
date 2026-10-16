import {
  ArrowDown,
  Check,
  CircleAlert,
  CircleSlash,
  Copy,
  Eraser,
  LoaderCircle,
} from 'lucide-solid'
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
  splitProps,
  type ComponentProps,
} from 'solid-js'
import { writeClipboardText } from '#lib/clipboard'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import {
  createAnsiParser,
  isPlainStyle,
  resolveColors,
  type AnsiLine,
  type AnsiStyle,
} from './ansi'
import {
  isAtBottom,
  isFailedExit,
  revealEarlier,
  terminalStatusLabel,
  terminalWindow,
  type TerminalStatus,
} from './terminal-model'

/**
 * Terminal.
 *
 * A command and its output, as it arrives. It is the thing to put inside an
 * agent's "ran a command" line (a `TraceLine`, with `size="sm"`) when the output
 * is the evidence; reach for `CodeBlock` instead when the text is source or a
 * finished log that needs no live behaviour, and for `TestResults` when the
 * output is a test run the host can structure.
 *
 * It does not wrap `CodeBlock`. A block's `highlight` seam re-renders the whole
 * body whenever the code changes, which is exactly wrong for output that grows a
 * line at a time, and a terminal has to own its scroller to follow the tail. It
 * keeps the block's header and surface vocabulary so the two read as one family.
 *
 * ## What the output is allowed to do
 *
 * Output is untrusted bytes. It is parsed by `createAnsiParser` into plain text
 * and a fixed set of styles — sixteen theme colours, bold, dim, italic,
 * underline, strike-through, reverse — and everything else (cursor movement,
 * title and clipboard sequences, anything malformed) is dropped, never echoed.
 * Colours come from the theme's `--terminal-ansi-*` tokens, painted on the
 * theme's own terminal background, so a program's colours keep the contrast the
 * theme measured for them. Nothing is rendered as markup.
 *
 * ## Streaming
 *
 * `output` is the whole string so far. When the new value begins with the old
 * one, only the appended text is parsed, so a chunk costs the size of the chunk
 * and not of the transcript. Finished lines are keyed by identity and are never
 * re-rendered; only the line still being written changes, which is what makes a
 * `\r` progress bar redraw in place. Batch appends per frame — the host sees a
 * prefix check proportional to the output on every change.
 *
 * Only the last `maxLines` finished lines are mounted. The rest are counted in
 * an explicit note with a control to show them a page at a time, because tens of
 * thousands of row elements are a frozen page, not a transcript. Copy still
 * writes `output` exactly as given — not the rendered lines, not the visible tail.
 *
 * ## Following the tail
 *
 * The terminal scrolls inside its own bounded box and follows new output only
 * while the reader is at the bottom of that box. Scrolling up *parks* the view:
 * the lines mounted are the ones that were there when they left, however much
 * output arrives, and "Jump to latest" is the only way back to the tail (reaching
 * the bottom of a parked view with nothing newer resumes it, because nothing was
 * missed). If retention discards the lines they were reading the note says how
 * many, and when none are left the oldest retained lines are shown. The page
 * itself is never scrolled. Scrolling is instant, so there is no animation to
 * reduce.
 *
 * ## Status is a claim
 *
 * `status` is drawn only when the host passes it, in words as well as an icon,
 * and only a non-zero exit is toned as a failure: this component does not decide
 * that a command "passed". Without a status the header says nothing about whether
 * the command is still running. `onClear` adds a clear button; without it the
 * output is the host's record and nothing here offers to erase it.
 */
export type TerminalProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** Everything the command has printed so far, exactly as received. */
  output: string
  /** The command line. Shown as text; the prompt glyph is decoration. */
  command?: string
  status?: TerminalStatus
  /** Finished lines mounted at once; earlier ones are counted and revealed a page at a time. */
  maxLines?: number
  /** Finished lines kept at all; older ones are discarded and counted. Default 200 000. */
  retainLines?: number
  /** Height of the output box, which scrolls past it. A number is pixels. Default `20rem`. */
  maxHeight?: number | string
  /** Soft-wrap long lines instead of scrolling sideways. Off: terminal columns keep their alignment. */
  wrap?: boolean
  /** `sm` is the compact chrome for output nested inside a Trace line. */
  size?: 'default' | 'sm'
  /** Show a clear button. The host empties `output`; the terminal erases nothing itself. */
  onClear?: () => void
  copyLabel?: string
  copiedLabel?: string
  clearLabel?: string
  /** Called after each copy attempt with whether the clipboard accepted it. */
  onCopy?: (ok: boolean) => void
}

/** Finished lines mounted by default. */
export const TERMINAL_MAX_LINES = 1000

// One literal class per colour, written out in full so the stylesheet generator
// can see each of them; a class assembled from an index would never be emitted.
const FG_CLASS = [
  'text-(color:--terminal-ansi-black)',
  'text-(color:--terminal-ansi-red)',
  'text-(color:--terminal-ansi-green)',
  'text-(color:--terminal-ansi-yellow)',
  'text-(color:--terminal-ansi-blue)',
  'text-(color:--terminal-ansi-magenta)',
  'text-(color:--terminal-ansi-cyan)',
  'text-(color:--terminal-ansi-white)',
  'text-(color:--terminal-ansi-bright-black)',
  'text-(color:--terminal-ansi-bright-red)',
  'text-(color:--terminal-ansi-bright-green)',
  'text-(color:--terminal-ansi-bright-yellow)',
  'text-(color:--terminal-ansi-bright-blue)',
  'text-(color:--terminal-ansi-bright-magenta)',
  'text-(color:--terminal-ansi-bright-cyan)',
  'text-(color:--terminal-ansi-bright-white)',
] as const
const BG_CLASS = [
  'bg-(--terminal-ansi-black)',
  'bg-(--terminal-ansi-red)',
  'bg-(--terminal-ansi-green)',
  'bg-(--terminal-ansi-yellow)',
  'bg-(--terminal-ansi-blue)',
  'bg-(--terminal-ansi-magenta)',
  'bg-(--terminal-ansi-cyan)',
  'bg-(--terminal-ansi-white)',
  'bg-(--terminal-ansi-bright-black)',
  'bg-(--terminal-ansi-bright-red)',
  'bg-(--terminal-ansi-bright-green)',
  'bg-(--terminal-ansi-bright-yellow)',
  'bg-(--terminal-ansi-bright-blue)',
  'bg-(--terminal-ansi-bright-magenta)',
  'bg-(--terminal-ansi-bright-cyan)',
  'bg-(--terminal-ansi-bright-white)',
] as const

function segmentClass(style: AnsiStyle): string {
  const { fg, bg } = resolveColors(style)
  return cn(
    {
      'font-bold': style.bold,
      'opacity-70': style.dim,
      italic: style.italic,
      underline: style.underline && !style.strike,
      'line-through': style.strike && !style.underline,
      '[text-decoration-line:underline_line-through]': style.underline && style.strike,
      'text-(color:--terminal-background)': fg === 'default-bg',
      'bg-(--terminal-foreground)': bg === 'default-fg',
    },
    typeof fg === 'number' && FG_CLASS[fg],
    typeof bg === 'number' && BG_CLASS[bg]
  )
}

function LineView(props: { line: AnsiLine; wrap: boolean }) {
  return (
    // `min-h-lh` keeps an empty line one line tall; a block with no text would
    // collapse and the transcript would lose its blank lines.
    <div
      class={cn('min-h-lh', {
        'whitespace-pre-wrap [overflow-wrap:anywhere]': props.wrap,
        'w-max min-w-full': !props.wrap,
      })}
    >
      <For each={props.line.segments}>
        {(segment) =>
          isPlainStyle(segment.style) ? (
            segment.text
          ) : (
            <span class={segmentClass(segment.style)}>{segment.text}</span>
          )
        }
      </For>
      <Show when={props.line.truncated > 0}>
        <span class="opacity-70 select-none">
          {' '}
          … {props.line.truncated.toLocaleString()} more characters not shown
        </span>
      </Show>
    </div>
  )
}

function sameAnsiLine(left: AnsiLine, right: AnsiLine): boolean {
  return (
    left.truncated === right.truncated &&
    left.segments.length === right.segments.length &&
    left.segments.every(
      (segment, index) =>
        segment.text === right.segments[index]?.text &&
        segment.style === right.segments[index]?.style
    )
  )
}

function StatusReadout(props: { status: TerminalStatus }) {
  return (
    // A live region, so a command that finishes while the reader is elsewhere is
    // announced once, in words.
    <span
      role="status"
      data-slot="terminal-status"
      data-state={props.status.state}
      class={cn('flex shrink-0 items-center gap-1 text-xs', {
        'text-destructive': isFailedExit(props.status),
        'text-info': props.status.state === 'running',
        'text-muted-foreground': props.status.state !== 'running' && !isFailedExit(props.status),
      })}
    >
      {/* A zero exit gets no glyph: a tick would be this component deciding the
          command succeeded, and some tools exit non-zero on purpose or zero on
          failure. The words carry the fact; only a non-zero code is toned. */}
      <Show when={props.status.state !== 'exited' || isFailedExit(props.status)}>
        <span aria-hidden="true" class="grid size-3.5 place-items-center [&_svg]:size-3.5">
          <Show
            when={props.status.state === 'running'}
            fallback={
              <Show when={props.status.state === 'cancelled'} fallback={<CircleAlert />}>
                <CircleSlash />
              </Show>
            }
          >
            <LoaderCircle class="motion-safe:animate-spin" />
          </Show>
        </span>
      </Show>
      {terminalStatusLabel(props.status)}
    </span>
  )
}

export function Terminal(props: TerminalProps) {
  const [local, rest] = splitProps(props, [
    'output',
    'command',
    'status',
    'maxLines',
    'retainLines',
    'maxHeight',
    'wrap',
    'size',
    'onClear',
    'copyLabel',
    'copiedLabel',
    'clearLabel',
    'onCopy',
    'class',
  ])

  const small = () => local.size === 'sm'
  const pageSize = () => Math.max(1, Math.floor(local.maxLines ?? TERMINAL_MAX_LINES))
  const maxHeight = () =>
    typeof local.maxHeight === 'number' ? `${local.maxHeight}px` : (local.maxHeight ?? '20rem')

  // The parser outlives renders: it holds the half-read escape sequence, the
  // current style and the open line. A new `output` that extends the old one is
  // fed only its tail; anything else (a clear, a different command) starts over.
  const newParser = () => createAnsiParser({ retainLines: local.retainLines })
  let parser = newParser()
  let consumed = ''
  // Bumped when the output restarts, so a parked position from the old output
  // is never applied to the new one.
  let epoch = 0
  const revision = createMemo(
    () => {
      const next = local.output
      if (next.length >= consumed.length && next.startsWith(consumed)) {
        parser.write(next.slice(consumed.length))
      } else {
        parser = newParser()
        parser.write(next)
        epoch += 1
      }
      consumed = next
      return epoch
    },
    undefined,
    { equals: false }
  )

  const [limit, setLimit] = createSignal(pageSize())
  createEffect(on(pageSize, (size) => setLimit(size), { defer: true }))
  // A cleared terminal is a fresh one: the next command starts at the page size.
  createEffect(
    on(
      () => local.output === '',
      (empty) => {
        if (empty) setLimit(pageSize())
      },
      { defer: true }
    )
  )

  const outputRows = createMemo(
    () => {
      revision()
      const rows = parser.lines.slice()
      const open = parser.openLine()
      if (open) rows.push(open)
      return rows
    },
    [],
    { equals: false }
  )
  // Where the reader parked, as a count of lines since the output began. An open
  // line is a row too: freeze its snapshot so streamed characters and CR redraws
  // do not rewrite the text under a parked reader.
  const [parked, setParked] = createSignal<{ epoch: number; end: number; open?: AnsiLine }>()
  const total = () => parser.droppedLines + outputRows().length
  const anchorEnd = () => {
    const current = revision()
    const position = parked()
    return position && position.epoch === current ? position.end : undefined
  }
  const lineWindow = createMemo(() => {
    revision()
    return terminalWindow(outputRows().length, parser.droppedLines, limit(), anchorEnd())
  })
  // Finished rows keep their parser identity. If an open row existed when the
  // reader parked, substitute its immutable snapshot until they jump to latest.
  const visibleRows = createMemo(
    () => {
      revision()
      const start = lineWindow().start
      const end = lineWindow().end
      const rows = outputRows().slice(start, end)
      const position = parked()
      if (position?.epoch === revision() && position.open) {
        const retainedIndex = position.end - 1 - parser.droppedLines
        if (retainedIndex >= start && retainedIndex < end) {
          rows[retainedIndex - start] = position.open
        }
      }
      return rows
    },
    [],
    { equals: false }
  )
  const changedParkedLine = () => {
    const position = parked()
    if (position?.epoch !== revision() || !position.open) return false
    const retainedIndex = position.end - 1 - parser.droppedLines
    const current = outputRows()[retainedIndex]
    return current !== undefined && !sameAnsiLine(position.open, current)
  }
  const newerRows = () => lineWindow().later + (changedParkedLine() ? 1 : 0)

  let scroller: HTMLDivElement | undefined
  const following = () => anchorEnd() === undefined

  const onScroll = () => {
    if (!scroller) return
    const atEnd = isAtBottom(scroller.scrollHeight, scroller.scrollTop, scroller.clientHeight)
    const position = anchorEnd()
    if (!atEnd) {
      if (position === undefined) {
        const currentEpoch = revision()
        setParked({ epoch: currentEpoch, end: total(), open: parser.openLine() })
      }
    } else if (position !== undefined && position >= total() && !changedParkedLine()) {
      // Back at the end of a view with nothing newer: nothing was missed.
      setParked(undefined)
    }
  }
  createEffect(
    on(revision, () => {
      if (scroller && following()) scroller.scrollTop = scroller.scrollHeight
    })
  )
  const jumpToLatest = () => {
    if (!scroller) return
    setParked(undefined)
    scroller.scrollTop = scroller.scrollHeight
    // The button is about to disappear; leave focus somewhere real.
    scroller.focus()
  }

  const [copied, setCopied] = createSignal(false)
  const [copyFailed, setCopyFailed] = createSignal(false)
  const copy = async () => {
    let ok = true
    try {
      await writeClipboardText(local.output)
    } catch {
      ok = false
    }
    setCopied(ok)
    setCopyFailed(!ok)
    local.onCopy?.(ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  const empty = () => local.output === ''
  const regionLabel = () =>
    local.command ? `Output of ${local.command.slice(0, 120)}` : 'Terminal output'

  return (
    <div
      data-slot="terminal"
      data-size={local.size ?? 'default'}
      aria-busy={local.status?.state === 'running' || undefined}
      class={cn(
        'group/terminal overflow-hidden border border-border bg-card',
        small() ? 'rounded-lg' : 'rounded-xl',
        local.class
      )}
      {...rest}
    >
      <div class={cn('flex items-center gap-2', small() ? 'px-2 py-0.5' : 'px-3 py-1')}>
        <Show
          when={local.command !== undefined}
          fallback={<span class="flex-1 text-xs text-muted-foreground">Terminal</span>}
        >
          <span class="flex min-w-0 flex-1 items-baseline gap-2">
            <span
              aria-hidden="true"
              class="shrink-0 font-code text-code text-muted-foreground select-none"
            >
              $
            </span>
            <code
              title={local.command}
              class="line-clamp-2 min-w-0 font-code text-code text-foreground [overflow-wrap:anywhere]"
            >
              {local.command}
            </code>
          </span>
        </Show>
        <Show when={local.status}>{(status) => <StatusReadout status={status()} />}</Show>
        {/* Hidden until the terminal is hovered or holds focus, never removed:
            a control that only exists under the pointer is unreachable by
            keyboard, and a touch screen has no hover, so it always shows there. */}
        <div class="flex items-center gap-1 opacity-0 transition-opacity group-focus-within/terminal:opacity-100 group-hover/terminal:opacity-100 [@media(hover:none)]:opacity-100">
          <Show when={local.onClear !== undefined && !empty()}>
            <Button
              variant="ghost"
              size="icon-2xs"
              aria-label={local.clearLabel ?? 'Clear output'}
              onClick={() => local.onClear?.()}
            >
              <Eraser aria-hidden="true" />
            </Button>
          </Show>
          <Show when={!empty()}>
            <Button
              variant="ghost"
              size="icon-2xs"
              aria-label={
                copied() ? (local.copiedLabel ?? 'Copied') : (local.copyLabel ?? 'Copy output')
              }
              title={copyFailed() ? 'Copying is unavailable in this context' : undefined}
              onClick={() => void copy()}
            >
              <Show when={copied()} fallback={<Copy aria-hidden="true" />}>
                <Check aria-hidden="true" />
              </Show>
            </Button>
          </Show>
        </div>
      </div>

      <Show when={lineWindow().hidden > 0 || lineWindow().evicted > 0}>
        <div
          data-slot="terminal-hidden-note"
          class="flex items-center gap-2 border-t border-border px-3 py-1 text-xs text-muted-foreground"
        >
          <span>
            <Show when={lineWindow().hidden > 0}>
              {lineWindow().hidden.toLocaleString()} earlier{' '}
              {lineWindow().hidden === 1 ? 'line' : 'lines'} hidden
              <Show when={parser.droppedLines > 0}>
                {' '}
                ({parser.droppedLines.toLocaleString()} only in the copy)
              </Show>
              .
            </Show>
            <Show when={lineWindow().evicted > 0}>
              {' '}
              {lineWindow().lost
                ? `The lines you were reading were discarded to keep memory bounded; showing the oldest ${lineWindow().end.toLocaleString()} still kept.`
                : `${lineWindow().evicted.toLocaleString()} of the lines you were reading were discarded to keep memory bounded.`}
            </Show>
          </span>
          <Show when={lineWindow().revealable > 0}>
            <Button
              variant="ghost"
              size="2xs"
              onClick={() => setLimit(revealEarlier(limit(), pageSize(), outputRows().length))}
            >
              Show {Math.min(pageSize(), lineWindow().revealable).toLocaleString()} earlier
            </Button>
          </Show>
        </div>
      </Show>

      <div class="relative">
        <div
          ref={(element) => (scroller = element)}
          data-slot="terminal-body"
          // A region that scrolls must be focusable, and a tab stop needs a name.
          role="region"
          tabindex="0"
          aria-label={regionLabel()}
          onScroll={onScroll}
          style={{ 'max-height': maxHeight() }}
          class="scroll-fade overflow-auto border-t border-border bg-(--terminal-background) text-(color:--terminal-foreground)"
        >
          <Show
            when={!empty()}
            fallback={
              <p class={cn('m-0 opacity-70', small() ? 'px-2 py-1.5' : 'px-3 py-2')}>
                <span class="font-code text-code">
                  {local.status?.state === 'running' ? 'Waiting for output…' : 'No output'}
                </span>
              </p>
            }
          >
            <pre
              class={cn(
                'm-0 font-code text-code leading-normal',
                small() ? 'px-2 py-1.5' : 'px-3 py-2'
              )}
            >
              <For each={visibleRows()}>
                {(line) => <LineView line={line} wrap={local.wrap === true} />}
              </For>
            </pre>
          </Show>
        </div>
        <Show when={newerRows() > 0}>
          <Button
            variant="secondary"
            size="2xs"
            class="absolute end-3 bottom-2 shadow-sm"
            onClick={jumpToLatest}
          >
            <ArrowDown aria-hidden="true" />
            Jump to latest
            <span class="text-muted-foreground tabular-nums">
              ({newerRows().toLocaleString()} newer {newerRows() === 1 ? 'line' : 'lines'})
            </span>
          </Button>
        </Show>
      </div>
    </div>
  )
}
