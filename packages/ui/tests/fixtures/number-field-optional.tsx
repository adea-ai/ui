import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { NumberField } from '../../src/components/ui/field/number-field'
import '../../src/styles/globals.css'

function NumberFieldOptionalFixture() {
  const [limit, setLimit] = createSignal<number | null>(null)
  const [locked, setLocked] = createSignal<number | null>(500)
  const [count, setCount] = createSignal(3)
  const [changes, setChanges] = createSignal('')

  return (
    <main class="flex w-96 flex-col gap-4 p-4">
      <NumberField
        optional
        label="Document limit"
        hint="blank uses the global budget"
        value={limit()}
        min={1}
        max={1000000}
        onChange={(value) => {
          setLimit(value)
          setChanges((current) => `${current}limit=${value};`)
        }}
      />
      <NumberField
        optional
        disabled
        label="Locked limit"
        value={locked()}
        min={1}
        max={1000}
        onChange={setLocked}
      />
      <NumberField
        label="Required count"
        value={count()}
        min={1}
        max={10}
        onChange={(value) => {
          setCount(value)
          setChanges((current) => `${current}count=${value};`)
        }}
      />
      <button type="button" onClick={() => setLimit(250)}>
        Set limit
      </button>
      <button type="button" onClick={() => setLimit(null)}>
        Clear limit
      </button>
      <output aria-label="Reported changes">{changes()}</output>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(() => <NumberFieldOptionalFixture />, root)
