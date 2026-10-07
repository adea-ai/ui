import type { Accessor, Component, ComponentProps } from 'solid-js'
import {
  For,
  Show,
  createComponent,
  createMemo,
  createSignal,
  createUniqueId,
  splitProps,
} from 'solid-js'
import { ChevronDown } from 'lucide-solid'
import { cn } from '#lib/utils'
import { Button } from '../ui/button/button'
import {
  applyTranscriptRunningState,
  createTranscriptGrouper,
  type TranscriptDisplayItem,
  type TranscriptRow,
  type TranscriptTurnItem,
} from './transcript-grouping'
import {
  planTranscriptFold,
  type TranscriptFoldMode,
  type TranscriptMounting,
} from './transcript-folding'

export type TranscriptFoldState = 'default' | 'collapsed' | 'expanded'
export type TranscriptDisplayKind = 'single' | 'group' | 'turn'

export type {
  GroupedTranscript,
  TranscriptDisplayItem,
  TranscriptRow,
  TranscriptTurnItem,
} from './transcript-grouping'
export type {
  TranscriptFoldMode,
  TranscriptFoldPlan,
  TranscriptMounting,
} from './transcript-folding'

export type TranscriptCompositionFold = Readonly<{
  /** Stable host persistence key. Use with `transcriptDisclosureKey` to seed a store. */
  key: string
  mode: TranscriptFoldMode
  mounting: TranscriptMounting
  /** Distinct host-classified request IDs in this contiguous fold segment. */
  callCount: number
}>

export type TranscriptCompositionRowContext = Readonly<{
  /** Original index in the caller's row array, including rows hidden by the host. */
  index: number
  /** The row's current position in the generic display composition. */
  displayKind: TranscriptDisplayKind
  group?: Readonly<{ index: number; size: number }>
  turn?: Readonly<{
    /** Derived from the first stable row ID; presentation bookkeeping only. */
    id: string
    /** A presentation state, never proof of successful runtime completion. */
    complete: boolean
    interim: boolean
  }>
  fold?: TranscriptCompositionFold
}>

export type TranscriptCompositionRendererProps<T> = Readonly<{
  /** Reactive Solid prop; a row component keeps its DOM owner stable as values update. */
  row: TranscriptRow<T>
  context: TranscriptCompositionRowContext
}>

export type TranscriptCompositionProps<T> = Omit<ComponentProps<'div'>, 'children'> & {
  /** Ordered, already redacted rows with host-supplied semantic classifications. */
  rows: readonly TranscriptRow<T>[]
  /** Render one host row. Permission, session, event and protocol authority stay outside this component. */
  renderRow: Component<TranscriptCompositionRendererProps<T>>
  /** The host's current run state. Live rows stay mounted and expanded until settled. */
  running?: boolean
  /** Reset scope for row identity and disclosure. It is not inferred from display content. */
  resetKey?: string | number | null
  /** Default settled fold policy. `tools` keeps prose visible; `prose` retains a proven conclusion. */
  foldMode?: TranscriptFoldMode
  /** Global command state. `collapsed` keeps hidden content mounted; prose folds only before a host-marked conclusion. */
  foldState?: TranscriptFoldState
  onFoldStateChange?: (state: TranscriptFoldState) => void
  /** Optional controlled disclosure map keyed by `transcriptDisclosureKey`. */
  disclosure?: ReadonlyMap<string, boolean>
  onDisclosureChange?: (key: string, expanded: boolean) => void
  /**
   * Row rhythm. `compact` (default) packs rows 4px apart; `comfortable` spaces
   * them 12px apart and stacks each row's rendered parts, for a chat stream
   * whose rows are separate messages rather than one running log.
   */
  density?: 'compact' | 'comfortable'
}

type TurnPresentation = NonNullable<TranscriptCompositionRowContext['turn']>
type GroupPresentation = NonNullable<TranscriptCompositionRowContext['group']>

type FoldGroup<T> = Readonly<{
  key: string
  mode: TranscriptFoldMode
  callCount: number
  rows: readonly TranscriptRow<T>[]
}>

type RowRecord<T> = {
  row: TranscriptRow<T>
  index: number
  displayKind: TranscriptDisplayKind
  group?: GroupPresentation
  turn?: TurnPresentation
  fold?: TranscriptCompositionFold
  foldControl?: FoldGroup<T>
}

type TranscriptLayout<T> = Readonly<{
  rows: readonly RowRecord<T>[]
  controls: readonly FoldGroup<T>[]
}>

type RowHandle<T> = {
  key: string
  get: Accessor<RowRecord<T>>
  set: (next: RowRecord<T>) => void
  last: RowRecord<T>
}

