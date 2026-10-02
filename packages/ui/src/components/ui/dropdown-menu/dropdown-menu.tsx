import { DropdownMenu as KobalteDropdownMenu } from '@kobalte/core/dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import {
  menuContentPadding,
  destructiveMenuItem,
  menuItem,
  menuLabel,
  menuSeparator,
  overlayMotion,
  overlaySurface,
  popoverArrow,
} from '#lib/overlay'
import { cn } from '#lib/utils'

/**
 * DropdownMenu.
 *
 * A list of actions on a trigger, with radio groups for persistent choices
 * that fit naturally in a compact menu. Use Select for form inputs whose
 * selected value needs the field-style control, and Popover for arbitrary
 * content.
 *
 * Kobalte supplies the full menu contract — arrow keys, typeahead, the roving
 * highlight, Escape to close and return focus — which is exactly what a
 * hand-rolled `div` with click handlers gets wrong.
 * Menus are nonmodal by default so their generated focus guards do not become
 * invalid direct children of the ARIA menu. Set `modal` explicitly when the
 * surrounding interaction needs modal containment.
 *
 * The `destructive` variant marks the row with a status-coloured edge and
 * highlighted tint while keeping its label on the body foreground. Pairing it
 * with an AlertDialog is the caller's job.
 */
export function DropdownMenu(props: ComponentProps<typeof KobalteDropdownMenu>) {
  const [local, rest] = splitProps(props, ['modal'])
  return <KobalteDropdownMenu modal={local.modal ?? false} {...rest} />
}

export function DropdownMenuTrigger(props: ComponentProps<typeof KobalteDropdownMenu.Trigger>) {
  return <KobalteDropdownMenu.Trigger {...props} />
}

export function DropdownMenuPortal(props: ComponentProps<typeof KobalteDropdownMenu.Portal>) {
  return <KobalteDropdownMenu.Portal {...props} />
}

export type DropdownMenuContentProps = ComponentProps<typeof KobalteDropdownMenu.Content> & {
  hideArrow?: boolean
  /** Mount under an owner element such as a modal, keeping the menu in its accessible subtree. */
  portalMount?: HTMLElement
}

export function DropdownMenuContent(props: DropdownMenuContentProps) {
  const [local, rest] = splitProps(props, ['class', 'hideArrow', 'children', 'portalMount'])

  return (
    <KobalteDropdownMenu.Portal mount={local.portalMount}>
      <KobalteDropdownMenu.Content
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[10rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      >
        {!local.hideArrow && <KobalteDropdownMenu.Arrow aria-hidden="true" class={popoverArrow} />}
        {local.children}
      </KobalteDropdownMenu.Content>
    </KobalteDropdownMenu.Portal>
  )
}

export function DropdownMenuItem(
  props: ComponentProps<typeof KobalteDropdownMenu.Item> & {
    /** Colour the row as a destructive action. Confirm it separately. */
    variant?: 'default' | 'destructive'
    /** Draw a shortcut hint at the trailing edge of the row. */
    shortcut?: string
    /**
     * The parseable chord behind `shortcut`, e.g. `Meta+E`. The drawn glyph is
     * `aria-hidden` — reading it out would pollute the item's accessible name —
     * so this is what assistive technology announces instead. Supply it
     * whenever `shortcut` is drawn.
     */
    keyshortcuts?: string
  }
) {
  const [local, rest] = splitProps(props, [
    'class',
    'variant',
    'shortcut',
    'keyshortcuts',
    'children',
  ])

  return (
    <KobalteDropdownMenu.Item
      class={cn(
        menuItem,
        {
          [destructiveMenuItem]: local.variant === 'destructive',
        },
        local.class
      )}
      aria-keyshortcuts={local.keyshortcuts}
      {...rest}
    >
      {local.children}
      {local.shortcut ? (
        <span
          aria-hidden="true"
          class="text-muted-foreground ms-auto font-mono text-2xs tracking-widest"
        >
          {local.shortcut}
        </span>
      ) : null}
    </KobalteDropdownMenu.Item>
  )
}

/**
 * The chord drawn at a row's trailing edge.
 *
 * A component as well as the `shortcut` prop on an item, because a caller composing
 * a row by hand needs the same treatment — and because the alternative is every
 * caller inventing the same mono-and-dimmed span.
 *
 * The glyphs are decorative: the span is `aria-hidden` and the parseable chord
 * belongs in the row's `aria-keyshortcuts`, so the item's accessible name stays
 * exactly its label.
 */
export function DropdownMenuShortcut(props: ComponentProps<'span'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      aria-hidden="true"
      class={cn('text-muted-foreground ms-auto font-mono text-2xs tracking-widest', local.class)}
      {...rest}
    />
  )
}

export function DropdownMenuCheckboxItem(
  props: ComponentProps<typeof KobalteDropdownMenu.CheckboxItem>
) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteDropdownMenu.CheckboxItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteDropdownMenu.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Check class="size-4" />
      </KobalteDropdownMenu.ItemIndicator>
    </KobalteDropdownMenu.CheckboxItem>
  )
}

export function DropdownMenuRadioGroup(
  props: ComponentProps<typeof KobalteDropdownMenu.RadioGroup>
) {
  return <KobalteDropdownMenu.RadioGroup {...props} />
}

export function DropdownMenuRadioItem(props: ComponentProps<typeof KobalteDropdownMenu.RadioItem>) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteDropdownMenu.RadioItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      {local.children}
      <KobalteDropdownMenu.ItemIndicator class="absolute end-2 flex size-4 items-center justify-center">
        <Circle class="size-2 fill-current" />
      </KobalteDropdownMenu.ItemIndicator>
    </KobalteDropdownMenu.RadioItem>
  )
}

export function DropdownMenuLabel(props: ComponentProps<typeof KobalteDropdownMenu.GroupLabel>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDropdownMenu.GroupLabel class={cn(menuLabel, local.class)} {...rest} />
}

export function DropdownMenuGroup(props: ComponentProps<typeof KobalteDropdownMenu.Group>) {
  return <KobalteDropdownMenu.Group {...props} />
}

export function DropdownMenuSeparator(props: ComponentProps<typeof KobalteDropdownMenu.Separator>) {
  const [local, rest] = splitProps(props, ['class'])
  return <KobalteDropdownMenu.Separator class={cn(menuSeparator, local.class)} {...rest} />
}

export function DropdownMenuSub(props: ComponentProps<typeof KobalteDropdownMenu.Sub>) {
  return <KobalteDropdownMenu.Sub {...props} />
}

export function DropdownMenuSubTrigger(
  props: ComponentProps<typeof KobalteDropdownMenu.SubTrigger>
) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <KobalteDropdownMenu.SubTrigger class={cn(menuItem, local.class)} {...rest}>
      {local.children}
      <ChevronRight class="ms-auto size-4" />
    </KobalteDropdownMenu.SubTrigger>
  )
}

export function DropdownMenuSubContent(
  props: ComponentProps<typeof KobalteDropdownMenu.SubContent>
) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <KobalteDropdownMenu.Portal>
      <KobalteDropdownMenu.SubContent
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[8rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      />
    </KobalteDropdownMenu.Portal>
  )
}
