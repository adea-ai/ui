import { render } from 'solid-js/web'
import { WorkspaceMark } from '../../src/components/composites/workspace-mark/workspace-mark'
import { Badge } from '../../src/components/ui/badge/badge'
import '../../src/styles/globals.css'

// The story's rail shape: one active mark, one idle, one carrying a count.
render(
  () => (
    <main class="flex flex-col gap-2 bg-background p-6">
      <WorkspaceMark name="adea" active />
      <WorkspaceMark
        name="plugins"
        badge={
          <Badge size="sm" variant="notification">
            2
          </Badge>
        }
      />
      <WorkspaceMark
        name="control-plane"
        badge={
          <Badge size="sm" variant="notification">
            12
          </Badge>
        }
      />
    </main>
  ),
  document.body
)
