import { createUniqueId, For, onCleanup, Show, type JSX } from 'solid-js'
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-solid'
import { keyedRows } from '#lib/keyed-rows'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Skeleton } from '../../ui/skeleton'
import type { CatalogBrowserEntry, CatalogBrowserGroup as CatalogGroup } from './catalog-types'

export function CatalogLoadingState(props: { label: string }) {
  return (
    <div
      class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2"
      aria-busy="true"
      aria-label={props.label}
    >
      <For each={[0, 1, 2, 3, 4, 5, 6]}>
        {() => (
          <div class="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3">
            <Skeleton class="size-9 shrink-0" />
            <div class="grid min-w-0 flex-1 gap-2">
              <Skeleton class="h-4 w-2/5" />
              <Skeleton class="h-3 w-4/5" />
              <Skeleton class="h-3 w-3/5" />
            </div>
          </div>
        )}
      </For>
    </div>
  )
}

function CatalogBrowserRow<Value>(props: {
  entry: CatalogBrowserEntry<Value>
  groupId: string
  installedLabel: string
  disabled: boolean
  renderIcon: (value: Value) => JSX.Element
  onSelect: (entry: CatalogBrowserEntry<Value>, key: string) => void
  onRef: (key: string, element: HTMLButtonElement | undefined) => void
}) {
  const key = JSON.stringify([props.groupId, props.entry.id])
  let element: HTMLButtonElement | undefined
  onCleanup(() => {
    if (element) props.onRef(key, undefined)
  })

  return (
    <Button
      ref={(node) => {
        element = node
        props.onRef(key, node)
      }}
      data-catalog-entry-id={props.entry.id}
      variant="outline"
      size="lg"
      // `h-auto!` must stay important: the size token's fixed `h-control-lg`
      // is a custom class tailwind-merge cannot conflict-resolve, so an
      // unimportant `h-auto` loses the stylesheet sort and clamps this
      // multi-line row to one control line, spilling its content over the
      // neighbouring rows.
      class="h-auto! min-h-row-lg w-full min-w-0 justify-start gap-3 py-2.5 whitespace-normal"
      disabled={props.disabled}
      onClick={() => props.onSelect(props.entry, key)}
    >
      <span class="shrink-0">{props.renderIcon(props.entry.value)}</span>
      <span class="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span class="flex min-w-0 flex-wrap items-center gap-2">
          <strong class="min-w-0 truncate">{props.entry.name}</strong>
          <Show when={props.entry.installed}>
            <Badge variant="secondary">{props.installedLabel}</Badge>
          </Show>
        </span>
        {/* Exactly one content line: the description truncates and the
            publisher and category ride the same line as accent chips. */}
        <span class="flex min-w-0 items-center gap-1.5 text-xs">
          <span class="text-muted-foreground min-w-0 truncate">{props.entry.description}</span>
          <span class="ms-auto flex shrink-0 items-center gap-1">
            <span class="rounded bg-primary-subtle px-1.5 py-0.5 text-2xs font-medium text-primary">
              {props.entry.publisher}
            </span>
            <span class="rounded bg-primary-subtle px-1.5 py-0.5 text-2xs font-medium text-primary">
              {props.entry.category}
            </span>
          </span>
        </span>
      </span>
      <ChevronRight aria-hidden="true" />
    </Button>
  )
}

export function CatalogBrowserGroup<Value>(props: {
  group: CatalogGroup<Value>
  expanded: boolean
  previewCount: number
  disabled: boolean
  installedLabel: string
  showMoreLabel: (entries: readonly CatalogBrowserEntry<Value>[], remainingCount: number) => string
  showLessLabel: string
  renderIcon: (value: Value) => JSX.Element
  onSelect: (entry: CatalogBrowserEntry<Value>, key: string) => void
  onRef: (key: string, element: HTMLButtonElement | undefined) => void
  onToggle: (id: string) => void
}) {
  const headingId = `catalog-browser-group-${createUniqueId()}`
  const listId = `catalog-browser-items-${createUniqueId()}`
  const hidden = () => props.group.entries.slice(props.previewCount)
  const preview = () =>
    props.expanded ? props.group.entries : props.group.entries.slice(0, props.previewCount)
  const rows = keyedRows(preview, (entry) => entry.id)

  return (
    <section class="grid min-w-0 gap-2" aria-labelledby={headingId}>
      <header class="flex min-w-0 items-center gap-2">
        <h3 id={headingId} class="min-w-0 flex-1 truncate text-sm font-semibold">
          {props.group.label}
        </h3>
        <Badge
          variant="outline"
          class="border-primary/25 bg-primary-subtle tabular-nums text-primary"
        >
          {props.group.entries.length}
        </Badge>
      </header>
      <div id={listId} class="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
        <For each={rows()}>
          {(row) => (
            <CatalogBrowserRow
              entry={row.item()}
              groupId={props.group.id}
              installedLabel={props.installedLabel}
              disabled={props.disabled}
              renderIcon={props.renderIcon}
              onSelect={props.onSelect}
              onRef={props.onRef}
            />
          )}
        </For>
      </div>
      <Show when={hidden().length > 0}>
        <Button
          variant="ghost"
          size="lg"
          disabled={props.disabled}
          aria-expanded={props.expanded}
          aria-controls={listId}
          onClick={() => props.onToggle(props.group.id)}
        >
          <Show
            when={props.expanded}
            fallback={
              <>
                {props.showMoreLabel(hidden(), hidden().length)}{' '}
                <ChevronDown data-icon="inline-end" aria-hidden="true" />
              </>
            }
          >
            {props.showLessLabel} <ChevronUp data-icon="inline-end" aria-hidden="true" />
          </Show>
        </Button>
      </Show>
    </section>
  )
}
