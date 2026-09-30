import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'

import { TextLink } from '../../src/components/ui/text-link'
import '../../src/styles/globals.css'

function Fixture() {
  const [clicked, setClicked] = createSignal(false)

  return (
    <main>
      <h1>TextLink test</h1>
      <p>
        Read the <TextLink href="#link-destination">accessibility guide</TextLink> to continue.
      </p>
      <p>
        <TextLink
          data-testid="external-link"
          href="https://example.test/docs?from=text-link"
          target="_blank"
          rel="noopener noreferrer"
          title="Open external documentation"
        >
          External documentation
        </TextLink>
      </p>
      <p>
        <TextLink
          class="w-fit"
          data-testid="event-link"
          href="/prevented-navigation"
          onClick={(event) => {
            event.preventDefault()
            setClicked(true)
          }}
        >
          Track click
        </TextLink>
      </p>
      <output data-testid="click-state">{clicked() ? 'clicked' : 'idle'}</output>
      <section id="link-destination" tabIndex={-1} aria-label="Accessibility guide">
        <h2>Accessibility guide</h2>
      </section>
    </main>
  )
}

render(Fixture, document.body)
