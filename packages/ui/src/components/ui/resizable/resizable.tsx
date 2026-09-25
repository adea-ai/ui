import Resizable from '@corvu/resizable'
import { GripVertical } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Resizable.
 *
 * A split layout: panels the user can resize, with a handle between them. This
 * is the shape of every IDE-like surface — rail, file tree, editor, terminal —
 * and the reason it is a primitive rather than something each view improvises.
 *
 * corvu supplies the pointer capture, the min/max constraints and the keyboard
 * resizing, which is what makes a divider operable without a mouse. The handle
 * is a real focusable element with an accessible role, so a split pane can be
 * adjusted from the keyboard; a bare `cursor-col-resize` div cannot.
 */
export function ResizablePanelGroup(props: ComponentProps<typeof Resizable> & { class?: string }) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <Resizable
      class={cn('flex size-full data-[orientation=vertical]:flex-col', local.class)}
      {...rest}
    />
  )
}

export function ResizablePanel(props: ComponentProps<typeof Resizable.Panel> & { class?: string }) {
  const [local, rest] = splitProps(props, ['class'])
  return <Resizable.Panel class={cn('min-h-0 min-w-0 overflow-hidden', local.class)} {...rest} />
}

export type ResizableHandleProps = ComponentProps<typeof Resizable.Handle> & {
  class?: string
  /** Draw a visible grip in the middle of the divider. */
  withHandle?: boolean
}

export function ResizableHandle(props: ResizableHandleProps) {
  const [local, rest] = splitProps(props, ['class', 'withHandle'])

  return (
    <Resizable.Handle
      class={cn(
        'group/resize bg-border relative flex w-px shrink-0 items-center justify-center',
        /* Widen the hit target without moving the visual line: the divider is
           a hairline, but a hairline is far too small to grab. */
        'after:absolute after:inset-y-0 after:-inset-x-1 after:w-3',
        'transition-colors ease-out hover:bg-primary',
        'focus-visible:bg-primary focus-visible:outline-none',
        'data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full',
        'data-[orientation=vertical]:after:inset-x-0 data-[orientation=vertical]:after:-inset-y-1 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full',
        local.class
      )}
      {...rest}
    >
      {local.withHandle ? (
        <div class="bg-border z-(--z-docked) flex h-4 w-2.5 items-center justify-center rounded-sm border border-border">
          <GripVertical class="size-2.5 text-muted-foreground" />
        </div>
      ) : null}
    </Resizable.Handle>
  )
}
