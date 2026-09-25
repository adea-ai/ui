import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../button/button'
import { Field } from '../field/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSection,
  SelectTrigger,
  SelectValue,
} from './select'

/**
 * Select.
 *
 * A single choice from a list that is too long to show, or whose options are only
 * known at runtime. The distinction from RadioGroup is disclosure: a Select hides
 * the choices behind a click, which is right above roughly seven options and wrong
 * below it.
 *
 * Kobalte renders the human-readable label of the selection rather than its
 * value, which is why a Select takes `options` plus `optionValue` and
 * `optionText` instead of a bare list of strings — the trigger must never show a
 * raw id.
 */
const meta = {
  title: 'Primitives/Forms/Select',
  component: SelectTrigger,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof SelectTrigger>

export default meta
type Story = StoryObj<typeof meta>

const models = [
  { value: 'opus', label: 'Claude Opus' },
  { value: 'sonnet', label: 'Claude Sonnet' },
  { value: 'haiku', label: 'Claude Haiku' },
]

/** The default shape: a labelled trigger and a flat list. */
export const Default: Story = {
  render: () => (
    <Select
      options={models}
      optionValue={(option) => option.value}
      optionTextValue={(option) => option.label}
      placeholder="Choose a model"
      itemComponent={(props) => (
        <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
      )}
    >
      <SelectTrigger class="w-56" aria-label="Model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent />
    </Select>
  ),
}

/** Grouped options, for a list with two or more natural categories. */
export const Grouped: Story = {
  render: () => (
    <Select
      options={[
        { value: 'opus', label: 'Claude Opus', group: 'Anthropic' },
        { value: 'sonnet', label: 'Claude Sonnet', group: 'Anthropic' },
        { value: 'gpt', label: 'GPT', group: 'OpenAI' },
        { value: 'local', label: 'Managed Pi', group: 'Local' },
      ]}
      optionValue={(option) => option.value}
      optionTextValue={(option) => option.label}
      optionGroupChildren="group"
      placeholder="Choose a model"
      itemComponent={(props) => (
        <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
      )}
      sectionComponent={(props) => (
        <SelectSection>
          <SelectLabel>{props.section.rawValue}</SelectLabel>
        </SelectSection>
      )}
    >
      <SelectTrigger class="w-56" aria-label="Model">
        <SelectValue />
      </SelectTrigger>
      <SelectContent />
    </Select>
  ),
}

/** The three trigger heights, matching the shared control ladder. */
export const Sizes: Story = {
  render: () => (
    <div class="flex flex-col gap-3">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Select
          options={models}
          optionValue={(option) => option.value}
          optionTextValue={(option) => option.label}
          defaultValue={models[1]}
          itemComponent={(props) => (
            <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
          )}
        >
          <SelectTrigger size={size} class="w-56" aria-label={`Model (${size})`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent />
        </Select>
      ))}
    </div>
  ),
}

/**
 * A multi-select, which reports its selection as a summary rather than as a list
 * of chips — a trigger that grows with the selection changes the layout of
 * everything around it every time the user clicks.
 */
export const Multiple: Story = {
  render: () => (
    <Select
      multiple
      options={models}
      optionValue={(option) => option.value}
      optionTextValue={(option) => option.label}
      placeholder="Choose models"
      itemComponent={(props) => (
        <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
      )}
    >
      <SelectTrigger class="w-56" aria-label="Models">
        <SelectValue />
      </SelectTrigger>
      <SelectContent />
    </Select>
  ),
}

/** In a Field, with a label, description and validation slot. */
export const InAField: Story = {
  render: () => (
    <Field class="w-72">
      <Select
        options={models}
        optionValue={(option) => option.value}
        optionTextValue={(option) => option.label}
        placeholder="Choose a model"
        itemComponent={(props) => (
          <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
        )}
      >
        <SelectTrigger aria-label="Model">
          <SelectValue />
        </SelectTrigger>
        <SelectContent />
      </Select>
    </Field>
  ),
}

/** With a trailing action, which is how a Select sits in a toolbar. */
export const WithTrailingAction: Story = {
  render: () => (
    <div class="flex items-center gap-2">
      <Select
        options={models}
        optionValue={(option) => option.value}
        optionTextValue={(option) => option.label}
        defaultValue={models[1]}
        itemComponent={(props) => (
          <SelectItem item={props.item}>{props.item.rawValue.label}</SelectItem>
        )}
      >
        <SelectTrigger size="sm" class="w-44" aria-label="Model">
          <SelectValue />
        </SelectTrigger>
        <SelectContent />
      </Select>
      <Button size="sm" variant="ghost">
        Reset
      </Button>
    </div>
  ),
}
