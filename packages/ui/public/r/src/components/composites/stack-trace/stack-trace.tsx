import { Check, CircleAlert, Copy, Package } from 'lucide-solid'
import {
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  splitProps,
  Switch,
  type ComponentProps,
} from 'solid-js'
import { writeClipboardText } from '../../../lib/clipboard'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import { CodeBlock } from '../../ui/code-block'
import { TraceLine } from '../../ui/trace'
import {
  boundLines,
  dedentLines,
  describeFrameGroup,
  frameLocation,
  groupStackEntries,
  parseStackTrace,
  type ParseStackTraceOptions,
  type StackBlock,
  type StackFrame,
} from './parse-stack-trace'

/**
 * StackTrace.
 *
 * A failed call and the frames it failed through. Put it in the body of the
 * `TraceLine` for the call that failed, or under a failing test; reach for
 * `CodeBlock` when the text is not a trace, and for `Terminal` when it is the
 * live output of a command rather than one error.
 *
 * ## The reader's code first
 *
 * A trace is mostly someone else's frames. Runs of dependency and runtime frames
 * (`node_modules`, `site-packages`, `.cargo/registry`, `node:` internals, Rust's
 * `std`) fold into one disclosure line that says what it holds, and a lone
 * dependency frame is dimmed rather than folded. When *none* of the frames is the
 * reader's, nothing folds: hiding the whole trace behind a button helps nobody.
 * Whose code a frame is comes from its path; a host that knows the project layout
 * passes `classify`.
 *
 * ## It never hides a line
 *
 * Every line of `text` is on screen in order — as a frame, as a header, or as
 * muted text — and a trace in a format this does not know is shown whole in a
 * `CodeBlock`, which also copies it. Copy writes `text` exactly as given, not a
 * reformatted version of what was parsed.
 *
 * ## Opening a frame is the host's decision
 *
 * A frame is a button only when `onOpenFrame` is supplied, and only when the
 * frame names a file; without it frames are plain text, because a control that
 * does nothing is a tab stop with no purpose. The component never builds a path
 * or tries to open one — the trace is untrusted text, and what a path in it means
 * on this machine is the host's call.
 *
 * Text is text throughout: frames, messages and source lines are rendered as text
 * nodes, long unbroken tokens wrap rather than widening the column, and what is
 * drawn is bounded with the omission stated every time: a text line or a header
 * message beyond 10 000 characters, a frame's printed lines beyond 40 lines or
 * 10 000 characters, and the frames of a folded group, which are built only while
 * it is open and then `maxBlocks` at a time. Copy and `onOpenFrame` still get all of
 * it.
 */
export type StackTraceProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The trace exactly as the runtime printed it. */
  text: string
  /** Make frames that name a file open it. Omit to render them as plain text. */
  onOpenFrame?: (frame: StackFrame) => void
  classify?: ParseStackTraceOptions['classify']
  /** Fold runs of dependency and runtime frames. Default true. */
  collapseDependencies?: boolean
  /** Start folded groups open. */
  defaultDependenciesOpen?: boolean
  /** Blocks (frames, groups, text) shown before "show more". Default 200. */
  maxBlocks?: number
  copyLabel?: string
  copiedLabel?: string
  /** Called after each copy attempt with whether the clipboard accepted it. */
  onCopy?: (ok: boolean) => void
}

export const STACK_TRACE_MAX_BLOCKS = 200
const TEXT_DISPLAY_LIMIT = 10_000
/** What a frame's own printed lines (a Python source line, a locals dump) may show. */
const DETAIL_LINE_LIMIT = 40
const DETAIL_CHAR_LIMIT = 10_000

const rowClass =
  'flex min-w-0 flex-wrap items-baseline gap-x-2 rounded-md px-1.5 py-0.5 text-start text-xs outline-none'
const interactiveClass =
  'w-full cursor-pointer transition-colors ease-out hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-primary-subtle focus-visible:border-ring'

function omissionNote(lines: number, chars: number): string {
  return lines > 0
    ? `… ${lines.toLocaleString()} more ${lines === 1 ? 'line' : 'lines'} (${chars.toLocaleString()} characters) not shown`
    : `… ${chars.toLocaleString()} more characters not shown`
}

/** A frame's printed lines, bounded so one frame cannot be the whole page. */
function FrameDetail(props: { lines: readonly string[] }) {
  const bounded = createMemo(() => boundLines(props.lines, DETAIL_LINE_LIMIT, DETAIL_CHAR_LIMIT))
  return (
    <>
      <pre class="m-0 ms-1.5 px-1.5 font-code text-code whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
        {dedentLines(bounded().lines).join('\n')}
      </pre>
      <Show when={bounded().omittedLines > 0 || bounded().omittedChars > 0}>
        <p class="m-0 ms-1.5 px-1.5 text-xs text-muted-foreground italic">
          {omissionNote(bounded().omittedLines, bounded().omittedChars)}
          {' (copy has all of it)'}
        </p>
      </Show>
    </>
  )
}

