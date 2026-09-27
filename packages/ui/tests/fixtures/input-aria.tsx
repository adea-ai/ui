import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Checkbox,
  CheckboxLabel,
  CheckboxDescription,
} from '../../src/components/ui/checkbox/checkbox'
import { Switch } from '../../src/components/ui/switch/switch'
import { RadioGroup, RadioGroupItem } from '../../src/components/ui/radio-group/radio-group'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [invalid, setInvalid] = createSignal(true)
  return (
    <main>
      <p id="control-help">Choose which workspace to sync.</p>
      <Checkbox
        aria-label="Sync workspace"
        aria-describedby="control-help"
        aria-invalid={invalid()}
        aria-busy={invalid()}
        title="Workspace sync"
      />
      <Switch
        aria-label="Enable source"
        aria-describedby="control-help"
        aria-invalid={invalid()}
        aria-busy={invalid()}
        title="Source availability"
      />
      <RadioGroup aria-label="Provider">
        <RadioGroupItem
          value="files"
          aria-label="Files and code"
          aria-describedby="control-help"
          aria-invalid={invalid()}
          aria-busy={invalid()}
          title="File provider"
        />
        <RadioGroupItem value="calendar" label="Calendar" description="Events in your calendar" />
      </RadioGroup>
      <Checkbox label="Include attachments" description="Screenshots and files" />
      <Switch label="Notify team" description="Deliver updates immediately" />
      <Checkbox>
        <CheckboxLabel>Composed option</CheckboxLabel>
        <CheckboxDescription>Composed help</CheckboxDescription>
      </Checkbox>
      <label>
        Work
        <Checkbox />
      </label>
      <Button onClick={() => setInvalid(false)}>Clear validation</Button>
    </main>
  )
}
render(() => <Fixture />, document.body)
