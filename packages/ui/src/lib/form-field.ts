import type { ComponentProps } from 'solid-js'
import { createContext, createSignal, useContext } from 'solid-js'

export type FormFieldControlKind = 'control' | 'group'

export type FormFieldContextValue = {
  group: () => boolean
  labelId: string
  controlId: () => string
  registerControlId: (requestedId?: string) => string | undefined
  describedBy: () => string | undefined
  errorId: () => string | undefined
  invalid: () => boolean
}

export const FormFieldContext = createContext<FormFieldContextValue>()

function mergeIds(...values: Array<string | undefined>) {
  return (
    [...new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []))].join(' ') ||
    undefined
  )
}

export function createFormFieldContext(props: {
  controlId?: string
  defaultControlId: string
  labelId: string
  descriptionId?: string
  errorId?: string
  hint: () => string | undefined
  error: () => string | undefined
  group: () => boolean
}): FormFieldContextValue {
  const [controlId, setControlId] = createSignal(props.controlId ?? props.defaultControlId)

  return {
    group: props.group,
    labelId: props.labelId,
    controlId,
    registerControlId(requestedId) {
      if (props.group() && !requestedId) return undefined
      if (requestedId) {
        setControlId(requestedId)
        return requestedId
      }
      return props.group() ? undefined : controlId()
    },
    describedBy: () =>
      [props.hint() ? props.descriptionId : undefined, props.error() ? props.errorId : undefined]
        .filter((id): id is string => Boolean(id))
        .join(' ') || undefined,
    errorId: () => (props.error() ? props.errorId : undefined),
    invalid: () => Boolean(props.error()),
  }
}

export function useFormFieldControl(
  kind: FormFieldControlKind,
  props: {
    id?: string
    'aria-label'?: string
    'aria-labelledby'?: string
    'aria-describedby'?: string
    'aria-invalid'?: ComponentProps<'input'>['aria-invalid']
    'aria-errormessage'?: string
  } = {}
) {
  const field = useContext(FormFieldContext)
  if (!field) return null

  const groupedDescendant = field.group() && kind !== 'group'
  const id = groupedDescendant ? props.id : field.registerControlId(props.id)
  const labelledBy =
    props['aria-label'] || props['aria-labelledby']
      ? props['aria-labelledby']
      : groupedDescendant
        ? undefined
        : field.labelId
  return {
    id,
    'aria-labelledby': labelledBy,
    get 'aria-describedby'() {
      return mergeIds(props['aria-describedby'], field.describedBy())
    },
    get 'aria-invalid'() {
      return props['aria-invalid'] ?? (field.invalid() || undefined)
    },
    get 'aria-errormessage'() {
      return props['aria-errormessage'] ?? field.errorId()
    },
  }
}
