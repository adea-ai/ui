import { For, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button'
import { FloatingPreview } from '../../src/components/layout/floating-preview'
import '../../src/styles/globals.css'

const [source, setSource] = createSignal({ width: 1600, height: 1000 })

render(
  () => (
    <main class="relative h-screen w-screen">
      <h1 class="sr-only">Preview fixture</h1>
      <FloatingPreview
        label="Preview window"
        source={source()}
        onClose={() => (document.body.dataset['closed'] = 'true')}
        actions={
          <div class="flex items-center gap-1">
            <Button size="xs" variant="outline">
              Actions
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setSource({ width: 1000, height: 1000 })}
            >
              Change source ratio
            </Button>
          </div>
        }
      >
        <div class="flex flex-col gap-2 p-3">
          <p>Host supplied placeholder</p>
          <For each={Array.from({ length: 40 }, (_, index) => index + 1)}>
            {(index) => <p>Preview content item {index}</p>}
          </For>
        </div>
      </FloatingPreview>
    </main>
  ),
  document.body
)
