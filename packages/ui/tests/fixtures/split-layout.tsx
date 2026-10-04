import { createSignal, Show, onCleanup, type Accessor } from 'solid-js'
import { render } from 'solid-js/web'
import { SplitLayout } from '../../src/components/layout/split-layout/split-layout'
import {
  createLayoutState,
  splitPane,
  splitPaneBalanced,
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
  const [hidden, setHidden] = createSignal(false)
  const [moves, setMoves] = createSignal(0)
  const [hostPresentation, setHostPresentation] = createSignal(false)
  const [dragPreviewContent, setDragPreviewContent] = createSignal(false)
  const [hostState, setHostState] = createSignal(
    splitPane(createLayoutState({ kind: 'leaf', id: 'host-a' }), 'host-a', {
      direction: 'row',
      placement: 'after',
      leaf: { kind: 'leaf', id: 'host-b' },
      splitId: 'host-split',
    })
  )
  let nextMove = 0
  let nextBalanced = 0
  const act = (event: Event) => {
    const detail = (event as CustomEvent<string>).detail
    if (detail === 'balanced') {
      const sequence = ++nextBalanced
      setState((s) =>
        splitPaneBalanced(s, s.focusedLeafId, {
          placement: 'after',
          leaf: { kind: 'leaf', id: `balanced-${sequence}` },
          splitId: `balanced-split-${sequence}`,
        })
      )
    }
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
    if (detail === 'hide') setHidden(true)
    if (detail === 'show') setHidden(false)
    if (detail === 'hide-unmount') {
      setHidden(true)
      setVisible(false)
    }
    if (detail === 'hidden-mount') setVisible(true)
    if (detail === 'host-presentation') setHostPresentation(true)
    if (detail === 'drag-preview-content') setDragPreviewContent(true)
    if (detail === 'resize') setState((s) => resizeSplit(s, 'ab', 0.7))
  }
  window.addEventListener('layout-fixture', act)
  onCleanup(() => window.removeEventListener('layout-fixture', act))
  function Content(props: { leaf: Accessor<SplitLayoutLeaf> }) {
    setMounts((n) => n + 1)
    onCleanup(() => setUnmounts((n) => n + 1))
    return (
      <Show
        when={dragPreviewContent()}
        fallback={<textarea aria-label={`Editor ${props.leaf().id}`} />}
      >
        <div class="flex min-h-0 min-w-0 flex-col gap-1">
          <canvas
            aria-label={`Terminal canvas ${props.leaf().id}`}
            data-preview-canvas=""
            width="1024"
            height="512"
            class="size-4"
            ref={(canvas) => {
              const context = canvas.getContext('2d')
              if (!context) return
              context.fillStyle = 'rgb(18, 52, 86)'
              context.fillRect(0, 0, 1024, 512)
            }}
          />
          <svg
            data-preview-svg=""
            aria-hidden="true"
            viewBox="0 0 8 8"
            class="size-4"
            ref={(svg) =>
              svg.setAttribute(
                'onload',
                'window.dragPreviewSvgLoads = (window.dragPreviewSvgLoads ?? 0) + 1'
              )
            }
          >
            <circle cx="4" cy="4" r="3" fill="currentColor" />
          </svg>
          <iframe
            title={`Embedded preview ${props.leaf().id}`}
            data-preview-resource="iframe"
            src="https://drag-preview.invalid/frame"
          />
          <video data-preview-resource="video" src="https://drag-preview.invalid/video.mp4" />
          <audio data-preview-resource="audio" src="https://drag-preview.invalid/audio.mp3" />
          <object data-preview-resource="object" data="https://drag-preview.invalid/object.bin" />
          <embed data-preview-resource="embed" src="https://drag-preview.invalid/embed.bin" />
        </div>
      </Show>
    )
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
      <div class="h-96" hidden={hidden()}>
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
      <Show when={hostPresentation()}>
        <div class="h-32">
          <SplitLayout
            state={hostState()}
            label="Host work panes"
            labelForLeaf={(leaf) => `Host region ${leaf.id}`}
            paneTabIndex={0}
            renderPaneLabel={(leaf) => (
              <>
                <span aria-hidden="true">⌘</span>
                <span data-host-label="">
                  Host header {leaf().id}
                  {leaf().id === 'host-b' ? ' with a long filename that should truncate' : ''}
                </span>
              </>
            )}
            labelForSeparator={() => 'Resize workspace panes'}
            renderLeaf={(leaf) => <textarea aria-label={`Host editor ${leaf().id}`} />}
            onFocus={(id) => setHostState((current) => focusPane(current, id))}
            onResize={(id, ratio) => setHostState((current) => resizeSplit(current, id, ratio))}
          />
        </div>
      </Show>
    </main>
  )
}
render(Fixture, document.body)
