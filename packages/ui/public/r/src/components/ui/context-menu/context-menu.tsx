import { ContextMenu as KobalteContextMenu } from '@kobalte/core/context-menu'
import { Check, ChevronRight, Circle } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import {
  menuContentPadding,
  menuItem,
  menuLabel,
  menuSeparator,
  overlayMotion,
  overlaySurface,
} from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * ContextMenu.
 *
 * The same actions as DropdownMenu, opened by right-click. The trigger is the
 * region the menu belongs to — a file row, a canvas, a code block — and the
 * menu opens at the pointer.
 *
 * The accessibility rule for this component is not about its own markup: a
 * context menu must never hold the *only* route to an action, because a
 * right-click is unavailable on touch and undiscoverable on a trackpad. Every
 * item here should also appear somewhere reachable, usually a DropdownMenu on
 * the same row.
 */
export function ContextMenu(props: ComponentProps<typeof KobalteContextMenu>) {
  return <KobalteContextMenu {...props} />
}

export function ContextMenuTrigger(props: ComponentProps<typeof KobalteContextMenu.Trigger>) {
  return <KobalteContextMenu.Trigger {...props} />
}

export function ContextMenuContent(props: ComponentProps<typeof KobalteContextMenu.Content>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteContextMenu.Portal>
      <KobalteContextMenu.Content
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[10rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      />
    </KobalteContextMenu.Portal>
  )
}

export function ContextMenuItem(
  props: ComponentProps<typeof KobalteContextMenu.Item> & {
    variant?: 'default' | 'destructive'
    shortcut?: string
  }
) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'shortcut', 'children'])

  return (
    <KobalteContextMenu.Item
      class={cn(
        menuItem,
        {
          'text-destructive data-[highlighted]:bg-destructive-subtle data-[highlighted]:text-destructive':
            local.variant === 'destructive',
        },
        local.class
      )}
      {...rest}
    >
      {local.children}
      {local.shortcut ? (
        <span class="text-muted-foreground ms-auto font-mono text-2xs tracking-widest">
          {local.shortcut}
        </span>
      ) : null}
    </KobalteContextMenu.Item>
  )
}

export function ContextMenuCheckboxItem(
  props: ComponentProps<typeof KobalteContextMenu.CheckboxItem>
) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteContextMenu.CheckboxItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteContextMenu.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Check class="size-4" />
      </KobalteContextMenu.ItemIndicator>
    </KobalteContextMenu.CheckboxItem>
  )
}

export function ContextMenuRadioGroup(props: ComponentProps<typeof KobalteContextMenu.RadioGroup>) {
  return <KobalteContextMenu.RadioGroup {...props} />
}

export function ContextMenuRadioItem(props: ComponentProps<typeof KobalteContextMenu.RadioItem>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteContextMenu.RadioItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteContextMenu.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Circle class="size-2 fill-current" />
      </KobalteContextMenu.ItemIndicator>
    </KobalteContextMenu.RadioItem>
  )
}

export function ContextMenuLabel(props: ComponentProps<typeof KobalteContextMenu.GroupLabel>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteContextMenu.GroupLabel class={cn(menuLabel, local.class)} {...rest} />
}

export function ContextMenuGroup(props: ComponentProps<typeof KobalteContextMenu.Group>) {
  return <KobalteContextMenu.Group {...props} />
}

export function ContextMenuSeparator(props: ComponentProps<typeof KobalteContextMenu.Separator>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteContextMenu.Separator class={cn(menuSeparator, local.class)} {...rest} />
}

export function ContextMenuSub(props: ComponentProps<typeof KobalteContextMenu.Sub>) {
  return <KobalteContextMenu.Sub {...props} />
}

export function ContextMenuSubTrigger(props: ComponentProps<typeof KobalteContextMenu.SubTrigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteContextMenu.SubTrigger class={cn(menuItem, local.class)} {...rest}>
      {local.children}
      <ChevronRight class="ms-auto size-4" />
    </KobalteContextMenu.SubTrigger>
  )
}

export function ContextMenuSubContent(props: ComponentProps<typeof KobalteContextMenu.SubContent>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteContextMenu.Portal>
      <KobalteContextMenu.SubContent
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[8rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      />
    </KobalteContextMenu.Portal>
  )
}
