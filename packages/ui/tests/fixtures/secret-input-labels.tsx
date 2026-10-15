import { render } from 'solid-js/web'
import { FormField } from '../../src/components/ui/field/field'
import { SecretInputGroup } from '../../src/components/ui/input-group/secret-input-group'
import { TooltipProvider } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function SecretInputLabelsFixture() {
  return (
    <TooltipProvider openDelay={0}>
      <main class="flex w-96 flex-col gap-4 p-4">
        <FormField label="Default wording">
          <SecretInputGroup value="a" disabled={false} onChange={() => {}} onClear={() => {}} />
        </FormField>
        <FormField label="Default locked">
          <SecretInputGroup value="a" disabled onChange={() => {}} onClear={() => {}} />
        </FormField>
        <FormField label="New bearer token">
          <SecretInputGroup
            clearLabel="Clear stored bearer token"
            value="a"
            disabled={false}
            onChange={() => {}}
            onClear={() => {}}
          />
        </FormField>
        <FormField label="Token path value">
          <SecretInputGroup
            clearLabel="Clear stored token path"
            disabledReason="Set a token variable name first"
            value=""
            disabled
            onChange={() => {}}
            onClear={() => {}}
          />
        </FormField>
        <SecretInputGroup
          aria-label="New token"
          clearLabel="Clear stored token"
          value="a"
          disabled={false}
          onChange={() => {}}
          onClear={() => {}}
        />
      </main>
    </TooltipProvider>
  )
}

const root = document.getElementById('app')
if (root) render(() => <SecretInputLabelsFixture />, root)
