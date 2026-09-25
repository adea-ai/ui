import { Polymorphic, type PolymorphicProps } from '@kobalte/core/polymorphic'
import type { ComponentProps, JSX, ValidComponent } from 'solid-js'
import { Show, createMemo, createSignal, splitProps } from 'solid-js'
import { Portal } from 'solid-js/web'
import { cn } from '#lib/utils'
import { SideRailContext, createSideRailValue } from './side-rail-context'

/**
 * SideRail.
 *
 * The narrow, persistent column of top-level destinations at the window's leading
 * edge: the app mark, the primary sections, and a footer for account and settings.
 * It is the one piece of chrome that is always on screen, which is why it is a
 * component rather than something each view arranges.
 *
 * Two forms, one component. Collapsed it is an icon column; expanded it carries
 * labels. Both widths come from `--rail-width` (74px) and `--rail-width-expanded`
 * (236px), so an app cannot pick its own and end up a few pixels out of step with
 * the app beside it.
 *
 * The rail does not own its collapsed state; the app does. That state has to
 * survive a reload and usually lives with the rest of the window preferences, and
 * a rail that kept it privately could not be restored.
 */
export type SideRailProps<T extends ValidComponent = 'nav'> = PolymorphicProps<
  T,
  {
    class?: string
    collapsed?: boolean
    'aria-label'?: string
  }
>

export function SideRail<T extends ValidComponent = 'nav'>(props: SideRailProps<T>) {
  const [local, rest] = splitProps(props as SideRailProps, [
    'class',
    'collapsed',
    'aria-label',
    'children',
  ])

  const collapsed = () => local.collapsed ?? false
  const value = createSideRailValue(
    collapsed,
    createMemo(() => (collapsed() ? 'var(--rail-width)' : 'var(--rail-width-expanded)'))
  )

  return (
    <SideRailContext.Provider value={value}>
      <Polymorphic
        as="nav"
        aria-label={local['aria-label'] ?? 'Primary'}
        /* Rendered in both states, with a real value, so the descendant selectors
           below can key on true *and* false — an absent attribute would leave the
           expanded form matching neither. */
        data-collapsed={collapsed() ? 'true' : 'false'}
        class={cn(
          'group/rail bg-sidebar text-sidebar-foreground flex h-full shrink-0 flex-col border-e border-sidebar-border',
          'transition-[width] duration-150 ease-out',
          { 'w-rail': collapsed(), 'w-rail-expanded': !collapsed() },
          local.class
        )}
        {...(rest as ComponentProps<'nav'>)}
      >
        {local.children}
      </Polymorphic>
    </SideRailContext.Provider>
  )
}

/** The header slot: the app mark, and the product name when there is room. */
export function SideRailHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-header"
      class={cn(
        'h-topbar flex shrink-0 items-center gap-2.5 px-3 group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0',
        local.class
      )}
      {...rest}
    />
  )
}

/** The scrolling middle. Keeps the header and the footer pinned. */
export function SideRailContent(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-content"
      class={cn(
        'flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto px-2 py-2',
        local.class
      )}
      {...rest}
    />
  )
}

/** The pinned footer: account, settings, help. */
export function SideRailFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="side-rail-footer"
      class={cn(
        'flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border px-2 py-2',
        local.class
      )}
      {...rest}
    />
  )
}

/** A titled group of rail destinations. The title hides when collapsed. */
export function SideRailSection(props: ComponentProps<'div'> & { label?: string }) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])

  return (
    <div data-slot="side-rail-section" class={cn('flex flex-col gap-0.5', local.class)} {...rest}>
      <Show when={local.label}>
        <div class="text-sidebar-muted-foreground px-2 pt-2 pb-1 text-2xs font-medium tracking-wide uppercase group-data-[collapsed=true]/rail:hidden">
          {local.label}
        </div>
      </Show>
      {local.children}
    </div>
  )
}

/**
 * The classes a rail row uses. Exported so a caller's own element — a router link,
 * a custom button — can match the rail exactly instead of approximating it.
 */
