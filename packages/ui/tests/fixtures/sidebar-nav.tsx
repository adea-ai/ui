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
import '../../src/styles/globals.css'

render(() => {
  const [created, setCreated] = createSignal(0)
  const create = () => setCreated((count) => count + 1)
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
    </main>
  )
}, document.body)
