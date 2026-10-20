import type { ComponentProps, JSX } from 'solid-js'
import { children, Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Separator } from '../../ui/separator'

/**
 * ShellTopBar.
 *
 * The window's top bar as both applications draw it. It has two halves with a
 * vertical divider between them:
 *
 *   - **Leading**: history arrows, the sidebar toggle and the workspace
 *     switcher, in that order. This is the part that belongs to the window.
 *   - **Content**: breadcrumbs, search and the view's actions. This is the part
 *     that belongs to the view, and it always sits to the right of the divider.
 *
 * ## Why the divider tracks the sidebar
 *
 * With the sidebar open the divider lands on the sidebar's trailing edge, so the
 * bar reads as the rail and sidebar's header on one side and the content's
 * header on the other. The bar spans the rail and the sidebar (they sit under
 * it), so the leading half is as wide as `--rail-width` plus the sidebar's width
 * less the bar's own start padding. The host publishes the width as
 * `--shell-sidebar-width` on an ancestor; the fallback of 17rem matches the
 * default sidebar. Below the 48rem breakpoint the sidebar is a drawer and the
 * leading half is only as wide as its controls.
 *
 * ## Narrow windows
 *
 * The bar is its own container. Below 34rem the search drops to a row of its
 * own so the leading controls, the breadcrumb and the actions keep their room;
 * the breadcrumb is the first thing to truncate.
 *
 * On a frameless desktop window the bar is the drag region (`draggable`) and
 * every control opts back out; `macosInset` and `windowsInset` reserve the
 * native window controls.
 */
export type ShellTopBarProps = Omit<ComponentProps<'header'>, 'children'> & {
  /** History arrows. Rendered first, left of the sidebar toggle. */
  navigation?: JSX.Element
  /** The sidebar toggle button. */
  sidebarToggle?: JSX.Element
  /** The workspace switcher. */
  workspace?: JSX.Element
  /**
   * Whether the sidebar is open at wide widths. Open, the divider aligns with
   * the sidebar's edge; closed, the leading half hugs its controls.
   */
  sidebarOpen?: boolean
  /**
   * The open sidebar's width in pixels. Published as `--shell-sidebar-width` on
   * the bar so the divider tracks a resizable sidebar; leave it unset to use an
   * ancestor's variable or the 17rem default.
   */
  sidebarWidth?: number
  /** Breadcrumbs or the view's title. Takes the free space and truncates first. */
  breadcrumb?: JSX.Element
  /** The view's search. */
  search?: JSX.Element
  /** The view's actions, at the trailing edge. */
  actions?: JSX.Element
  /** Make the bar a drag region, for a frameless window. */
  draggable?: boolean
  /** Reserve space for the macOS traffic lights. */
  macosInset?: boolean
  /** Reserve space for the Windows caption buttons. */
  windowsInset?: boolean
  /** Blur the content scrolling under the bar. */
  glass?: boolean
}

export function ShellTopBar(props: ShellTopBarProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'navigation',
    'sidebarToggle',
    'workspace',
    'sidebarOpen',
    'sidebarWidth',
    'breadcrumb',
    'search',
    'actions',
    'draggable',
    'macosInset',
    'windowsInset',
    'glass',
  ])

  // Resolve each slot once: a JSX prop is a getter that builds its elements on
  // every read, so testing it with `Show` and then rendering it would build
  // (and run the refs of) two copies.
  const navigation = children(() => local.navigation)
  const sidebarToggle = children(() => local.sidebarToggle)
  const workspace = children(() => local.workspace)
  const breadcrumb = children(() => local.breadcrumb)
  const search = children(() => local.search)
  const actions = children(() => local.actions)

  return (
    <header
      data-slot="shell-top-bar"
      class={cn(
        '@container/shell-top-bar relative z-(--z-sticky) flex min-h-topbar shrink-0 flex-wrap items-center border-b border-border bg-card text-card-foreground',
        local.glass && 'glass-panel',
        local.draggable && 'window-drag',
        /* Each edge gets exactly one inline-padding utility, for the reason the
           shared TopBar documents: two would tie-break by build order. The inset
           is also published as a variable so the leading half can subtract it. */
        local.macosInset
          ? 'window-inset-macos [--shell-top-bar-inset:84px]'
          : 'ps-3 [--shell-top-bar-inset:0.75rem]',
        local.windowsInset ? 'window-inset-windows' : 'pe-3',
        local.class
      )}
      style={
        local.sidebarWidth === undefined
          ? undefined
          : { '--shell-sidebar-width': `${local.sidebarWidth}px` }
      }
      {...rest}
    >
      <div
        data-slot="shell-top-bar-leading"
        data-sidebar-open={local.sidebarOpen ? 'true' : 'false'}
        class={cn(
          'window-no-drag flex h-topbar min-w-0 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden pe-3',
          /* Wide and open: span the rail and the sidebar so the divider lands on
             the sidebar's edge. The sidebar's own border is the 1px the divider
             overlaps, so no extra allowance is needed. */
          local.sidebarOpen &&
            'md:w-[calc(var(--rail-width)+var(--shell-sidebar-width,17rem)-var(--shell-top-bar-inset))]'
        )}
      >
        <Show when={navigation()}>
          <div data-slot="shell-top-bar-navigation" class="flex shrink-0 items-center gap-2">
            {navigation()}
          </div>
        </Show>
        <Show when={sidebarToggle()}>
          <div data-slot="shell-top-bar-toggle" class="flex shrink-0 items-center">
            {sidebarToggle()}
          </div>
        </Show>
        <Show when={workspace()}>
          <div data-slot="shell-top-bar-workspace" class="flex min-w-0 items-center">
            {workspace()}
          </div>
        </Show>
      </div>
      <Separator
        orientation="vertical"
        data-slot="shell-top-bar-divider"
        aria-hidden="true"
        class="h-5"
      />
      <Show when={breadcrumb()}>
        <div
          data-slot="shell-top-bar-breadcrumb"
          class="window-no-drag flex h-topbar min-w-0 flex-1 items-center truncate ps-3 text-sm [&_:is(a,button)]:window-no-drag"
        >
          {breadcrumb()}
        </div>
      </Show>
      <Show when={!breadcrumb()}>
        <div class="min-w-0 flex-1" aria-hidden="true" />
      </Show>
      <Show when={search()}>
        <div
          data-slot="shell-top-bar-search"
          class="window-no-drag min-w-0 max-w-md shrink basis-72 px-3 @max-[34rem]/shell-top-bar:order-last @max-[34rem]/shell-top-bar:max-w-none @max-[34rem]/shell-top-bar:basis-full @max-[34rem]/shell-top-bar:pb-2"
        >
          {search()}
        </div>
      </Show>
      <Show when={actions()}>
        <div
          data-slot="shell-top-bar-actions"
          class="window-no-drag flex h-topbar min-w-0 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden ps-1"
        >
          {actions()}
        </div>
      </Show>
    </header>
  )
}
