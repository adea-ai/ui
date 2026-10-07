import { useTabsContext } from '@kobalte/core/tabs'
import type { JSX } from 'solid-js'
import { createEffect, createUniqueId, onCleanup, Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'
import { sidebarNavItemClass, sidebarNavItemStateClass } from '../../layout/sidebar-nav/sidebar-nav'
import { TabsList, TabsTrigger, type TabsListProps } from '../../ui/tabs'
import { Text } from '../../ui/typography'

/** One host-owned destination in a settings tab list. Values must be unique. */
export type SettingsNavigationItem = {
  value: string
  label: string
  icon?: JSX.Element
  disabled?: boolean
}

/** A visible, accessibly named group of settings destinations. */
export type SettingsNavigationGroup = {
  label: string
  items: readonly SettingsNavigationItem[]
}

export type SettingsNavigationProps = Omit<
  TabsListProps,
  'appearance' | 'children' | 'orientation'
> & {
  /** Groups are presentation only; the host owns the tab values and panels. */
  groups: readonly SettingsNavigationGroup[]
  /** The same controlled value supplied to the enclosing `Tabs`. */
  value: string
  /** Called when the already-selected destination is activated again. */
  onReselect?: (value: string) => void
  /** Reveal the selected row on value changes and window resizes. Defaults to nearest scrolling
   * of the ancestors that expose a scroll affordance; hidden-overflow ancestors never move. */
  revealSelected?:
    | boolean
    | ((
        trigger: HTMLButtonElement | undefined
      ) => void) /** Every tab list needs a label independent of its visible group headings. */
  'aria-label': string
}

/**
 * SettingsNavigation.
 *
 * A grouped vertical tab list for sibling settings panels. It composes the
 * shared Tabs behaviour with the shared sidebar row recipe; the host supplies
 * the controlled value, panel content, icons and any persistence or routing.
 * Use ordinary tabs for a short, ungrouped row of view choices.
 *
 * The shape follows the enclosing `Tabs` orientation rather than a prop of its
 * own, so the visual axis can never disagree with the arrow keys Kobalte
 * binds: `vertical` is the grouped rail, `horizontal` is a single scrollable
 * strip of tabs (what `SettingsLayout` shows below 48rem). The strip keeps the
 * groups in order, separated by a rule; their visible headings drop out, since
 * an overline between tabs reads as another tab, but each tab still carries its
 * group as its accessible description.
 *
 * Kobalte owns roving focus, arrow keys, selection and tab/panel ARIA. This
 * component adds no URL, storage or host-specific state. Set
 * `revealSelected={false}` when the surrounding layout does not use an internal
 * scrolling viewport.
 */
/**
 * Reveal by scrolling only the ancestors that expose a scroll affordance
 * (`auto` or `scroll`), by the exact nearest-edge delta. `scrollIntoView` also
 * pans `overflow: hidden` ancestors, which are programmatically scrollable but
 * give the user no way back, so one over-pan left earlier rows permanently
 * clipped outside the viewport with no scroll to recover them (#182).
 */
function scrollContainerNearest(container: HTMLElement, row: HTMLElement): void {
  const style = window.getComputedStyle(container)
  const box = container.getBoundingClientRect()
  const rowBox = row.getBoundingClientRect()
  if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
    if (rowBox.left < box.left) container.scrollLeft += rowBox.left - box.left
    else if (rowBox.right > box.right) container.scrollLeft += rowBox.right - box.right
  }
  if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
    if (rowBox.top < box.top) container.scrollTop += rowBox.top - box.top
    else if (rowBox.bottom > box.bottom) container.scrollTop += rowBox.bottom - box.bottom
  }
}

function revealNearest(row: HTMLElement): void {
  for (let container = row.parentElement; container; container = container.parentElement) {
    scrollContainerNearest(container, row)
  }
}

export function SettingsNavigation(props: SettingsNavigationProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'aria-label',
    'groups',
    'value',
    'onReselect',
    'revealSelected',
  ])
  const tabs = useTabsContext()
  const strip = () => tabs.orientation() === 'horizontal'
  const triggers = new Map<string, HTMLButtonElement>()
  const groupIdPrefix = `settings-navigation-${createUniqueId()}`

  createEffect(() => {
    const value = local.value
    const reveal = local.revealSelected
    // Tracked so a rail that becomes a strip (or back) re-reveals on the new axis.
    strip()
    if (reveal === false) return

    const revealCurrent = () => {
      const trigger = triggers.get(value)
      if (typeof reveal === 'function') reveal(trigger)
      else if (trigger) revealNearest(trigger)
    }

    revealCurrent()
    window.addEventListener('resize', revealCurrent)
    onCleanup(() => window.removeEventListener('resize', revealCurrent))
  })

  return (
    <TabsList
      data-slot="settings-navigation"
      aria-label={local['aria-label']}
      orientation={tabs.orientation()}
      class={cn(
        // Positioned so the visually hidden group names are laid out (and
        // clipped) inside the list: unpositioned, their absolute boxes escape a
        // scrolled strip and widen the page by however far it has scrolled.
        'relative flex min-w-0 shrink-0 justify-start',
        strip()
          ? // The block padding is the room the focus ring needs: a scroller
            // clips at its padding edge, and this one scrolls sideways only.
            'scroll-fade w-full flex-row items-center gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-2 py-1.5'
          : 'max-h-full min-h-0 flex-col items-stretch gap-2 overflow-x-hidden overflow-y-auto px-2 py-2',
        local.class
      )}
      {...rest}
    >
      {local.groups.map((group, groupIndex) => {
        const groupId = `${groupIdPrefix}-group-${groupIndex}`
        return (
          <div
            role="none"
            data-slot="settings-navigation-group"
            class={cn(
              'flex gap-0.5',
              strip()
                ? 'shrink-0 flex-row items-center not-first:ms-1 not-first:border-s not-first:border-border not-first:ps-2'
                : 'min-w-0 flex-col'
            )}
          >
            <span id={groupId} class="sr-only">
              {group.label}
            </span>
            <Show when={!strip()}>
              {/* The overline role on the sidebar's own muted foreground. */}
              <Text
                variant="overline"
                tone="inherit"
                aria-hidden="true"
                class="px-2 py-1.5 text-sidebar-muted-foreground"
              >
                {group.label}
              </Text>
            </Show>
            {group.items.map((item) => (
              <TabsTrigger
                data-slot="settings-navigation-trigger"
                aria-describedby={groupId}
                value={item.value}
                disabled={item.disabled}
                ref={(element: HTMLButtonElement | undefined) => {
                  if (element) triggers.set(item.value, element)
                  else triggers.delete(item.value)
                }}
                onClick={() => {
                  if (local.value === item.value) local.onReselect?.(item.value)
                }}
                class={cn(
                  sidebarNavItemClass,
                  sidebarNavItemStateClass.idle,
                  'h-row-lg justify-start border-0 px-3 py-2 text-left data-[selected]:bg-primary-subtle data-[selected]:text-foreground',
                  strip() ? 'w-auto shrink-0' : 'w-full'
                )}
              >
                {item.icon}
                <span class={cn('min-w-0', { truncate: !strip() })}>{item.label}</span>
              </TabsTrigger>
            ))}
          </div>
        )
      })}
    </TabsList>
  )
}
