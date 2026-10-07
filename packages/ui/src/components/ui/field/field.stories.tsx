import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal, Show } from 'solid-js'
import { expect, userEvent, within } from 'storybook/test'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { Combobox, ComboboxControl, ComboboxInput, ComboboxItem } from '../combobox/combobox'
import { Input } from '../input/input'
import { NativeSelect } from '../native-select/native-select'
import { RadioGroup, RadioGroupItem } from '../radio-group/radio-group'
import { Switch } from '../switch/switch'
import { Textarea } from '../textarea/textarea'
import {
  Field,
  FormField,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldInput,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTextArea,
} from './field'
import { NumberField } from './number-field'

/**
 * Field.
 *
 * The wrapper that makes a form control describable and validatable: a label, a
 * description, an error message, and the ARIA relationships between them.
 *
 * It is built on Kobalte's TextField specifically so `aria-describedby`,
 * `aria-invalid` and `aria-errormessage` are wired by construction. Those three
 * attributes are the difference between "this field is required and empty" and a red
 * border that only a sighted user can perceive — and they are the first thing a
 * hand-rolled form drops.
 */
const meta = {
  title: 'Primitives/Forms/Field',
  component: Field,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

/** Label, description and input: the ordinary case. */
export const Default: Story = {
  render: () => (
    <Field class="w-96">
      <FieldLabel>Workspace name</FieldLabel>
      <FieldInput placeholder="Adea" />
      <FieldDescription>Shown to anyone you invite.</FieldDescription>
    </Field>
  ),
}

/** Invalided with a message, which is announced rather than only drawn. */
export const WithError: Story = {
  render: () => (
    <Field class="w-96" validationState="invalid">
      <FieldLabel>Base directory</FieldLabel>
      <FieldInput value="relative/path" />
      <FieldError>Enter an absolute path beginning with /</FieldError>
    </Field>
  ),
}

/** A textarea, at a larger measure. */
export const TextArea: Story = {
  render: () => (
    <Field class="w-96">
      <FieldLabel>Objective</FieldLabel>
      <FieldTextArea placeholder="What should this session accomplish?" rows={4} />
      <FieldDescription>
        Written once at the start. The session references it rather than restating it.
      </FieldDescription>
    </Field>
  ),
}

/**
 * A fieldset with a legend, for a group that belongs together.
 *
 * Grouping is what lets a screen reader announce "Shipping address, group" before
 * reading the four fields inside it, instead of reading four unrelated inputs.
 */
export const Grouped: Story = {
  render: () => (
    <FieldSet class="w-96">
      <FieldLegend>Notification channels</FieldLegend>
      <Field>
        <FieldLabel>Email</FieldLabel>
        <FieldInput type="email" placeholder="you@example.com" />
      </Field>
      <Field>
        <FieldLabel>Webhook</FieldLabel>
        <FieldInput placeholder="https://" />
      </Field>
    </FieldSet>
  ),
}

/** Legend variants and the separator, for a full form header. */
export const FormHeader: Story = {
  render: () => (
    <FieldSet class="w-96">
      <FieldLegend variant="label">Sign in</FieldLegend>
      <FieldSeparator>or</FieldSeparator>
      <Field>
        <FieldLabel>Email</FieldLabel>
        <FieldInput type="email" />
      </Field>
      <Button size="sm">Continue</Button>
    </FieldSet>
  ),
}

/**
 * One field contract across native controls, toggles, radio groups and a
 * filterable combobox. Its interaction checks verify actual focusable nodes,
 * not just a wrapper that happens to contain the right IDs.
 */
export const SharedFormField: Story = {
  render: () => {
    const [alternate, setAlternate] = createSignal(false)

    return (
      <div class="flex w-96 flex-col gap-4">
        <FormField
          label="Workspace name"
          hint="Shown to anyone you invite."
          error="Choose a workspace name."
        >
          <Input />
        </FormField>
        <FormField label="Workspace name" controlId="workspace-slug">
          <Input />
        </FormField>
        <FormField label="Provider">
          <NativeSelect
            options={[
              { value: 'local', label: 'Local' },
              { value: 'cloud', label: 'Cloud' },
            ]}
          />
        </FormField>
        <FormField label="Enable sync" hint="Runs after the next workspace change.">
          <Switch />
        </FormField>
        <FormField label="Include source metadata">
          <Checkbox />
        </FormField>
        <FormField label="Processing mode" group hint="Choose one mode.">
          <RadioGroup value="safe" onChange={() => {}}>
            <RadioGroupItem value="safe" label="Safe" />
            <RadioGroupItem value="fast" label="Fast" />
          </RadioGroup>
        </FormField>
        <FormField label="Model">
          <Combobox
            options={['Adea Small', 'Adea Large']}
            itemComponent={(itemProps) => (
              <ComboboxItem item={itemProps.item}>{itemProps.item.rawValue}</ComboboxItem>
            )}
          >
            <ComboboxControl>
              <ComboboxInput placeholder="Find a model" />
            </ComboboxControl>
          </Combobox>
        </FormField>
        <FormField label="Objective">
          <Textarea />
        </FormField>
        <FormField label="Dynamic control">
          <Show when={alternate()} fallback={<Input id="dynamic-input" />}>
            <Textarea id="dynamic-textarea" />
          </Show>
        </FormField>
        <Button size="sm" onClick={() => setAlternate((value) => !value)}>
          Change dynamic control
        </Button>
        <FormField
          label="Permissions"
          group
          hint="These permissions apply to every selected source."
        >
          <Checkbox label="Read sources" />
          <Checkbox label="Read documents" />
        </FormField>
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const duplicateLabels = canvas.getAllByRole('textbox', { name: 'Workspace name' })
    expect(duplicateLabels).toHaveLength(2)
    expect(duplicateLabels[0]!.id).not.toBe(duplicateLabels[1]!.id)
    expect(duplicateLabels[0]!.getAttribute('aria-invalid')).toBe('true')
    const describedBy = duplicateLabels[0]!.getAttribute('aria-describedby')?.split(' ') ?? []
    expect(describedBy).toHaveLength(2)
    for (const id of describedBy) expect(canvasElement.querySelector(`#${id}`)).not.toBeNull()
    expect(canvas.getByLabelText('Workspace name', { selector: '#workspace-slug' })).not.toBeNull()

    const provider = canvas.getByRole('combobox', { name: 'Provider' })
    expect(provider.id).not.toBe('')
    const syncDescriptionId = canvas
      .getByRole('switch', { name: 'Enable sync' })
      .getAttribute('aria-describedby')!
    expect(canvasElement.querySelector(`#${CSS.escape(syncDescriptionId)}`)?.textContent).toContain(
      'Runs after the next workspace change.'
    )
    expect(canvas.getByRole('checkbox', { name: 'Include source metadata' }).id).not.toBe('')
    const groupDescriptionId = canvas
      .getByRole('radiogroup', { name: 'Processing mode' })
      .getAttribute('aria-describedby')!
    expect(
      canvasElement.querySelector(`#${CSS.escape(groupDescriptionId)}`)?.textContent
    ).toContain('Choose one mode.')
    expect(canvas.getByRole('combobox', { name: 'Model' }).id).not.toBe('')
    expect(canvas.getByRole('textbox', { name: 'Objective' }).id).not.toBe('')

    const dynamicField = canvas.getByRole('textbox', { name: 'Dynamic control' })
    expect(canvas.getByLabelText('Dynamic control').id).toBe('dynamic-input')
    await userEvent.click(canvas.getByRole('button', { name: 'Change dynamic control' }))
    expect(canvas.getByLabelText('Dynamic control').id).toBe('dynamic-textarea')
    expect(dynamicField.isConnected).toBe(false)

    const permissions = canvas.getByRole('group', { name: 'Permissions' })
    const permissionInputs = permissions.querySelectorAll('input[type="checkbox"]')
    expect(permissionInputs).toHaveLength(2)
    expect(permissionInputs[0]!.id).not.toBe(permissionInputs[1]!.id)
    expect(permissions.getAttribute('aria-describedby')).not.toBeNull()
  },
}

/** Draft validation and controlled updates for numeric values. */
export const Number: Story = {
  render: () => {
    const [workers, setWorkers] = createSignal(4)
    const [ratio, setRatio] = createSignal(1.5)

    return (
      <div class="flex w-96 flex-col gap-4">
        <NumberField
          label="Workers"
          hint="Choose between one and eight workers."
          value={workers()}
          min={1}
          max={8}
          onChange={setWorkers}
        />
        <NumberField
          label="Ratio"
          value={ratio()}
          min={0}
          max={5}
          integer={false}
          onChange={setRatio}
        />
        <Button size="sm" onClick={() => setWorkers(6)}>
          Set workers to six
        </Button>
      </div>
    )
  },
}

/**
 * `columns={2}` lays paired fields out in two columns from the `sm` breakpoint
 * up, and in one column below it. A field that needs the full width says
 * `class="col-span-full"`.
 */
export const TwoColumns: Story = {
  render: () => (
    <FieldGroup columns={2} class="w-144">
      <Field>
        <FieldLabel>Host</FieldLabel>
        <FieldInput placeholder="127.0.0.1" />
      </Field>
      <Field>
        <FieldLabel>Port</FieldLabel>
        <FieldInput inputMode="numeric" placeholder="11434" />
      </Field>
      <Field class="col-span-full">
        <FieldLabel>Model</FieldLabel>
        <FieldInput placeholder="nomic-embed-text" />
      </Field>
    </FieldGroup>
  ),
}
