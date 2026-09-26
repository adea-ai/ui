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
  type SplitLayoutLeaf,
} from '../../src/components/layout/split-layout/model'
import '../../src/styles/globals.css'
function Fixture() {
  const [state, setState] = createSignal(createLayoutState({ kind: 'leaf', id: 'a' }))
  const [mounts, setMounts] = createSignal(0)
  const [unmounts, setUnmounts] = createSignal(0)
  const [visible, setVisible] = createSignal(true)
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
      <div class="h-96">
        <Show when={visible()}>
          <SplitLayout
            state={state()}
            label="Work panes"
            labelForLeaf={(leaf) => `Pane ${leaf.id}`}
            renderLeaf={(leaf) => <Content leaf={leaf} />}
            onFocus={(id) => setState((s) => focusPane(s, id))}
            onResize={(id, ratio) => setState((s) => resizeSplit(s, id, ratio))}
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
        />
      </div>
    </main>
  )
}
render(Fixture, document.body)
