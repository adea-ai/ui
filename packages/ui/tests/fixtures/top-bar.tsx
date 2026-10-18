import { render } from 'solid-js/web'
import { createSignal, For } from 'solid-js'
import { ArrowLeft, ArrowRight, Search } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button'
import {
  TopBar,
  TopBarSearch,
  TopBarSection,
  TopBarTitle,
} from '../../src/components/layout/top-bar'
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
          <TopBarTitle class="hidden md:block">A long workspace title</TopBarTitle>
        </TopBarSection>
        <TopBarSearch
          placeholder="Search projects, files and sessions"
          shortcut="⌘K"
          keyshortcuts="Meta+K"
          onClick={() => setLastAction('Search projects, files and sessions')}
        />
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
      <TopBar draggable aria-label="Title-only toolbar">
        <TopBarSection />
        <TopBarTitle align="center" class="hidden md:block">
          A title without search
        </TopBarTitle>
        <TopBarSection align="end" />
      </TopBar>
      <TopBar aria-label="Wide centre toolbar" centerWidth="wide">
        <TopBarSection>
          <ActionButton
            tooltip="Toggle navigation"
            aria-label="Toggle navigation"
            size="icon-sm"
            onClick={() => setLastAction('Toggle navigation')}
          >
            <ArrowLeft aria-hidden="true" />
          </ActionButton>
          <TopBarTitle>Wide centre</TopBarTitle>
        </TopBarSection>
        <div class="flex w-full min-w-0 items-center gap-2 justify-self-center">
          <input
            aria-label="Search with an action"
            class="h-control-md min-w-0 flex-1 rounded-md border border-input px-3"
          />
          <ActionButton
            tooltip="Reflect"
            aria-label="Reflect"
            size="icon-sm"
            onClick={() => setLastAction('Reflect')}
          >
            <Search aria-hidden="true" />
          </ActionButton>
        </div>
        <TopBarSection align="end">
          <For each={['Status', 'Actions']}>
            {(name) => (
              <ActionButton
                tooltip={name}
                aria-label={`Wide ${name}`}
                size="icon-sm"
                onClick={() => setLastAction(`Wide ${name}`)}
              >
                <Search aria-hidden="true" />
              </ActionButton>
            )}
          </For>
        </TopBarSection>
      </TopBar>
      <TopBar aria-label="Wide centre compact toolbar" centerWidth="wide">
        <TopBarSection>
          <ActionButton
            tooltip="Compact navigation"
            aria-label="Compact navigation"
            size="icon-sm"
            onClick={() => setLastAction('Compact navigation')}
          >
            <ArrowLeft aria-hidden="true" />
          </ActionButton>
        </TopBarSection>
        <div class="flex w-full min-w-0 items-center gap-2 justify-self-center">
          <input
            aria-label="Compact search with an action"
            class="h-control-md min-w-0 flex-1 rounded-md border border-input px-3"
          />
          <ActionButton
            tooltip="Compact reflect"
            aria-label="Compact reflect"
            size="icon-sm"
            onClick={() => setLastAction('Compact reflect')}
          >
            <Search aria-hidden="true" />
          </ActionButton>
        </div>
        <TopBarSection align="end">
          <For each={['Status', 'Actions']}>
            {(name) => (
              <ActionButton
                tooltip={name}
                aria-label={`Compact ${name}`}
                size="icon-sm"
                onClick={() => setLastAction(`Compact ${name}`)}
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
