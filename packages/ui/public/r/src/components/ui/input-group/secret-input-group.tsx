import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip/tooltip'
import { InputGroup, InputGroupButton, InputGroupInput } from './input-group'

export type SecretInputGroupProps = {
  value: string
  disabled: boolean
  onChange: JSX.EventHandler<HTMLInputElement, Event>
  onClear?: () => void
  class?: string
} & Pick<ComponentProps<'input'>, 'id' | 'aria-label' | 'aria-describedby' | 'aria-invalid'>

/** A password input with an optional keyboard-accessible clear action. */
export function SecretInputGroup(props: SecretInputGroupProps) {
  const [local, rest] = splitProps(props, [
    'value',
    'disabled',
    'onChange',
    'onClear',
    'aria-label',
    'class',
  ])

  return (
    <InputGroup class={local.class}>
      <InputGroupInput
        {...rest}
        aria-label={local['aria-label'] ?? 'New API key'}
        type="password"
        autocomplete="new-password"
        value={local.value}
        disabled={local.disabled}
        onInput={local.onChange}
      />
      <Show when={local.onClear}>
        <Tooltip openDelay={0}>
          <TooltipTrigger as={InputGroupButton} onClick={() => local.onClear?.()}>
            Clear
          </TooltipTrigger>
          <TooltipContent>Clear API key</TooltipContent>
        </Tooltip>
      </Show>
    </InputGroup>
  )
}
