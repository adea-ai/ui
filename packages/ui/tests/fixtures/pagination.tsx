import '../../src/styles/globals.css'
import { render } from 'solid-js/web'
import { Pagination } from '../../src/components/ui/pagination'

render(
  () => (
    <main>
      <Pagination count={84} defaultPage={40} />
    </main>
  ),
  document.body
)
