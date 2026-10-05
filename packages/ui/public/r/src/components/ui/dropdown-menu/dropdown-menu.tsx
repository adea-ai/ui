import { DropdownMenu as KobalteDropdownMenu } from '@kobalte/core/dropdown-menu'
import { Check, ChevronRight, Circle } from 'lucide-solid'
import type { Accessor, ComponentProps } from 'solid-js'
import { createContext, Show, splitProps, useContext } from 'solid-js'
import {
  menuContentPadding,
  destructiveMenuItem,
  menuItem,
  menuLabel,
  menuSwatchTone,
  type MenuSwatchTone,
  menuSeparator,
  overlayMotion,
  overlaySurface,
  popoverArrow,
  topLayerProps,
} from '../../../lib/overlay'
import { cn } from '../../../lib/utils'

type MenuOrientation = 'horizontal' | 'vertical'
const DropdownMenuOrientationContext = createContext<Accessor<MenuOrientation | undefined>>()
type HandlerEvent<Handler> = Handler extends (...args: infer Arguments) => void
  ? Arguments[0]
  : never
type DropdownMenuTriggerKeyEvent = HandlerEvent<
  NonNullable<ComponentProps<typeof KobalteDropdownMenu.Trigger>['onKeyDown']>
>
type DropdownMenuTriggerPointerEvent = HandlerEvent<
  NonNullable<ComponentProps<typeof KobalteDropdownMenu.Trigger>['onPointerDown']>
>

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
  const [local, rest] = splitProps(props, ['modal', 'orientation'])
  const orientation = () => local.orientation
  return (
    <DropdownMenuOrientationContext.Provider value={orientation}>
      <KobalteDropdownMenu modal={local.modal ?? false} orientation={local.orientation} {...rest} />
    </DropdownMenuOrientationContext.Provider>
  )
}

const SCROLLABLE_OVERFLOW = /(auto|scroll)/
const OVERFLOW_PROPERTIES = ['overflow', 'overflow-x', 'overflow-y'] as const

type OverflowProperty = (typeof OVERFLOW_PROPERTIES)[number]
type OverflowDeclaration = Readonly<{
  property: OverflowProperty
  value: string
  priority: string
}>

function readInlineOverflow(element: HTMLElement): OverflowDeclaration[] {
  return OVERFLOW_PROPERTIES.map((property) => ({
    property,
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  }))
}

function declarationsMatch(element: HTMLElement, declarations: OverflowDeclaration[]) {
  return declarations.every(
    ({ property, value, priority }) =>
      element.style.getPropertyValue(property) === value &&
      element.style.getPropertyPriority(property) === priority
  )
}

function bypassUnboundedScrollLookup(trigger: HTMLElement) {
  const scrollRoot = document.scrollingElement ?? document.documentElement
  if (window.getComputedStyle(scrollRoot).overflow !== 'hidden') return

  const temporaryStyles: Array<{
    element: HTMLElement
    original: OverflowDeclaration[]
    applied: OverflowDeclaration[]
  }> = []

  for (let element: HTMLElement | null = trigger; element;) {
    const parent: HTMLElement | null = element.parentElement
    if (element !== scrollRoot) {
      const computed = window.getComputedStyle(element)
      const overflow = `${computed.overflow} ${computed.overflowX} ${computed.overflowY}`
      if (SCROLLABLE_OVERFLOW.test(overflow)) {
        const original = readInlineOverflow(element)
        element.style.setProperty('overflow', 'clip', 'important')
        temporaryStyles.push({ element, original, applied: readInlineOverflow(element) })
      }
    }
    element = parent
  }

  if (temporaryStyles.length === 0) return

  // Kobalte's keyboard path synchronously walks scroll parents before it opens
  // the menu. Clipping only non-root scroll ancestors makes that walk stop at
  // the locked viewport. Restore those declarations once the event handler
  // finishes, and leave any newer owner write untouched.
  queueMicrotask(() => {
    for (const { element, original, applied } of temporaryStyles) {
      if (!element.isConnected || !declarationsMatch(element, applied)) continue
      for (const property of OVERFLOW_PROPERTIES) element.style.removeProperty(property)
      for (const { property, value, priority } of original) {
        if (value) element.style.setProperty(property, value, priority)
      }
    }
  })
}

