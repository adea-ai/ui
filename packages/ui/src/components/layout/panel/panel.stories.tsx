import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { MoreHorizontal, Play, RefreshCw } from 'lucide-solid'
import { Badge } from '../../ui/badge/badge'
import { Button } from '../../ui/button/button'
import {
  Panel,
  PanelActions,
  PanelBody,
  PanelCard,
  PanelDescription,
  PanelFooter,
  PanelHeader,
  PanelPlaceholder,
  PanelTitle,
  PanelToolbar,
} from './panel'

/**
 * Panel.
 *
 * A titled region inside the content area — an editor, an inspector, a list, a
 * terminal. It is the third level of surface after the shell and the sidebar, and
 * like them its parts are fixed: a header with a title and a toolbar, a scrolling
 * body, an optional footer.
 *
 * **The body scrolls and the header does not.** That is the whole reason this is a
 * component. A panel whose header scrolls away loses the name of what the user is
 * looking at, and every hand-built panel gets this wrong at least once.
 */
const meta = {
  title: 'Layout/Panel',
  component: Panel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof Panel>

export default meta
type Story = StoryObj<typeof meta>

/** Header with a title and actions, a toolbar, a scrolling body, a footer. */
export const Default: Story = {
  render: () => (
    <div class="h-screen p-4">
      <div class="h-full overflow-hidden rounded-xl border border-border">
        <Panel>
          <PanelHeader>
            <PanelTitle>Terminal</PanelTitle>
            <PanelDescription>bash · adea/feat-m12-397</PanelDescription>
            <PanelActions>
              <Button size="icon-sm" variant="ghost" aria-label="Restart">
                <RefreshCw />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </PanelActions>
          </PanelHeader>
          <PanelToolbar>
            <Badge variant="success" size="sm">
              live
            </Badge>
            <span class="text-xs text-muted-foreground">zsh</span>
          </PanelToolbar>
          <PanelBody bare>
            <pre class="p-3 font-mono text-xs leading-relaxed">
              {'$ bun test packages/ui/tests\n'}
              {'\n'}
              {' 37 pass\n'}
              {' 0 fail\n'}
              {' 103 expect() calls'}
            </pre>
          </PanelBody>
          <PanelFooter>
            <span class="text-xs text-muted-foreground">Exited 0</span>
            <Button size="xs" variant="outline" class="ms-auto">
              <Play />
              Re-run
            </Button>
          </PanelFooter>
        </Panel>
      </div>
    </div>
  ),
}

/** The placeholder, for a panel with nothing in it yet. */
export const Placeholder: Story = {
  render: () => (
    <div class="h-screen p-4">
      <div class="h-full overflow-hidden rounded-xl border border-border">
        <Panel>
          <PanelHeader>
            <PanelTitle>Artifacts</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <PanelPlaceholder>
              <span>Nothing has been produced in this session yet.</span>
              <Button size="xs" variant="outline">
                Run a lane
              </Button>
            </PanelPlaceholder>
          </PanelBody>
        </Panel>
      </div>
    </div>
  ),
}

/** The raised variant, for a panel floating over the canvas. */
export const Raised: Story = {
  render: () => (
    <div class="h-screen bg-surface-sunken p-0">
      <PanelCard>
        <PanelHeader>
          <PanelTitle>Floating panel</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <p class="text-sm text-muted-foreground">
            `PanelCard` adds the surface, the radius, the border and the margin. Use it when the
            panel sits on a canvas rather than filling its region.
          </p>
        </PanelBody>
      </PanelCard>
    </div>
  ),
}
