import { splitProps, type ComponentProps, type JSX } from 'solid-js'
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem } from './combobox'

export type ValueComboboxChoice =
  | { value: string; label: string | number; textValue?: string }
  | { value: string; label: JSX.Element; textValue: string }

export type ValueComboboxProps = Omit<ComponentProps<typeof ComboboxInput>, 'value'> & {
  value: string
  choices: ValueComboboxChoice[]
  onValueChange: (value: string) => void
}

/** A single-choice combobox for a controlled string value and labelled choices. */
export function ValueCombobox(props: ValueComboboxProps) {
  const [local, rest] = splitProps(props, ['value', 'choices', 'onValueChange'])

  return (
    <Combobox
      options={local.choices}
      optionValue="value"
      optionTextValue={(choice) => choice.textValue ?? textFromLabel(choice.label)}
      optionLabel={(choice) => choice.textValue ?? textFromLabel(choice.label)}
      value={local.choices.find((choice) => String(choice.value) === local.value) ?? null}
      onChange={(option) => option && local.onValueChange(String(option.value))}
      itemComponent={(itemProps) => (
        <ComboboxItem item={itemProps.item}>{itemProps.item.rawValue.label}</ComboboxItem>
      )}
    >
      <ComboboxInput {...rest} />
      <ComboboxContent />
    </Combobox>
  )
}

function textFromLabel(label: JSX.Element) {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : ''
}