export function DropdownMenuTrigger(props: ComponentProps<typeof KobalteDropdownMenu.Trigger>) {
  const inheritedOrientation = useContext(DropdownMenuOrientationContext)
  const [local, rest] = splitProps(props, ['disabled', 'onKeyDown', 'onPointerDown'])
  const onPointerDown = (event: DropdownMenuTriggerPointerEvent) => {
    if (typeof local.onPointerDown === 'function') local.onPointerDown(event)
    else if (local.onPointerDown) local.onPointerDown[0](local.onPointerDown[1], event)

    // WebKit can leave focus on a previous control when a native button gets
    // a pointer click. Focus the trigger before Kobalte opens the menu so an
    // enclosing modal focus scope does not restore focus and dismiss the menu.
    if (
      local.disabled ||
      event.defaultPrevented ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return
    }
    const trigger = event.currentTarget
    const isNativeLink = trigger instanceof HTMLAnchorElement && trigger.hasAttribute('href')
    if (trigger instanceof HTMLElement && !isNativeLink) {
      trigger.focus({ preventScroll: true })
      // Focusing first is not enough in WebKit: the press's default mousedown
      // action runs afterwards and moves focus off a button to the nearest
      // focusable ancestor — inside a dialog, the dialog — so the menu that
      // just opened still reads focus leaving it and closes. Cancelling the
      // default keeps focus where it was put.
      if (event.pointerType !== 'touch') event.preventDefault()
    }
  }
  const onKeyDown = (event: DropdownMenuTriggerKeyEvent) => {
    // Kobalte's MenuTrigger does not consult defaultPrevented before its own
    // open-key handling. Preserve its existing callback behavior; this wrapper
    // only makes the pre-open scroll-parent lookup terminate.
    if (typeof local.onKeyDown === 'function') local.onKeyDown(event)
    else if (local.onKeyDown) local.onKeyDown[0](local.onKeyDown[1], event)

    if (local.disabled) return
    const trigger = event.currentTarget
    if (!(trigger instanceof HTMLElement)) return
    const menubarOrientation = trigger.closest('[role="menubar"]')?.getAttribute('aria-orientation')
    const orientation =
      inheritedOrientation?.() ?? (menubarOrientation === 'vertical' ? 'vertical' : 'horizontal')
    const openingArrow = orientation === 'horizontal' ? 'ArrowDown' : 'ArrowRight'
    if (!['Enter', ' ', openingArrow].includes(event.key)) return
    const isNativeLink = trigger instanceof HTMLAnchorElement && trigger.hasAttribute('href')
    if (isNativeLink && (event.key === 'Enter' || event.key === ' ')) return
    bypassUnboundedScrollLookup(trigger)
  }

  return (
    <KobalteDropdownMenu.Trigger
      {...rest}
      disabled={local.disabled}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}

export function DropdownMenuPortal(props: ComponentProps<typeof KobalteDropdownMenu.Portal>) {
  return <KobalteDropdownMenu.Portal {...props} />
}

export type DropdownMenuContentProps = ComponentProps<typeof KobalteDropdownMenu.Content> & {
  /**
   * Kept for callers that hid the arrow explicitly; the arrow is now hidden by
   * default. Pass `false` to draw one. The default flipped because Kobalte
   * reserves half of the arrow's 30px box as popper gutter — a menu anchored to
   * its trigger floated 15px off it, which read as a gap rather than as a
   * pointer, and every anchored caller already passed `hideArrow`.
   */
  hideArrow?: boolean
  /** Mount under an owner element such as a modal, keeping the menu in its accessible subtree. */
  portalMount?: HTMLElement
}

export function DropdownMenuContent(props: DropdownMenuContentProps) {
  const [local, rest] = splitProps(props, ['class', 'hideArrow', 'children', 'portalMount'])

  return (
    <KobalteDropdownMenu.Portal mount={local.portalMount}>
      <KobalteDropdownMenu.Content
        {...topLayerProps}
        class={cn(
          overlaySurface,
          overlayMotion,
          'z-(--z-menu) min-w-[10rem] origin-(--kb-menu-content-transform-origin) overflow-hidden',
          menuContentPadding,
          local.class
        )}
        {...rest}
      >
        {local.hideArrow === false && (
          /* Rendered only when a caller asks for it back: the popper folds half
             the arrow's box into the content's gutter, so an arrow and a flush
             menu have never been true at once. */
          <KobalteDropdownMenu.Arrow aria-hidden="true" class={popoverArrow} />
        )}
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
    /** Draw a leading colour dot from the shared tone ladder — the accent or
     * status role the option's card badge carries. `aria-hidden`; the label
     * carries the meaning. */
    swatch?: MenuSwatchTone
  }
) {
  const [local, rest] = splitProps(props, [
    'class',
    'variant',
    'shortcut',
    'keyshortcuts',
    'swatch',
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
      <Show when={local.swatch}>
        <span aria-hidden="true" class={menuSwatchTone({ tone: local.swatch })} />
      </Show>
      {local.children}
      {local.shortcut ? (
        <span
          aria-hidden="true"
          class="text-muted-foreground ms-auto font-code text-code tracking-widest"
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
      class={cn('text-muted-foreground ms-auto font-code text-code tracking-widest', local.class)}
      {...rest}
    />
  )
}

export function DropdownMenuCheckboxItem(
  props: ComponentProps<typeof KobalteDropdownMenu.CheckboxItem> & {
    /** Draw a leading colour dot from the shared tone ladder. `aria-hidden`;
     * the label carries the meaning. */
    swatch?: MenuSwatchTone
  }
) {
  const [local, rest] = splitProps(props, ['class', 'swatch', 'children'])

  return (
    <KobalteDropdownMenu.CheckboxItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      <Show when={local.swatch}>
        <span aria-hidden="true" class={menuSwatchTone({ tone: local.swatch })} />
      </Show>
      {local.children}
      <KobalteDropdownMenu.ItemIndicator
        data-slot="dropdown-menu-indicator"
        class="absolute end-2 flex size-4 items-center justify-center text-primary"
      >
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

export function DropdownMenuRadioItem(
  props: ComponentProps<typeof KobalteDropdownMenu.RadioItem> & {
    /** Draw a leading colour dot from the shared tone ladder. `aria-hidden`;
     * the label carries the meaning. */
    swatch?: MenuSwatchTone
  }
) {
  const [local, rest] = splitProps(props, ['class', 'swatch', 'children'])

  return (
    <KobalteDropdownMenu.RadioItem class={cn(menuItem, 'pe-8', local.class)} {...rest}>
      <Show when={local.swatch}>
        <span aria-hidden="true" class={menuSwatchTone({ tone: local.swatch })} />
      </Show>
      {local.children}
      {/* The indicator reads in the accent, like every other selected state in
          the system — a canvas-colored dot on a checked row reads as decoration. */}
      <KobalteDropdownMenu.ItemIndicator
        data-slot="dropdown-menu-indicator"
        class="absolute end-2 flex size-4 items-center justify-center text-primary"
      >
        <Circle class="size-2 fill-current" />
      </KobalteDropdownMenu.ItemIndicator>
    </KobalteDropdownMenu.RadioItem>
  )
}

/**
 * The caption of a `DropdownMenuGroup`, and that group's accessible name. It must be a
 * child of the group it names: Kobalte reads the group from context, so a label
 * placed directly in the content throws `useMenuGroupContext must be used within
 * a Menu.Group` the moment the menu opens. For an ungrouped caption, wrap the
 * label and its items in a group anyway — the grouping is what a screen reader
 * announces.
 */
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
        {...topLayerProps}
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
