import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import { Button } from '../../src/components/ui/button/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../src/components/ui/dropdown-menu'
import {
  SidebarNavItem,
  SidebarNavSection,
} from '../../src/components/layout/sidebar-nav/sidebar-nav'
import {
  ContextualSidebar,
  PixelResizeHandle,
} from '../../src/components/layout/contextual-sidebar'
import '../../src/styles/globals.css'
import './contextual-sidebar.fixture.css'

type FixtureOptions = {
  open?: boolean
  wideViewportAtLoad?: boolean
}

declare global {
  interface Window {
    contextualSidebarFixture?: FixtureOptions
  }
}

render(() => {
  const options = window.contextualSidebarFixture ?? {}
  const [open, setOpen] = createSignal(options.open ?? true)
  const [width, setWidth] = createSignal(272)
  const [savedWidth, setSavedWidth] = createSignal(272)
  const [rightWidth, setRightWidth] = createSignal(272)
  const [rightCommits, setRightCommits] = createSignal<number[]>([])
  let layout: HTMLElement | undefined
  let opener: HTMLButtonElement | undefined
  let rightHost: HTMLElement | undefined
  const updateRightWidth = (next: number) => {
    setRightWidth(next)
    rightHost?.style.setProperty('--right-width', `${next}px`)
  }

  const updateWidth = (next: number) => {
    setWidth(next)
    layout?.style.setProperty('--sidebar-width', `${next}px`)
  }

  return (
    <>
      <main class="workspace-sidebar-fixture-layout" data-sidebar-open={String(open())}>
        <header class="workspace-sidebar-fixture-topbar">
          <div id="sidebar-topbar-segment" class="workspace-sidebar-fixture-topbar-start" />
          <div>
            <Button
              ref={(element) => {
                opener = element
              }}
              onClick={() => setOpen((value) => !value)}
            >
              Toggle workspace navigation
            </Button>
          </div>
        </header>
        <div
          id="sidebar-column"
          class="workspace-sidebar-fixture-sidebar"
          ref={(element) => {
            const shell = element.parentElement
            queueMicrotask(() => {
              layout = shell ?? undefined
              layout?.style.setProperty('--sidebar-width', `${width()}px`)
            })
          }}
        >
          <ContextualSidebar
            id="fixture-contextual-sidebar"
            label="Workspace navigation"
            title="Workspace"
            headingAs="h1"
            open={open()}
            onOpenChange={setOpen}
            wideViewportAtLoad={options.wideViewportAtLoad ?? false}
            width={width()}
            minimum={208}
            maximum={448}
            step={16}
            resizeLabel="Resize workspace navigation"
            restoreFocusRef={() => opener}
            onWidthChange={updateWidth}
            onWidthCommit={setSavedWidth}
            content={(context) => (
              <>
                <SidebarNavSection label="Projects" headingAs="h2" count={1}>
                  <SidebarNavItem as="button" type="button" active>
                    Atlas workspace
                  </SidebarNavItem>
                </SidebarNavSection>
                <DropdownMenu>
                  <DropdownMenuTrigger as={Button} size="sm" variant="ghost">
                    Project actions
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    portalMount={context.mobile ? context.portalMount() : undefined}
                  >
                    <DropdownMenuItem>Rename project</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <output aria-label="Rendered sidebar mode">
                  {context.mobile ? 'mobile' : 'desktop'}
                </output>
              </>
            )}
            footer={() => (
              <Button size="sm" variant="ghost">
                Archived items
              </Button>
            )}
          />
        </div>
        <section class="workspace-sidebar-fixture-main" aria-label="View content">
          <output aria-label="Projected sidebar width">{width()}</output>
          <output aria-label="Committed sidebar width">{savedWidth()}</output>
        </section>
      </main>
      <aside
        aria-label="Right utility"
        id="right-ruler-host"
        class="workspace-sidebar-fixture-right-ruler"
        ref={(element) => {
          rightHost = element
          element.style.setProperty('--right-width', `${rightWidth()}px`)
        }}
      >
        <PixelResizeHandle
          side="right"
          value={rightWidth()}
          minimum={208}
          maximum={448}
          step={16}
          label="Resize right utility"
          controls="right-ruler-host"
          onChange={updateRightWidth}
          onCommit={(value) => setRightCommits((previous) => [...previous, value])}
        />
        <output aria-label="Right utility width">{rightWidth()}</output>
        <output aria-label="Right utility commit count">{rightCommits().length}</output>
        <output aria-label="Right utility committed width">
          {rightCommits().at(-1) ?? rightWidth()}
        </output>
      </aside>
    </>
  )
}, document.body)
