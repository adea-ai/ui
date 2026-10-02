import type { JSX } from 'solid-js'

/** A host-owned catalog record reduced to the fields needed by the browser. */
export type CatalogBrowserEntry<Value> = Readonly<{
  id: string
  value: Value
  name: string
  description: string
  category: string
  publisher: string
  installed: boolean
}>

/** One stable, host-ordered category in the browser. */
export type CatalogBrowserGroup<Value> = Readonly<{
  id: string
  label: string
  entries: readonly CatalogBrowserEntry<Value>[]
}>

export type CatalogBrowserTab = Readonly<{
  id: string
  label: string
  /** A host-rendered view, such as navigation settings, outside the catalog. */
  kind?: 'catalog' | 'supplemental'
}>

export type CatalogBrowserNotice = Readonly<{
  id: string
  role: 'alert' | 'status'
  message: string
}>

export type CatalogBrowserMessage = Readonly<{
  title: string
  description: string
  role?: 'alert' | 'status'
}>

export type CatalogBrowserProps<Value> = Readonly<{
  /** Optional layout hook for the host's containing surface. */
  class?: string
  /** Whether the containing host surface is open; closing it clears view-only state. */
  open: boolean
  tabs: readonly CatalogBrowserTab[]
  tab: string
  tabsLabel: string
  onTabChange: (tab: string) => void
  /** A host-owned view is rendered in the same tab frame without catalog assumptions. */
  renderSupplementalView?: (tab: string) => JSX.Element | undefined
  query: string
  onQueryChange: (query: string) => void
  searchLabel: string
  searchPlaceholder: string
  resultsRegionLabel: string
  filterControl?: JSX.Element
  resultCount: number
  resultLabel: (count: number) => string
  loadingLabel: string
  status: 'loading' | 'ready' | 'error'
  catalogError: CatalogBrowserMessage
  catalogErrorAction?: JSX.Element
  installError?: string
  notices?: readonly CatalogBrowserNotice[]
  emptyState: CatalogBrowserMessage
  emptyStateAction?: JSX.Element
  groups: readonly CatalogBrowserGroup<Value>[]
  /** All selectable records, including records omitted by the current filter. */
  entries: readonly CatalogBrowserEntry<Value>[]
  selectedId: string | null
  onSelect: (value: Value) => void
  onBack: () => void
  backLabel: string
  detailRegionLabel: string
  installedLabel: string
  /** Optional legacy label: rows now show the bare publisher as an accent chip. */
  publishedByLabel?: (publisher: string) => string
  showMoreLabel: (entries: readonly CatalogBrowserEntry<Value>[], remainingCount: number) => string
  showLessLabel: string
  /** Temporarily disables catalog controls while a host menu owns interaction. */
  interactionDisabled?: boolean
  renderIcon: (value: Value) => JSX.Element
  renderDetail: (value: Value) => JSX.Element
}>
