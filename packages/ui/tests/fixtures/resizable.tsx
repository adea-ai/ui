import { render } from 'solid-js/web'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../../src/components/ui/resizable/resizable'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main class="grid gap-4 p-4">
      <div data-testid="horizontal" class="h-48 w-96">
        <ResizablePanelGroup>
          <ResizablePanel initialSize={0.28}>Files</ResizablePanel>
          <ResizableHandle label="Resize files" />
          <ResizablePanel>Editor</ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div data-testid="vertical" class="h-48 w-96">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel initialSize={0.65}>Editor</ResizablePanel>
          <ResizableHandle label="Resize terminal" />
          <ResizablePanel>Terminal</ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div data-testid="leading-unsized" class="h-48 w-96">
        <ResizablePanelGroup>
          <ResizablePanel>Editor</ResizablePanel>
          <ResizableHandle label="Resize outline" />
          <ResizablePanel initialSize={0.25}>Outline</ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <div data-testid="unsized" class="h-48 w-96">
        <ResizablePanelGroup>
          <ResizablePanel>One</ResizablePanel>
          <ResizableHandle label="Resize one" />
          <ResizablePanel>Two</ResizablePanel>
          <ResizableHandle label="Resize two" />
          <ResizablePanel>Three</ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </main>
  )
}

render(() => <Fixture />, document.body)
