import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js'
import { ArrowLeft, Blocks, Search } from 'lucide-solid'
import { keyedRows } from '#lib/keyed-rows'
import { Button } from '../../ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '../../ui/input-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { ScrollArea } from '../../ui/scroll-area'
import { cn } from '#lib/utils'
import { CatalogBrowserGroup, CatalogLoadingState } from './catalog-browser-group'
import type { CatalogBrowserProps } from './catalog-types'

export function CatalogBrowser<Value>(props: CatalogBrowserProps<Value>) {
  const [expandedGroups, setExpandedGroups] = createSignal<ReadonlySet<string>>(new Set())
  const [returnKey, setReturnKey] = createSignal<string>()
  const [lastSelectedId, setLastSelectedId] = createSignal<string>()
  const rowRefs = new Map<string, HTMLButtonElement>()
  let searchInput: HTMLInputElement | undefined
  let backButton: HTMLButtonElement | undefined

  const selectedTab = createMemo(() => props.tabs.find((tab) => tab.id === props.tab))
  const supplemental = () => selectedTab()?.kind === 'supplemental'
  const selected = createMemo(() => {
    const id = props.selectedId
    return id && !supplemental() ? props.entries.find((entry) => entry.id === id) : undefined
  })
  const groupRows = keyedRows(
    () => props.groups,
    (group) => group.id
  )
  const [wide, setWide] = createSignal(
    typeof window === 'undefined' || window.matchMedia('(min-width: 48rem)').matches
  )
  const updateWide = (event: MediaQueryListEvent) => setWide(event.matches)

  createEffect(() => {
    if (typeof window === 'undefined') return
    const query = window.matchMedia('(min-width: 48rem)')
    query.addEventListener('change', updateWide)
    onCleanup(() => query.removeEventListener('change', updateWide))
  })

  createEffect(() => {
    const open = props.open
    const selectedId = props.selectedId
    const selectedEntry = selected()
    if (!open) {
      setExpandedGroups(new Set<string>())
      setLastSelectedId(undefined)
      setReturnKey(undefined)
      return
    }
    if (selectedId && selectedEntry) {
      const previous = lastSelectedId()
      setLastSelectedId(selectedId)
      if (selectedId !== previous) {
        window.requestAnimationFrame(() => {
          if (props.open && props.selectedId === selectedId) backButton?.focus()
        })
      }
      return
    }
    const previous = lastSelectedId()
    if (!previous) return
    const key = returnKey()
    setLastSelectedId(undefined)
    setReturnKey(undefined)
    window.requestAnimationFrame(() => {
      if (!props.open || props.selectedId) return
      const row = key ? rowRefs.get(key) : undefined
      if (row?.isConnected) row.focus()
      else searchInput?.focus()
    })
  })

  const registerRow = (key: string, element: HTMLButtonElement | undefined) => {
    if (element) rowRefs.set(key, element)
    else rowRefs.delete(key)
  }
  const selectEntry = (key: string, value: Value) => {
    setReturnKey(key)
    props.onSelect(value)
  }
  const toggleGroup = (id: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const previewCount = () => (wide() ? 6 : 3)
  const countLabel = () =>
    props.status === 'loading' ? props.loadingLabel : props.resultLabel(props.resultCount)
  const supplementalContent = () => props.renderSupplementalView?.(props.tab)

  return (
    <div class={cn('flex min-h-0 min-w-0 flex-1 flex-col', props.class)}>
      <Show
        when={selected()}
        fallback={
          <Tabs
            class="flex min-h-0 min-w-0 flex-1 flex-col gap-0"
            value={props.tab}
            onChange={(value) => value && props.onTabChange(value)}
          >
            <TabsList aria-label={props.tabsLabel} class="ms-auto max-w-full flex-wrap px-4 pt-2">
              <For each={props.tabs}>
                {(tab) => <TabsTrigger value={tab.id}>{tab.label}</TabsTrigger>}
              </For>
            </TabsList>
            <TabsContent value={props.tab} class="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
              <Show
                when={supplemental()}
                fallback={
                  <>
                    <Show when={props.installError}>
                      {(message) => (
                        <p class="text-destructive px-4 pt-2 text-sm" role="alert">
                          {message()}
                        </p>
                      )}
                    </Show>
                    <div class="flex min-w-0 shrink-0 flex-wrap items-center gap-2 px-4 pt-2">
                      {props.filterControl}
                      <InputGroup class="min-w-0 flex-1 sm:max-w-md">
                        <InputGroupAddon>
                          <Search aria-hidden="true" />
                        </InputGroupAddon>
                        <InputGroupInput
                          ref={(element) => (searchInput = element)}
                          type="search"
                          aria-label={props.searchLabel}
                          placeholder={props.searchPlaceholder}
                          value={props.query}
                          onInput={(event) => props.onQueryChange(event.currentTarget.value)}
                        />
                      </InputGroup>
                      <span class="text-muted-foreground ms-auto text-sm" role="status">
                        {countLabel()}
                      </span>
                    </div>
                    <ScrollArea
                      role="region"
                      aria-label={props.resultsRegionLabel}
                      orientation="vertical"
                      class="flex min-h-0 min-w-0 flex-1 flex-col gap-5 px-4 pb-4"
                    >
                      <Show when={props.status === 'error'}>
                        <Empty
                          class="min-h-0 min-w-0 flex-1"
                          role={props.catalogError.role ?? 'alert'}
                        >
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Blocks aria-hidden="true" />
                            </EmptyMedia>
                            <EmptyTitle>{props.catalogError.title}</EmptyTitle>
                            <EmptyDescription>{props.catalogError.description}</EmptyDescription>
                          </EmptyHeader>
                          <Show when={props.catalogErrorAction}>
                            <EmptyContent>{props.catalogErrorAction}</EmptyContent>
                          </Show>
                        </Empty>
                      </Show>
                      <Show when={props.status === 'loading'}>
                        <CatalogLoadingState label={props.loadingLabel} />
                      </Show>
                      <Show when={props.status === 'ready'}>
                        <Show
                          when={props.resultCount > 0}
                          fallback={
                            <Empty class="min-h-0 min-w-0 flex-1" role="status">
                              <EmptyHeader>
                                <EmptyMedia variant="icon">
                                  <Blocks aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>{props.emptyState.title}</EmptyTitle>
                                <EmptyDescription>{props.emptyState.description}</EmptyDescription>
                              </EmptyHeader>
                              <Show when={props.emptyStateAction}>
                                <EmptyContent>{props.emptyStateAction}</EmptyContent>
                              </Show>
                            </Empty>
                          }
                        >
                          <div class="grid min-w-0 gap-5">
                            <For each={groupRows()}>
                              {(row) => (
                                <CatalogBrowserGroup
                                  group={row.item()}
                                  expanded={expandedGroups().has(row.item().id)}
                                  previewCount={previewCount()}
                                  disabled={props.interactionDisabled ?? false}
                                  installedLabel={props.installedLabel}
                                  publishedByLabel={props.publishedByLabel}
                                  showMoreLabel={props.showMoreLabel}
                                  showLessLabel={props.showLessLabel}
                                  renderIcon={props.renderIcon}
                                  onSelect={(entry, key) => selectEntry(key, entry.value)}
                                  onRef={registerRow}
                                  onToggle={toggleGroup}
                                />
                              )}
                            </For>
                          </div>
                        </Show>
                      </Show>
                      <For each={props.notices ?? []}>
                        {(notice) => (
                          <p class="text-muted-foreground text-sm" role={notice.role}>
                            {notice.message}
                          </p>
                        )}
                      </For>
                    </ScrollArea>
                  </>
                }
              >
                {supplementalContent()}
              </Show>
            </TabsContent>
          </Tabs>
        }
      >
        {(entry) => (
          <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-3" data-catalog-browser-detail>
            <Button
              ref={(element) => (backButton = element)}
              variant="ghost"
              size="sm"
              onClick={() => props.onBack()}
              class="mx-4 mt-2 self-start"
            >
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              {props.backLabel}
            </Button>
            <ScrollArea
              role="region"
              aria-label={props.detailRegionLabel}
              orientation="vertical"
              class="min-h-0 min-w-0 flex-1 px-4 pb-4"
            >
              {props.renderDetail(entry().value)}
            </ScrollArea>
          </div>
        )}
      </Show>
    </div>
  )
}
