import { render } from 'solid-js/web'

import { Button } from '../../src/components/ui/button'
import { downloadBlob } from '../../src/lib/download'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main>
      <h1>Download test</h1>
      <Button
        type="button"
        onClick={() =>
          downloadBlob(
            new Blob(['workspace export'], { type: 'application/json' }),
            'workspace.json'
          )
        }
      >
        Download workspace
      </Button>
    </main>
  )
}

render(Fixture, document.body)
