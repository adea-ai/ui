import { render } from 'solid-js/web'
import { SettingsRow, SettingsSection } from '../../src/components/composites/settings/settings'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main>
      <SettingsSection title="Rows" data-testid="rows-section">
        <div data-testid="row-content">Row content</div>
      </SettingsSection>
      <SettingsSection title="Content" bodyLayout="content" data-testid="content-section">
        <div data-testid="field-content">Field content</div>
        <SettingsRow label="Flush row" flush data-testid="flush-row">
          <span data-testid="flush-control">Control</span>
        </SettingsRow>
        <SettingsRow label="Padded row" data-testid="padded-row">
          <span>Control</span>
        </SettingsRow>
        <div data-testid="settings-card" class="rounded-xl border border-border p-4">
          Settings card
        </div>
      </SettingsSection>
    </main>
  )
}

render(() => <Fixture />, document.body)
