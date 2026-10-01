import { renderToString } from 'solid-js/web'
import { SplitLayout } from '../../src/components/layout/split-layout/split-layout'
import { createLayoutState, splitPane } from '../../src/components/layout/split-layout/model'
import {
  SidebarNav,
  SidebarNavContent,
  SidebarNavItem,
  SidebarNavRow,
  SidebarNavSection,
} from '../../src/components/layout/sidebar-nav/sidebar-nav'
export function renderLayout() {
  const state = splitPane(createLayoutState({ kind: 'leaf', id: 'first' }), 'first', {
    direction: 'row',
    placement: 'after',
    leaf: { kind: 'leaf', id: 'second' },
    splitId: 'root',
  })
  return renderToString(() => (
    <SplitLayout
      state={state}
      label="Server panes"
      labelForLeaf={(leaf) => leaf.id}
      renderLeaf={(leaf) => <p>{leaf().id}</p>}
      onResize={() => {}}
    />
  ))
}

export function renderSidebar() {
  return renderToString(() => (
    <SidebarNav aria-label="Server workspace navigation">
      <SidebarNavContent>
        <SidebarNavSection label="Server projects" active collapsible headingAs="h2">
          <SidebarNavRow actions={<span>Server row status</span>}>
            <SidebarNavItem href="/server-project" active>
              Server project
            </SidebarNavItem>
          </SidebarNavRow>
        </SidebarNavSection>
      </SidebarNavContent>
    </SidebarNav>
  ))
}
