import { NavigationMenu as KobalteNavigationMenu } from '@kobalte/core/navigation-menu'
import { ChevronDown } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { menuContentPadding, menuItem, overlaySurface } from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * NavigationMenu.
 *
 * A site-wide or product-wide navigation bar whose items open panels. The
 * distinguishing behaviour is that the panels **share one surface**: as the pointer
 * moves from one trigger to the next, the panel resizes and slides between them
 * rather than closing and reopening. That continuity is the whole reason this is a
 * component and not a row of Popovers.
 *
 * Kobalte renders the panel into a viewport that animates its own width and
 * position, which is what produces the effect and what a hand-built version always
 * misses.
 *
 * This is for navigation — moving between areas. For actions, use DropdownMenu; a
 * menu of commands styled as navigation is a menu the user will not find.
 */
export function NavigationMenu(props: ComponentProps<typeof KobalteNavigationMenu>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteNavigationMenu
      class={cn('relative flex max-w-max flex-1 items-center justify-center', local.class)}
      {...rest}
    />
  )
}

export function NavigationMenuList(props: ComponentProps<typeof KobalteNavigationMenu.Item>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Item class={cn('flex items-center gap-1', local.class)} {...rest} />
}

export function NavigationMenuItem(props: ComponentProps<typeof KobalteNavigationMenu.Item>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Item class={cn('relative', local.class)} {...rest} />
}

/**
 * One top-level entry: a trigger and the panel it opens.
 *
 * Required for the same reason as the menubar's — the bar tracks which entry is
 * open so the shared viewport can move between panels — and it is what makes the
 * panels animate as one surface rather than as separate popovers.
 */
export function NavigationMenuMenu(props: ComponentProps<typeof KobalteNavigationMenu.Menu>) {
  return <KobalteNavigationMenu.Menu {...props} />
}

export function NavigationMenuTrigger(props: ComponentProps<typeof KobalteNavigationMenu.Trigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <KobalteNavigationMenu.Trigger
      class={cn(
        'group/nav-trigger flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium select-none',
        'transition-colors ease-out outline-none',
        'hover:bg-surface-hover data-[expanded]:bg-surface-active',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        local.class
      )}
      {...rest}
    >
      {local.children}
      <ChevronDown
        aria-hidden="true"
        class="size-3.5 transition-transform ease-out group-data-[expanded]/nav-trigger:rotate-180"
      />
    </KobalteNavigationMenu.Trigger>
  )
}

/**
 * A plain link in the bar, for a destination that needs no panel.
 *
 * A navigation bar where *every* item opens a panel is a bar nobody can navigate:
 * the most important link is usually the one that goes straight there.
 */
export function NavigationMenuLink(props: ComponentProps<'a'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <a
      class={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium',
        'transition-colors ease-out outline-none',
        'hover:bg-surface-hover',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        local.class
      )}
      {...rest}
    />
  )
}

export function NavigationMenuContent(props: ComponentProps<typeof KobalteNavigationMenu.Content>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteNavigationMenu.Content
      class={cn(overlaySurface, 'absolute top-full start-0 mt-1.5 w-64 p-2', local.class)}
      {...rest}
    />
  )
}

/**
 * The shared viewport the panels animate inside. One per menu, rendered once.
 *
 * It is positioned by Kobalte and animates its own width and offset, which is what
 * makes moving between triggers feel like one surface rather than two popovers.
 */
export function NavigationMenuViewport(
  props: ComponentProps<typeof KobalteNavigationMenu.Viewport>
) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteNavigationMenu.Portal>
      <KobalteNavigationMenu.Viewport
        class={cn(
          overlaySurface,
          'absolute top-full start-0 mt-1.5 h-(--kb-navigation-menu-viewport-height) w-(--kb-navigation-menu-viewport-width) overflow-hidden',
          'origin-top transition-[width,height] ease-out',
          local.class
        )}
        {...rest}
      />
    </KobalteNavigationMenu.Portal>
  )
}

export function NavigationMenuLinkItem(props: ComponentProps<typeof KobalteNavigationMenu.Item>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Item class={cn(menuItem, local.class)} {...rest} />
}

export function NavigationMenuPanel(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return <div class={cn(menuContentPadding, 'grid gap-1', local.class)} {...rest} />
}
