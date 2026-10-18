import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { Search } from 'lucide-solid'
import { cn } from '#lib/utils'

/**
 * TopBar.
 *
 * The window's title row and primary toolbar. Three tracks: a leading group, a
 * centred search, and a trailing group. On wide screens the search is a fixed
 * function of the window width and the side groups are equal remainders. On
 * narrow screens the middle track yields space to the controls, and each side
 * group scrolls when necessary so keyboard focus can reveal every action.
 *
 * The centre track is sized for a lone search field. A bar whose centre holds
 * more than that, such as a search plus an action beside it, passes
 * `centerWidth="wide"`: the centre then stays fluid below 1280px, with each
 * side group sized to its content but capped between 30% and 40% of the row
 * (a longer group scrolls instead): the cap is 30% on the narrowest rows and
 * grows to 40% as the row widens, so full side groups never squeeze the
 * centre's search out of it and enlarged text never pushes a short leading
 * control such as a navigation toggle out of the row. Above 1280px it takes a
 * wider fixed track.
 *
 * A wide bar also never squeezes its centre to nothing. When the row is
 * narrower than 19rem (measured in rem, so enlarged text reaches it at a wider
 * window) the centre moves to a second row of its own and the two side groups
 * share the first, the trailing group taking the remainder beside the leading
 * group's cap, so the leading and trailing controls and the whole centre each
 * keep a full row instead of fighting for one. The bar grows from one row
 * to two only then. The wide layout places the leading group, centre and
 * trailing group as its first, second and third children.
 *
 * On a frameless desktop window this row is also the drag region, so it carries
 * `window-drag` and the controls inside it opt back out. `macos-inset` and
 * `windows-inset` reserve the space the native window controls occupy, which is
 * why the row can look off-centre in a frameless window and be correct: it is
 * centred in the space the user can actually see.
 */
export type TopBarProps = ComponentProps<'header'> & {
  /** Make the row draggable, for a frameless window. */
  draggable?: boolean
  /** Reserve space for the macOS traffic lights. */
  macosInset?: boolean
  /** Reserve space for the Windows caption buttons. */
  windowsInset?: boolean
  /** Blur the content scrolling under the bar. */
  glass?: boolean
  /**
   * How wide the centre track is. `field` (default) suits a lone search field.
   * `wide` suits a centre that also holds an action: fluid below 1280px between
   * side groups sized to their content and capped between 30% and 40% of the
   * row (a longer group scrolls), then a clamp of 32vw up to 672px between equal
   * side tracks.
   * Below a 19rem row the centre drops to a second row of its own.
   */
  centerWidth?: 'field' | 'wide'
}

export function TopBar(props: TopBarProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'draggable',
    'macosInset',
    'windowsInset',
    'glass',
    'centerWidth',
  ])

  return (
    <header
      data-slot="top-bar"
      class={cn(
        'h-topbar relative z-(--z-sticky) grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border bg-card text-card-foreground md:grid-cols-[minmax(0,1fr)_clamp(240px,22vw,480px)_minmax(0,1fr)]',
        /* The bar is its own container so its children can move to a second
           row by the row's width in rem, which enlarged text shrinks. The
           first row keeps the bar's height (less the 1px bottom border); the
           second only exists when the centre has dropped onto it. */
        local.centerWidth === 'wide' &&
          '@container/top-bar h-auto grid-cols-[fit-content(max(30%,min(40%,calc(50%-3.75rem))))_minmax(0,1fr)_fit-content(max(30%,min(40%,calc(50%-3.75rem))))] grid-rows-[minmax(calc(var(--topbar-height)-1px),auto)] gap-x-2 gap-y-0 md:grid-cols-[fit-content(max(30%,min(40%,calc(50%-3.75rem))))_minmax(0,1fr)_fit-content(max(30%,min(40%,calc(50%-3.75rem))))] xl:grid-cols-[minmax(0,1fr)_clamp(240px,32vw,672px)_minmax(0,1fr)] [&>:nth-child(2)]:@max-[19rem]/top-bar:col-span-full [&>:nth-child(2)]:@max-[19rem]/top-bar:row-start-2 [&>:nth-child(2)]:@max-[19rem]/top-bar:pb-2 [&>:nth-child(3)]:@max-[19rem]/top-bar:col-span-2 [&>:nth-child(3)]:@max-[19rem]/top-bar:col-start-2 [&>:nth-child(3)]:@max-[19rem]/top-bar:row-start-1',
        local.glass && 'glass-panel',
        local.draggable && 'window-drag',
        /* Each edge gets exactly one inline-padding utility. A window inset
           and px-3 would share a layer and tie-break by build order, and a
           build that put px-3 last hid the leading controls under the
           traffic lights. */
        local.macosInset ? 'window-inset-macos' : 'ps-3',
        local.windowsInset ? 'window-inset-windows' : 'pe-3',
        local.class
      )}
      {...rest}
    />
  )
}

