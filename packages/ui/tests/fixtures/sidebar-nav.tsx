import { render } from 'solid-js/web'
import { createSignal } from 'solid-js'
import {
  SidebarNav,
  SidebarNavButton,
  SidebarNavContent,
  SidebarNavHeader,
  SidebarNavItem,
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
  const [savedProjectsOpen, setSavedProjectsOpen] = createSignal(true)
  const [savedAgentsOpen, setSavedAgentsOpen] = createSignal(false)
  const [filtering, setFiltering] = createSignal(false)
  const [selectedSection, setSelectedSection] = createSignal('Projects')
  const [reordered, setReordered] = createSignal('none')
  const [dragStarted, setDragStarted] = createSignal(false)
  const [cancelClicks, setCancelClicks] = createSignal(0)
  const [cancelableReordered, setCancelableReordered] = createSignal(false)
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
            <SidebarNavItem as="button" type="button" active>
              Product
            </SidebarNavItem>
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
          <button type="button" onClick={() => setFiltering(true)}>
            Show matching sections
          </button>
          <button type="button" onClick={() => setFiltering(false)}>
            Clear section filter
          </button>
          <output aria-label="Saved projects disclosure">{String(savedProjectsOpen())}</output>
          <output aria-label="Saved agents disclosure">{String(savedAgentsOpen())}</output>
          <SidebarNavSection
            label="Projects"
            active={selectedSection() === 'Projects'}
            collapsible
            open={filtering() || savedProjectsOpen()}
            onOpenChange={setSavedProjectsOpen}
            triggerProps={{
              id: 'projects-section-disclosure',
              onClick: () => setSelectedSection('Projects'),
              'aria-description': 'Press Alt with Arrow Up or Arrow Down to reorder Projects.',
              draggable: true,
              ref: (element) => {
                element.dataset.refConfirmed = 'true'
              },
              onDragStart: () => setDragStarted(true),
              onReorder: (direction) => setReordered(direction),
            }}
          >
            <SidebarNavButton>Product</SidebarNavButton>
          </SidebarNavSection>
          <SidebarNavSection
            label="Agents"
            active={selectedSection() === 'Agents'}
            triggerProps={{ onClick: () => setSelectedSection('Agents') }}
            collapsible
            open={filtering() || savedAgentsOpen()}
            onOpenChange={setSavedAgentsOpen}
          >
            <SidebarNavButton>Research Agent</SidebarNavButton>
          </SidebarNavSection>
          <SidebarNavSection
            label="Cancelable"
            collapsible
            open={false}
            triggerProps={{
              onClick: (event) => {
                setCancelClicks((count) => count + 1)
                event.preventDefault()
              },
              onKeyDown: (event) => {
                if (event.altKey) event.preventDefault()
              },
              onReorder: () => setCancelableReordered(true),
            }}
          >
            <SidebarNavButton>Must remain closed</SidebarNavButton>
          </SidebarNavSection>
          <output aria-label="Section reorder direction">{reordered()}</output>
          <output aria-label="Section drag started">{String(dragStarted())}</output>
          <output aria-label="Canceled disclosure clicks">{cancelClicks()}</output>
          <output aria-label="Canceled disclosure reorder">{String(cancelableReordered())}</output>
        </SidebarNavContent>
      </SidebarNav>
      <output aria-label="Created sections">{created()}</output>
      <div class="h-80">
        <SidebarNav
          id="resize-pane"
          as="aside"
          aria-label="Resizable navigation"
          class="relative overflow-hidden"
          style={{ '--sidebar-width': `${width()}px` }}
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
        </SidebarNav>
      </div>
      <output aria-label="Navigation width">{width()}</output>
      <output aria-label="Committed navigation width">{committed()}</output>
    </main>
  )
}, document.body)
