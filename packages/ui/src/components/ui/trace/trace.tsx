import { Collapsible as KobalteCollapsible } from '@kobalte/core/collapsible'
import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  CircleSlash,
  Dot,
  ExternalLink,
  LoaderCircle,
} from 'lucide-solid'
import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Trace.
 *
 * A list of lines, one per thing an agent did. Reasoning, a tool call, a source
 * it read, a plan step and a whole subagent run all share one shape — *something
 * the agent did, and what happened* — so they share one row: a leading mark, a
 * title, an optional description, a status and, when there is more to say, a
 * disclosure. A transcript built from this reads as one quiet column of activity
 * under the answer instead of a stack of competing cards.
 *
 * ## One row, three behaviours
 *
 * - **Children** make the line expandable. The trigger is a real button with
 *   `aria-expanded`, so keyboard and screen-reader users get the disclosure for
 *   free. Children can themselves be a `Trace`, which is how a summary expands
 *   into steps and a step into its output.
 * - **`href`** makes the line a link — a source, a file, a run page.
 * - **`onSelect`** makes the line a button that opens something *else* (a dialog,
 *   sheet, drawer or popover owned by the caller). The line says so with
 *   `aria-haspopup`; the surface itself is not this component's business.
 * - None of the three: a static line. It is not focusable, because a control that
 *   does nothing is a tab stop with no purpose.
 *
 * ## Status is a claim, so it is optional
 *
 * `status` is rendered only when the caller has it. A line without one makes no
 * statement about success, which matters for runtime events whose lifecycle the
 * producer has not told us: showing a tick on an event that merely *arrived* is
 * a small lie that accumulates. `running` shimmers the title and spins the mark,
 * both of which stop under reduced motion; `error` and `cancelled` change the
 * mark's shape as well as its colour; every status is also spoken (`sr-only`),
 * because a coloured dot alone fails anyone who cannot see it.
 */
export type TraceStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled'

/** The words spoken for each status. Override per line for another language. */
export const TRACE_STATUS_LABELS: Readonly<Record<TraceStatus, string>> = {
  pending: 'Pending',
  running: 'Running',
  success: 'Completed',
  error: 'Failed',
  cancelled: 'Cancelled',
}

export type TraceProps = ComponentProps<'ul'> & {
  /** Tighter rows, for output nested inside another line. */
  size?: 'default' | 'sm'
}

