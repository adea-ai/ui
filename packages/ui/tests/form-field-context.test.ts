import { describe, expect, test } from 'bun:test'
import { createRoot, createSignal } from 'solid-js'

import {
  FormFieldContext,
  createFormFieldContext,
  useFormFieldControl,
  type FormFieldContextValue,
} from '../src/lib/form-field'

/**
 * How a field wires its label, hint and error to the control inside it. The wiring is what a
 * screen reader reads, so the ids and the descriptions are the behaviour.
 */
function field(
  options: { group?: boolean; hint?: string; error?: string; controlId?: string } = {}
) {
  const [hint, setHint] = createSignal(options.hint)
  const [error, setError] = createSignal(options.error)
  const [group, setGroup] = createSignal(options.group ?? false)
  const value = createFormFieldContext({
    controlId: options.controlId,
    defaultControlId: 'field-control',
    labelId: 'field-label',
    descriptionId: 'field-hint',
    errorId: 'field-error',
    hint,
    error,
    group,
  })
  return { value, setHint, setError, setGroup }
}

function inside<T>(value: FormFieldContextValue, run: () => T): T {
  return createRoot((dispose) => {
    let result!: T
    FormFieldContext.Provider({
      value,
      get children() {
        result = run()
        return undefined
      },
    })
    dispose()
    return result
  })
}

describe('createFormFieldContext', () => {
  test('a single control gets the default id and is labelled by the field label', () => {
    createRoot((dispose) => {
      const { value } = field()
      expect(value.controlId()).toBe('field-control')
      expect(value.registerControlId()).toBe('field-control')
      expect(value.labelId).toBe('field-label')
      dispose()
    })
  })

  test('a control that brings its own id replaces the default, and the field follows it', () => {
    createRoot((dispose) => {
      const { value } = field()
      expect(value.registerControlId('custom')).toBe('custom')
      expect(value.controlId()).toBe('custom')
      dispose()
    })
  })

  test('an id given to the field is the starting control id', () => {
    createRoot((dispose) => {
      expect(field({ controlId: 'given' }).value.controlId()).toBe('given')
      dispose()
    })
  })

  test('a group has no single control id to hand out', () => {
    createRoot((dispose) => {
      const { value } = field({ group: true })
      expect(value.registerControlId()).toBeUndefined()
      expect(value.registerControlId('radio-a')).toBe('radio-a')
      dispose()
    })
  })

  test('the description names the hint and the error only while they exist', () => {
    createRoot((dispose) => {
      const { value, setHint, setError } = field({ hint: 'Use letters' })
      expect(value.describedBy()).toBe('field-hint')
      expect(value.errorId()).toBeUndefined()
      expect(value.invalid()).toBe(false)

      setError('Too short')
      expect(value.describedBy()).toBe('field-hint field-error')
      expect(value.errorId()).toBe('field-error')
      expect(value.invalid()).toBe(true)

      setHint(undefined)
      expect(value.describedBy()).toBe('field-error')
      setError(undefined)
      expect(value.describedBy()).toBeUndefined()
      dispose()
    })
  })
})

describe('useFormFieldControl', () => {
  test('is null outside a field, so a bare control keeps its own attributes', () => {
    expect(
      createRoot((dispose) => {
        const result = useFormFieldControl('control', { id: 'x' })
        dispose()
        return result
      })
    ).toBeNull()
  })

  test('a control inside a field takes the field id, label and live description', () => {
    const { value, setError } = createRoot(() => field({ hint: 'Hint' }))
    const control = inside(value, () => useFormFieldControl('control', {}))!
    expect(control.id).toBe('field-control')
    expect(control['aria-labelledby']).toBe('field-label')
    expect(control['aria-describedby']).toBe('field-hint')
    expect(control['aria-invalid']).toBeUndefined()
    expect(control['aria-errormessage']).toBeUndefined()

    setError('Required')
    expect(control['aria-describedby']).toBe('field-hint field-error')
    expect(control['aria-invalid']).toBe(true)
    expect(control['aria-errormessage']).toBe('field-error')
  })

  test("merges the control's own description without repeating an id", () => {
    const { value } = createRoot(() => field({ hint: 'Hint' }))
    const control = inside(value, () =>
      useFormFieldControl('control', { 'aria-describedby': 'own field-hint' })
    )!
    expect(control['aria-describedby']).toBe('own field-hint')
  })

  test('an explicit label or invalid state on the control wins over the field', () => {
    const { value } = createRoot(() => field({ error: 'Bad' }))
    const labelled = inside(value, () =>
      useFormFieldControl('control', { 'aria-label': 'Search', 'aria-invalid': false })
    )!
    // The control brought its own accessible name, so the field label is not added on top of it.
    expect(labelled['aria-labelledby']).toBeUndefined()
    expect(labelled['aria-invalid']).toBe(false)

    const named = inside(value, () =>
      useFormFieldControl('control', { 'aria-labelledby': 'mine', 'aria-errormessage': 'e' })
    )!
    expect(named['aria-labelledby']).toBe('mine')
    expect(named['aria-errormessage']).toBe('e')
  })

  test('inside a group, the group is labelled and its members are not given the field id', () => {
    const { value } = createRoot(() => field({ group: true }))
    const group = inside(value, () => useFormFieldControl('group', {}))!
    expect(group.id).toBeUndefined()
    expect(group['aria-labelledby']).toBe('field-label')

    const member = inside(value, () => useFormFieldControl('control', { id: 'radio-a' }))!
    expect(member.id).toBe('radio-a')
    expect(member['aria-labelledby']).toBeUndefined()
  })
})
