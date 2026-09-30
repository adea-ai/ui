import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ListRow } from '../../src/components/composites/list-row/list-row'
import '../../src/styles/globals.css'

function Fixture() {
  const [activations, setActivations] = createSignal(0)
  const [submissions, setSubmissions] = createSignal(0)
  let buttonRef: HTMLButtonElement | undefined

  return (
    <main>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSubmissions((count) => count + 1)
        }}
      >
        <ListRow
          as="button"
          aria-label="Open report"
          tooltip="Open the report"
          ref={(element: HTMLButtonElement) => {
            buttonRef = element
          }}
          onClick={() => setActivations((count) => count + 1)}
        >
          Report
        </ListRow>
        <ListRow as="a" href="#details" tooltip="Read report details">
          Details
        </ListRow>
        <ListRow tooltip="Run this action" onClick={() => setActivations((count) => count + 1)}>
          Run action
        </ListRow>
      </form>
      <output aria-label="Activations">{activations()}</output>
      <output aria-label="Submissions">{submissions()}</output>
      <output aria-label="Forwarded ref">{buttonRef?.tagName ?? 'missing'}</output>
    </main>
  )
}

render(() => <Fixture />, document.body)
