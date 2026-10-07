import { createUniqueId, For, Show, splitProps } from 'solid-js'
import { useFormFieldControl } from '../../../lib/form-field'
import { InputControl, type InputControlProps } from './input-control'

/**
 * Input.
 *
 * Deliberately a plain `<input>` rather than a Kobalte TextField part. The
 * styling contract is what a consumer needs from an input; validation,
 * description and error wiring come from `Field`, which composes this. Keeping
 * them separate is what lets an input sit inside a custom control without
 * inheriting a form's ARIA graph.
 *
 * Height comes from the control tokens (`size`, `md` by default); an input
 * cannot be given a height off that ladder, which is what keeps it aligned
 * with Button and Select.
 */
export type InputProps = InputControlProps & {
  /** Native text suggestions; custom values remain valid and submit unchanged. */
  suggestions?: readonly string[]
}

export function Input(props: InputProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'type',
    'id',
    'list',
    'suggestions',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'aria-invalid',
    'aria-errormessage',
  ])
  const field = useFormFieldControl('control', {
    id: local.id,
    'aria-label': local['aria-label'],
    'aria-labelledby': local['aria-labelledby'],
    'aria-describedby': local['aria-describedby'],
    'aria-invalid': local['aria-invalid'],
    'aria-errormessage': local['aria-errormessage'],
  })
  const suggestionsId = createUniqueId()
  const listId = () => local.list ?? `input-suggestions-${suggestionsId}`

  return (
    <>
      <InputControl
        {...rest}
        class={local.class}
        type={local.type}
        id={field?.id ?? local.id}
        list={local.suggestions ? listId() : local.list}
        aria-label={local['aria-label']}
        aria-labelledby={field?.['aria-labelledby'] ?? local['aria-labelledby']}
        aria-describedby={field?.['aria-describedby'] ?? local['aria-describedby']}
        aria-invalid={field?.['aria-invalid'] ?? local['aria-invalid']}
        aria-errormessage={field?.['aria-errormessage'] ?? local['aria-errormessage']}
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
