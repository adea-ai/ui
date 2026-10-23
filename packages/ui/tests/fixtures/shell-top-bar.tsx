import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import { ChevronLeft, ChevronRight, Home, PanelLeft, Plus, Settings } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button'
import { WorkspaceSwitcher } from '../../src/components/composites/workspace-switcher/workspace-switcher'
import { TopBarBreadcrumb, TopBarSearch } from '../../src/components/layout/top-bar'
import { ShellTopBar } from '../../src/components/layout/shell-top-bar'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

render(() => {
  const [value, setValue] = createSignal('home')
  return (
    <main>
      <h1 class="sr-only">Workspace</h1>
      <ShellTopBar
        aria-label="Workspace toolbar"
        sidebarOpen
        navigation={
          <>
            <ActionButton variant="ghost" size="sm" aria-label="Back" tooltip="Back">
              <ChevronLeft aria-hidden="true" />
            </ActionButton>
            <ActionButton variant="ghost" size="sm" aria-label="Forward" tooltip="Forward">
              <ChevronRight aria-hidden="true" />
            </ActionButton>
          </>
        }
        sidebarToggle={
          <ActionButton
            variant="ghost"
            size="sm"
            aria-label="Collapse sidebar"
            tooltip="Collapse sidebar"
          >
            <PanelLeft aria-hidden="true" />
          </ActionButton>
        }
        workspace={
          <WorkspaceSwitcher
            value={value()}
            onValueChange={setValue}
            workspaces={[
              { id: 'home', name: 'Home', mark: <Home class="size-4" /> },
              { id: 'adea', name: 'adea', mark: <Home class="size-4" /> },
            ]}
          />
        }
        breadcrumb={
          <TopBarBreadcrumb>
            <span class="truncate">Projects</span>
            <span aria-hidden="true">/</span>
            <span class="truncate font-medium">Redesign</span>
          </TopBarBreadcrumb>
        }
        search={<TopBarSearch placeholder="Search" shortcut="⌘K" keyshortcuts="Meta+K" />}
        actions={
          <>
            <Button size="sm" variant="ghost" aria-label="New session">
              <Plus aria-hidden="true" />
            </Button>
            <Button size="sm" variant="ghost" aria-label="Settings">
              <Settings aria-hidden="true" />
            </Button>
          </>
        }
      />
    </main>
  )
}, document.body)
