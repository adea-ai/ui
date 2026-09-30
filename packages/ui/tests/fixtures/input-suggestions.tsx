import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Input } from '../../src/components/ui/input/input'
import { Button } from '../../src/components/ui/button/button'
import { Label } from '../../src/components/ui/label/label'
import '../../src/styles/globals.css'

function Fixture() {
  const [value, setValue] = createSignal('')
  const [submitted, setSubmitted] = createSignal('')
  return (
    <main>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(String(new FormData(event.currentTarget).get('functionKey')))
        }}
      >
        <Label for="function-key">Function key</Label>
        <Input
          id="function-key"
          name="functionKey"
          required
          pattern="[a-z]+"
          value={value()}
          onInput={(event) => setValue(event.currentTarget.value)}
          suggestions={['engineering', 'design']}
        />
        <Input aria-label="Other suggestions" suggestions={['operations']} />
        <Button type="submit">Save</Button>
      </form>
      <output aria-label="Submitted value">{submitted()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