export function Trace(props: TraceProps) {
  const [local, rest] = splitProps(props, ['class', 'size', 'children'])
  return (
    // `role="list"` restores list semantics that `list-none` strips in WebKit.
    <ul
      role="list"
      data-slot="trace"
      data-size={local.size ?? 'default'}
      class={cn('m-0 flex min-w-0 list-none flex-col gap-px p-0', local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  )
}

export type TraceLineProps = Omit<ComponentProps<'li'>, 'title' | 'onSelect'> & {
  title: JSX.Element
  description?: JSX.Element
  /** The line's own glyph. A `running`, `error`, `pending` or `cancelled` status replaces it. */
  icon?: JSX.Element
  status?: TraceStatus
  /** Spoken in place of the default status word. */
  statusLabel?: string
  /** Trailing text: a duration, a count, a file size. */
  meta?: JSX.Element
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Make the line a link. Mutually exclusive with children and `onSelect`. */
  href?: string
  /** Make the line open a surface the caller owns. */
  onSelect?: () => void
  /** Which kind of surface `onSelect` opens, for assistive technology. */
  selectHaspopup?: 'dialog' | 'menu' | 'true'
  /** Details. Their presence makes the line expandable. */
  children?: JSX.Element
}

function StatusMark(props: { status?: TraceStatus; icon?: JSX.Element; completed?: boolean }) {
  return (
    <span
      data-slot="trace-mark"
      aria-hidden="true"
      class={cn('grid size-4 shrink-0 place-items-center [&_svg]:size-3.5', {
        'text-muted-foreground': props.status !== 'error' && props.status !== 'running',
        'text-destructive': props.status === 'error',
        'text-info': props.status === 'running',
      })}
    >
      <Show
        when={props.status === 'running'}
        fallback={
          <Show
            when={props.status === 'error'}
            fallback={
              <Show
                when={props.status === 'cancelled'}
                fallback={
                  <Show
                    when={props.status === 'pending'}
                    fallback={props.icon ?? (props.completed ? <Check /> : <Dot />)}
                  >
                    <CircleDashed />
                  </Show>
                }
              >
                <CircleSlash />
              </Show>
            }
          >
            <CircleAlert />
          </Show>
        }
      >
        <LoaderCircle class="motion-safe:animate-spin" />
      </Show>
    </span>
  )
}

/**
 * Whether the status takes over the mark. A completed line keeps its own glyph
 * (the tool, the file) because "done" is the default expectation and a column of
 * identical ticks says nothing; the states that need noticing replace it.
 */
function statusOwnsMark(status: TraceStatus | undefined): boolean {
  return (
    status === 'running' || status === 'error' || status === 'pending' || status === 'cancelled'
  )
}

function LineHead(props: {
  title: JSX.Element
  description?: JSX.Element
  icon?: JSX.Element
  status?: TraceStatus
  statusLabel?: string
  meta?: JSX.Element
  trailing?: JSX.Element
}) {
  return (
    <>
      <StatusMark
        status={statusOwnsMark(props.status) ? props.status : undefined}
        icon={props.icon}
        completed={props.status === 'success'}
      />
      <span class="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          data-slot="trace-title"
          class={cn('truncate text-sm', {
            'text-shimmer': props.status === 'running',
            'text-destructive': props.status === 'error',
            'text-muted-foreground': props.status !== 'running' && props.status !== 'error',
          })}
        >
          {props.title}
        </span>
        <Show when={props.description}>
          <span
            data-slot="trace-description"
            class="min-w-0 truncate text-xs text-muted-foreground/80"
          >
            {props.description}
          </span>
        </Show>
      </span>
      <Show when={props.status}>
        {(status) => (
          <span class="sr-only">{props.statusLabel ?? TRACE_STATUS_LABELS[status()]}</span>
        )}
      </Show>
      <Show when={props.meta}>
        <span data-slot="trace-meta" class="shrink-0 text-xs text-muted-foreground tabular-nums">
          {props.meta}
        </span>
      </Show>
      {props.trailing}
    </>
  )
}

const lineClass =
  'flex min-h-control-xs w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 text-start outline-none'
const interactiveClass =
  'cursor-pointer transition-colors ease-out hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-primary-subtle focus-visible:border-ring'

export function TraceLine(props: TraceLineProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'title',
    'description',
    'icon',
    'status',
    'statusLabel',
    'meta',
    'open',
    'defaultOpen',
    'onOpenChange',
    'href',
    'onSelect',
    'selectHaspopup',
    'children',
  ])
  const head = (trailing?: JSX.Element) => (
    <LineHead
      title={local.title}
      description={local.description}
      icon={local.icon}
      status={local.status}
      statusLabel={local.statusLabel}
      meta={local.meta}
      trailing={trailing}
    />
  )

  return (
    <li
      data-slot="trace-line"
      data-status={local.status}
      aria-busy={local.status === 'running' || undefined}
      class={cn('min-w-0', local.class)}
      {...rest}
    >
      <Show
        when={local.href === undefined}
        fallback={
          <a
            href={local.href}
            target="_blank"
            rel="noreferrer noopener"
            class={cn(lineClass, interactiveClass)}
          >
            {head(
              <ExternalLink aria-hidden="true" class="size-3 shrink-0 text-muted-foreground" />
            )}
          </a>
        }
      >
        <Show
          when={local.onSelect === undefined}
          fallback={
            <button
              type="button"
              aria-haspopup={local.selectHaspopup ?? 'dialog'}
              class={cn(lineClass, interactiveClass)}
              onClick={() => local.onSelect?.()}
            >
              {head(
                <ChevronRight aria-hidden="true" class="size-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>
          }
        >
          <Show when={local.children} fallback={<div class={lineClass}>{head()}</div>}>
            <KobalteCollapsible
              open={local.open}
              defaultOpen={local.defaultOpen}
              onOpenChange={local.onOpenChange}
              class="group/trace"
            >
              <KobalteCollapsible.Trigger class={cn(lineClass, interactiveClass)}>
                {head(
                  <ChevronRight
                    aria-hidden="true"
                    class="size-3.5 shrink-0 text-muted-foreground transition-transform ease-out group-data-[expanded]/trace:rotate-90"
                  />
                )}
              </KobalteCollapsible.Trigger>
              <KobalteCollapsible.Content
                data-slot="trace-content"
                class="overflow-hidden data-[expanded]:animate-in data-[expanded]:fade-in-0"
              >
                {/* The rail is drawn from the mark's centre, so a nested line reads as
                    belonging to the one above it without an indent that eats the width. */}
                <div class="ms-[0.6875rem] mt-0.5 mb-1 flex min-w-0 flex-col gap-1 border-s border-border ps-3">
                  {local.children}
                </div>
              </KobalteCollapsible.Content>
            </KobalteCollapsible>
          </Show>
        </Show>
      </Show>
    </li>
  )
}

/**
 * Free-form detail inside an expanded line: an input, an output, a paragraph. It
 * is a plain block with the type scale already set, so a caller does not restyle
 * a line's children to make a paragraph fit.
 */
export function TraceDetail(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <div
      data-slot="trace-detail"
      class={cn('min-w-0 text-xs leading-5 text-muted-foreground', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  )
}
