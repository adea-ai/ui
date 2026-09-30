import { render } from 'solid-js/web'

import {
  AppShell,
  AppShellBody,
  AppShellMain,
  SkipLink,
} from '../../src/components/layout/app-shell'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <AppShell>
      <SkipLink data-testid="default-skip-link" />
      <SkipLink
        class="w-fit"
        data-testid="custom-skip-link"
        href="#secondary-content"
        tabIndex={-1}
        title="Jump to secondary content"
      >
        Jump to secondary content
      </SkipLink>
      <AppShellBody>
        <AppShellMain id="main-content" tabIndex={-1} aria-label="Main content">
          <h1>Workspace</h1>
          <section id="secondary-content" tabIndex={-1} aria-label="Secondary content">
            <h2>Secondary content</h2>
          </section>
        </AppShellMain>
      </AppShellBody>
    </AppShell>
  )
}

render(Fixture, document.body)
