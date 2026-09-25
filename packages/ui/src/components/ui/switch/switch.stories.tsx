import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Switch, SwitchDescription, SwitchLabel } from './switch'

/**
 * Switch.
 *
 * For a setting that takes effect the moment it is flipped. The distinction from
 * Checkbox is behaviour, not looks: a Switch applies immediately and belongs in a
 * settings row, while a Checkbox is a value the user is still composing and is
 * applied when a form is submitted.
 *
 * A Switch inside an unsaved form is the mistake this component's existence is
 * meant to prevent — the user flips it, sees no save button, and cannot tell
 * whether the change took.
 */
const meta = {
  title: 'Primitives/Forms/Switch',
  component: Switch,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <Switch aria-label="Enable notifications" />,
}

/** With a label and description: the settings-row form. */
export const Labelled: Story = {
  render: () => (
    <Switch>
      <SwitchLabel>Frosted surfaces</SwitchLabel>
      <SwitchDescription>
        Blur what scrolls under the top bar. Costs a compositing layer.
      </SwitchDescription>
    </Switch>
  ),
}

/** Both states, including the disabled pair. */
export const States: Story = {
  render: () => (
    <div class="flex flex-col gap-4">
      <Switch aria-label="Off" />
      <Switch aria-label="On" defaultChecked />
      <Switch aria-label="Disabled" disabled />
      <Switch aria-label="Disabled and on" disabled defaultChecked />
    </div>
  ),
}

/**
 * A controlled switch, which is what a persisted preference looks like.
 *
 * The state is owned by the app — a switch that managed its own state privately
 * could not be restored, and the setting would silently reset on reload.
 */
export const Controlled: Story = {
  render: () => {
    const [enabled, setEnabled] = createSignal(true)

    return (
      <div class="flex w-96 flex-col gap-4">
        <div class="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
          <div class="flex flex-col gap-0.5">
            <SwitchLabel>Reduce transparency</SwitchLabel>
            <SwitchDescription>Solid panels instead of frosted ones.</SwitchDescription>
          </div>
          <Switch checked={enabled()} onChange={setEnabled} aria-label="Reduce transparency" />
        </div>
        <p class="text-sm text-muted-foreground">Currently {enabled() ? 'enabled' : 'disabled'}.</p>
      </div>
    )
  },
}

/**
 * A group of switches in a settings card.
 *
 * Each row is label-leading and control-trailing, at a fixed control position,
 * so the toggles line up down the page regardless of how long the labels are.
 * That alignment is the difference between a settings page that reads as
 * designed and one that reads as a form.
 */
export const SettingsGroup: Story = {
  render: () => (
    <div class="w-144 divide-y divide-border rounded-xl border border-border">
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Auto-update</div>
          <p class="text-sm text-muted-foreground">Install signed updates when the app is idle.</p>
        </div>
        <Switch defaultChecked aria-label="Auto-update" />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Telemetry</div>
          <p class="text-sm text-muted-foreground">Send anonymous performance counters.</p>
        </div>
        <Switch aria-label="Telemetry" />
      </div>
      <div class="flex items-center justify-between gap-4 p-4">
        <div class="flex flex-col gap-0.5">
          <div class="text-sm font-medium">Launch at login</div>
          <p class="text-sm text-muted-foreground">Start in the background when you sign in.</p>
        </div>
        <Switch aria-label="Launch at login" disabled />
      </div>
    </div>
  ),
}
