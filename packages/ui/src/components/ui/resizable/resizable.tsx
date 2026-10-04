import Resizable from '@corvu/resizable'
import { GripVertical } from 'lucide-solid'
import type { ComponentProps } from 'solid-js'
import { createContext, splitProps, useContext } from 'solid-js'
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
/**
 * Whether the group was given `initialSizes` or controlled `sizes`. Those are corvu's to apply, and a
 * panel's own `initialSize` overrides them — so an unsized panel must not invent
 * one when the group already has an answer.
 */
const GroupSizesContext = createContext<() => boolean>(() => false)

export function ResizablePanelGroup(props: ComponentProps<typeof Resizable> & { class?: string }) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <GroupSizesContext.Provider
      value={() => rest.initialSizes !== undefined || rest.sizes !== undefined}
    >
      <Resizable
        class={cn('flex size-full data-[orientation=vertical]:flex-col', local.class)}
        {...rest}
      />
    </GroupSizesContext.Provider>
  )
}

/**
 * The size an unsized panel registers with: whatever its earlier siblings left.
 *
 * corvu registers a panel without `initialSize` at a flat 50%, so `0.28` beside
 * an unsized panel summed to 78% and left a gap. Panels register in document
 * order, so at registration `sizes` holds exactly the panels before this one.
 * When nothing is left — a second unsized panel — it takes an equal share, and
 * corvu shrinks the earlier panels by that share to keep the total at 100%.
 */
function remainingSize(sizes: readonly number[]): number {
  const left = 1 - sizes.reduce((total, size) => total + size, 0)
  return left > 0.001 ? left : 1 / (sizes.length + 1)
}

export function ResizablePanel(props: ComponentProps<typeof Resizable.Panel> & { class?: string }) {
  const [local, rest] = splitProps(props, ['class', 'initialSize'])
  const group = Resizable.useContext(rest.contextId)
  const groupHasSizes = useContext(GroupSizesContext)

  return (
    <Resizable.Panel
      initialSize={
        local.initialSize ?? (groupHasSizes() ? undefined : remainingSize(group.sizes()))
      }
      class={cn('min-h-0 min-w-0 overflow-hidden', local.class)}
      {...rest}
    />
  )
}

export type ResizableHandleProps = ComponentProps<typeof Resizable.Handle> & {
  class?: string
  /** Draw a visible grip in the middle of the divider. */
  withHandle?: boolean
  /**
   * The divider's accessible name. It is a focusable control — arrow keys move
   * the split — so it needs one; without it a screen reader announces an
   * unlabelled button between the two panels.
   */
  label?: string
}

export function ResizableHandle(props: ResizableHandleProps) {
  const [local, rest] = splitProps(props, ['class', 'withHandle', 'label'])
  const group = Resizable.useContext(rest.contextId)

  return (
    <Resizable.Handle
      aria-label={local.label ?? 'Resize panels'}
      // A separator's orientation is the line's own, which runs across the
      // group: a row of panels is divided by a vertical line, a column by a
      // horizontal one. corvu reports the group's orientation instead.
      aria-orientation={group.orientation() === 'horizontal' ? 'vertical' : 'horizontal'}
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
