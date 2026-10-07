import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { FolderOpen, Mail, NotebookPen } from 'lucide-solid'
import { EntityIcon } from '../entity-icon/entity-icon'
import { RadioGroup, RadioGroupItem } from './radio-group'

/**
 * RadioGroup.
 *
 * A single choice from a small, visible set. The group owns the value and the
 * arrow-key navigation, so a caller sets `value` once instead of wiring a `name` and
 * a handler onto every item.
 *
 * Below about five options a Select hides the choices behind a click, which is the
 * wrong trade; above about seven, radios become a wall and the Select wins. That
 * call belongs to the caller, and both controls are drawn from the same tokens.
 */
const meta = {
  title: 'Primitives/Forms/Radio Group',
  component: RadioGroup,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof RadioGroup>

export default meta
type Story = StoryObj<typeof meta>

/** The default: a labelled stack with one preselected option. */
export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="cow" aria-label="Materialisation strategy">
      <RadioGroupItem
        value="cow"
        label="Copy-on-write"
        description="Instant, and shares blocks with the base."
      />
      <RadioGroupItem
        value="clone"
        label="Full clone"
        description="Independent, but copies every object."
      />
      <RadioGroupItem
        value="share"
        label="Share the working tree"
        description="No isolation. Two sessions can conflict."
      />
    </RadioGroup>
  ),
}

/** Labels only, for options that need no explanation. */
export const LabelsOnly: Story = {
  render: () => (
    <RadioGroup defaultValue="dark" aria-label="Theme">
      <RadioGroupItem value="light" label="Light" />
      <RadioGroupItem value="dark" label="Dark" />
      <RadioGroupItem value="system" label="Match the system" />
    </RadioGroup>
  ),
}

/** Disabled options, where the reason matters more than the state. */
export const WithDisabledOption: Story = {
  render: () => (
    <RadioGroup defaultValue="md" aria-label="Density">
      <RadioGroupItem value="sm" label="Compact" description="28px rows." />
      <RadioGroupItem value="md" label="Comfortable" description="32px rows. The default." />
      <RadioGroupItem
        value="xl"
        label="Spacious"
        description="40px rows. Not available in this view yet."
        disabled
      />
    </RadioGroup>
  ),
}

/**
 * Arrow keys move within the group, and the whole group is one stop in the tab
 * order. That is the platform contract for a radio group, and it is what makes a
 * seven-option group one keystroke instead of seven.
 */
export const Keyboard: Story = {
  render: () => (
    <div class="flex max-w-prose flex-col gap-4">
      <RadioGroup defaultValue="one" aria-label="Keyboard demonstration">
        <RadioGroupItem value="one" label="Tab reaches this group once" />
        <RadioGroupItem value="two" label="Then the arrow keys move between options" />
        <RadioGroupItem value="three" label="And Tab leaves for the next control" />
      </RadioGroup>
      <p class="text-sm text-muted-foreground">
        Focus the selected option and press the arrow keys.
      </p>
    </div>
  ),
}

/** The accessible name and help may come from the surrounding settings field. */
export const ExternalHelp: Story = {
  render: () => (
    <div>
      <p id="provider-help">Choose which provider to connect.</p>
      <RadioGroup aria-label="Provider">
        <RadioGroupItem
          value="files"
          aria-label="Files and code"
          aria-describedby="provider-help"
        />
        <RadioGroupItem value="calendar" label="Calendar" />
      </RadioGroup>
    </div>
  ),
}

/**
 * `variant="card"` draws each option as a bordered card, for a choice whose
 * options each need a sentence. The whole card is the hit target; the selected
 * card takes the primary edge. `media` puts an icon between the radio and the
 * text.
 */
export const Cards: Story = {
  render: () => (
    <RadioGroup defaultValue="folder" aria-label="Source type" class="w-96">
      <RadioGroupItem
        variant="card"
        value="folder"
        label="Folder"
        description="Index Markdown and text files from a folder on this computer."
        media={<EntityIcon name="Folder" size="sm" icon={FolderOpen} />}
      />
      <RadioGroupItem
        variant="card"
        value="mail"
        label="Mail"
        description="Index messages from a connected mailbox."
        media={<EntityIcon name="Mail" size="sm" icon={Mail} />}
      />
      <RadioGroupItem
        variant="card"
        value="notes"
        label="Notes"
        description="Not available on this platform."
        disabled
        media={<EntityIcon name="Notes" size="sm" icon={NotebookPen} />}
      />
    </RadioGroup>
  ),
}
