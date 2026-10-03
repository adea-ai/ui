import { render } from 'solid-js/web'
import { AspectRatio } from '../../src/components/ui/aspect-ratio/aspect-ratio'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main class="grid w-64 gap-4">
      <AspectRatio data-testid="object-style" ratio={2} style={{ '--caller-style': 'kept' }}>
        <div>Object style</div>
      </AspectRatio>
      <AspectRatio data-testid="string-style" ratio={2} style="--caller-style: kept">
        <div>String style</div>
      </AspectRatio>
    </main>
  )
}

render(() => <Fixture />, document.body)
