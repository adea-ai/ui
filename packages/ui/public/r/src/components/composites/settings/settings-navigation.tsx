import type { JSX } from 'solid-js'
import { createEffect, createUniqueId, onCleanup, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'
import { sidebarNavItemClass, sidebarNavItemStateClass } from '../../layout/sidebar-nav/sidebar-nav'
import { TabsList, TabsTrigger, type TabsListProps } from '../../ui/tabs'

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
  /** Reveal the selected row on value changes and window resizes. Defaults to nearest scroll. */
  revealSelected?: boolean | ((trigger: HTMLButtonElement | undefined) => void)
  /** Every tab list needs a label independent of its visible group headings. */
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
 * Kobalte owns roving focus, arrow keys, selection and tab/panel ARIA. This
 * component adds no URL, storage or host-specific state. Set
 * `revealSelected={false}` when the surrounding layout does not use an internal
 * scrolling viewport.
 */
export function SettingsNavigation(props: SettingsNavigationProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'aria-label',
    'groups',
    'value',
    'onReselect',
    'revealSelected',
  ])
  const triggers = new Map<string, HTMLButtonElement>()
  const groupIdPrefix = `settings-navigation-${createUniqueId()}`

  createEffect(() => {
    const value = local.value
    const reveal = local.revealSelected
    if (reveal === false) return

    const revealCurrent = () => {
      const trigger = triggers.get(value)
      if (typeof reveal === 'function') reveal(trigger)
      else trigger?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }

    revealCurrent()
    window.addEventListener('resize', revealCurrent)
    onCleanup(() => window.removeEventListener('resize', revealCurrent))
  })

  return (
    <TabsList
      data-slot="settings-navigation"
      aria-label={local['aria-label']}
      orientation="vertical"
      class={cn(
        'flex max-h-full min-h-0 min-w-0 shrink-0 flex-col items-stretch justify-start gap-2 overflow-x-hidden overflow-y-auto px-2 py-2',
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
            class="flex min-w-0 flex-col gap-0.5"
          >
            <span id={groupId} class="sr-only">
              {group.label}
            </span>
            <span
              aria-hidden="true"
              class="px-2 py-1.5 text-2xs font-medium tracking-wide text-sidebar-muted-foreground uppercase"
            >
              {group.label}
            </span>
            {group.items.map((item) => (
              <TabsTrigger
                data-slot="settings-navigation-trigger"
                orientation="vertical"
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
                  'h-row-lg w-full justify-start border-0 px-3 py-2 text-left data-[selected]:bg-primary-subtle data-[selected]:text-foreground'
                )}
              >
                {item.icon}
                <span class="min-w-0 truncate">{item.label}</span>
              </TabsTrigger>
            ))}
          </div>
        )
      })}
    </TabsList>
  )
}
