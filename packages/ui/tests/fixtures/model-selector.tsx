import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ModelSelector, type ModelOption } from '../../src/components/composites/model-selector'
import '../../src/styles/globals.css'

type FixtureWindow = Window & {
  setBlocked?: (blocked: boolean) => void
  selections?: string[]
}

const [blocked, setBlocked] = createSignal(false)
const efforts = ['low', 'high']
const shortModels: ModelOption[] = [
  { id: 'first', label: 'First', provider: 'Provider', efforts },
  { id: 'second', label: 'Second', provider: 'Provider' },
]
const searchableModels: ModelOption[] = Array.from({ length: 8 }, (_, index) => ({
  id: `search-${index + 1}`,
  label: `Search model ${index + 1}`,
  provider: 'Provider',
}))

;(window as FixtureWindow).selections = []
;(window as FixtureWindow).setBlocked = setBlocked

const record = (selection: string) => (window as FixtureWindow).selections?.push(selection)

render(
  () => (
    <main class="flex w-2xl max-w-full flex-col gap-4 p-4">
      <ModelSelector
        label="Short picker"
        models={shortModels}
        value="first"
        effort="high"
        disabledReason={blocked() ? 'The run is in progress.' : undefined}
        onChange={(id) => record(`model:${id}`)}
        onEffortChange={(id) => record(`effort:${id}`)}
      />
      <ModelSelector
        label="Search picker"
        models={searchableModels}
        value="search-1"
        searchThreshold={1}
        disabledReason={blocked() ? 'The run is in progress.' : undefined}
        onChange={(id) => record(`search:${id}`)}
      />
    </main>
  ),
  document.body
)
