import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Terminal } from '../../src/components/composites/terminal'
import '../../src/styles/globals.css'

type FixtureWindow = Window & {
  appendParked?: (count: number) => void
  appendRetained?: (count: number) => void
  appendUnfinished?: () => void
  advanceProgress?: () => void
  restartParked?: () => void
}

const lines = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => `line ${from + index}`).join('\n') + '\n'

const [parked, setParked] = createSignal(lines(0, 100))
const [retained, setRetained] = createSignal(lines(0, 100))
const [progress, setProgress] = createSignal(`${lines(200, 100)}Downloading 10%`)
let parkedCount = 100
let retainedCount = 100

;(window as FixtureWindow).appendParked = (count) => {
  setParked((output) => output + lines(parkedCount, count))
  parkedCount += count
}
;(window as FixtureWindow).appendRetained = (count) => {
  setRetained((output) => output + lines(retainedCount, count))
  retainedCount += count
}
;(window as FixtureWindow).appendUnfinished = () => setParked((output) => output + 'building layer')
;(window as FixtureWindow).advanceProgress = () =>
  setProgress((output) => output + '\rDownloading 20%')
;(window as FixtureWindow).restartParked = () => {
  parkedCount = 30
  setParked(lines(1000, 30))
}

render(
  () => (
    <main class="w-2xl max-w-full p-4">
      <Terminal command="parked" output={parked()} maxLines={20} maxHeight={120} />
      <Terminal command="progress" output={progress()} maxLines={20} maxHeight={120} />
      <div class="h-6" />
      <Terminal
        command="retention"
        output={retained()}
        maxLines={40}
        retainLines={100}
        maxHeight={120}
      />
    </main>
  ),
  document.body
)
