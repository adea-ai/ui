import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../lib/utils'
import { overlaySurface } from '../../lib/overlay'
import { Button } from '../ui/button/button'

export type ComposerMenuProps = ComponentProps<'div'> & {
  /** A name for what the menu offers, e.g. "Mention an Agent". */
  label?: string
}

/**
 * ComposerMenu.
 *
 * The panel a composer raises above the field: mention suggestions while the
 * reader types a name, the picker of what can be attached, follow-up prompts.
 * It is deliberately *not* a `Menu`: there is no trigger and no focus trap —
 * the reader keeps typing while it is open, and it opens and closes on the
 * draft's own grammar rather than on a button press.
 *
 * Rows are `ComposerMenuItem`s; anything else a caller renders (a checkbox
 * list, a heading) sits inside the same panel. Placement stays with the host —
 * a suggestion menu renders in the composer's `menu` slot, a picker anchors to
 * its own control.
 */
export function ComposerMenu(props: ComposerMenuProps) {
  const [local, rest] = splitProps(props, ['class', 'label', 'children'])

  return (
    <div
      role="group"
      aria-label={local.label}
      data-slot="composer-menu"
      class={cn(
        overlaySurface,
        'flex max-h-56 min-w-60 flex-col gap-0.5 overflow-y-auto p-1',
        local.class
      )}
      {...rest}
    >
      {local.children}
    </div>
  )
}

export type ComposerMenuItemProps = ComponentProps<typeof Button>

/**
 * ComposerMenuItem.
 *
 * One row of a `ComposerMenu`. A ghost button stretched across the panel —
 * the same row every menu in the library draws, so a suggestion never reads as
 * a stray button floating over the draft.
 */
export function ComposerMenuItem(props: ComposerMenuItemProps) {
  const [local, rest] = splitProps(props, ['class', 'children'])

  return (
    <Button
      variant="ghost"
      class={cn('w-full justify-start gap-2 text-start font-normal', local.class)}
      {...rest}
    >
      {local.children}
    </Button>
  )
}