function invokeFocusHandler(handler: unknown, event: Event) {
  if (Array.isArray(handler)) {
    const [callback, data] = handler as [(data: unknown, event: Event) => void, unknown]
    callback(data, event)
  } else if (typeof handler === 'function') {
    const callback = handler as (event: Event) => void
    callback(event)
  }
}

/** A scrollable side group; equal wide-screen tracks centre the search. */
export function TopBarSection(props: ComponentProps<'div'> & { align?: 'start' | 'end' }) {
  const [local, rest] = splitProps(props, ['class', 'align', 'onFocusIn'])

  return (
    <div
      data-slot="top-bar-section"
      class={cn(
        'window-no-drag flex min-w-0 items-center gap-2 overflow-x-auto overflow-y-hidden',
        local.align === 'end' && 'md:justify-end-safe',
        local.align !== 'end' && 'justify-start',
        local.class
      )}
      onFocusIn={(event) => {
        if (event.target instanceof HTMLElement) {
          event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        }
        invokeFocusHandler(local.onFocusIn, event)
      }}
      {...rest}
    />
  )
}

export function TopBarTitle(
  props: ComponentProps<'div'> & {
    /** Aligns text within this slot; it does not position the slot. */
    align?: 'start' | 'center'
  }
) {
  const [local, rest] = splitProps(props, ['class', 'align'])
  return (
    <div
      data-slot="top-bar-title"
      class={cn(
        /* The title slot sits in the drag region; a link, button or field
           placed in it (a breadcrumb, a view's search) must stay pressable. */
        'truncate text-sm font-medium [&_:is(a,button,input)]:window-no-drag',
        local.align === 'center' && 'text-center',
        local.class
      )}
      {...rest}
    />
  )
}

/** A breadcrumb or path readout that yields to the actions when space runs out. */
export function TopBarBreadcrumb(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="top-bar-breadcrumb"
      class={cn(
        'flex min-w-0 items-center gap-1.5 text-sm [&_:is(a,button,input)]:window-no-drag',
        local.class
      )}
      {...rest}
    />
  )
}

export type TopBarSearchProps = ComponentProps<'button'> & {
  /** The hint shown inside the field, e.g. "Search projects and files". */
  placeholder?: string
  /** The shortcut chip drawn at the trailing edge, e.g. "⌘K". */
  shortcut?: string
  /**
   * The parseable chord behind `shortcut`, e.g. `Meta+K`. The chip is
   * `aria-hidden` — reading it out would pollute the button's accessible
   * name — so this is what assistive technology announces instead. Supply it
   * whenever `shortcut` is drawn.
   */
  keyshortcuts?: string
}

/**
 * The search affordance in the middle track.
 *
 * It is a button, not an input, and that is deliberate: clicking it opens the
 * command palette, which already owns the input, the ranking and the keyboard
 * handling. A second live input here would be a second source of truth for the
 * same query. It is styled to read as a field because that is what it behaves
 * like from the user's side.
 */
export function TopBarSearch(props: TopBarSearchProps) {
  const [local, rest] = splitProps(props, ['class', 'placeholder', 'shortcut', 'keyshortcuts'])

  return (
    <button
      type="button"
      data-slot="top-bar-search"
      class={cn(
        'text-muted-foreground flex h-control-md w-full min-w-(--control-height-md) items-center justify-center gap-2 rounded-md border border-input px-3 text-sm sm:justify-start',
        'transition-colors ease-out outline-none',
        'hover:bg-surface-hover hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'window-no-drag',
        local.class
      )}
      aria-keyshortcuts={local.keyshortcuts}
      {...rest}
    >
      <Search aria-hidden="true" class="size-4 shrink-0 sm:hidden" />
      <span class="sr-only sm:not-sr-only sm:truncate">{local.placeholder ?? 'Search'}</span>
      <Show when={local.shortcut}>
        <kbd
          aria-hidden="true"
          class="bg-muted ms-auto hidden h-5 shrink-0 items-center rounded-sm border border-border px-1.5 font-code text-code sm:flex"
        >
          {local.shortcut}
        </kbd>
      </Show>
    </button>
  )
}

/**
 * A labelled top-bar control — the readouts KiroCrew puts in the trailing
 * group. Container queries on the group decide which of these survive a narrow
 * window; a caller marks the cheap-to-drop ones and the group handles the rest.
 */
export function TopBarPill(props: ComponentProps<'button'> & { label: string }) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])

  return (
    <button
      type="button"
      data-slot="top-bar-pill"
      class={cn(
        'text-muted-foreground inline-flex h-control-sm shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium',
        'transition-colors ease-out outline-none',
        'hover:border-input hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'window-no-drag [&_svg]:size-3.5 [&_svg]:shrink-0',
        local.class
      )}
      {...rest}
    >
      {local.children}
      <span>{local.label}</span>
    </button>
  )
}
