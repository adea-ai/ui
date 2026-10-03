import { splitProps, type ComponentProps, type JSX } from 'solid-js'
import * as KobalteNavigationMenu from '@kobalte/core/navigation-menu'
import { ChevronDown } from 'lucide-solid'
import { cn } from '../../../lib/utils'
import {
  menuContentPadding,
  menuItem,
  menuLabel,
  menuSeparator,
  overlayMotion,
  overlaySurface,
} from '../../../lib/overlay'

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
 * - The viewport is an empty surface. Each `Content` reaches it through Kobalte's
 *   `Portal`, which mounts the panel inside the viewport while keeping it in its
 *   own `Menu`'s context. A `Content` rendered anywhere else — the viewport's own
 *   children included — has no `Menu` above it, and Kobalte throws
 *   `useMenuRootContext must be used within a MenuRoot` the moment a panel opens.
 *
 * The wrapper enforces the last two by rendering the `Viewport` itself and by
 * portalling every `NavigationMenuContent`, so a caller cannot forget either and
 * get a menu whose panels never appear.
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
    <KobalteNavigationMenu.Portal>
      <KobalteNavigationMenu.Content
        class={cn(
          // Absolute so the viewport sizes to the active panel's measured box and
          // animates between panels, rather than stacking them.
          'absolute top-0 left-0 grid w-max gap-1 outline-none',
          // The viewport is the surface and carries no padding of its own (its
          // measured size is the panel's), so the panel supplies the inset every
          // menu surface shares — the one the separator's bleed is cut for.
          menuContentPadding,
          // The motion is the panel's, not the viewport's. Kobalte keeps an
          // outgoing panel mounted until the viewport's own animation ends; a
          // viewport that carries an entrance animation never fires that again
          // after it opens, so the previous panel would stay painted under the
          // next one.
          overlayMotion,
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
    </KobalteNavigationMenu.Portal>
  )
}

/**
 * The shared panel surface. One per menu bar, and the wrapper supplies it — but
 * exported so a caller with an unusual layout can place it themselves.
 *
 * It renders no children: the panels arrive through each `NavigationMenuContent`'s
 * portal. Kobalte positions it under the bar and publishes the active panel's size
 * as `--kb-navigation-menu-viewport-*`, which the surface animates between.
 * `box-content` keeps the border outside that measured size so a panel is never
 * clipped by its own frame.
 */
export function NavigationMenuViewport(
  props: ComponentProps<typeof KobalteNavigationMenu.Viewport>
) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteNavigationMenu.Viewport
      data-slot="navigation-menu-viewport"
      class={cn(
        overlaySurface,
        'isolate z-(--z-menu) mt-1.5 box-content list-none overflow-hidden',
        'h-(--kb-navigation-menu-viewport-height) w-(--kb-navigation-menu-viewport-width)',
        'origin-(--kb-menu-content-transform-origin) transition-[width,height] duration-200 ease-out',
        local.class
      )}
      {...rest}
    />
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
        // The description sits under the label, in the label's column. Without
        // an icon there is no leading column, and a two-column grid would set
        // the description beside the label instead of beneath it.
        local.icon ? 'grid grid-cols-[auto_1fr]' : 'grid grid-cols-1',
        'items-center gap-x-2 gap-y-0.5',
        local.description && 'grid-rows-[auto_auto] py-2',
        local.class
      )}
      {...rest}
    >
      {local.icon}
      <span class="font-medium">{local.children}</span>
      {local.description && (
        <span
          class={cn('text-xs text-muted-foreground', {
            'col-start-2': !!local.icon,
          })}
        >
          {local.description}
        </span>
      )}
    </KobalteNavigationMenu.Item>
  )
}

export function NavigationMenuSeparator(
  props: ComponentProps<typeof KobalteNavigationMenu.Separator>
) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Separator class={cn(menuSeparator, local.class)} {...rest} />
}

/** A non-interactive caption above a group of items. */
export function NavigationMenuGroupLabel(
  props: ComponentProps<typeof KobalteNavigationMenu.GroupLabel>
) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.GroupLabel class={cn(menuLabel, local.class)} {...rest} />
}

export function NavigationMenuGroup(props: ComponentProps<typeof KobalteNavigationMenu.Group>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteNavigationMenu.Group class={cn('grid gap-0.5', local.class)} {...rest} />
}