type DisclosureSignal = Readonly<{
  get: Accessor<boolean | undefined>
  set: (next: boolean | undefined) => void
}>

const encodeId = (value: string): string => encodeURIComponent(value)

/** Stable, transcript-scoped key for host-owned disclosure restoration. */
export function transcriptDisclosureKey(
  resetKey: string | number | null | undefined,
  mode: TranscriptFoldMode,
  firstRowId: string
): string {
  return `transcript:${encodeId(String(resetKey ?? ''))}:${mode}:${encodeId(firstRowId)}`
}

function panelId(instanceId: string, resetKey: string, rowId: string): string {
  return `${instanceId}-row-${encodeId(resetKey)}-${encodeId(rowId)}`
}

function buttonId(instanceId: string, resetKey: string, segmentKey: string): string {
  return `${instanceId}-fold-${encodeId(resetKey)}-${encodeId(segmentKey)}`
}

function sameGroup(a?: GroupPresentation, b?: GroupPresentation): boolean {
  return a === b || (!!a && !!b && a.index === b.index && a.size === b.size)
}

function sameTurn(a?: TurnPresentation, b?: TurnPresentation): boolean {
  return (
    a === b || (!!a && !!b && a.id === b.id && a.complete === b.complete && a.interim === b.interim)
  )
}

function sameFold(a?: TranscriptCompositionFold, b?: TranscriptCompositionFold): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.key === b.key &&
      a.mode === b.mode &&
      a.mounting === b.mounting &&
      a.callCount === b.callCount)
  )
}

function sameFoldGroup<T>(a?: FoldGroup<T>, b?: FoldGroup<T>): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.key === b.key &&
      a.callCount === b.callCount &&
      a.rows.length === b.rows.length &&
      a.rows.every((row, index) => row === b.rows[index]))
  )
}

function sameRecord<T>(a: RowRecord<T>, b: RowRecord<T>): boolean {
  return (
    a.row === b.row &&
    a.index === b.index &&
    a.displayKind === b.displayKind &&
    sameGroup(a.group, b.group) &&
    sameTurn(a.turn, b.turn) &&
    sameFold(a.fold, b.fold) &&
    sameFoldGroup(a.foldControl, b.foldControl)
  )
}

function firstRow<T>(item: TranscriptTurnItem<T>): TranscriptRow<T> | undefined {
  return item.kind === 'single' ? item.row : item.rows[0]
}

function appendTurnItem<T>(
  item: TranscriptTurnItem<T>,
  displayKind: 'single' | 'group' | 'turn',
  turn: TurnPresentation | undefined,
  indices: ReadonlyMap<TranscriptRow<T>, number>,
  into: RowRecord<T>[]
): void {
  if (item.kind === 'single') {
    into.push({
      row: item.row,
      index: indices.get(item.row) ?? item.index,
      displayKind,
      turn,
    })
    return
  }
  item.rows.forEach((row, index) => {
    into.push({
      row,
      index: indices.get(row) ?? item.startIndex + index,
      displayKind,
      group: { index, size: item.rows.length },
      turn,
    })
  })
}

function appendDisplayItem<T>(
  item: TranscriptDisplayItem<T>,
  indices: ReadonlyMap<TranscriptRow<T>, number>,
  into: RowRecord<T>[]
): void {
  if (item.kind !== 'turn') {
    appendTurnItem(item, item.kind, undefined, indices, into)
    return
  }
  const turnId = item.items.map(firstRow).find((row) => row)?.id ?? 'empty-turn'
  const turn: TurnPresentation = {
    id: turnId,
    complete: item.complete,
    interim: !!item.interim,
  }
  for (const child of item.items) appendTurnItem(child, 'turn', turn, indices, into)
}

function buildDisclosures<T>(
  records: readonly RowRecord<T>[],
  defaultMode: TranscriptFoldMode,
  foldState: TranscriptFoldState,
  resetKey: string
): FoldGroup<T>[] {
  const controls: FoldGroup<T>[] = []
  let scope: RowRecord<T>[] = []
  const flushScope = () => {
    if (!scope.length) return
    const rows = scope.map((record) => record.row)
    const hasInterimTurn = scope.some((record) => record.turn?.interim)
    const hasConclusion = scope.some((record) => record.row.conclusion)
    const mode: TranscriptFoldMode = hasInterimTurn
      ? 'interim'
      : foldState === 'default'
        ? defaultMode
        : foldState === 'collapsed'
          ? hasConclusion
            ? 'prose'
            : 'tools'
          : 'interim'
    const plan = planTranscriptFold(rows, { mode, settled: true })
    const foldable = plan.entries.flatMap((entry, index) =>
      entry.mounting === 'always' ? [] : [{ record: scope[index]!, mounting: entry.mounting }]
    )
    if (foldable.length) {
      const anchorId = scope[0]?.row.id ?? foldable[0]!.record.row.id
      const control: FoldGroup<T> = {
        key: transcriptDisclosureKey(resetKey, mode, anchorId),
        mode,
        callCount: plan.callCount,
        rows: foldable.map(({ record }) => record.row),
      }
      controls.push(control)
      foldable.forEach(({ record, mounting }, index) => {
        record.fold = {
          key: control.key,
          mode: control.mode,
          mounting: foldState === 'collapsed' ? 'hide-when-collapsed' : mounting,
          callCount: control.callCount,
        }
        if (index === 0) record.foldControl = control
      })
    }
    scope = []
  }

  for (const record of records) {
    if (record.row.opensTurn && scope.length) flushScope()
    scope.push(record)
  }
  flushScope()
  return controls
}

