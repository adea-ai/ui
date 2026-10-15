import { createEffect, createSignal, type JSX } from 'solid-js'
import { FormField } from './field'
import { Input } from '../input/input'

export type NumberFieldProps = {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  /**
   * The increment of the spinner and the arrow keys, and the grid a typed value
   * must sit on: `min` plus a whole number of steps. Use it for stepped or
   * fractional values (`0.05` for a 0-1 score, `5` for a percentage in fives).
   * Without it a field steps by 1, or by `any` when `integer` is `false`, which
   * accepts every decimal but leaves the spinner moving in whole numbers.
   */
  step?: number
  /**
   * Whether only whole numbers are valid. It defaults to `true`, or, when a
   * `step` is given, to whether both the step and its base `min` are whole
   * numbers, so `step={0.05}` accepts decimals without also saying
   * `integer={false}`, and `min={0.5} step={1}` accepts 0.5, 1.5, 2.5.
   */
  integer?: boolean
  onChange: (value: number) => void
  class?: string
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>
}

/**
 * A controlled numeric field that keeps an editable draft while validating
 * range, integer and step constraints. Invalid drafts are announced and restored
 * to the latest controlled value when focus leaves the input, so `onChange`
 * only ever receives a value the field accepts — a caller never needs a
 * `Number(value) || fallback` of its own.
 */
export function NumberField(props: NumberFieldProps) {
  const [draft, setDraft] = createSignal(String(props.value))
  const [error, setError] = createSignal('')
  // Whole numbers only when nothing on the grid is fractional: a whole step from
  // a fractional `min` (0.5, 1.5, 2.5) puts the spinner's own values off the
  // integers, so inference needs the step and its base to both be whole.
  const integer = () =>
    props.integer ??
    (props.step === undefined || (Number.isInteger(props.step) && Number.isInteger(props.min)))

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
    if (props.step !== undefined && props.step > 0) {
      // Compare in whole steps with a tolerance: 0.15 / 0.05 is 3.0000000000000004,
      // and rejecting it would make the spinner's own values invalid.
      const steps = (next - props.min) / props.step
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        return props.min === 0
          ? `${props.label} must be a multiple of ${props.step}.`
          : `${props.label} must be ${props.min} plus a multiple of ${props.step}.`
      }
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
        step={props.step ?? (integer() ? 1 : 'any')}
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
