import { HoverCard as KobalteHoverCard } from '@kobalte/core/hover-card'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { overlaySurface, popoverArrow } from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * HoverCard.
 *
 * A rich preview shown on hover: a user's profile, a file's summary, a link's
 * destination. The difference from Tooltip is that this may be hovered *into*
 * — the pointer can leave the trigger, cross the gap, and read the card.
 *
 * Because it only opens on hover, its content must also be reachable another
 * way (clicking the trigger, for instance). A hover card that holds the only
 * route to something is unreachable by keyboard and by touch.
 */
export function HoverCard(props: ComponentProps<typeof KobalteHoverCard>) {
  return <KobalteHoverCard {...props} />
}

export function HoverCardTrigger(props: ComponentProps<typeof KobalteHoverCard.Trigger>) {
  return <KobalteHoverCard.Trigger {...props} />
}

export function HoverCardContent(props: ComponentProps<typeof KobalteHoverCard.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteHoverCard.Portal>
      <KobalteHoverCard.Content
        class={cn(
          overlaySurface,
          'z-(--z-menu) w-64 p-3',
          'origin-(--kb-hover-card-content-transform-origin)',
          'data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95',
          'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          'data-expanded:duration-150 data-closed:duration-100',
          local.class
        )}
        {...rest}
      >
        {local.children}
        <KobalteHoverCard.Arrow class={popoverArrow} />
      </KobalteHoverCard.Content>
    </KobalteHoverCard.Portal>
  )
}
