import { For, createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Button } from '../../src/components/ui/button/button'
import { OrbitItem, OrbitLayout } from '../../src/components/layout/orbit-layout/orbit-layout'
import { VirtualWindow } from '../../src/components/layout/virtual-window/virtual-window'
import '../../src/styles/globals.css'

// OrbitItem's order: index 0 at three o'clock, then clockwise.
const [points, setPoints] = createSignal(['East', 'South', 'West', 'North'])
const [mode, setMode] = createSignal<'radial' | 'flow'>('radial')
const [virtualMetrics, setVirtualMetrics] = createSignal({ totalSize: 640, offset: 160 })

render(
  () => (
    <main class="flex flex-col gap-4 p-4">
      <Button
        data-add-orbit-item=""
        size="sm"
        variant="outline"
        onClick={() => setPoints((items) => [...items, 'Center'])}
      >
        Add orbit point
      </Button>
      <Button
        data-advance-virtual-window=""
        size="sm"
        variant="outline"
        onClick={() => setVirtualMetrics({ totalSize: 800, offset: 240 })}
      >
        Advance virtual window
      </Button>
      <Button
        data-toggle-orbit-mode=""
        size="sm"
        variant="outline"
        onClick={() => setMode((current) => (current === 'radial' ? 'flow' : 'radial'))}
      >
        Use {mode() === 'radial' ? 'flow' : 'radial'} layout
      </Button>
      <OrbitLayout
        data-orbit-host=""
        mode={mode()}
        role="list"
        aria-label="Orbit fixture"
        radius="min(29vw, calc(50% - 92px))"
        class="size-80 grid-cols-1 sm:grid-cols-2"
      >
        <For each={points()}>
          {(point, index) => (
            <OrbitItem
              index={index()}
              count={points().length}
              role="listitem"
              data-orbit-item={point}
            >
              <Button size="icon-lg" variant="outline" aria-label={point}>
                {point.slice(0, 1)}
              </Button>
            </OrbitItem>
          )}
        </For>
      </OrbitLayout>
      <div
        data-virtual-viewport=""
        class="h-48 w-80 overflow-auto"
        role="list"
        tabIndex={0}
        aria-label="Virtual window fixture"
      >
        <VirtualWindow totalSize={virtualMetrics().totalSize} offset={virtualMetrics().offset}>
          <div data-virtual-row="" class="h-10" role="listitem">
            First mounted row
          </div>
          <div class="h-10" role="listitem">
            Second mounted row
          </div>
        </VirtualWindow>
      </div>
    </main>
  ),
  document.body
)
