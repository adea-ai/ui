import { splitProps, useContext, type ComponentProps, type JSX } from 'solid-js'
import { ActionButton } from '../../composites/action-button'
import { FormFieldContext } from '../../../lib/form-field'
import { InputGroup, InputGroupInput } from './input-group'

export type SecretInputGroupProps = {
  value: string
  disabled: boolean
  onChange: JSX.EventHandler<HTMLInputElement, Event>
  onClear?: () => void
  /**
   * What the clear action does, for this field: its accessible name and its
   * tooltip while enabled ("Clear stored token", "Clear Google token path").
   * Defaults to "Clear API key".
   */
  clearLabel?: string
  /**
   * Why the clear action is unavailable, shown as its tooltip while the group is
   * `disabled`. Defaults to the policy message, so name the real reason when a
   * field is disabled for another one ("Set a token variable first").
   */
  disabledReason?: string
  class?: string
} & Pick<ComponentProps<'input'>, 'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid'>

/**
 * A password input with an optional keyboard-accessible clear action.
 *
 * The wording is the caller's: inside a `FormField` the input takes the field's
 * label, outside one it needs `aria-label` (the fallback names an API key), and
 * `clearLabel` and `disabledReason` name the clear action for the field it
 * belongs to, so a bearer token or a token path is not announced as an API key.
 */
export function SecretInputGroup(props: SecretInputGroupProps) {
  const field = useContext(FormFieldContext)
  const [local, rest] = splitProps(props, [
    'value',
    'disabled',
    'onChange',
    'onClear',
    'clearLabel',
    'disabledReason',
    'aria-label',
    'class',
  ])

  const input = (
    <InputGroupInput
      {...rest}
      aria-label={local['aria-label'] ?? (field ? undefined : 'New API key')}
      type="password"
      autocomplete="new-password"
      value={local.value}
      disabled={local.disabled}
      onInput={local.onChange}
    />
  )

  if (!local.onClear) return <InputGroup class={local.class}>{input}</InputGroup>

  return (
    <InputGroup class={local.class}>
      {input}
      <ActionButton
        data-slot="input-group-button"
        variant="ghost"
        size="xs"
        class="-me-1 h-6 min-w-0 shrink-0 px-2"
        disabled={local.disabled}
        tooltip={
          local.disabled
            ? (local.disabledReason ?? 'This API key is managed by policy')
            : (local.clearLabel ?? 'Clear API key')
        }
        tooltipSide="top"
        aria-label={local.clearLabel ?? 'Clear API key'}
        onClick={() => local.onClear?.()}
      >
        Clear
      </ActionButton>
    </InputGroup>
  )
}
