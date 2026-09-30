import type { ComponentProps } from 'solid-js'
import { createUniqueId, For, Show, splitProps } from 'solid-js'
import { InputControl } from './input-control'

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
  const [local, rest] = splitProps(props, ['list', 'suggestions'])
  const suggestionsId = createUniqueId()
  const listId = () => local.list ?? `input-suggestions-${suggestionsId}`

  return (
    <>
      <InputControl {...rest} list={local.suggestions ? listId() : local.list} />
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
