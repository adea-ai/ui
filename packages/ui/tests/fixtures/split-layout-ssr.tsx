import { renderToString } from 'solid-js/web'
import { SplitLayout as RootSplitLayout, createLayoutState, splitPane } from '@adea-ai/ui'
import { SplitLayout as SubpathSplitLayout } from '@adea-ai/ui/components/layout/split-layout'

export function renderLayout() {
  const rootState = splitPane(createLayoutState({ kind: 'leaf', id: 'first' }), 'first', {
    direction: 'row',
    placement: 'after',
    leaf: { kind: 'leaf', id: 'second' },
    splitId: 'root',
  })
  const subpathState = splitPane(
    createLayoutState({ kind: 'leaf', id: 'subpath-first' }),
    'subpath-first',
    {
      direction: 'column',
      placement: 'after',
      leaf: { kind: 'leaf', id: 'subpath-second' },
      splitId: 'subpath-root',
    }
  )
  return renderToString(() => (
    <main>
      <RootSplitLayout
        state={rootState}
        label="Server panes"
        labelForLeaf={(leaf) => leaf.id}
        renderLeaf={(leaf) => <p>{leaf().id}</p>}
        onResize={() => {}}
      />
      <SubpathSplitLayout
        state={subpathState}
        label="Subpath server panes"
        labelForLeaf={(leaf) => leaf.id}
        renderLeaf={(leaf) => <p>{leaf().id}</p>}
        onResize={() => {}}
      />
    </main>
  ))
}
