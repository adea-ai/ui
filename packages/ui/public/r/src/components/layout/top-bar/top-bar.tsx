import type { ComponentProps } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * TopBar.
 *
 * The window's title row and primary toolbar. Three tracks: a leading group, a
 * centred search, and a trailing group. The search is a fixed function of the
 * window width and the two side groups are equal remainders, which is what
 * makes the search *exactly* window-centred by construction — no measurement,
 * no observer, no absolutely-positioned overlay to keep clear of.
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
}

export function TopBar(props: TopBarProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'draggable',
    'macosInset',
    'windowsInset',
    'glass',
  ])

  return (
    <header
      data-slot="top-bar"
      class={cn(
        'h-topbar relative z-(--z-sticky) grid shrink-0 grid-cols-[minmax(0,1fr)_clamp(240px,22vw,480px)_minmax(0,1fr)] items-center gap-3 border-b border-border px-3',
        local.glass && 'glass-panel',
        local.draggable && 'window-drag',
        local.macosInset && 'window-inset-macos',
        local.windowsInset && 'window-inset-windows',
        local.class
      )}
      {...rest}
    />
  )
}

/** A side group. Both sides are equal remainders, which centres the search. */
export function TopBarSection(props: ComponentProps<'div'> & { align?: 'start' | 'end' }) {
  const [local, rest] = splitProps(props, ['class', 'align'])

  return (
    <div
      data-slot="top-bar-section"
      class={cn(
        'flex min-w-0 items-center gap-2 overflow-hidden',
        local.align === 'end' && 'justify-end',
        local.align !== 'end' && 'justify-start',
        local.class
      )}
      {...rest}
    />
  )
}

export function TopBarTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="top-bar-title"
      class={cn('truncate text-sm font-medium', local.class)}
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
      class={cn('flex min-w-0 items-center gap-1.5 text-sm', local.class)}
      {...rest}
    />
  )
}

export type TopBarSearchProps = ComponentProps<'button'> & {
  /** The hint shown inside the field, e.g. "Search projects and files". */
  placeholder?: string
  /** The shortcut chip drawn at the trailing edge, e.g. "⌘K". */
  shortcut?: string
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
  const [local, rest] = splitProps(props, ['class', 'placeholder', 'shortcut'])

  return (
    <button
      type="button"
      data-slot="top-bar-search"
      class={cn(
        'text-muted-foreground flex h-control-md w-full items-center gap-2 rounded-md border border-input px-3 text-sm',
        'transition-colors ease-out outline-none',
        'hover:bg-surface-hover hover:text-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'window-no-drag',
        local.class
      )}
      {...rest}
    >
      <span class="truncate">{local.placeholder ?? 'Search'}</span>
      <Show when={local.shortcut}>
        <kbd class="bg-muted ms-auto hidden h-5 shrink-0 items-center rounded-sm border border-border px-1.5 font-mono text-2xs sm:flex">
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
