import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button'
import { FloatingPreview } from '../../src/components/layout/floating-preview'
import '../../src/styles/globals.css'

render(
  () => (
    <main style={{ position: 'relative', width: 'min(640px, 100vw)', height: 'min(480px, 100vh)' }}>
      <h1 class="sr-only">Preview fixture</h1>
      <FloatingPreview
        label="Preview window"
        source={{ width: 1600, height: 1000 }}
        onClose={() => (document.body.dataset['closed'] = 'true')}
        actions={
          <Button size="xs" variant="outline">
            Actions
          </Button>
        }
      >
        <div>Host supplied placeholder</div>
      </FloatingPreview>
    </main>
  ),
  document.body
)
