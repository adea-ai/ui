import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Button } from '../../ui/button/button'
import { Input } from '../../ui/input/input'
import { Switch } from '../../ui/switch/switch'
import { SettingsField, SettingsPage, SettingsRow, SettingsSection } from './settings'

/**
 * SettingsSection and SettingsRow.
 *
 * A settings page is the most repetitive surface in any application, and the one
 * where drift is most visible: label sizes, control widths and description placement
 * all wander unless something fixes them.
 *
 * The row is label-leading and control-trailing at a fixed control position, so
 * controls line up down the page regardless of how long the labels are. That
 * alignment is the difference between a settings page that reads as designed and one
 * that reads as a form.
 */
const meta = {
  title: 'Composites/Settings',
  component: SettingsSection,
  parameters: { layout: 'fullscreen' },
  args: { title: 'General' },
  tags: ['autodocs'],
} satisfies Meta<typeof SettingsSection>

export default meta
type Story = StoryObj<typeof meta>

/** The full page: two sections of rows, control trailing and aligned. */
export const Default: Story = {
  render: () => (
    <SettingsPage class="h-screen">
      <SettingsSection title="General" description="Applies to this workspace on this machine.">
        <SettingsRow label="Workspace name" description="Shown to anyone you invite.">
          <Input class="w-56" value="Adea" aria-label="Workspace name" />
        </SettingsRow>
        <SettingsRow label="Base directory" description="Where worktrees are materialised.">
          <Input
            class="w-56 font-mono text-xs"
            value="~/Developer/Adea"
            aria-label="Base directory"
          />
        </SettingsRow>
        <SettingsRow label="Auto-update" description="Install signed updates when the app is idle.">
          <Switch defaultChecked aria-label="Auto-update" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Advanced" description="Defaults that most people never change.">
        <SettingsRow
          label="Reduce transparency"
          description="Solid panels instead of frosted ones."
        >
          <Switch aria-label="Reduce transparency" />
        </SettingsRow>
        <SettingsRow
          label="Delete workspace"
          description="Removes the workspace for everyone. This cannot be undone."
        >
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  ),
}

/**
 * The vertical form, for a control that needs the full width.
 *
 * A textarea or a list cannot live in a trailing 224px slot, so it stacks. Both
 * orientations share the same label and description treatment, so a page that mixes
 * them still reads as one page.
 */
export const StackedFields: Story = {
  render: () => (
    <SettingsPage class="h-screen">
      <SettingsSection title="Notifications" description="Where a lane verdict lands.">
        <SettingsField
          label="Email"
          description="Sent once per failing lane."
          htmlFor="settings-email"
        >
          <Input id="settings-email" type="email" placeholder="you@example.com" />
        </SettingsField>
        <SettingsField
          label="Webhook"
          description="POSTed with a JSON body."
          htmlFor="settings-webhook"
        >
          <Input id="settings-webhook" placeholder="https://" />
        </SettingsField>
      </SettingsSection>
    </SettingsPage>
  ),
}

/** A section with a master control, for a group that can be switched off whole. */
export const WithSectionAction: Story = {
  render: () => (
    <SettingsPage class="h-screen">
      <SettingsSection
        title="Telemetry"
        description="Anonymous counters for startup time and lane budget verdicts."
        action={<Switch aria-label="Enable telemetry" />}
      >
        <SettingsRow label="Performance counters" description="Frame cadence and startup time.">
          <Switch aria-label="Performance counters" />
        </SettingsRow>
        <SettingsRow label="Crash reports" description="Stack traces, with paths redacted.">
          <Switch defaultChecked aria-label="Crash reports" />
        </SettingsRow>
      </SettingsSection>
    </SettingsPage>
  ),
}
