import type { ComponentProps } from 'solid-js'
import { createUniqueId, For, Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Input.
 *
 * Deliberately a plain `<input>` rather than a Kobalte TextField part. The
 * styling contract is what a consumer needs from an input; validation,
 * description and error wiring come from `Field`, which composes this. Keeping
 * them separate is what lets an input sit inside a custom control without
 * inheriting a form's ARIA graph.
 *
 * Height comes from `h-control-md`; an input cannot be given a new height
 * without a new token, which is what keeps it aligned with Button and Select.
 */
export type InputProps = ComponentProps<'input'> & {
  /** Native text suggestions; custom values remain valid and submit unchanged. */
  suggestions?: readonly string[]
}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, ['class', 'type', 'list', 'suggestions'])
  const suggestionsId = createUniqueId()
  const listId = () => local.list ?? `input-suggestions-${suggestionsId}`

  return (
    <>
      <input
        data-slot="input"
        type={local.type ?? 'text'}
        list={local.suggestions ? listId() : local.list}
        class={cn(
          'h-control-md w-full min-w-0 rounded-md border border-input bg-transparent px-control-md py-1 text-sm',
          'transition-[color,box-shadow,border-color] ease-out outline-none',
          'placeholder:text-muted-foreground',
          'selection:bg-primary selection:text-primary-foreground',
          'file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          /* A pointer click on a text field is a typing affordance, so the ring
           appears where the user agent already matches :focus-visible. */
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
          'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
          'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          'read-only:bg-surface-hover',
          local.class
        )}
        {...rest}
      />
      <Show when={local.suggestions}>
        {(suggestions) => (
          <datalist id={listId()}>
            <For each={suggestions()}>{(value) => <option value={value} />}</For>
          </datalist>
        )}
      </Show>
    </>
  )
}
