import { createEffect, createSignal, type JSX } from 'solid-js'
import { FormField } from './field'
import { Input } from '../input/input'

export type NumberFieldProps = {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  integer?: boolean
  onChange: (value: number) => void
  class?: string
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>
}

/**
 * A controlled numeric field that keeps an editable draft while validating
 * range and integer constraints. Invalid drafts are announced and restored
 * to the latest controlled value when focus leaves the input.
 */
export function NumberField(props: NumberFieldProps) {
  const [draft, setDraft] = createSignal(String(props.value))
  const [error, setError] = createSignal('')
  const integer = () => props.integer ?? true

  createEffect(() => {
    setDraft(String(props.value))
  })

  const validate = (raw: string) => {
    if (!raw) return `${props.label} is required.`
    const next = Number(raw)
    if (!Number.isFinite(next)) return `${props.label} must be a valid number.`
    if (integer() && !Number.isInteger(next)) {
      return `${props.label} must be a whole number.`
    }
    if (next < props.min || next > props.max) {
      return `${props.label} must be between ${props.min} and ${props.max}.`
    }
    return ''
  }

  return (
    <FormField label={props.label} hint={props.hint} error={error()} class={props.class}>
      <Input
        type="number"
        value={draft()}
        min={props.min}
        max={props.max}
        step={integer() ? 1 : 'any'}
        required
        onInput={(event) => {
          const raw = event.currentTarget.value
          setDraft(raw)
          const nextError = validate(raw)
          setError(nextError)
          if (!nextError) props.onChange(Number(raw))
        }}
        onBlur={(event) => {
          const nextError = validate(draft())
          if (nextError) {
            setDraft(String(props.value))
            setError('')
          }
          props.onBlur?.(event)
        }}
      />
    </FormField>
  )
}
