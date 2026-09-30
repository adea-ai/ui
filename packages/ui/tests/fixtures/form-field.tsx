import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import { TooltipProvider } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'
import { Checkbox } from '../../src/components/ui/checkbox/checkbox'
import {
  Combobox,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
} from '../../src/components/ui/combobox/combobox'
import { FieldGroup, FormField } from '../../src/components/ui/field/field'
import { NumberField } from '../../src/components/ui/field/number-field'
import { Input } from '../../src/components/ui/input/input'
import { ValueCombobox } from '../../src/components/ui/combobox/value-combobox'
import { SecretInputGroup } from '../../src/components/ui/input-group/secret-input-group'
import { NativeSelect } from '../../src/components/ui/native-select/native-select'
import { RadioGroup, RadioGroupItem } from '../../src/components/ui/radio-group/radio-group'
import { SettingsRow } from '../../src/components/composites/settings/settings'
import { Switch } from '../../src/components/ui/switch/switch'
import { Textarea } from '../../src/components/ui/textarea/textarea'

export function FormFieldFixture() {
  const [alternate, setAlternate] = createSignal(false)
  const [workerCount, setWorkerCount] = createSignal(4)
  const [ratio, setRatio] = createSignal(1.5)
  const [selectedModel, setSelectedModel] = createSignal('small')
  const [secret, setSecret] = createSignal('sk-example')

  return (
    <TooltipProvider openDelay={0}>
      <main>
        <FormField
          label="Workspace name"
          hint="Shown to anyone you invite."
          error="Choose a workspace name."
        >
          <Input />
        </FormField>
        <FormField label="Workspace name" controlId="workspace-slug">
          <Input />
        </FormField>
        <FormField label="Provider">
          <NativeSelect
            options={[
              { value: 'local', label: 'Local' },
              { value: 'cloud', label: 'Cloud' },
            ]}
          />
        </FormField>
        <p id="external-help">Use the exact identifier from the provider.</p>
        <FormField label="Accessible name" hint="Shown beside the query.">
          <Input aria-label="Custom query name" aria-describedby="external-help" />
        </FormField>
        <FormField label="Objective" hint="A short description for this workspace.">
          <Textarea />
        </FormField>
        <FormField
          label="Enable sync"
          hint="Runs after the next workspace change."
          error="Sync is unavailable."
        >
          <Switch />
        </FormField>
        <FormField label="Include source metadata">
          <Checkbox />
        </FormField>
        <FormField label="Processing mode" group hint="Choose one mode.">
          <RadioGroup value="safe" onChange={() => {}}>
            <RadioGroupItem value="safe" label="Safe" />
            <RadioGroupItem value="fast" label="Fast" />
          </RadioGroup>
        </FormField>
        <FormField label="Model">
          <Combobox
            options={['Adea Small', 'Adea Large']}
            itemComponent={(itemProps) => (
              <ComboboxItem item={itemProps.item}>{itemProps.item.rawValue}</ComboboxItem>
            )}
          >
            <ComboboxControl>
              <ComboboxInput placeholder="Find a model" />
            </ComboboxControl>
          </Combobox>
        </FormField>
        <FormField label="Dynamic control">
          <Show when={alternate()} fallback={<Input id="dynamic-input" />}>
            <Textarea id="dynamic-textarea" />
          </Show>
        </FormField>
        <Button onClick={() => setAlternate((value) => !value)}>Change dynamic control</Button>
        <FieldGroup>
          <FormField label="Permissions" group hint="These permissions apply to each source.">
            <Checkbox label="Read sources" />
            <Checkbox label="Read documents" />
          </FormField>
          <Checkbox label="Keep permissions enabled" />
        </FieldGroup>
        <SettingsRow label="Row control" description="A row description.">
          <Switch />
        </SettingsRow>
        <NumberField
          label="Workers"
          hint="Choose between one and eight workers."
          value={workerCount()}
          min={1}
          max={8}
          onChange={setWorkerCount}
        />
        <NumberField
          label="Ratio"
          value={ratio()}
          min={0}
          max={5}
          integer={false}
          onChange={setRatio}
        />
        <Button onClick={() => setWorkerCount(6)}>Set workers to six</Button>
        <Button onClick={() => setRatio(2.5)}>Set ratio to two point five</Button>
        <FormField label="Controlled model" hint="Select a provider model.">
          <ValueCombobox
            value={selectedModel()}
            choices={[
              { value: 'small', label: 'Adea Small' },
              {
                value: 'large',
                label: (
                  <>
                    <strong>Adea</strong> Large
                  </>
                ),
                textValue: 'Adea Large',
              },
            ]}
            onValueChange={setSelectedModel}
          />
        </FormField>
        <FormField label="API key" hint="Stored securely for this provider.">
          <SecretInputGroup
            value={secret()}
            disabled={false}
            onChange={(event) => setSecret(event.currentTarget.value)}
            onClear={() => setSecret('')}
          />
        </FormField>
        <FormField label="Locked API key" hint="Managed by policy.">
          <SecretInputGroup value="sk-managed" disabled onChange={() => {}} onClear={() => {}} />
        </FormField>
      </main>
    </TooltipProvider>
  )
}

const root = document.getElementById('app')
if (root) render(() => <FormFieldFixture />, root)
