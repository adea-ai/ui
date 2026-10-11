import { splitProps, useContext, type ComponentProps, type JSX } from 'solid-js'
import { buttonVariants } from '../button/button'
import { FormFieldContext } from '#lib/form-field'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip/tooltip'
import { InputGroup, InputGroupInput } from './input-group'
import { cn } from '#lib/utils'

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
    <Tooltip openDelay={0}>
      <InputGroup class={local.class}>
        {input}
        <TooltipTrigger
          as="button"
          type="button"
          class={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), '-me-1 h-6 min-w-0 px-2')}
          disabled={local.disabled}
          aria-label="Clear API key"
          onFocus={(event) =>
            event.currentTarget.setAttribute('data-tooltip-focus-observed', 'true')
          }
          onClick={() => local.onClear?.()}
        >
          Clear
        </TooltipTrigger>
      </InputGroup>
      <TooltipContent>Clear API key</TooltipContent>
    </Tooltip>
  )
}
