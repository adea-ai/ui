import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Kbd.
 *
 * A keyboard key, in the order the user presses them. The element is a real
 * `<kbd>` so the semantics survive copy-paste, and the mono face is what makes
 * a shortcut visually distinct from the sentence around it.
 *
 * `KbdGroup` exists because a shortcut is a sequence: typing `⌘` then `K`
 * needs a gap between them that is a layout concern, not punctuation.
 */
export function Kbd(props: ComponentProps<'kbd'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <kbd
      data-slot="kbd"
      class={cn(
        'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm border border-border px-1 font-mono text-2xs font-medium select-none',
        /* Inside a hover/selected row the key needs to recede with the row. */
        'in-data-[slot=br-tooltip-content]:bg-background/20 in-data-[slot=br-tooltip-content]:text-scrim-foreground in-data-[slot=br-tooltip-content]:border-transparent',
        local.class
      )}
      {...rest}
    />
  )
}

export function KbdGroup(props: ComponentProps<'span'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <span
      data-slot="kbd-group"
      class={cn('inline-flex items-center gap-1', local.class)}
      {...rest}
    />
  )
}
