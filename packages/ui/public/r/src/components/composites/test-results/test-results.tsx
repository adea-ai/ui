import { CircleCheck, CircleMinus, CircleX, FlaskConical, LoaderCircle } from 'lucide-solid'
import {
  createMemo,
  createEffect,
  createSignal,
  For,
  Show,
  splitProps,
  type Accessor,
  type ComponentProps,
  type JSX,
} from 'solid-js'
import { cn } from '../../../lib/utils'
import { Button } from '../../ui/button'
import { DiffBlock } from '../../ui/diff-block'
import { Trace, TraceDetail, TraceLine, type TraceStatus } from '../../ui/trace'
import { StackTrace, type StackTraceProps } from '../stack-trace'
import {
  boundedEntries,
  describeCount,
  firstFailureRenderPath,
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
  type FirstFailureRenderPath,
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
 * tests are not rendered until it is open. The first failure in reading order opens
 * when its row is visible; a failure beyond a "show more" boundary stays unmounted
 * until its page is revealed. When a running result first reports a failure, its
 * suite and test open once. Later updates preserve the user's disclosure choices.
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
  itemKey: (item: T, index: number) => string
  limit: number
  noun: string
  children: (item: Accessor<T>, index: Accessor<number>, key: string) => JSX.Element
}) {
  const [shown, setShown] = createSignal(props.limit)
  const page = createMemo(() => boundedEntries(props.items, shown(), props.itemKey))
  const visible = () => page().entries
  const visibleKeys = createMemo(() => visible().map((entry) => entry.key))
  const hidden = () => props.items.length - visible().length
  return (
    <>
      <For each={visibleKeys()}>
        {(key) => {
          const entry = createMemo(() => page().byKey.get(key)!)
          return props.children(
            () => entry().item,
            () => entry().index,
            key
          )
        }}
      </For>
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
  test: Accessor<TestCase>
  keyed: string
  failure?: FirstFailureRenderPath
  onOpenFrame?: TestResultsProps['onOpenFrame']
}) {
  const test = () => props.test()
  const state = () => (test().status ? TRACE_STATUS[test().status as TestCaseStatus] : undefined)
  const hasDetail = () => Boolean(test().message || test().diff || test().stack)
  const failureKey = () => props.failure?.test
  const [open, setOpen] = createSignal(failureKey() === props.keyed)
  let previousFailureKey = failureKey()
  let collapsedFailureKey: string | undefined

  createEffect(() => {
    const currentFailureKey = failureKey()
    if (
      currentFailureKey === props.keyed &&
      currentFailureKey !== previousFailureKey &&
      currentFailureKey !== collapsedFailureKey
    ) {
      setOpen(true)
    }
    previousFailureKey = currentFailureKey
  })

  const handleOpenChange = (next: boolean) => {
    if (!next && failureKey() === props.keyed) collapsedFailureKey = props.keyed
    else if (next) collapsedFailureKey = undefined
    setOpen(next)
  }

  return (
    <TraceLine
      title={test().name}
      status={state()?.status}
      statusLabel={state()?.label}
      meta={formatDuration(test().durationMs)}
      open={open()}
      onOpenChange={handleOpenChange}
    >
      {hasDetail() ? (
        <TraceDetail class="flex flex-col gap-2">
          <Show when={test().message}>
            <pre class="m-0 font-code text-code whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">
              {test().message}
            </pre>
          </Show>
          <Show when={test().diff}>
            <DiffBlock patch={test().diff!} complete title="Expected and received" />
          </Show>
          <Show when={test().stack}>
            <StackTrace text={test().stack!} onOpenFrame={props.onOpenFrame} />
          </Show>
        </TraceDetail>
      ) : undefined}
    </TraceLine>
  )
}

function SuiteLine(props: {
  suite: Accessor<TestSuite>
  keyed: string
  limit: number
  failure?: FirstFailureRenderPath
  onOpenFrame?: TestResultsProps['onOpenFrame']
}) {
  const suite = () => props.suite()
  const counts = createMemo(() => listedCounts([suite()]))
  const state = createMemo(() => suiteState(counts()))
  const children = () => (suite().tests?.length ?? 0) + (suite().suites?.length ?? 0) > 0
  const [open, setOpen] = createSignal(state() === 'failed')
  const failureKey = () => props.failure?.test
  const containsFailure = () => props.failure?.suites.includes(props.keyed) ?? false
  let previousFailureKey = failureKey()
  let collapsedFailureKey: string | undefined

  createEffect(() => {
    const currentFailureKey = failureKey()
    if (
      containsFailure() &&
      currentFailureKey &&
      currentFailureKey !== previousFailureKey &&
      currentFailureKey !== collapsedFailureKey
    ) {
      setOpen(true)
    }
    previousFailureKey = currentFailureKey
  })

  const handleOpenChange = (next: boolean) => {
    if (!next && containsFailure()) collapsedFailureKey = failureKey()
    else if (next) collapsedFailureKey = undefined
    setOpen(next)
  }

  const description = () => {
    const parts = [
      suite().file,
      counts().failed > 0 ? `${counts().failed.toLocaleString()} failed` : undefined,
    ]
    return parts.filter(Boolean).join(' · ') || undefined
  }
  return (
    <TraceLine
      icon={<FlaskConical />}
      title={suite().name}
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
      meta={formatDuration(suite().durationMs)}
      open={open()}
      onOpenChange={handleOpenChange}
    >
      {children() ? (
        <div>
          <Show when={open()}>
            <Trace size="sm" aria-label={`${suite().name} tests`}>
              <Bounded
                items={suite().tests ?? []}
                itemKey={(test, index) => testKey(props.keyed, test, index)}
                limit={props.limit}
                noun="tests"
              >
                {(test, _index, key) => (
                  <TestLine
                    test={test}
                    keyed={key}
                    failure={props.failure}
                    onOpenFrame={props.onOpenFrame}
                  />
                )}
              </Bounded>
              <Bounded
                items={suite().suites ?? []}
                itemKey={(nested, index) => suiteKey(props.keyed, nested, index)}
                limit={props.limit}
                noun="suites"
              >
                {(nested, _index, key) => (
                  <SuiteLine
                    suite={nested}
                    keyed={key}
                    limit={props.limit}
                    failure={props.failure}
                    onOpenFrame={props.onOpenFrame}
                  />
                )}
              </Bounded>
            </Trace>
          </Show>
        </div>
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
  const failure = createMemo(() => firstFailureRenderPath(local.suites))
  const duration = () => formatDuration(local.summary?.durationMs, 'long')
  const nothing = () =>
    counts().lines.length === 0 &&
    counts().reportedTotal === undefined &&
    local.suites.length === 0 &&
    !local.running

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
            <Show
              when={
                counts().lines.length === 0 &&
                !counts().totalNote &&
                counts().reportedTotal !== undefined
              }
            >
              <span class="text-muted-foreground">
                {counts().reportedTotal?.toLocaleString()} tests reported
              </span>
            </Show>
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
            <Bounded
              items={local.suites}
              itemKey={(suite, index) => suiteKey('', suite, index)}
              limit={limit()}
              noun="suites"
            >
              {(suite, _index, key) => (
                <SuiteLine
                  suite={suite}
                  keyed={key}
                  limit={limit()}
                  failure={failure()}
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
