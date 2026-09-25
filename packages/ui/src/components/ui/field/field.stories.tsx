import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldInput,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTextArea,
} from './field'

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
