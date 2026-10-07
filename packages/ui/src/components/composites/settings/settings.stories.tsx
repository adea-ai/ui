import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Bell, Database, Settings, ShieldCheck, UserRound } from 'lucide-solid'
import { expect, within } from 'storybook/test'
import { Button } from '../../ui/button/button'
import { Input } from '../../ui/input/input'
import { Switch } from '../../ui/switch/switch'
import { TabsContent } from '../../ui/tabs/tabs'
import { SettingsField, SettingsPage, SettingsRow, SettingsSection } from './settings'
import { SettingsLayout, type SettingsNavigationLayout } from './settings-layout'
import type { SettingsNavigationGroup } from './settings-navigation'

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

/** Content sections space fields and cards without enclosing them in a row border. */
export const ContentBody: Story = {
  render: () => (
    <SettingsPage class="h-screen">
      <SettingsSection title="Memory" bodyLayout="content">
        <SettingsField label="Retention" description="Controls how long memories remain.">
          <Input value="90 days" aria-label="Retention" />
        </SettingsField>
        <div class="rounded-xl border border-border bg-card p-4">A separately bordered card</div>
      </SettingsSection>
    </SettingsPage>
  ),
}

/** SettingsRow names an otherwise bare shared control and describes it. */
export const AccessibleRows: Story = {
  render: () => (
    <SettingsSection title="General">
      <SettingsRow label="Workspace name" description="Shown to anyone you invite.">
        <Input value="Adea" />
      </SettingsRow>
      <SettingsRow label="Auto-update" description="Installs signed updates when idle.">
        <Switch defaultChecked />
      </SettingsRow>
      <SettingsRow label="Delete workspace" description="This action cannot be undone.">
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </SettingsRow>
    </SettingsSection>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nameInput = canvas.getByRole('textbox', { name: 'Workspace name' })
    expect(nameInput.id).not.toBe('')
    const nameDescriptionId = nameInput.getAttribute('aria-describedby')!
    expect(canvasElement.querySelector(`#${CSS.escape(nameDescriptionId)}`)?.textContent).toContain(
      'Shown to anyone you invite.'
    )

    const autoUpdate = canvas.getByRole('switch', { name: 'Auto-update' })
    expect(autoUpdate.id).not.toBe('')
    const switchDescriptionId = autoUpdate.getAttribute('aria-describedby')!
    expect(
      canvasElement.querySelector(`#${CSS.escape(switchDescriptionId)}`)?.textContent
    ).toContain('Installs signed updates when idle.')
    expect(
      canvas.getByRole('button', { name: 'Delete' }).getAttribute('aria-labelledby')
    ).toBeNull()
  },
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

function GroupedNavigationDemo(props: { id: string; navigationLayout?: SettingsNavigationLayout }) {
  const [value, setValue] = createSignal('account')
  const [reselected, setReselected] = createSignal('none')
  const groups: readonly SettingsNavigationGroup[] = [
    {
      label: 'Workspace',
      items: [
        { value: 'account', label: 'Account', icon: <UserRound aria-hidden="true" /> },
        { value: 'preferences', label: 'Preferences', icon: <Settings aria-hidden="true" /> },
        { value: 'notifications', label: 'Notifications', icon: <Bell aria-hidden="true" /> },
      ],
    },
    {
      label: 'Privacy',
      items: [
        { value: 'data', label: 'Data controls', icon: <Database aria-hidden="true" /> },
        { value: 'access', label: 'Access', icon: <ShieldCheck aria-hidden="true" /> },
      ],
    },
  ]

  return (
    <div class="flex h-screen flex-col">
      <SettingsLayout
        id={props.id}
        value={value()}
        onChange={(next) => setValue(next)}
        aria-label="Settings sections"
        groups={groups}
        navigationLayout={props.navigationLayout}
        class="min-h-0 min-w-0 flex-1"
        onReselect={setReselected}
      >
        <TabsContent value="account">
          <SettingsSection title="Account" description="Session and product information." />
        </TabsContent>
        <TabsContent value="preferences">
          <SettingsSection title="Preferences" description="Workspace defaults." />
        </TabsContent>
        <TabsContent value="notifications">
          <SettingsSection title="Notifications" description="Where updates are delivered." />
        </TabsContent>
        <TabsContent value="data">
          <SettingsSection title="Data controls" description="Retention and private content." />
        </TabsContent>
        <TabsContent value="access">
          <SettingsSection title="Access" description="Permissions for this workspace." />
        </TabsContent>
      </SettingsLayout>
      <output class="sr-only" aria-label="Reselected settings section">
        {reselected()}
      </output>
    </div>
  )
}

/**
 * Grouped vertical settings tabs whose routes and controlled selection belong to
 * the host. Below 48rem of viewport width the rail becomes the strip shown in
 * `NarrowStrip`; resize the canvas to see it switch.
 */
export const GroupedNavigation: Story = {
  render: () => <GroupedNavigationDemo id="settings-navigation-story" />,
}

/**
 * The narrow-width shape, pinned with `navigationLayout="strip"`: one horizontal,
 * scrollable row of tabs above the panels, groups in order and separated by a
 * rule. It is a horizontal tab list, so Left/Right move between sections, and
 * each tab keeps its group as its accessible description.
 */
export const NarrowStrip: Story = {
  render: () => <GroupedNavigationDemo id="settings-navigation-strip" navigationLayout="strip" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('tablist', { name: 'Settings sections' })
    expect(list.getAttribute('aria-orientation')).toBe('horizontal')
    const account = canvas.getByRole('tab', { name: 'Account' })
    const data = canvas.getByRole('tab', { name: 'Data controls' })
    expect(account.getAttribute('aria-selected')).toBe('true')
    const groupLabel = canvasElement.querySelector(
      `#${CSS.escape(data.getAttribute('aria-describedby') ?? '')}`
    )
    expect(groupLabel?.textContent).toBe('Privacy')
  },
}