export const sideRailItemClass = [
  'group/rail-item flex h-rail-item min-w-0 w-full items-center gap-2.5 rounded-md px-3 text-sm font-medium',
  'group-data-[collapsed=true]/rail:justify-center group-data-[collapsed=true]/rail:px-0',
  'transition-colors ease-out outline-none select-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
  '[&_svg]:size-4 [&_svg]:shrink-0',
].join(' ')

export const sideRailItemStateClass = {
  active: 'bg-sidebar-accent text-sidebar-accent-foreground',
  idle: 'text-sidebar-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
}

/**
 * A rail destination.
 *
 * ## The tooltip is the rail's hover affordance, not a generic bubble
 *
 * Collapsed, the row has no text, so the label has to come from somewhere. This
 * ports the donor's treatment rather than using a standard tooltip, because the
 * details are what make it read as part of the rail:
 *
 *   - It is **flush with the row**: positioned at the row's own top and given the
 *     row's own height, so it continues the row outward instead of floating near
 *     it. A centred bubble with an arrow reads as a separate object.
 *   - It **repeats the icon**, which anchors it to the row it belongs to.
 *   - It carries the **keyboard chord**, which is the one piece of information a
 *     collapsed rail otherwise cannot show.
 *   - It opens on **hover and on focus**, so a keyboard user gets the same label a
 *     pointer user does.
 *   - It is `pointer-events-none` and `aria-hidden`: the row already carries the
 *     name (as a visually hidden span when collapsed), so this is decoration and
 *     must never be the accessible name.
 *
 * ## The chord on the row
 *
 * Expanded, the row shows its chord on hover and on focus — and the chord is
 * declared once to assistive technology through `aria-keyshortcuts` rather than
 * being read out as glyphs. The visible badge is `aria-hidden` for that reason.
 */
export type SideRailItemProps<T extends ValidComponent = 'a'> = PolymorphicProps<
  T,
  {
    class?: string
    /** Marks the item as the current destination. */
    active?: boolean
    /**
     * The item's accessible name. Required, and always in the accessibility tree:
     * collapsed it moves into the tooltip and a visually hidden span rather than
     * being deleted.
     */
    label: string
    /** A count or a dot, rendered over the icon's corner. */
    badge?: JSX.Element
    /** An indicator pinned to the trailing edge in the expanded form. */
    trailing?: JSX.Element
    /** The chord as it should be drawn, e.g. `⌘1`. Shown on hover and focus. */
    shortcut?: string
    /**
     * The same chord in the ARIA grammar, e.g. `Meta+1`. Declared to assistive
     * technology instead of the display glyphs, which are not a keyboard shortcut
     * a screen reader can parse. Supply it whenever `shortcut` is drawn.
     */
    keyshortcuts?: string
  }
>

