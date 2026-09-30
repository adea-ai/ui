import { render } from 'solid-js/web'
import { createSignal, For } from 'solid-js'
import { ArrowLeft, ArrowRight, Search } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button'
import { TopBar, TopBarSection, TopBarTitle } from '../../src/components/layout/top-bar'
import '../../src/styles/globals.css'

render(() => {
  const [lastAction, setLastAction] = createSignal('None')
  return (
    <main>
      <h1 class="sr-only">Workspace</h1>
      <TopBar draggable aria-label="Workspace toolbar">
        <TopBarSection>
          <ActionButton
            tooltip="Back"
            aria-label="Back"
            size="icon-sm"
            onClick={() => setLastAction('Back')}
          >
            <ArrowLeft aria-hidden="true" />
          </ActionButton>
          <ActionButton
            tooltip="Forward"
            aria-label="Forward"
            size="icon-sm"
            onClick={() => setLastAction('Forward')}
          >
            <ArrowRight aria-hidden="true" />
          </ActionButton>
        </TopBarSection>
        <TopBarTitle align="center" class="hidden md:block">
          A long workspace title
        </TopBarTitle>
        <TopBarSection align="end">
          <For each={['Files', 'Source control', 'Browser', 'Devices', 'Agents', 'Search']}>
            {(name) => (
              <ActionButton
                tooltip={name}
                aria-label={name}
                size="icon-sm"
                onClick={() => setLastAction(name)}
              >
                <Search aria-hidden="true" />
              </ActionButton>
            )}
          </For>
        </TopBarSection>
      </TopBar>
      <output aria-live="polite">{lastAction()}</output>
    </main>
  )
}, document.body)
