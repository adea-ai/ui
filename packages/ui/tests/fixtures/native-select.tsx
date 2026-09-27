import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { NativeSelect } from '../../src/components/ui/native-select'
import '../../src/styles/globals.css'

function NativeSelectFixture() {
  const [kind, setKind] = createSignal('derived')
  const [changeCount, setChangeCount] = createSignal(0)

  return (
    <main>
      <form id="native-select-form" onSubmit={(event) => event.preventDefault()}>
        <label for="relationship-kind">Relationship kind</label>
        <NativeSelect
          id="relationship-kind"
          name="relationshipKind"
          required
          value={kind()}
          onChange={(event) => {
            setChangeCount((count) => count + 1)
            setKind(event.currentTarget.value)
          }}
        >
          <option value="">All relationships</option>
          <optgroup label="Graph source">
            <option value="explicit">Explicit</option>
            <option value="derived">Derived</option>
          </optgroup>
        </NativeSelect>
        <output aria-label="Selected relationship kind">{kind()}</output>
        <output aria-label="Relationship change count">{changeCount()}</output>

        <label for="minimum-confidence">Minimum confidence</label>
        <NativeSelect id="minimum-confidence" name="minimumConfidence" defaultValue="0.75">
          <option value="all">All</option>
          <option value="0.5">50%</option>
          <option value="0.75">75%</option>
          <option value="0.9">90%</option>
        </NativeSelect>

        <label for="allowed-origins">Allowed origins</label>
        <NativeSelect
          id="allowed-origins"
          name="allowedOrigin"
          multiple
          defaultValue={['explicit', 'derived']}
        >
          <option value="explicit">Explicit</option>
          <option value="derived">Derived</option>
          <option value="inferred">Inferred</option>
        </NativeSelect>

        <NativeSelect aria-label="Locked filter" name="lockedFilter" disabled defaultValue="locked">
          <option value="locked">Locked</option>
          <option value="available">Available</option>
        </NativeSelect>
        <button type="submit">Apply filters</button>
      </form>
    </main>
  )
}

render(() => <NativeSelectFixture />, document.getElementById('app')!)
