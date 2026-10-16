import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import { ActionButton } from '../../src/components/composites/action-button'
import { FormField } from '../../src/components/ui/field/field'
import { SecretInputGroup } from '../../src/components/ui/input-group/secret-input-group'
import { TooltipProvider } from '../../src/components/ui/tooltip/tooltip'
import '../../src/styles/globals.css'

function SecretInputClearTransitionFixture() {
  const [value, setValue] = createSignal('')
  const [clearable, setClearable] = createSignal(false)
  const [clears, setClears] = createSignal(0)
  return (
    <TooltipProvider openDelay={0}>
      <main class="flex w-96 flex-col gap-4 p-4">
        {/* F2 toggles the action from inside the input, so focus never leaves it. */}
        <div
          onKeyDown={(event) => {
            if (event.key === 'F2') setClearable((on) => !on)
          }}
        >
          <FormField label="Stored token">
            <SecretInputGroup
              clearLabel="Clear stored token"
              value={value()}
              disabled={false}
              onChange={(event) => setValue(event.currentTarget.value)}
              onClear={clearable() ? () => setClears((count) => count + 1) : undefined}
            />
          </FormField>
        </div>
        <ActionButton tooltip="Toggle the clear action" onClick={() => setClearable((on) => !on)}>
          Toggle clear action
        </ActionButton>
        <output aria-live="polite">{`clears: ${clears()}`}</output>
      </main>
    </TooltipProvider>
  )
}

const root = document.getElementById('app')
if (root) render(() => <SecretInputClearTransitionFixture />, root)
