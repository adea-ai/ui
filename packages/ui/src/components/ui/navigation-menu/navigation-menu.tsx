import { splitProps, type ComponentProps, type JSX } from 'solid-js'
import * as KobalteNavigationMenu from '@kobalte/core/navigation-menu'
import { ChevronDown } from 'lucide-solid'
import { cn } from '#lib/utils'
import { menuContentPadding, menuItem, overlayMotion, overlaySurface } from '#lib/overlay'

/**
 * NavigationMenu.
 *
 * A site-style menu bar: top-level triggers that open panels of links. It is the
 * header pattern — a documentation site, a marketing page, an application with
 * several top-level destinations — and it is deliberately *not* a `Menubar`.
 * `Menubar` is a row of application menus (File, Edit, View) whose items are
 * commands; this is a row of destinations whose panels are links. The two have
 * different roles, different keyboard models, and different semantics.
 *
 * ## Composition
 *
 * Kobalte's primitive has an unusual shape, and getting it wrong is why this took
 * three attempts to port. The structure is:
 *
 * ```tsx
 * <NavigationMenu>
 *   <NavigationMenuMenu>
 *     <NavigationMenuTrigger>Destinations</NavigationMenuTrigger>
 *     <NavigationMenuContent>
 *       <NavigationMenuItem href="/x">X</NavigationMenuItem>
 *     </NavigationMenuContent>
 *   </NavigationMenuMenu>
 *   <NavigationMenuViewport />
 * </NavigationMenu>
 * ```
 *
 * Three facts that are not obvious from the prop types:
 *
 * - `Menu` renders **nothing**. It is a context provider — one per top-level
 *   entry, naming it so the bar's arrow keys can move between entries. A menu
 *   without one cannot be reached by keyboard.
 * - `Trigger` renders `<li role="presentation"><button>`. It is already the list
 *   item, so wrapping it in your own `<li>` produces a `<ul>` inside a `<ul>`.
 * - `Content` must be a direct child of `Menu`, and the `Viewport` is a **sibling
 *   of the menus** — not inside them. All the panels share one viewport, which is
 *   what lets the bar animate between them instead of each panel popping in place.
 *
 * The wrapper enforces the last of those by rendering the `Viewport` itself, so a
 * caller cannot forget it and get a menu whose panels never appear.
 */

export type NavigationMenuProps = ComponentProps<typeof KobalteNavigationMenu.Root> & {
  /** The accessible name for the navigation landmark. */
  label?: string
}

export function NavigationMenu(props: NavigationMenuProps) {
  const [local, rest] = splitProps(props, ['label', 'class', 'children'])

  return (
    <KobalteNavigationMenu.Root
      class={cn(
        'relative flex max-w-max flex-1 items-center justify-center',
        '[&>nav>ul]:flex [&>nav>ul]:items-center [&>nav>ul]:gap-1',
        local.class
      )}
      aria-label={local.label ?? 'Main'}
      {...rest}
    >
      {local.children}
      {/*
        The shared panel surface. Rendered here rather than left to the caller:
        every panel animates through this one element, and a menu bar without it
        opens panels that never paint.
      */}
      <NavigationMenuViewport />
    </KobalteNavigationMenu.Root>
  )
}

/**
 * One top-level entry. Renders nothing itself — see the note above — and exists
 * so a caller cannot build a bar whose entries the keyboard cannot reach.
 */
export function NavigationMenuMenu(props: ComponentProps<typeof KobalteNavigationMenu.Menu>) {
  return <KobalteNavigationMenu.Menu {...props} />
}

export function NavigationMenuTrigger(props: ComponentProps<typeof KobalteNavigationMenu.Trigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteNavigationMenu.Trigger
      class={cn(
        'inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground',
        'transition-colors ease-out outline-none select-none',
        'hover:bg-muted hover:text-foreground',
        'data-[expanded]:bg-muted data-[expanded]:text-foreground',
        'data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        local.class
      )}
      {...rest}
    >
      {local.children}
      <ChevronDown
        aria-hidden="true"
        class="size-3.5 transition-transform duration-200 ease-out [[data-expanded]_&]:rotate-180"
      />
    </KobalteNavigationMenu.Trigger>
  )
}

export function NavigationMenuContent(props: ComponentProps<typeof KobalteNavigationMenu.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteNavigationMenu.Content
      class={cn(
        'grid w-max gap-1 p-2',
        // A two-column panel is the shape most menu bars want, and it is opt-in
        // through this hook rather than a prop because the column count is a
        // layout decision the caller's content makes.
        'data-[wide]:grid-cols-2',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </KobalteNavigationMenu.Content>
  )
}

/**
 * The shared panel surface. One per menu bar, and the wrapper supplies it — but
 * exported so a caller with an unusual layout can place it themselves.
 */
export function NavigationMenuViewport(
  props: ComponentProps<typeof KobalteNavigationMenu.Viewport>
) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteNavigationMenu.Viewport
      class={cn(
        'absolute top-full left-0 isolate z-(--z-menu) mt-1.5 flex justify-center overflow-hidden',
        'h-(--kb-navigation-menu-viewport-height) w-(--kb-navigation-menu-viewport-width)',
        'origin-top transition-[width,height] duration-200 ease-out',
        local.class
      )}
      {...rest}
    >
      <div
        class={cn(
          overlaySurface,
          overlayMotion,
          'w-full rounded-lg border border-border bg-popover p-1 shadow-lg'
        )}
      >
        <KobalteNavigationMenu.Content />
      </div>
    </KobalteNavigationMenu.Viewport>
  )
}

/**
 * A link inside a panel. `href` is the point of the component, so it is a link
 * rather than a button — and the accessible name comes from its text, which is
 * why there is no `aria-label` here.
 */
export type NavigationMenuItemProps = ComponentProps<typeof KobalteNavigationMenu.Item> & {
  /** A one-line description, shown under the label. */
  description?: string
  /** A leading icon. */
  icon?: JSX.Element
}

export function NavigationMenuItem(props: NavigationMenuItemProps) {
  const [local, rest] = splitProps(props, ['class', 'children', 'description', 'icon'])

  return (
    <KobalteNavigationMenu.Item
      class={cn(
        menuItem,
        'grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-0.5',
        local.description && 'grid-rows-[auto_auto] py-2',
        local.class
      )}
      {...rest}
    >
      {local.icon}
      <span class="font-medium">{local.children}</span>
      {local.description && (
        <span class="col-start-2 text-xs text-muted-foreground">{local.description}</span>
      )}
    </KobalteNavigationMenu.Item>
  )
}

export function NavigationMenuSeparator(
  props: ComponentProps<typeof KobalteNavigationMenu.Separator>
) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteNavigationMenu.Separator
      class={cn('-mx-1 my-1 h-px bg-border', local.class)}
      {...rest}
    />
  )
}

/** A non-interactive caption above a group of items. */
export function NavigationMenuGroupLabel(
  props: ComponentProps<typeof KobalteNavigationMenu.GroupLabel>
) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteNavigationMenu.GroupLabel
      class={cn(
        menuContentPadding,
        'text-2xs font-semibold text-muted-foreground uppercase',
        local.class
      )}
      {...rest}
    />
  )
}

export function NavigationMenuGroup(props: ComponentProps<typeof KobalteNavigationMenu.Group>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Group class={cn('grid gap-0.5', local.class)} {...rest} />
}
