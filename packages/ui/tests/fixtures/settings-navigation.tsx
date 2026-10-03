import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Bell, Database, Settings, ShieldCheck, UserRound } from 'lucide-solid'
import { Button } from '../../src/components/ui/button/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../src/components/ui/tabs/tabs'
import {
  SettingsLayout,
  SettingsNavigation,
  type SettingsNavigationGroup,
} from '../../src/components/composites/settings'
import '../../src/styles/globals.css'

const variant = (window as { settingsNavFixture?: string }).settingsNavFixture

function ForcedRowFixture() {
  const [value, setValue] = createSignal('account')
  const groups: readonly SettingsNavigationGroup[] = [
    {
      label: 'Workspace preferences',
      items: [
        { value: 'account', label: 'Account', icon: <UserRound aria-hidden="true" /> },
        { value: 'appearance', label: 'Appearance', icon: <Settings aria-hidden="true" /> },
        {
          value: 'workspace',
          label: 'Workspace defaults',
          icon: <Database aria-hidden="true" />,
        },
        { value: 'input', label: 'Input and notifications', icon: <Bell aria-hidden="true" /> },
      ],
    },
    {
      label: 'Access and privacy',
      items: [
        { value: 'privacy', label: 'Privacy', icon: <ShieldCheck aria-hidden="true" /> },
        { value: 'notifications', label: 'Notifications', icon: <Bell aria-hidden="true" /> },
        {
          value: 'diagnostics',
          label: 'Diagnostics and recovery',
          icon: <Database aria-hidden="true" />,
        },
      ],
    },
  ]

  return (
    <main class="flex h-screen min-h-0 flex-col gap-2 p-2">
      <Button type="button" onClick={() => setValue('diagnostics')}>
        Select diagnostics
      </Button>
      {/* The consumer shape from the field report: a clipped pane wrapping a
      scroller, with the grouped list forced into a row. The pane is fixed
      narrow so the row genuinely overflows the affordance scroller. */}
      <div id="forced-row-pane" class="flex h-48 w-40 min-h-0 min-w-0 overflow-hidden">
        <div id="forced-row-scroller" class="min-w-0 flex-1 overflow-x-auto">
          <Tabs
            id="forced-row-tabs"
            orientation="vertical"
            value={value()}
            onChange={(next: string) => setValue(next)}
          >
            <SettingsNavigation
              id="forced-row-navigation"
              value={value()}
              onChange={(next: string) => setValue(next)}
              aria-label="Settings sections"
              groups={groups}
              class="w-max flex-row items-center"
            />
          </Tabs>
        </div>
      </div>
      <output aria-label="Selected section">{value()}</output>
    </main>
  )
}

function SettingsNavigationFixture() {
  const [value, setValue] = createSignal('account')
  const [reselected, setReselected] = createSignal('none')
  const groups: readonly SettingsNavigationGroup[] = [
    {
      label: 'Workspace preferences',
      items: [
        { value: 'account', label: 'Account', icon: <UserRound aria-hidden="true" /> },
        { value: 'appearance', label: 'Appearance', icon: <Settings aria-hidden="true" /> },
        {
          value: 'workspace',
          label: 'Workspace defaults',
          icon: <Database aria-hidden="true" />,
        },
      ],
    },
    {
      label: 'Access and privacy',
      items: [
        { value: 'privacy', label: 'Privacy', icon: <ShieldCheck aria-hidden="true" /> },
        { value: 'notifications', label: 'Notifications', icon: <Bell aria-hidden="true" /> },
        {
          value: 'diagnostics',
          label: 'Diagnostics and recovery',
          icon: <Database aria-hidden="true" />,
        },
      ],
    },
  ]

  return (
    <main class="flex h-screen min-h-0 min-w-0 flex-col gap-2 p-2 md:flex-row">
      <Button type="button" onClick={() => setValue('diagnostics')}>
        Select diagnostics
      </Button>
      <SettingsLayout
        id="settings-navigation-fixture"
        value={value()}
        onChange={(next) => setValue(next)}
        aria-label="Settings sections"
        groups={groups}
        class="min-h-0 min-w-0 flex-1"
        onReselect={setReselected}
      >
        <TabsContent id="settings-panel-account" value="account">
          <h2>Account</h2>
          <p>Session and installed product information.</p>
        </TabsContent>
        <TabsContent id="settings-panel-appearance" value="appearance">
          <h2>Appearance</h2>
          <p>Theme and display choices.</p>
        </TabsContent>
        <TabsContent id="settings-panel-workspace" value="workspace">
          <h2>Workspace defaults</h2>
          <p>Preferences shared by this workspace.</p>
        </TabsContent>
        <TabsContent id="settings-panel-privacy" value="privacy">
          <h2>Privacy</h2>
          <p>Control how private data is handled.</p>
        </TabsContent>
        <TabsContent id="settings-panel-notifications" value="notifications">
          <h2>Notifications</h2>
          <p>Choose where updates are delivered.</p>
        </TabsContent>
        <TabsContent id="settings-panel-diagnostics" value="diagnostics">
          <h2>Diagnostics and recovery</h2>
          <p>Review diagnostics and recovery choices.</p>
        </TabsContent>
      </SettingsLayout>
      <div hidden>
        <Tabs value="account" orientation="horizontal">
          <TabsList aria-label="Independent tab root">
            <TabsTrigger value="account">Independent account</TabsTrigger>
            <TabsTrigger id="custom-tabs-trigger" value="custom">
              Custom tab
            </TabsTrigger>
            <TabsTrigger id="custom-mapped-trigger" value="custom-mapped">
              Custom mapped tab
            </TabsTrigger>
          </TabsList>
          <TabsContent id="independent-account-panel" value="account">
            Independent account panel.
          </TabsContent>
          <TabsContent
            forceMount
            id="custom-tabs-panel"
            aria-labelledby="custom-panel-label"
            value="custom"
          >
            Custom panel.
          </TabsContent>
          <TabsContent forceMount id="custom-mapped-panel" value="custom-mapped">
            Custom mapped panel.
          </TabsContent>
        </Tabs>
        <span id="custom-panel-label">External custom panel label</span>
        <Tabs value="general" orientation="vertical">
          <TabsList aria-label="Vertical tab root">
            <TabsTrigger value="general">Vertical general</TabsTrigger>
            <TabsTrigger value="advanced">Vertical advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="general">Vertical general panel.</TabsContent>
          <TabsContent value="advanced">Vertical advanced panel.</TabsContent>
        </Tabs>
      </div>
      <output aria-label="Selected section">{value()}</output>
      <output aria-label="Reselected section">{reselected()}</output>
    </main>
  )
}

if (variant === 'forced-row') {
  render(() => <ForcedRowFixture />, document.body)
} else {
  render(() => <SettingsNavigationFixture />, document.body)
}
