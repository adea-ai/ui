import { createSignal, Show } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '../../src/components/ui/combobox/combobox'
import { Slider } from '../../src/components/ui/slider/slider'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [query, setQuery] = createSignal('')
  const [controlled, setControlled] = createSignal([10, 80])
  const choices = ['Files', 'Calendar']
  return (
    <main>
      <Combobox
        options={choices}
        allowsEmptyCollection
        onInputChange={setQuery}
        defaultFilter={(option, input) => option.toLowerCase().includes(input.toLowerCase())}
        itemComponent={(props) => (
          <ComboboxItem item={props.item}>{props.item.rawValue}</ComboboxItem>
        )}
      >
        <ComboboxControl>
          <ComboboxInput aria-label="Provider" />
          <ComboboxTrigger aria-label="Show providers" />
        </ComboboxControl>
        <ComboboxContent>
          <Show
            when={!choices.some((option) => option.toLowerCase().includes(query().toLowerCase()))}
          >
            <p role="status">No matching providers.</p>
          </Show>
        </ComboboxContent>
      </Combobox>
      <form aria-label="Controlled thresholds">
        <Slider
          name="controlled"
          value={controlled()}
          onChange={setControlled}
          aria-label="Controlled bounds"
          thumbLabels={
            controlled().length > 1
              ? ['Controlled minimum', 'Controlled maximum']
              : ['Controlled value']
          }
        />
        <Button type="button" onClick={() => setControlled([30])}>
          Use scalar
        </Button>
        <Button type="button" onClick={() => setControlled([10, 80])}>
          Use range
        </Button>
      </form>
      <form aria-label="Thresholds">
        <Slider name="relevance" defaultValue={[50]} aria-label="Relevance" />
        <Slider
          name="bounds"
          defaultValue={[20, 70]}
          aria-label="Bounds"
          thumbLabels={['Bounds minimum', 'Bounds maximum']}
        />
        <Slider name="disabled" defaultValue={[75]} aria-label="Disabled value" disabled />
        <Button type="reset">Reset thresholds</Button>
      </form>
    </main>
  )
}
render(() => <Fixture />, document.body)
