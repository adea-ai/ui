import { splitProps, useContext, type ComponentProps, type JSX } from 'solid-js'
import { ActionButton } from '../../composites/action-button'
import { FormFieldContext } from '../../../lib/form-field'
import { InputGroup, InputGroupInput } from './input-group'

export type SecretInputGroupProps = {
  value: string
  disabled: boolean
  onChange: JSX.EventHandler<HTMLInputElement, Event>
  onClear?: () => void
  class?: string
} & Pick<ComponentProps<'input'>, 'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid'>

/** A password input with an optional keyboard-accessible clear action. */
export function SecretInputGroup(props: SecretInputGroupProps) {
  const field = useContext(FormFieldContext)
  const [local, rest] = splitProps(props, [
    'value',
    'disabled',
    'onChange',
    'onClear',
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
        tooltip="Clear API key"
        tooltipSide="top"
        aria-label="Clear API key"
        onClick={() => local.onClear?.()}
      >
        Clear
      </ActionButton>
    </InputGroup>
  )
}
