import { render } from 'solid-js/web'
import { Stat, StatGroup } from '../../src/components/composites/stat/stat'
import '../../src/styles/globals.css'

// A function: a JSX element is one DOM tree and can be placed only once.
const stats = () => (
  <>
    <Stat label="Documents" value="12,480" />
    <Stat label="Chunks" value="96,210" />
    <Stat label="Sources" value="7" />
    <Stat label="Embedding cache hits" value="41,002" />
    <Stat label="Query cache" value="318 entries" />
    <Stat label="Retrieval fallbacks" value="0" />
    <Stat label="Answers total" value="1,204" />
  </>
)

render(
  () => (
    <main class="flex flex-col gap-6 p-2">
      <div id="narrow-fit" class="w-80">
        <StatGroup fit>{stats()}</StatGroup>
      </div>
      <div id="wide-fit" class="w-176">
        <StatGroup fit>{stats()}</StatGroup>
      </div>
      <div id="narrow-default" class="w-80">
        <StatGroup>{stats()}</StatGroup>
      </div>
      <div id="wide-default" class="w-176">
        <StatGroup>{stats()}</StatGroup>
      </div>
    </main>
  ),
  document.body
)
