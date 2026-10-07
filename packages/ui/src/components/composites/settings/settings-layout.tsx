import type { ComponentProps, JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Tabs } from '../../ui/tabs'
import { SettingsNavigation, type SettingsNavigationGroup } from './settings-navigation'

export type SettingsLayoutProps = Omit<
  ComponentProps<typeof Tabs>,
  'children' | 'orientation' | 'value' | 'defaultValue' | 'onChange'
> & {
  /** Grouped navigation entries; the host owns their values and panel content. */
  groups: readonly SettingsNavigationGroup[]
  /** Accessible name for the tab list. */
  'aria-label': string
  /** The host-controlled selected destination. */
  value: string
  /** Updates the host-controlled selected destination. */
  onChange: (value: string) => void
  /** Called when the already-selected destination is activated again. */
  onReselect?: (value: string) => void
  /** Reveal the selected row on value changes and window resizes. Defaults to nearest scroll. */
  revealSelected?: boolean | ((trigger: HTMLButtonElement | undefined) => void)
  /**
   * How the section navigation sits beside the panels. `auto` (the default) is
   * the vertical rail from 48rem of viewport width up and a horizontal,
   * scrollable strip of tabs above the panels below it. `rail` and `strip` pin
   * one shape at every width.
   */
  navigationLayout?: SettingsNavigationLayout
  /** Panels must be rendered as `TabsContent` descendants. */
  children?: JSX.Element
}

export type SettingsNavigationLayout = 'auto' | 'rail' | 'strip'

/** The `md` breakpoint the rail has always widened at; below it the rail becomes a strip. */
const RAIL_MEDIA_QUERY = '(min-width: 48rem)'

function railQuery(): MediaQueryList | undefined {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? undefined
    : window.matchMedia(RAIL_MEDIA_QUERY)
}

/**
 * SettingsLayout.
 *
 * A controlled, vertical settings rail beside its scrollable panel viewport.
 * The host keeps ownership of selection, URL/hash state and panel content.
 *
 * Below 48rem the rail becomes a horizontal strip of tabs above the panels.
 * A 6rem rail at phone width clips every label, so this is the default rather
 * than an opt-in. It changes the tab root's orientation, not just its
 * styling: the list's `aria-orientation` and Kobalte's arrow keys (Up/Down on
 * the rail, Left/Right on the strip) follow the axis the reader sees. The
 * breakpoint is the viewport's, like CatalogBrowser's and ContextualSidebar's,
 * and is read before the first render so a phone never paints the rail. A
 * server render, which has no viewport, renders the rail.
 */
export function SettingsLayout(props: SettingsLayoutProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'children',
    'groups',
    'aria-label',
    'value',
    'onReselect',
    'revealSelected',
    'navigationLayout',
  ])

  const [wide, setWide] = createSignal(railQuery()?.matches ?? true)
  onMount(() => {
    const query = railQuery()
    if (!query) return
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    onCleanup(() => query.removeEventListener('change', update))
  })
  const layout = (): 'rail' | 'strip' => {
    const requested = local.navigationLayout ?? 'auto'
    if (requested !== 'auto') return requested
    return wide() ? 'rail' : 'strip'
  }

  return (
    <Tabs
      {...rest}
      orientation={layout() === 'rail' ? 'vertical' : 'horizontal'}
      data-navigation-layout={layout()}
      value={local.value}
      class={cn('min-h-0 min-w-0 flex-1 gap-0', local.class)}
    >
      <SettingsNavigation
        aria-label={local['aria-label']}
        groups={local.groups}
        value={local.value}
        onReselect={local.onReselect}
        revealSelected={local.revealSelected}
        class={layout() === 'rail' ? 'w-24 md:w-sidebar' : undefined}
      />
      <div data-slot="settings-layout-panels" class="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        {local.children}
      </div>
    </Tabs>
  )
}
