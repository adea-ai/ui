import DrawerPrimitive from '@corvu/drawer'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Drawer.
 *
 * A sheet the user can drag away: it opens from an edge, carries a handle, and
 * closes by swipe as well as by button. That drag affordance is the reason to
 * choose it over Sheet — the gesture is for content the user is *finishing*
 * with (a summary, a queue, a confirmation), not for browsing.
 *
 * On a large window a Drawer is usually the wrong control: dragging is a touch
 * idiom, and on a desktop the same content is better as a Sheet or a Dialog.
 * The exceptions are the surfaces a pointer also drags naturally — a bottom
 * console, a media panel.
 *
 * corvu supplies the drag physics, the snap points and the pointer capture.
 */
export function Drawer(props: ComponentProps<typeof DrawerPrimitive>) {
  return <DrawerPrimitive {...props} />
}

export function DrawerTrigger(props: ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger {...props} />
}

export function DrawerOverlay(props: ComponentProps<typeof DrawerPrimitive.Overlay>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <DrawerPrimitive.Overlay
      class={cn(
        'fixed inset-0 z-(--z-drawer) bg-scrim/50',
        'data-[open]:animate-in data-[open]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0',
        local.class
      )}
      {...rest}
    />
  )
}

export type DrawerContentProps = ComponentProps<typeof DrawerPrimitive.Content> & {
  /**
   * Draw the grabber at the leading edge of the sheet.
   *
   * It is an affordance, not the drag target: corvu makes the whole sheet
   * draggable, exactly as the platform's own sheets behave. So this is
   * `aria-hidden` decoration that tells the user the sheet can be pulled — it
   * carries no behaviour and must not be the only thing that moves.
   */
  withHandle?: boolean
}

export function DrawerContent(props: DrawerContentProps) {
  const [local, rest] = splitProps(props, ['class', 'withHandle', 'children'])

  return (
    <DrawerPrimitive.Portal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        class={cn(
          'group/drawer bg-popover text-popover-foreground fixed z-(--z-drawer) flex flex-col border-border shadow-lg',
          'data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:max-h-[85vh] data-[side=bottom]:rounded-t-xl data-[side=bottom]:border-t',
          'data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:max-h-[85vh] data-[side=top]:rounded-b-xl data-[side=top]:border-b',
          'data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:w-80 data-[side=left]:rounded-e-xl data-[side=left]:border-e',
          'data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-80 data-[side=right]:rounded-s-xl data-[side=right]:border-s',
          local.class
        )}
        {...rest}
      >
        {local.withHandle ? (
          <span
            aria-hidden="true"
            class={cn(
              'bg-muted shrink-0 self-center',
              'group-data-[side=bottom]/drawer:mt-2 group-data-[side=bottom]/drawer:h-1.5 group-data-[side=bottom]/drawer:w-10 group-data-[side=bottom]/drawer:rounded-full'
            )}
          />
        ) : null}
        {local.children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  )
}

export function DrawerTitle(props: ComponentProps<typeof DrawerPrimitive.Label>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <DrawerPrimitive.Label
      class={cn('text-base leading-none font-semibold tracking-tight', local.class)}
      {...rest}
    />
  )
}

export function DrawerDescription(props: ComponentProps<typeof DrawerPrimitive.Description>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <DrawerPrimitive.Description
      class={cn('text-muted-foreground text-sm', local.class)}
      {...rest}
    />
  )
}

export function DrawerCloseButton(props: ComponentProps<typeof DrawerPrimitive.Close>) {
  const [local, rest] = splitProps(props, ['class'])
  return <DrawerPrimitive.Close class={cn('focus-ring', local.class)} {...rest} />
}

export function DrawerHeader(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="drawer-header"
      class={cn('flex flex-col gap-1.5 p-5 pb-3 text-start', local.class)}
      {...rest}
    />
  )
}

export function DrawerBody(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="drawer-body"
      class={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-4', local.class)}
      {...rest}
    />
  )
}

export function DrawerFooter(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="drawer-footer"
      class={cn('flex flex-col-reverse gap-2 p-5 pt-3 sm:flex-row sm:justify-end', local.class)}
      {...rest}
    />
  )
}
