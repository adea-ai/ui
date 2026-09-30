import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { Board } from '../../src/components/ui/board/board'
import { Button } from '../../src/components/ui/button/button'
import '../../src/styles/globals.css'

function Fixture() {
  const [items, setItems] = createSignal([{ id: 'card', column: 'todo' }])
  const [moves, setMoves] = createSignal(0)
  const [defer, setDefer] = createSignal(false)
  const row = { item: () => items()[0]! }
  return (
    <main>
      <Board
        columns={[
          { id: 'todo', label: 'To do' },
          { id: 'blocked', label: 'Blocked', disabled: true },
          { id: 'done', label: 'Done' },
        ]}
        items={[row]}
        itemId={(entry) => entry.item().id}
        itemColumn={(entry) => entry.item().column}
        canDrop={(_item, from, to) => from !== to && to !== 'blocked'}
        onMove={(move) => {
          setMoves((value) => value + 1)
          const apply = () => setItems([{ id: move.itemId, column: move.to }])
          if (defer()) setTimeout(apply, 750)
          else apply()
        }}
      >
        {() => <Button>Synthetic card</Button>}
      </Board>
      <Button onClick={() => setDefer(true)}>Defer moves</Button>
      <Button>Another action</Button>
      <output aria-label="Move count">{moves()}</output>
    </main>
  )
}
render(() => <Fixture />, document.body)
