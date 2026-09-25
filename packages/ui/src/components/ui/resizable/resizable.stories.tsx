import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Panel, PanelBody, PanelHeader, PanelTitle } from '../../layout/panel/panel'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable'

/**
 * Resizable.
 *
 * A split layout: panels the user can resize, with a handle between them. This is
 * the shape of every IDE-like surface — rail, file tree, editor, terminal.
 *
 * corvu supplies the pointer capture, the min/max constraints and the keyboard
 * resizing, which is what makes a divider operable without a mouse. The handle is a
 * real focusable element with an accessible role, so a split pane can be adjusted
 * from the keyboard; a bare `cursor-col-resize` div cannot.
 */
const meta = {
  title: 'Layout/Resizable',
  component: ResizablePanelGroup,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ResizablePanelGroup>

export default meta
type Story = StoryObj<typeof meta>

/** A two-pane split, which is the shape a file tree and an editor take. */
export const Horizontal: Story = {
  render: () => (
    <div class="h-screen p-4">
      <ResizablePanelGroup>
        <ResizablePanel initialSize={0.28} minSize={0.15}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Files</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p class="text-sm text-muted-foreground">
                Drag the divider, or focus it and use the arrow keys.
              </p>
            </PanelBody>
          </Panel>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={0.3}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Editor</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <p class="text-sm text-muted-foreground">
                The handle is widened with a pseudo-element, so the visible line stays a hairline
                while the hit target is comfortably grabbable.
              </p>
            </PanelBody>
          </Panel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
}

/** A vertical split, for an editor over a terminal. */
export const Vertical: Story = {
  render: () => (
    <div class="h-screen p-4">
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel initialSize={0.65} minSize={0.2}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Editor</PanelTitle>
            </PanelHeader>
            <PanelBody />
          </Panel>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize={0.15}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Terminal</PanelTitle>
            </PanelHeader>
            <PanelBody>
              <code class="text-xs">$ bun test</code>
            </PanelBody>
          </Panel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
}

/** Three panes: rail, list, detail. */
export const ThreePanes: Story = {
  render: () => (
    <div class="h-screen p-4">
      <ResizablePanelGroup>
        <ResizablePanel initialSize={0.2} minSize={0.12}>
          <Panel class="bg-sidebar">
            <PanelHeader>
              <PanelTitle>Sessions</PanelTitle>
            </PanelHeader>
          </Panel>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel initialSize={0.4} minSize={0.2}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Transcript</PanelTitle>
            </PanelHeader>
          </Panel>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel initialSize={0.4} minSize={0.2}>
          <Panel>
            <PanelHeader>
              <PanelTitle>Review</PanelTitle>
            </PanelHeader>
          </Panel>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
}
