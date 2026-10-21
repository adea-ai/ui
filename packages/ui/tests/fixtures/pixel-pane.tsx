import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { PixelPane } from '../../src/components/layout/pixel-pane/pixel-pane'
import '../../src/styles/globals.css'

type Live = { width: number | undefined; style: 'none' | 'string' | 'object' }

const styles = {
  none: undefined,
  string: 'background-color: rgb(1, 2, 3)',
  object: { '--pane-tone': 'kept' },
} as const

function Fixture() {
  const [live, setLive] = createSignal<Live>({ width: 120, style: 'none' })
  Object.assign(window, {
    paneFixture: { set: (next: Live) => setLive(next) },
  })

  return (
    <main class="p-4">
      <div data-testid="row" class="flex h-32 w-150">
        <PixelPane width={200} aria-label="Fixed">
          Fixed
        </PixelPane>
        <PixelPane aria-label="Flexible">Flexible</PixelPane>
        <PixelPane width={150.4} aria-label="Rounded">
          Rounded
        </PixelPane>
      </div>
      <div data-testid="styled" class="flex h-32 w-150">
        <PixelPane
          width={200}
          aria-label="String style"
          style="background-color: rgb(1, 2, 3); padding: 10px"
        >
          String
        </PixelPane>
        <PixelPane width={100} aria-label="Object style" style={{ '--pane-tone': 'kept' }}>
          Object
        </PixelPane>
        <PixelPane
          width={100}
          aria-label="Own basis"
          style="flex-basis: 10px; color: rgb(7, 8, 9);"
        >
          Own basis
        </PixelPane>
      </div>
      <div data-testid="live" class="flex h-32 w-150">
        {/* The style prop changes kind at run time, which is what the spec exercises. */}
        {/* oxlint-disable-next-line shadcn/no-inline-styles */}
        <PixelPane aria-label="Live" width={live().width} style={styles[live().style]}>
          Live
        </PixelPane>
        <PixelPane aria-label="Live rest">Rest</PixelPane>
      </div>
      <div data-testid="crowded" class="flex h-32 w-75">
        <PixelPane width={400} aria-label="Too wide">
          <p class="w-225">Wider than its pane</p>
        </PixelPane>
      </div>
    </main>
  )
}

render(() => <Fixture />, document.body)
