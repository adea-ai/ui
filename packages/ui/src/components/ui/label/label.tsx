import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '#lib/utils'

/**
 * Label.
 *
 * A plain `<label>` rather than a Kobalte control. Kobalte has no standalone
 * label primitive — its labels are parts of `TextField`, `Checkbox` and
 * friends, and those parts carry the association wiring for *their* control.
 * A free-standing label has to be the real element so the browser's native
 * `for` → control association, click-to-focus, and `aria-labelledby` all keep
 * working.
 *
 * Use the compound controls' own labels (`Switch.Label`, `Checkbox.Label`) when
 * the label belongs to one of them; use this one for an `Input` or `Textarea`,
 * which are plain elements with no wrapper.
 */
export function Label(props: ComponentProps<'label'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <label
      data-slot="label"
      class={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none',
        /* A label inside a disabled group is part of a dead control and must
           not offer a pointer that does nothing. */
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        local.class
      )}
      {...rest}
    />
  )
}
