import { render } from 'solid-js/web'
import { PixelPane } from '../../src/components/layout/pixel-pane/pixel-pane'
import '../../src/styles/globals.css'

render(
  () => (
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
      <div data-testid="crowded" class="flex h-32 w-75">
        <PixelPane width={400} aria-label="Too wide">
          <p class="w-225">Wider than its pane</p>
        </PixelPane>
      </div>
    </main>
  ),
  document.body
)
