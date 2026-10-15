import { Wrench } from 'lucide-solid'
import { children as resolveChildren, createMemo, Show, splitProps, type JSX } from 'solid-js'
import { Badge } from '../../ui/badge'
import { CodeBlock, type CodeLineMark } from '../../ui/code-block'
import { TraceDetail, TraceLine, type TraceLineProps, type TraceStatus } from '../../ui/trace'
import { formatToolValue, TOOL_VALUE_MAX_CHARS } from './format-tool-value'

/**
 * `TraceLine` reads its children twice: once to decide whether the line can
 * expand, and once to draw them when it is open. A function child is returned
 * unevaluated by the first read and run once, when the content mounts, by the
 * second — so a folded line builds none of its body. Solid's `insert` unwraps
 * functions; the JSX types simply do not admit them.
 */
const deferred = (render: () => JSX.Element) => render as unknown as JSX.Element

/**
 * Tool.
 *
 * One tool call, from what was asked to what came back, as a `TraceLine`: the
 * tool's name and a short description on the line, and — when there is anything
 * to show — an input section, an output section and an error underneath. Reach
 * for `Subagent` when the "tool" is another agent with steps of its own, for a
 * bare `CodeBlock` when the point is the output itself and not the call that made
 * it, and for a confirmation (passed as `children`) when the reader has to decide
 * something about the call.
 *
 * ## Everything is optional, and absence is not a claim
 *
 * A call with no `status` shows no mark at all — an event that merely arrived is
 * not "done". `input`, `output` and `errorText` each render a section only when
 * the host passed them: no empty "Output" box under a call that is still running,
 * and no invented "No output" under one that failed. An error with no output is
 * just the error. A call with nothing to expand is a plain line, not a
 * disclosure that opens onto nothing.
 *
 * Two statuses are words, not only marks, because the glyphs for them are easy to
 * misread: `awaiting-approval` and `denied` also show a badge. Both are spoken
 * once (the badge is hidden from assistive technology and the status word is
 * read in its place). A call awaiting approval opens by default, since it is the
 * one state in which the reader has something to do. The component never decides
 * whether an approval is allowed: the controls live in `children`, supplied by
 * the host, or are absent.
 *
 * ## Payloads are untrusted and unbounded
 *
 * `input` and `output` are `unknown` — whatever the model sent and the tool
 * returned. They go through `formatToolValue`, which cannot throw (circular
 * references, `BigInt`, throwing getters) and stops after `maxChars`; a cut view
 * says so rather than presenting half a document as the whole. Sections render in
 * a small `CodeBlock` with a capped height. A string is shown as given; anything
 * structured is pretty-printed JSON. The sections mount only when the line is
 * opened, so a transcript of hundreds of calls formats none of them until asked.
 *
 * A `Tool` is a line: place it inside a `Trace`.
 */
export type ToolStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'awaiting-approval'
  | 'denied'

/** The words spoken (and, for the last two, shown) for each status. */
export const TOOL_STATUS_LABELS: Readonly<Record<ToolStatus, string>> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Completed',
  error: 'Failed',
  'awaiting-approval': 'Awaiting approval',
  denied: 'Denied',
}

const TRACE_STATUS: Readonly<Record<ToolStatus, TraceStatus>> = {
  pending: 'pending',
  running: 'running',
  success: 'success',
  error: 'error',
  'awaiting-approval': 'pending',
  denied: 'cancelled',
}

export type ToolProps = Omit<
  TraceLineProps,
  'title' | 'status' | 'statusLabel' | 'href' | 'onSelect' | 'selectHaspopup'
> & {
  /** The tool's name, as the host knows it. Rendered as text. */
  name: string
  /** What this call is for: a path, a query, a command. */
  description?: JSX.Element
  status?: ToolStatus
  /** What the model asked the tool to do. Any value; omit it to show no section. */
  input?: unknown
  /** What the tool returned. Any value; omit it to show no section. */
  output?: unknown
  /** The failure, as text. */
  errorText?: string
  /** Characters of each section shown before it is cut. Defaults to 20,000. */
  maxChars?: number
  /** Extra detail below the sections: an approval, a link to the full output. */
  children?: JSX.Element
}

