import { render } from 'solid-js/web'
import { Progress } from '../../src/components/ui/progress/progress'
import '../../src/styles/globals.css'

function Fixture() {
  return (
    <main>
      <Progress value={42} label="Preparing archive" />
      <Progress value={64} aria-label="Refreshing session" hideValue />
    </main>
  )
}

render(() => <Fixture />, document.body)
