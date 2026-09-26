import { Menubar as KobalteMenubar } from '@kobalte/core/menubar'
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
  popoverArrow,
} from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

/**
 * Menubar.
 *
 * A persistent row of menus at the top of a surface — the desktop application
 * pattern. Each trigger opens its own menu, and the arrow keys move *between*
 * menus once one is open, which is what makes a menubar a single control rather
 * than five menus that happen to be adjacent.
 *
 * This is for a window-level command surface. For actions on one thing, use
 * DropdownMenu; a menubar on a row would be a menu pretending to be chrome.
 */
export function Menubar(props: ComponentProps<typeof KobalteMenubar>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteMenubar
      class={cn(
        'flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5',
        local.class
      )}
      {...rest}
    />
  )
}

/**
 * One top-level menu: a trigger and the panel it opens.
 *
 * Required, and the reason the component is not just a row of triggers — the
 * menubar's arrow keys move *between* menus, which only works when each trigger
 * belongs to a menu the bar knows about. `value` names it.
 */
export function MenubarMenu(props: ComponentProps<typeof KobalteMenubar.Menu>) {
  return <KobalteMenubar.Menu {...props} />
}

export function MenubarTrigger(props: ComponentProps<typeof KobalteMenubar.Trigger>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteMenubar.Trigger
      class={cn(
        'flex items-center rounded-sm px-2 py-1 text-sm font-medium select-none',
        'transition-colors ease-out outline-none',
        'data-[expanded]:bg-surface-active',
        'data-[highlighted]:bg-surface-hover',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        local.class
      )}
      {...rest}
    />
  )
}

export function MenubarContent(props: ComponentProps<typeof KobalteMenubar.Content>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <KobalteMenubar.Portal>
      <KobalteMenubar.Content
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[10rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      >
        <KobalteMenubar.Arrow aria-hidden="true" class={popoverArrow} />
        {local.children}
      </KobalteMenubar.Content>
    </KobalteMenubar.Portal>
  )
}

export function MenubarItem(
  props: ComponentProps<typeof KobalteMenubar.Item> & {
    variant?: 'default' | 'destructive'
    shortcut?: string
  }
) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'shortcut', 'children'])
  return (
    <KobalteMenubar.Item
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
    </KobalteMenubar.Item>
  )
}

export function MenubarCheckboxItem(props: ComponentProps<typeof KobalteMenubar.CheckboxItem>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <KobalteMenubar.CheckboxItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteMenubar.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Check class="size-4" />
      </KobalteMenubar.ItemIndicator>
    </KobalteMenubar.CheckboxItem>
  )
}

export function MenubarRadioGroup(props: ComponentProps<typeof KobalteMenubar.RadioGroup>) {
  return <KobalteMenubar.RadioGroup {...props} />
}

export function MenubarRadioItem(props: ComponentProps<typeof KobalteMenubar.RadioItem>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <KobalteMenubar.RadioItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteMenubar.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Circle class="size-2 fill-current" />
      </KobalteMenubar.ItemIndicator>
    </KobalteMenubar.RadioItem>
  )
}

export function MenubarLabel(props: ComponentProps<typeof KobalteMenubar.GroupLabel>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteMenubar.GroupLabel class={cn(menuLabel, local.class)} {...rest} />
}

export function MenubarGroup(props: ComponentProps<typeof KobalteMenubar.Group>) {
  return <KobalteMenubar.Group {...props} />
}

export function MenubarSeparator(props: ComponentProps<typeof KobalteMenubar.Separator>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteMenubar.Separator class={cn(menuSeparator, local.class)} {...rest} />
}

export function MenubarSub(props: ComponentProps<typeof KobalteMenubar.Sub>) {
  return <KobalteMenubar.Sub {...props} />
}

export function MenubarSubTrigger(props: ComponentProps<typeof KobalteMenubar.SubTrigger>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <KobalteMenubar.SubTrigger class={cn(menuItem, local.class)} {...rest}>
      {local.children}
      <ChevronRight class="ms-auto size-4" />
    </KobalteMenubar.SubTrigger>
  )
}

export function MenubarSubContent(props: ComponentProps<typeof KobalteMenubar.SubContent>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <KobalteMenubar.Portal>
      <KobalteMenubar.SubContent
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[8rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      />
    </KobalteMenubar.Portal>
  )
}
