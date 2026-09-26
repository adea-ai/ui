import { createSignal, Show, onCleanup, type Accessor } from 'solid-js'
import { render } from 'solid-js/web'
import { SplitLayout } from '../../src/components/layout/split-layout/split-layout'
import {
  createLayoutState,
  splitPane,
  movePane,
  resizeSplit,
  closePane,
  focusPane,
  neighborLeaf,
  countLeaves,
  type SplitLayoutLeaf,
} from '../../src/components/layout/split-layout/model'
import '../../src/styles/globals.css'
function Fixture() {
  const [state, setState] = createSignal(createLayoutState({ kind: 'leaf', id: 'a' }))
  const [mounts, setMounts] = createSignal(0)
  const [unmounts, setUnmounts] = createSignal(0)
  const [visible, setVisible] = createSignal(true)
  const [moves, setMoves] = createSignal(0)
  let nextMove = 0
  const act = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail
    if (detail === 'split')
      setState((s) =>
        splitPane(s, 'a', {
          direction: 'row',
          placement: 'after',
          leaf: { kind: 'leaf', id: 'b' },
          splitId: 'ab',
        })
      )
    if (detail === 'nested')
      setState((s) =>
        splitPane(s, 'a', {
          direction: 'column',
          placement: 'after',
          leaf: { kind: 'leaf', id: 'c' },
          splitId: 'ac',
        })
      )
    if (detail === 'move') setState((s) => movePane(s, 'a', 'b', 'after', 'column', 'moved'))
    if (detail === 'eight') {
      for (const [target, id, direction] of [
        ['a', 'c', 'column'],
        ['b', 'd', 'column'],
        ['a', 'e', 'row'],
        ['c', 'f', 'row'],
        ['b', 'g', 'row'],
        ['d', 'h', 'row'],
      ] as const)
        setState((current) =>
          splitPane(current, target, {
            direction,
            placement: 'after',
            leaf: { kind: 'leaf', id },
            splitId: `eight-${id}`,
          })
        )
    }
    if (detail === 'unmount') setVisible(false)
    if (detail === 'resize') setState((s) => resizeSplit(s, 'ab', 0.7))
  }
  window.addEventListener('layout-fixture', act)
  onCleanup(() => window.removeEventListener('layout-fixture', act))
  function Content(props: { leaf: Accessor<SplitLayoutLeaf> }) {
    setMounts((n) => n + 1)
    onCleanup(() => setUnmounts((n) => n + 1))
    return <textarea aria-label={`Editor ${props.leaf().id}`} />
  }
  return (
    <main class="h-screen p-4">
      <h1>Binary pane fixture</h1>
      <output aria-label="Mounts">{mounts()}</output>
      <output aria-label="Unmounts">{unmounts()}</output>
      <output aria-label="Moves">{moves()}</output>
      <button
        type="button"
        aria-label="Move focused pane before previous pane"
        disabled={!neighborLeaf(state(), state().focusedLeafId, -1)}
        onClick={() => {
          const id = state().focusedLeafId
          const previous = neighborLeaf(state(), id, -1)
          if (previous)
            setState((s) => movePane(s, id, previous.id, 'before', 'row', `toolbar-${++nextMove}`))
        }}
      >
        Move pane left
      </button>
      <div class="h-96">
        <Show when={visible()}>
          <SplitLayout
            state={state()}
            label="Work panes"
            labelForLeaf={(leaf) => `Pane ${leaf.id}`}
            renderLeaf={(leaf) => <Content leaf={leaf} />}
            renderPaneActions={(leaf) => (
              <Show when={countLeaves(state().center) <= 2}>
                <button
                  type="button"
                  aria-label={`Move ${leaf().id} before previous pane`}
                  disabled={!neighborLeaf(state(), leaf().id, -1)}
                  onClick={() => {
                    const previous = neighborLeaf(state(), leaf().id, -1)
                    if (previous)
                      setState((s) =>
                        movePane(
                          s,
                          leaf().id,
                          previous.id,
                          'before',
                          'row',
                          `keyboard-${++nextMove}`
                        )
                      )
                  }}
                >
                  ←
                </button>
              </Show>
            )}
            onFocus={(id) => setState((s) => focusPane(s, id))}
            onResize={(id, ratio) => setState((s) => resizeSplit(s, id, ratio))}
            onMove={(id, target, intent) => {
              setMoves((count) => count + 1)
              setState((s) =>
                movePane(s, id, target, intent.placement, intent.direction, `drop-${++nextMove}`)
              )
            }}
            onClose={(id) => {
              const next = closePane(state(), id, () => ({ kind: 'leaf', id: 'placeholder' }))
              setState(next)
              return next.focusedLeafId
            }}
          />
        </Show>
      </div>
      <div class="h-32">
        <SplitLayout
          state={createLayoutState({ kind: 'leaf', id: 'a' })}
          label="Other work panes"
          labelForLeaf={() => 'Other pane'}
          renderLeaf={() => <input aria-label="Other editor" />}
          onResize={() => {}}
          onMove={() => setMoves((count) => count + 1)}
        />
      </div>
    </main>
  )
}
render(Fixture, document.body)