const SECTION_MAX_HEIGHT = '16rem'

function Section(props: {
  title: string
  value: unknown
  maxChars: number
  complete?: boolean
  failure?: boolean
}) {
  const formatted = createMemo(() => formatToolValue(props.value, { maxChars: props.maxChars }))
  // Every line is marked as an error rather than recolouring the block, which
  // keeps the mark in the gutter (a glyph, not colour alone) and the copy exact.
  const marks = createMemo((): Readonly<Record<number, CodeLineMark>> | undefined => {
    if (!props.failure) return undefined
    const lines = formatted().text.split('\n').length
    return Object.fromEntries(Array.from({ length: lines }, (_, index) => [index + 1, 'error']))
  })
  return (
    <div class="flex min-w-0 flex-col gap-1">
      <CodeBlock
        size="sm"
        title={props.title}
        language={props.failure ? 'error' : formatted().language}
        code={formatted().text}
        lineMarks={marks()}
        complete={props.complete ?? true}
        maxHeight={SECTION_MAX_HEIGHT}
        wrap={formatted().language === 'text'}
      />
      <Show when={formatted().truncated}>
        <p class="m-0 px-1 text-xs text-muted-foreground">
          Showing the first {props.maxChars.toLocaleString('en')} characters.
        </p>
      </Show>
    </div>
  )
}

export function Tool(props: ToolProps) {
  const [local, rest] = splitProps(props, [
    'name',
    'description',
    'status',
    'input',
    'output',
    'errorText',
    'maxChars',
    'icon',
    'meta',
    'defaultOpen',
    'children',
  ])
  const maxChars = () => local.maxChars ?? TOOL_VALUE_MAX_CHARS
  const hasInput = () => local.input !== undefined
  const hasOutput = () => local.output !== undefined
  const hasError = () => local.errorText !== undefined && local.errorText !== ''
  // Resolved once: a host's approval controls are created once and keep their
  // state and focus however often the line is folded.
  const extra = resolveChildren(() => local.children)
  const hasDetail = () => hasInput() || hasOutput() || hasError() || extra.toArray().length > 0

  const detail = () => (
    <TraceDetail class="flex flex-col gap-2">
      <Show when={hasInput()}>
        <Section title="Input" value={local.input} maxChars={maxChars()} />
      </Show>
      <Show when={hasOutput()}>
        <Section
          title="Output"
          value={local.output}
          maxChars={maxChars()}
          complete={local.status !== 'running'}
        />
      </Show>
      <Show when={hasError()}>
        <Section title="Error" value={local.errorText} maxChars={maxChars()} failure />
      </Show>
      {extra()}
    </TraceDetail>
  )

  // Words as well as marks for the two states whose glyph is easy to misread. The
  // badge is hidden from assistive technology: the status word is already spoken.
  const wordBadge = () =>
    local.status === 'awaiting-approval' || local.status === 'denied' ? (
      <span class="flex items-center gap-2">
        <Badge
          aria-hidden="true"
          size="sm"
          variant={local.status === 'denied' ? 'outline' : 'warning'}
        >
          {TOOL_STATUS_LABELS[local.status]}
        </Badge>
        {local.meta}
      </span>
    ) : (
      local.meta
    )

  return (
    <TraceLine
      icon={local.icon ?? <Wrench />}
      title={local.name}
      description={local.description}
      status={local.status ? TRACE_STATUS[local.status] : undefined}
      statusLabel={local.status ? TOOL_STATUS_LABELS[local.status] : undefined}
      meta={wordBadge()}
      defaultOpen={local.defaultOpen ?? local.status === 'awaiting-approval'}
      {...rest}
    >
      {hasDetail() ? deferred(detail) : undefined}
    </TraceLine>
  )
}