function foldLabel(mode: TranscriptFoldMode, count: number, expanded: boolean): string {
  const subject =
    mode === 'tools'
      ? count === 1
        ? '1 tool call'
        : count > 1
          ? `${count} tool calls`
          : 'tool details'
      : mode === 'prose'
        ? 'earlier activity'
        : 'interim activity'
  return `${expanded ? 'Hide' : 'Show'} ${subject}`
}

function TranscriptRowEntry<T>(props: {
  record: Accessor<RowRecord<T>>
  renderRow: Component<TranscriptCompositionRendererProps<T>>
  prefix: string
  resetKey: Accessor<string>
  expanded: (key: string) => Accessor<boolean>
  running: Accessor<boolean>
  foldState: Accessor<TranscriptFoldState>
  onToggle: (key: string, expanded: boolean) => void
}) {
  const current = props.record
  const id = () => panelId(props.prefix, props.resetKey(), current().row.id)
  const foldControl = () => current().foldControl
  const disclosureKey = () => current().fold?.key
  const expanded = () => {
    const key = disclosureKey()
    return key ? props.expanded(key)() : true
  }
  const collapsed = () => !!current().fold && !expanded()
  const disabled = () => props.running() || props.foldState() !== 'default'
  const context = (): TranscriptCompositionRowContext => ({
    index: current().index,
    displayKind: current().displayKind,
    group: current().group,
    turn: current().turn,
    fold: current().fold,
  })
  const groupIndex = () => current().group?.index
  const groupSize = () => current().group?.size
  const renderable = () => current().fold?.mounting !== 'unmount-when-collapsed' || !collapsed()
  const renderHostRow = () =>
    createComponent(props.renderRow, {
      get row() {
        return current().row
      },
      get context() {
        return context()
      },
    })
  const controlLabel = () => {
    const control = foldControl()
    return control ? foldLabel(control.mode, control.callCount, expanded()) : ''
  }
  const controlRows = () =>
    foldControl()
      ?.rows.map((row) => panelId(props.prefix, props.resetKey(), row.id))
      .join(' ')

  return (
    <div
      data-slot="transcript-row"
      data-display-kind={current().displayKind}
      data-group-index={groupIndex()}
      data-group-size={groupSize()}
      class="flex min-w-0 flex-col gap-1"
    >
      <Show when={foldControl()}>
        {(control) => (
          <Button
            id={buttonId(props.prefix, props.resetKey(), control().key)}
            type="button"
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            aria-label={controlLabel()}
            aria-controls={controlRows()}
            aria-expanded={expanded()}
            aria-disabled={disabled() || undefined}
            onClick={() => props.onToggle(control().key, !expanded())}
          >
            <ChevronDown aria-hidden="true" class="size-4 shrink-0" />
            <span>{controlLabel()}</span>
          </Button>
        )}
      </Show>
      <div
        id={id()}
        data-slot="transcript-row-content"
        class="group-data-[density=comfortable]/transcript:flex group-data-[density=comfortable]/transcript:flex-col"
        hidden={collapsed()}
        aria-hidden={collapsed() || undefined}
      >
        <Show when={renderable() ? current() : undefined}>
          {(record) => {
            record()
            return renderHostRow()
          }}
        </Show>
      </div>
    </div>
  )
}

/**
 * Compose host-classified rows into stable turns, contiguous groups and disclosures.
 * Row render owners are keyed by `id` in a single list, so loose rows keep their DOM
 * owners when the grouping threshold promotes them into a turn. The caller owns row
 * identity, protocol meaning, redaction, permissions and durable conversation state.
 */
