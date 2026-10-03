import type { ComponentProps, JSX } from 'solid-js'
import { Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip/tooltip'

/**
 * WorkspaceMark.
 *
 * The mark for one workspace in a rail: an initial or a glyph, a ring while it is
 * active, and a badge for something unread. It is deliberately not an `Avatar` —
 * a workspace is not a person, it does not need an image or initials derived from a
 * name, and a rail of them needs an *active* treatment an avatar does not have.
 *
 * The mark is square with a rounded corner rather than round, which is what
 * distinguishes a workspace from a person at a glance in a rail that holds both.
 */
export type WorkspaceMarkProps = ComponentProps<'button'> & {
  /** The workspace's name. Used for the label, the initial, and the tooltip. */
  name: string
  /** Draw the active ring. */
  active?: boolean
  /** A count or a dot, drawn at the corner. */
  badge?: JSX.Element
  /** Replace the initial with a glyph. */
  children?: JSX.Element
}

export function WorkspaceMark(props: WorkspaceMarkProps) {
  const [local, rest] = splitProps(props, ['class', 'name', 'active', 'badge', 'children'])

  const mark = (
    <button
      type="button"
      aria-label={local.name}
      aria-current={local.active ? 'true' : undefined}
      data-active={local.active ? '' : undefined}
      class={cn(
        'relative flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
        'transition-[color,background-color,border-color,transform] ease-out outline-none select-none',
        'hover:scale-105 active:scale-95',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'disabled:pointer-events-none disabled:opacity-50',
        local.active
          ? 'border-primary bg-primary-subtle text-primary'
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
        local.class
      )}
      {...rest}
    >
      <Show
        when={local.children}
        fallback={
          <span data-slot="workspace-mark-initial" aria-hidden="true">
            {local.name.charAt(0).toUpperCase()}
          </span>
        }
      >
        {local.children}
      </Show>
      {/* The badge is centred on the corner rather than tucked inside it. Inset
          by an edge offset, a count badge is wider than the space between the
          corner and the monogram, so it sat on the letter; centred on the corner,
          a dot, a one-digit and a two-digit count all clear the letter's box. */}
      <Show when={local.badge}>
        <span
          data-slot="workspace-mark-badge"
          class="absolute end-0 top-0 flex translate-x-1/2 -translate-y-1/2 items-center justify-center rtl:-translate-x-1/2"
        >
          {local.badge}
        </span>
      </Show>
    </button>
  )

  return (
    <Tooltip placement="right">
      <TooltipTrigger as="span" class="contents">
        {mark}
      </TooltipTrigger>
      <TooltipContent>{local.name}</TooltipContent>
    </Tooltip>
  )
}
