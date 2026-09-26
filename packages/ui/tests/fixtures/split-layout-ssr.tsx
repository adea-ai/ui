import { renderToString } from 'solid-js/web'
import { SplitLayout } from '../../src/components/layout/split-layout/split-layout'
import { createLayoutState, splitPane } from '../../src/components/layout/split-layout/model'
export function renderLayout() {
  const state = splitPane(createLayoutState({ kind: 'leaf', id: 'first' }), 'first', {
    direction: 'row',
    placement: 'after',
    leaf: { kind: 'leaf', id: 'second' },
    splitId: 'root',
  })
  return renderToString(() => (
    <SplitLayout
      state={state}
      label="Server panes"
      labelForLeaf={(leaf) => leaf.id}
      renderLeaf={(leaf) => <p>{leaf().id}</p>}
      onResize={() => {}}
    />
  ))
}