export function TranscriptComposition<T>(props: TranscriptCompositionProps<T>) {
  const [local, rest] = splitProps(props, [
    'class',
    'rows',
    'renderRow',
    'running',
    'resetKey',
    'foldMode',
    'foldState',
    'onFoldStateChange',
    'density',
    'disclosure',
    'onDisclosureChange',
  ])
  const instanceId = createUniqueId()
  const grouper = createTranscriptGrouper<T>()
  const [internalFoldState, setInternalFoldState] = createSignal<TranscriptFoldState>('default')
  const rowHandles = new Map<string, RowHandle<T>>()
  const disclosureSignals = new Map<string, DisclosureSignal>()
  let lastResetKey = String(local.resetKey ?? '')

  const resetKey = () => String(local.resetKey ?? '')
  const foldState = () => local.foldState ?? internalFoldState()
  const running = () => !!local.running
  const localDisclosure = (key: string): DisclosureSignal => {
    let signal = disclosureSignals.get(key)
    if (!signal) {
      const [get, set] = createSignal<boolean | undefined>(undefined)
      signal = { get, set }
      disclosureSignals.set(key, signal)
    }
    return signal
  }
  const disclosureExpanded = (key: string): Accessor<boolean> => {
    const signal = localDisclosure(key)
    return () => {
      if (running()) return true
      if (foldState() === 'collapsed') return false
      if (foldState() === 'expanded') return true
      return local.disclosure?.get(key) ?? signal.get() ?? false
    }
  }
  const grouped = createMemo(() => grouper(local.rows))
  const layout = createMemo<TranscriptLayout<T>>(() => {
    const identity = resetKey()
    if (identity !== lastResetKey) {
      rowHandles.clear()
      disclosureSignals.clear()
      lastResetKey = identity
    }
    const indexByRow = new Map(local.rows.map((row, index) => [row, index]))
    const display = applyTranscriptRunningState(grouped(), running())
    const records: RowRecord<T>[] = []
    display.forEach((item) => appendDisplayItem(item, indexByRow, records))
    const controls = buildDisclosures(records, local.foldMode ?? 'tools', foldState(), identity)
    return { rows: records, controls }
  })
  const handles = createMemo(() => {
    const live = new Set<string>()
    const identity = resetKey()
    const result = layout().rows.map((record) => {
      const key = `${identity}\u001f${record.row.id}`
      live.add(key)
      let handle = rowHandles.get(key)
      if (!handle) {
        const [get, set] = createSignal(record)
        handle = { key, get, set, last: record }
        rowHandles.set(key, handle)
      } else if (!sameRecord(handle.last, record)) {
        handle.last = record
        handle.set(record)
      }
      return handle
    })
    for (const key of rowHandles.keys()) if (!live.has(key)) rowHandles.delete(key)
    return result
  })
  const allControlIds = () =>
    layout()
      .controls.flatMap((control) =>
        control.rows.map((row) => panelId(instanceId, resetKey(), row.id))
      )
      .join(' ')
  const updateFoldState = () => {
    if (running()) return
    const current = foldState()
    const next: TranscriptFoldState =
      current === 'default' ? 'collapsed' : current === 'collapsed' ? 'expanded' : 'default'
    if (local.foldState === undefined) setInternalFoldState(next)
    local.onFoldStateChange?.(next)
  }
  const updateDisclosure = (key: string, expanded: boolean) => {
    if (running() || foldState() !== 'default') return
    if (local.disclosure) {
      local.onDisclosureChange?.(key, expanded)
      return
    }
    localDisclosure(key).set(expanded)
    local.onDisclosureChange?.(key, expanded)
  }

  return (
    <div
      data-slot="transcript-composition"
      data-fold-state={foldState()}
      data-density={local.density ?? 'compact'}
      class={cn('group/transcript flex w-full min-w-0 flex-col gap-1', local.class)}
      {...rest}
    >
      <Show when={local.onFoldStateChange}>
        <div class="flex justify-end">
          <Button
            id={`${instanceId}-fold-all`}
            type="button"
            variant="ghost"
            size="sm"
            aria-controls={allControlIds() || undefined}
            aria-disabled={running() || undefined}
            onClick={updateFoldState}
          >
            {foldState() === 'default'
              ? 'Collapse all activity'
              : foldState() === 'collapsed'
                ? 'Expand all activity'
                : 'Restore default folding'}
          </Button>
        </div>
      </Show>
      <div
        data-slot="transcript-rows"
        class={cn('flex min-w-0 flex-col', local.density === 'comfortable' ? 'gap-3' : 'gap-1')}
      >
        <For each={handles()}>
          {(handle) => (
            <TranscriptRowEntry
              record={handle.get}
              renderRow={local.renderRow}
              prefix={instanceId}
              resetKey={resetKey}
              expanded={disclosureExpanded}
              running={running}
              foldState={foldState}
              onToggle={updateDisclosure}
            />
          )}
        </For>
      </div>
    </div>
  )
}
