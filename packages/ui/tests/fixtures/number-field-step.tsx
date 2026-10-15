import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { NumberField } from '../../src/components/ui/field/number-field'
import '../../src/styles/globals.css'

function NumberFieldStepFixture() {
  const [confidence, setConfidence] = createSignal(0.5)
  const [percent, setPercent] = createSignal(50)
  const [offset, setOffset] = createSignal(0.25)
  const [count, setCount] = createSignal(4)
  const [margin, setMargin] = createSignal(1.5)
  const [changes, setChanges] = createSignal('')
  const record = (name: string, set: (value: number) => void) => (value: number) => {
    set(value)
    setChanges((current) => `${current}${name}=${value};`)
  }

  return (
    <main class="flex w-96 flex-col gap-4 p-4">
      <NumberField
        label="Default confidence"
        hint="0 to 1; agents can override per record"
        value={confidence()}
        min={0}
        max={1}
        step={0.05}
        onChange={record('confidence', setConfidence)}
      />
      <NumberField
        label="Percent"
        value={percent()}
        min={0}
        max={100}
        step={5}
        onChange={record('percent', setPercent)}
      />
      <NumberField
        label="Offset"
        value={offset()}
        min={0.25}
        max={2}
        step={0.25}
        onChange={record('offset', setOffset)}
      />
      <NumberField
        label="Margin"
        value={margin()}
        min={0.5}
        max={2.5}
        step={1}
        onChange={record('margin', setMargin)}
      />
      <NumberField
        label="Workers"
        value={count()}
        min={1}
        max={8}
        onChange={record('count', setCount)}
      />
      <output aria-label="Reported changes">{changes()}</output>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(() => <NumberFieldStepFixture />, root)