/** Header text, cut to the display limit with what was cut stated. */
function ClippedText(props: { text: string; class?: string }) {
  const clipped = () => props.text.length > TEXT_DISPLAY_LIMIT
  return (
    <>
      <span class={props.class}>
        {clipped() ? props.text.slice(0, TEXT_DISPLAY_LIMIT) : props.text}
      </span>
      <Show when={clipped()}>
        <span class="block text-xs text-muted-foreground italic">
          … {(props.text.length - TEXT_DISPLAY_LIMIT).toLocaleString()} more characters not shown
          (copy has all of it)
        </span>
      </Show>
    </>
  )
}

/**
 * A folded run of dependency or runtime frames. Its rows are built only while it
 * is open and then a page at a time, so a run of ten thousand frames costs the
 * same as one of a few hundred until the reader asks for more.
 */
function FrameGroup(props: {
  frames: readonly StackFrame[]
  defaultOpen?: boolean
  pageSize: number
  onOpen?: (frame: StackFrame) => void
}) {
  const [open, setOpen] = createSignal(props.defaultOpen === true)
  const [limit, setLimit] = createSignal<number | undefined>()
  const title = createMemo(() => describeFrameGroup(props.frames))
  const shown = createMemo(() => props.frames.slice(0, limit() ?? props.pageSize))
  const hidden = () => props.frames.length - shown().length
  return (
    <TraceLine icon={<Package />} title={title()} open={open()} onOpenChange={setOpen}>
      <Show when={open()}>
        <ol role="list" aria-label={title()} class="m-0 flex min-w-0 list-none flex-col gap-px p-0">
          <For each={shown()}>{(frame) => <FrameRow frame={frame} onOpen={props.onOpen} />}</For>
        </ol>
        <Show when={hidden() > 0}>
          <ShowMore
            hidden={hidden()}
            pageSize={props.pageSize}
            onClick={() => setLimit(shown().length + props.pageSize)}
          />
        </Show>
      </Show>
    </TraceLine>
  )
}

function ShowMore(props: { hidden: number; pageSize: number; onClick: () => void }) {
  return (
    <div class="ps-1.5">
      <Button variant="ghost" size="2xs" onClick={props.onClick}>
        Show {Math.min(props.hidden, props.pageSize).toLocaleString()} more (
        {props.hidden.toLocaleString()} hidden)
      </Button>
    </div>
  )
}

function FrameRow(props: { frame: StackFrame; onOpen?: (frame: StackFrame) => void }) {
  const location = () => frameLocation(props.frame)
  const first = () => props.frame.kind === 'first-party'
  const content = () => (
    <>
      <span
        class={cn('font-code text-code', {
          'text-foreground': first(),
          'text-muted-foreground': !first(),
        })}
      >
        {props.frame.async ? 'async ' : ''}
        {props.frame.function ?? '(anonymous)'}
      </span>
      <Show when={location()}>
        <span class="min-w-0 font-code text-code text-muted-foreground [overflow-wrap:anywhere]">
          {location()}
        </span>
      </Show>
      {/* The dimming is a colour; the kind is also spoken. */}
      <Show when={!first()}>
        <span class="sr-only">
          {props.frame.kind === 'dependency' ? 'in a dependency' : 'in the runtime'}
        </span>
      </Show>
    </>
  )
  return (
    <li data-slot="stack-frame" data-kind={props.frame.kind} class="min-w-0">
      <Show
        when={props.onOpen !== undefined && props.frame.file !== undefined}
        fallback={<div class={rowClass}>{content()}</div>}
      >
        <button
          type="button"
          aria-label={`Open ${props.frame.function ?? 'frame'} at ${location()}`}
          class={cn(rowClass, interactiveClass)}
          onClick={() => props.onOpen?.(props.frame)}
        >
          {content()}
        </button>
      </Show>
      <Show when={props.frame.detail && props.frame.detail.length > 0}>
        <FrameDetail lines={props.frame.detail!} />
      </Show>
    </li>
  )
}

function TextRow(props: { text: string }) {
  const clipped = () => props.text.length > TEXT_DISPLAY_LIMIT
  return (
    <li class="min-w-0 px-1.5 py-0.5 font-code text-code whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
      {clipped() ? props.text.slice(0, TEXT_DISPLAY_LIMIT) : props.text}
      <Show when={clipped()}>
        <span class="block font-sans text-xs italic">
          … {(props.text.length - TEXT_DISPLAY_LIMIT).toLocaleString()} more characters not shown
        </span>
      </Show>
    </li>
  )
}

