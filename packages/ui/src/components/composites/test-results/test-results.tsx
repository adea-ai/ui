import { CircleCheck, CircleMinus, CircleX, FlaskConical, LoaderCircle } from 'lucide-solid'
import {
  createMemo,
  createSignal,
  For,
  Show,
  splitProps,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import { DiffBlock } from '../../ui/diff-block'
import { Trace, TraceDetail, TraceLine, type TraceStatus } from '../../ui/trace'
import { StackTrace, type StackTraceProps } from '../stack-trace'
import {
  describeCount,
  firstFailureKey,
  formatDuration,
  listedCounts,
  reconcileCounts,
  suiteKey,
  suiteState,
  testKey,
  type CountLine,
  type TestCase,
  type TestCaseStatus,
  type TestOutcome,
  type TestSuite,
  type TestSummary,
} from './test-results-model'

/**
 * TestResults.
 *
 * A test run: how it went in words and in a segmented bar, then the suites it
 * ran as `Trace` lines, each opening onto its tests, and a failing test opening
 * onto its message, diff and stack. It is for a run the host can structure; reach
 * for `Terminal` when all there is to show is the command's output, and for
 * `StackTrace` alone when one call failed outside a test.
 *
 * ## Counts are claims
 *
 * Nothing is computed that the host did not supply data for, and nothing the host
 * supplied is quietly recomputed. `summary` is the host's own tally and is shown
 * as given. If tests are listed and their number for an outcome does not match, the
 * listed number is shown beside it — "40 passed (2 listed)" — which is also how a
 * host that lists only its failures reads. Without a `summary` the counts shown are
 * those of the tests listed, and the component says so; it does not present them as
 * the run's totals. A suite is marked failed or passed only from the tests listed in
 * it, and its spoken label says "listed" so it claims no more than that.
 *
 * ## Not colour-only
 *
 * The bar is decoration: every segment has a counterpart in the words beside it,
 * each with its own shape (a cross, a tick, a dash). Segments are separated by a
 * gap and never narrower than a visible sliver, so one failure in five thousand
 * tests is still on the bar.
 *
 * ## Bounded
 *
 * Suites and tests are listed `listLimit` at a time with "show more", and a suite's
 * tests are not rendered until it is open. Exactly one failing test — the first —
 * opens by default; the rest are one click away.
 *
 * Failure details are text: the message is a `pre`, the diff goes to `DiffBlock`
 * and the stack to `StackTrace`. If a stack already begins with the message, pass
 * only the stack; nothing here de-duplicates what the host sends.
 */
export type TestResultsProps = Omit<ComponentProps<'section'>, 'children'> & {
  suites: readonly TestSuite[]
  /** The host's own counts. Shown as given; see the component comment. */
  summary?: TestSummary
  /** The run is still going. */
  running?: boolean
  /** Suites, or tests within a suite, listed before "show more". Default 50. */
  listLimit?: number
  /** Passed to each failure's `StackTrace`. */
  onOpenFrame?: StackTraceProps['onOpenFrame']
  /** The section's accessible name. Default "Test results". */
  label?: string
}

export const TEST_RESULTS_LIST_LIMIT = 50

const OUTCOME_ICON: Readonly<Record<TestOutcome, () => JSX.Element>> = {
  failed: () => <CircleX aria-hidden="true" class="size-3.5 text-destructive" />,
  passed: () => <CircleCheck aria-hidden="true" class="size-3.5 text-success" />,
  skipped: () => <CircleMinus aria-hidden="true" class="size-3.5 text-muted-foreground" />,
}

function CountReadout(props: { line: CountLine }) {
  return (
    <span class="flex items-center gap-1 whitespace-nowrap" data-outcome={props.line.outcome}>
      {OUTCOME_ICON[props.line.outcome]()}
      {describeCount(props.line)}
    </span>
  )
}

// Segments are drawn in this order so the bar reads the same in every run.
const SEGMENT_CLASS: Readonly<Record<TestOutcome, string>> = {
  failed: 'bg-destructive',
  passed: 'bg-success',
  skipped: 'bg-muted-foreground/40',
}

function SummaryBar(props: { lines: readonly CountLine[] }) {
  const visible = () => props.lines.filter((line) => line.count > 0)
  return (
    <Show when={visible().length > 0}>
      <div
        aria-hidden="true"
        data-slot="test-results-bar"
        class="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-muted"
      >
        <For each={visible()}>
          {(line) => (
            <span
              class={cn('min-w-1', SEGMENT_CLASS[line.outcome])}
              style={{ flex: `${line.count} 1 0` }}
            />
          )}
        </For>
      </div>
    </Show>
  )
}

const TRACE_STATUS: Readonly<Record<TestCaseStatus, { status: TraceStatus; label: string }>> = {
  passed: { status: 'success', label: 'Passed' },
  failed: { status: 'error', label: 'Failed' },
  skipped: { status: 'cancelled', label: 'Skipped' },
  running: { status: 'running', label: 'Running' },
  pending: { status: 'pending', label: 'Not run yet' },
}

/** A list that shows its first `limit` items and offers the rest. */
function Bounded<T>(props: {
  items: readonly T[]
  limit: number
  noun: string
  children: (item: T, index: number) => JSX.Element
}) {
  const [shown, setShown] = createSignal(props.limit)
  const visible = () => props.items.slice(0, shown())
  const hidden = () => props.items.length - visible().length
  return (
    <>
      <For each={visible()}>{(item, index) => props.children(item, index())}</For>
      <Show when={hidden() > 0}>
        <li class="px-1.5 py-0.5">
          <Button variant="ghost" size="2xs" onClick={() => setShown(shown() + props.limit)}>
            Show {Math.min(hidden(), props.limit).toLocaleString()} more {props.noun} (
            {hidden().toLocaleString()} hidden)
          </Button>
        </li>
      </Show>
    </>
  )
}

function TestLine(props: {
  test: TestCase
  keyed: string
  openKey?: string
  onOpenFrame?: TestResultsProps['onOpenFrame']
}) {
  const state = () => (props.test.status ? TRACE_STATUS[props.test.status] : undefined)
  const hasDetail = () => Boolean(props.test.message || props.test.diff || props.test.stack)
  return (
    <TraceLine
      title={props.test.name}
      status={state()?.status}
      statusLabel={state()?.label}
      meta={formatDuration(props.test.durationMs)}
      defaultOpen={props.openKey === props.keyed}
    >
      {hasDetail() ? (
        <TraceDetail class="flex flex-col gap-2">
          <Show when={props.test.message}>
            <pre class="m-0 font-code text-code whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
              {props.test.message}
            </pre>
          </Show>
          <Show when={props.test.diff}>
            <DiffBlock patch={props.test.diff!} complete title="Expected and received" />
          </Show>
          <Show when={props.test.stack}>
            <StackTrace text={props.test.stack!} onOpenFrame={props.onOpenFrame} />
          </Show>
        </TraceDetail>
      ) : undefined}
    </TraceLine>
  )
}

function SuiteLine(props: {
  suite: TestSuite
  keyed: string
  limit: number
  openKey?: string
  onOpenFrame?: TestResultsProps['onOpenFrame']
}) {
  const counts = createMemo(() => listedCounts([props.suite]))
  const state = createMemo(() => suiteState(counts()))
  const children = () => (props.suite.tests?.length ?? 0) + (props.suite.suites?.length ?? 0) > 0
  const description = () => {
    const parts = [
      props.suite.file,
      counts().failed > 0 ? `${counts().failed.toLocaleString()} failed` : undefined,
    ]
    return parts.filter(Boolean).join(' · ') || undefined
  }
  return (
    <TraceLine
      icon={<FlaskConical />}
      title={props.suite.name}
      description={description()}
      status={
        state() === 'failed'
          ? 'error'
          : state() === 'running'
            ? 'running'
            : state() === 'passed'
              ? 'success'
              : undefined
      }
      statusLabel={
        state() === 'failed'
          ? 'Has failing tests'
          : state() === 'passed'
            ? 'All listed tests passed'
            : undefined
      }
      meta={formatDuration(props.suite.durationMs)}
      defaultOpen={state() === 'failed'}
    >
      {children() ? (
        <Trace size="sm" aria-label={`${props.suite.name} tests`}>
          <Bounded items={props.suite.tests ?? []} limit={props.limit} noun="tests">
            {(test, index) => (
              <TestLine
                test={test}
                keyed={testKey(props.keyed, test, index)}
                openKey={props.openKey}
                onOpenFrame={props.onOpenFrame}
              />
            )}
          </Bounded>
          <Bounded items={props.suite.suites ?? []} limit={props.limit} noun="suites">
            {(suite, index) => (
              <SuiteLine
                suite={suite}
                keyed={suiteKey(props.keyed, suite, index)}
                limit={props.limit}
                openKey={props.openKey}
                onOpenFrame={props.onOpenFrame}
              />
            )}
          </Bounded>
        </Trace>
      ) : undefined}
    </TraceLine>
  )
}

export function TestResults(props: TestResultsProps) {
  const [local, rest] = splitProps(props, [
    'suites',
    'summary',
    'running',
    'listLimit',
    'onOpenFrame',
    'label',
    'class',
  ])

  const listed = createMemo(() => listedCounts(local.suites))
  const counts = createMemo(() => reconcileCounts(local.summary, listed()))
  const limit = () => Math.max(1, Math.floor(local.listLimit ?? TEST_RESULTS_LIST_LIMIT))
  const openKey = createMemo(() => firstFailureKey(local.suites))
  const duration = () => formatDuration(local.summary?.durationMs, 'long')
  const nothing = () => counts().lines.length === 0 && local.suites.length === 0 && !local.running

  return (
    <section
      data-slot="test-results"
      aria-label={local.label ?? 'Test results'}
      aria-busy={local.running || undefined}
      class={cn('flex min-w-0 flex-col gap-2', local.class)}
      {...rest}
    >
      <Show
        when={!nothing()}
        fallback={<p class="m-0 text-sm text-muted-foreground">No test results</p>}
      >
        <div class="flex flex-col gap-1.5">
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Show when={local.running}>
              <span class="flex items-center gap-1 text-info">
                <LoaderCircle aria-hidden="true" class="size-3.5 motion-safe:animate-spin" />
                Running
              </span>
            </Show>
            <For each={counts().lines}>{(line) => <CountReadout line={line} />}</For>
            <Show when={counts().totalNote}>
              {(note) => (
                <span class="text-muted-foreground">
                  {note().reported.toLocaleString()} tests reported (
                  {note().listed.toLocaleString()} listed)
                </span>
              )}
            </Show>
            <Show when={duration()}>
              <span class="text-muted-foreground">in {duration()}</span>
            </Show>
          </div>
          <SummaryBar lines={counts().lines} />
          <Show when={counts().basis === 'listed' && counts().lines.length > 0}>
            <p class="m-0 text-xs text-muted-foreground">Counts are from the tests listed below.</p>
          </Show>
        </div>
        <Show when={local.suites.length > 0}>
          <Trace aria-label="Test suites">
            <Bounded items={local.suites} limit={limit()} noun="suites">
              {(suite, index) => (
                <SuiteLine
                  suite={suite}
                  keyed={suiteKey('', suite, index)}
                  limit={limit()}
                  openKey={openKey()}
                  onOpenFrame={local.onOpenFrame}
                />
              )}
            </Bounded>
          </Trace>
        </Show>
      </Show>
    </section>
  )
}
