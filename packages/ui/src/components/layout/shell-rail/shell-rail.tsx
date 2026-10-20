import { Search } from 'lucide-solid'
import type { ComponentProps, JSX } from 'solid-js'
import { children, For, Show, splitProps } from 'solid-js'
import { cn } from '#lib/utils'
import { Kbd, KbdGroup } from '../../ui/kbd'
import { Separator } from '../../ui/separator'
import {
  SideRail,
  SideRailContent,
  SideRailFooter,
  SideRailHeader,
  SideRailItem,
} from '../side-rail'

/**
 * ShellRail.
 *
 * The side rail both applications put at the window's leading edge: always the
 * collapsed icon column, with the app's mark at the top, a search entry point
 * under it, the app's destinations in the middle and a footer for account and
 * settings.
 *
 * The rail is never the thing the sidebar toggle collapses. The toggle belongs
 * to the sidebar beside the rail, which is why this component takes no
 * `collapsed` prop: a rail that could be expanded would be a second sidebar,
 * and the two apps would drift on which of them the toggle meant.
 *
 * Destinations are the caller's: pass `SideRailItem`s (or a `SideRailSection`)
 * as children. The mark, the search row and the footer are slots with the
 * geometry decided here, so the rail's rhythm cannot differ between apps.
 */
export type ShellRailProps = Omit<ComponentProps<'nav'>, 'children'> & {
  /** The app's mark. Decorative: the rail names itself through `aria-label`. */
  mark: JSX.Element
  /** Opens search. Omit to leave the search row out. */
  onSearch?: () => void
  /** The search row's accessible name. */
  searchLabel?: string
  /** The chord as it is announced, e.g. `Meta+K Control+K`. */
  searchKeyshortcuts?: string
  /** The cap labels drawn under the icon, in press order, e.g. `['⌘', 'K']`. */
  searchKeys?: readonly string[]
  /** Destinations between the search row and the footer. */
  children?: JSX.Element
  /** Account, plugins, settings. Pinned to the rail's foot. */
  footer?: JSX.Element
}

export function ShellRail(props: ShellRailProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'mark',
    'onSearch',
    'searchLabel',
    'searchKeyshortcuts',
    'searchKeys',
    'children',
    'footer',
    'aria-label',
  ])

  // Resolve the footer once: reading a JSX prop twice builds two copies.
  const footer = children(() => local.footer)
  const content = children(() => local.children)

  return (
    <SideRail
      collapsed
      data-slot="shell-rail"
      aria-label={local['aria-label'] ?? 'Global navigation'}
      class={cn('relative z-(--z-sticky) min-w-0', local.class)}
      {...rest}
    >
      <SideRailHeader data-slot="shell-rail-header" class="h-auto justify-center px-0 pt-1">
        <span
          data-slot="shell-rail-mark"
          aria-hidden="true"
          class="flex h-rail-item items-center justify-center"
        >
          {local.mark}
        </span>
      </SideRailHeader>

      <SideRailContent data-slot="shell-rail-content" class="pt-0.5">
        <Show when={local.onSearch}>
          <div data-slot="shell-rail-search" class="flex min-w-0 flex-col gap-0.5">
            <SideRailItem
              as="button"
              type="button"
              label={local.searchLabel ?? 'Search'}
              aria-label={local.searchLabel ?? 'Search'}
              keyshortcuts={local.searchKeyshortcuts}
              shortcut={local.searchKeys?.join('')}
              onClick={() => local.onSearch?.()}
            >
              <Search aria-hidden="true" />
            </SideRailItem>
            {/* The chord is drawn as key caps under the icon: the one row that
                advertises a shortcut. The accessible chord stays on the row. */}
            <Show when={local.searchKeys?.length}>
              <KbdGroup
                size="compact"
                class="justify-center pb-1"
                data-slot="shell-rail-search-keys"
              >
                <For each={local.searchKeys}>{(key) => <Kbd size="compact">{key}</Kbd>}</For>
              </KbdGroup>
            </Show>
          </div>
          <Separator class="my-1" />
        </Show>
        {content()}
      </SideRailContent>

      <Show when={footer()}>
        <SideRailFooter data-slot="shell-rail-footer">{footer()}</SideRailFooter>
      </Show>
    </SideRail>
  )
}