export function StackTrace(props: StackTraceProps) {
  const [local, rest] = splitProps(props, [
    'text',
    'onOpenFrame',
    'classify',
    'collapseDependencies',
    'defaultDependenciesOpen',
    'maxBlocks',
    'copyLabel',
    'copiedLabel',
    'onCopy',
    'class',
  ])

  const parsed = createMemo(() => parseStackTrace(local.text, { classify: local.classify }))
  const blocks = createMemo<readonly StackBlock[]>(() =>
    groupStackEntries(parsed().entries, local.collapseDependencies !== false).filter(
      // A blank line between paragraphs of a trace carries nothing to draw.
      (block) => block.type !== 'text' || block.text.trim() !== ''
    )
  )
  const pageSize = () => Math.max(1, Math.floor(local.maxBlocks ?? STACK_TRACE_MAX_BLOCKS))
  const [limit, setLimit] = createSignal<number | undefined>()
  const shown = createMemo(() => blocks().slice(0, limit() ?? pageSize()))
  const hidden = () => blocks().length - shown().length

  const [copied, setCopied] = createSignal(false)
  const [copyFailed, setCopyFailed] = createSignal(false)
  const copy = async () => {
    let ok = true
    try {
      await writeClipboardText(local.text)
    } catch {
      ok = false
    }
    setCopied(ok)
    setCopyFailed(!ok)
    local.onCopy?.(ok)
    if (ok) setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-slot="stack-trace"
      data-format={parsed().format}
      class={cn('flex min-w-0 flex-col gap-1', local.class)}
      {...rest}
    >
      <Show
        when={parsed().format !== 'unknown'}
        fallback={
          // Nothing recognised: the whole text, in the block that copies it.
          <CodeBlock size="sm" title="Error output" code={local.text} complete wrap />
        }
      >
        <div class="group/stack flex items-start gap-2">
          <CircleAlert aria-hidden="true" class="mt-0.5 size-4 shrink-0 text-destructive" />
          <div class="min-w-0 flex-1 text-sm">
            <Show
              when={parsed().header}
              fallback={<span class="text-muted-foreground">Stack trace</span>}
            >
              {(header) => (
                <>
                  <p class="m-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
                    <Show when={header().type}>
                      <ClippedText class="font-semibold text-destructive" text={header().type!} />
                      <Show when={header().message !== ''}>
                        <span class="text-muted-foreground">: </span>
                      </Show>
                    </Show>
                    <ClippedText class="text-foreground" text={header().message} />
                  </p>
                  <Show when={header().location}>
                    <p class="m-0 font-code text-code text-muted-foreground [overflow-wrap:anywhere]">
                      <ClippedText text={header().location!} />
                    </p>
                  </Show>
                </>
              )}
            </Show>
          </div>
          <div class="flex items-center gap-1 opacity-0 transition-opacity group-focus-within/stack:opacity-100 group-hover/stack:opacity-100 [@media(hover:none)]:opacity-100">
            <Button
              variant="ghost"
              size="icon-2xs"
              aria-label={
                copied() ? (local.copiedLabel ?? 'Copied') : (local.copyLabel ?? 'Copy stack trace')
              }
              title={copyFailed() ? 'Copying is unavailable in this context' : undefined}
              onClick={() => void copy()}
            >
              <Show when={copied()} fallback={<Copy aria-hidden="true" />}>
                <Check aria-hidden="true" />
              </Show>
            </Button>
          </div>
        </div>

        <ol
          role="list"
          aria-label="Stack frames"
          class="m-0 ms-2 flex min-w-0 list-none flex-col gap-px border-s border-border p-0 ps-2"
        >
          <For each={shown()}>
            {(block) => (
              <Switch>
                <Match when={block.type === 'frame' && block}>
                  {(entry) => (
                    <FrameRow
                      frame={(entry() as Extract<StackBlock, { type: 'frame' }>).frame}
                      onOpen={local.onOpenFrame}
                    />
                  )}
                </Match>
                <Match when={block.type === 'text' && block}>
                  {(entry) => (
                    <TextRow text={(entry() as Extract<StackBlock, { type: 'text' }>).text} />
                  )}
                </Match>
                <Match when={block.type === 'group' && block}>
                  {(entry) => (
                    <FrameGroup
                      frames={(entry() as Extract<StackBlock, { type: 'group' }>).frames}
                      defaultOpen={local.defaultDependenciesOpen}
                      pageSize={pageSize()}
                      onOpen={local.onOpenFrame}
                    />
                  )}
                </Match>
              </Switch>
            )}
          </For>
        </ol>
        <Show when={hidden() > 0}>
          <div class="ms-2">
            <ShowMore
              hidden={hidden()}
              pageSize={pageSize()}
              onClick={() => setLimit(shown().length + pageSize())}
            />
          </div>
        </Show>
      </Show>
    </div>
  )
}
