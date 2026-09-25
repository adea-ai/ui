import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from './combobox'

/**
 * Combobox.
 *
 * A Select whose list is filterable by typing. The difference is not cosmetic: a
 * Combobox has a text input, so the user can narrow forty options to one without
 * reading the list. Above roughly ten options the search is the feature; below it,
 * a Select is quieter and a RadioGroup is better still.
 */
const meta = {
  title: 'Primitives/Forms/Combobox',
  component: ComboboxControl,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof ComboboxControl>

export default meta
type Story = StoryObj<typeof meta>

const branches = [
  'main',
  'feat/solid-tanstack-start',
  'feat/m12-397-worktrees',
  'feat/m12-422-browser',
  'fix/soak-stalled-stream',
  'chore/release-0.55.0',
  'release/0.54',
]

/** A filterable single-select. */
export const Default: Story = {
  render: () => (
    <Combobox
      options={branches}
      placeholder="Search branches"
      itemComponent={(props) => (
        <ComboboxItem item={props.item}>{props.item.rawValue}</ComboboxItem>
      )}
    >
      <ComboboxControl class="w-72">
        <ComboboxInput aria-label="Branch" placeholder="Search branches" />
        <ComboboxTrigger aria-label="Show branches" />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  ),
}

/** Open, so the filtered list is visible in the docs without interacting. */
export const OpenList: Story = {
  render: () => (
    <Combobox
      options={branches}
      defaultFilter={(value, input) => value.toLowerCase().includes(input.toLowerCase())}
      itemComponent={(props) => (
        <ComboboxItem item={props.item}>{props.item.rawValue}</ComboboxItem>
      )}
    >
      <ComboboxControl class="w-72">
        <ComboboxInput aria-label="Branch" placeholder="Search branches" value="feat" />
        <ComboboxTrigger aria-label="Show branches" />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  ),
}

/** Multiple selection, which reports a count rather than a growing row of chips. */
export const Multiple: Story = {
  render: () => (
    <Combobox
      multiple
      options={branches}
      placeholder="Search branches"
      itemComponent={(props) => (
        <ComboboxItem item={props.item}>{props.item.rawValue}</ComboboxItem>
      )}
    >
      <ComboboxControl class="w-72">
        <ComboboxInput aria-label="Branches" placeholder="Add a branch filter" />
        <ComboboxTrigger aria-label="Show branches" />
      </ComboboxControl>
      <ComboboxContent />
    </Combobox>
  ),
}
