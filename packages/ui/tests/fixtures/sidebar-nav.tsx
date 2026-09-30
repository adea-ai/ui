import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import {
  SidebarNav,
  SidebarNavButton,
  SidebarNavContent,
  SidebarNavHeader,
  SidebarNavSection,
  SidebarNavTitle,
} from '../../src/components/layout/sidebar-nav/sidebar-nav'
import { Button } from '../../src/components/ui/button/button'
import { SidebarNavResizeHandle } from '../../src/components/layout/sidebar-nav/sidebar-nav-resize-handle'
import '../../src/styles/globals.css'

render(() => {
  const [created, setCreated] = createSignal(0)
  const create = () => setCreated((count) => count + 1)
  const [width, setWidth] = createSignal(272)
  const [committed, setCommitted] = createSignal(272)
  return (
    <main>
      <SidebarNav aria-label="Workspace navigation">
        <SidebarNavHeader>
          <SidebarNavTitle as="h1">Workspace</SidebarNavTitle>
        </SidebarNavHeader>
        <SidebarNavContent>
          <SidebarNavSection
            label="Rooms"
            headingAs="h2"
            action={<Button onClick={create}>New Room</Button>}
          >
            <SidebarNavButton>Product</SidebarNavButton>
          </SidebarNavSection>
          <SidebarNavSection
            label="Conversations"
            headingAs="h2"
            collapsible
            count={2}
            action={<Button onClick={create}>New conversation</Button>}
          >
            <SidebarNavButton>Research</SidebarNavButton>
          </SidebarNavSection>
        </SidebarNavContent>
      </SidebarNav>
      <output aria-label="Created sections">{created()}</output>
      <div
        id="resize-pane"
        class="relative h-80 w-(--fixture-width) overflow-hidden"
        style={{ '--fixture-width': `${width()}px` }}
      >
        <SidebarNavResizeHandle
          value={width()}
          minimum={208}
          maximum={448}
          controls="resize-pane"
          label="Resize workspace navigation"
          onChange={setWidth}
          onCommit={setCommitted}
        />
      </div>
      <output aria-label="Navigation width">{width()}</output>
      <output aria-label="Committed navigation width">{committed()}</output>
    </main>
  )
}, document.body)
