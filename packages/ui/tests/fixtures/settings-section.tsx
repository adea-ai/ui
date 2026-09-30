import { render } from 'solid-js/web'
import { SettingsSection } from '../../src/components/composites/settings/settings'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main>
      <SettingsSection title="Rows" data-testid="rows-section">
        <div data-testid="row-content">Row content</div>
      </SettingsSection>
      <SettingsSection title="Content" bodyLayout="content" data-testid="content-section">
        <div data-testid="field-content">Field content</div>
        <div data-testid="settings-card" class="rounded-xl border border-border p-4">
          Settings card
        </div>
      </SettingsSection>
    </main>
  )
}

render(() => <Fixture />, document.body)
