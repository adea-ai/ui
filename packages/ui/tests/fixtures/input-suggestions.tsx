import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Input } from '../../src/components/ui/input/input'
import { InputControl } from '../../src/components/ui/input/input-control'
import { Button } from '../../src/components/ui/button/button'
import { Label } from '../../src/components/ui/label/label'
import '../../src/styles/globals.css'

function Fixture() {
  const [value, setValue] = createSignal('')
  const [search, setSearch] = createSignal('')
  const [submitted, setSubmitted] = createSignal('')
  let searchInput: HTMLInputElement | undefined
  return (
    <main>
      <label for="app-search">App search</label>
      <InputControl
        ref={(element) => (searchInput = element)}
        id="app-search"
        name="search"
        type="search"
        aria-label="Search apps"
        data-test="native-props-forwarded"
        value={search()}
        onInput={(event) => setSearch(event.currentTarget.value)}
      />
      <output aria-label="Search value">{search()}</output>
      <Button onClick={() => searchInput?.focus()}>Focus search</Button>
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
