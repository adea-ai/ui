import { Popover as KobaltePopover } from '@kobalte/core/popover'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { menuContentPadding, popoverArrow, popoverMotion, overlaySurface } from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * Popover.
 *
 * A floating surface with arbitrary content, anchored to a control. Use it for
 * something interactive that would not fit in a menu: a small form, a colour
 * picker, a filter panel. For a list of *actions* use DropdownMenu, which
 * carries the menu keyboard contract; for a sentence of explanation use
 * Tooltip, which is not focusable and cannot hold a control.
 *
 * Kobalte handles the anchoring, collision flipping, the focus trap for modal
 * popovers, and dismissal on outside click and Escape.
 */
export function Popover(props: ComponentProps<typeof KobaltePopover>) {
  return <KobaltePopover {...props} />
}

export function PopoverTrigger(props: ComponentProps<typeof KobaltePopover.Trigger>) {
  return <KobaltePopover.Trigger {...props} />
}

export function PopoverAnchor(props: ComponentProps<typeof KobaltePopover.Anchor>) {
  return <KobaltePopover.Anchor {...props} />
}

export type PopoverContentProps = ComponentProps<typeof KobaltePopover.Content> & {
  /** Hide the caret pointing at the trigger. */
  hideArrow?: boolean
}

export function PopoverContent(props: PopoverContentProps) {
  const [local, rest] = splitProps(props, ['class', 'hideArrow', 'children'])

  return (
    <KobaltePopover.Portal>
      <KobaltePopover.Content
        class={cn(
          overlaySurface,
          popoverMotion,
          'z-(--z-menu) w-72 origin-(--kb-popover-content-transform-origin)',
          menuContentPadding,
          local.class
        )}
        {...rest}
      >
        {local.children}
        <KobaltePopover.Arrow aria-hidden="true" class={popoverArrow} />
      </KobaltePopover.Content>
    </KobaltePopover.Portal>
  )
}

export function PopoverTitle(props: ComponentProps<typeof KobaltePopover.Title>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobaltePopover.Title
      class={cn('px-2 pt-1 pb-1.5 text-sm font-medium', local.class)}
      {...rest}
    />
  )
}

export function PopoverDescription(props: ComponentProps<typeof KobaltePopover.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobaltePopover.Description
      class={cn('text-muted-foreground px-2 pb-1.5 text-sm', local.class)}
      {...rest}
    />
  )
}

export function PopoverCloseButton(props: ComponentProps<typeof KobaltePopover.CloseButton>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobaltePopover.CloseButton class={cn(local.class)} {...rest} />
}