export function SideRailItem<T extends ValidComponent = 'a'>(props: SideRailItemProps<T>) {
  const [local, rest] = splitProps(props as SideRailItemProps, [
    'as',
    'class',
    'active',
    'label',
    'badge',
    'trailing',
    'shortcut',
    'keyshortcuts',
    'children',
  ])

  const [row, setRow] = createSignal<HTMLElement>()
  const [tip, setTip] = createSignal<{ top: number; left: number; height: number } | null>(null)

  const collapsed = () =>
    row()?.closest('[data-collapsed]')?.getAttribute('data-collapsed') === 'true'

  const showTip = () => {
    const element = row()
    if (!element || !collapsed()) return
    const rect = element.getBoundingClientRect()
    setTip({ top: rect.top, left: rect.right + 8, height: rect.height })
  }

  const hideTip = () => setTip(null)

  return (
    <>
      <Polymorphic
        as={local.as ?? 'a'}
        ref={setRow}
        aria-current={local.active ? 'page' : undefined}
        aria-keyshortcuts={local.keyshortcuts}
        data-active={local.active ? '' : undefined}
        class={cn(
          sideRailItemClass,
          local.active ? sideRailItemStateClass.active : sideRailItemStateClass.idle,
          local.class
        )}
        onPointerEnter={showTip}
        onPointerLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        {...(rest as Record<string, unknown>)}
      >
        <Show when={local.badge}>
          <span class="relative flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
            {local.children}
            <span class="absolute -top-1 -end-1 flex items-center justify-center">
              {local.badge}
            </span>
          </span>
        </Show>
        <Show when={!local.badge}>
          <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
            {local.children}
          </span>
        </Show>

        <span class="min-w-0 flex-1 truncate group-data-[collapsed=true]/rail:sr-only">
          {local.label}
        </span>

        <Show when={local.shortcut && local.trailing === undefined}>
          <span
            aria-hidden="true"
            class="text-sidebar-muted-foreground shrink-0 font-mono text-2xs leading-none opacity-0 transition-opacity group-hover/rail-item:opacity-100 group-focus-visible/rail-item:opacity-100 group-data-[collapsed=true]/rail:hidden"
          >
            {local.shortcut}
          </span>
        </Show>

        <Show when={local.trailing}>
          <span class="ms-auto shrink-0">{local.trailing}</span>
        </Show>
      </Polymorphic>

      <Show when={tip()}>
        {(position) => (
          <Portal>
            <div
              aria-hidden="true"
              data-slot="side-rail-tip"
              class={cn(
                'bg-card text-card-foreground border-border pointer-events-none fixed z-(--z-tooltip)',
                'flex items-center gap-2.5 rounded-md border ps-3 pe-3 text-sm font-medium whitespace-nowrap shadow-lg'
              )}
              style={{
                top: `${position().top}px`,
                left: `${position().left}px`,
                height: `${position().height}px`,
              }}
            >
              <span
                class={cn('flex size-4 shrink-0 items-center justify-center [&_svg]:size-4', {
                  'text-primary': local.active,
                })}
              >
                {local.children}
              </span>
              {local.label}
              <Show when={local.shortcut}>
                <span class="text-muted-foreground shrink-0 font-mono text-2xs leading-none">
                  {local.shortcut}
                </span>
              </Show>
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}

/** A non-navigating rail control: a collapse toggle, a "new" action. */
export function SideRailButton(
  props: Omit<ComponentProps<'button'>, 'type'> & { label: string; shortcut?: string }
) {
  const [local, rest] = splitProps(props, ['class', 'label', 'shortcut', 'children'])
  const [row, setRow] = createSignal<HTMLElement>()
  const [tip, setTip] = createSignal<{ top: number; left: number; height: number } | null>(null)

  const collapsed = () =>
    row()?.closest('[data-collapsed]')?.getAttribute('data-collapsed') === 'true'

  const showTip = () => {
    const element = row()
    if (!element || !collapsed()) return
    const rect = element.getBoundingClientRect()
    setTip({ top: rect.top, left: rect.right + 8, height: rect.height })
  }

  return (
    <>
      <button
        type="button"
        ref={setRow}
        aria-label={local.label}
        onPointerEnter={showTip}
        onPointerLeave={() => setTip(null)}
        onFocus={showTip}
        onBlur={() => setTip(null)}
        class={cn(
          sideRailItemClass,
          sideRailItemStateClass.idle,
          'disabled:pointer-events-none disabled:opacity-50',
          local.class
        )}
        {...rest}
      >
        <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
          {local.children}
        </span>
        <span class="min-w-0 flex-1 truncate group-data-[collapsed=true]/rail:sr-only">
          {local.label}
        </span>
        <Show when={local.shortcut}>
          <span
            aria-hidden="true"
            class="text-sidebar-muted-foreground shrink-0 font-mono text-2xs leading-none opacity-0 transition-opacity group-hover/rail-item:opacity-100 group-focus-visible/rail-item:opacity-100 group-data-[collapsed=true]/rail:hidden"
          >
            {local.shortcut}
          </span>
        </Show>
      </button>

      <Show when={tip()}>
        {(position) => (
          <Portal>
            <div
              aria-hidden="true"
              data-slot="side-rail-tip"
              class="bg-card text-card-foreground border-border pointer-events-none fixed z-(--z-tooltip) flex items-center gap-2.5 rounded-md border ps-3 pe-3 text-sm font-medium whitespace-nowrap shadow-lg"
              style={{
                top: `${position().top}px`,
                left: `${position().left}px`,
                height: `${position().height}px`,
              }}
            >
              <span class="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4">
                {local.children}
              </span>
              {local.label}
            </div>
          </Portal>
        )}
      </Show>
    </>
  )
}
