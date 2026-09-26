import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal, Show } from 'solid-js'
import { ArrowLeft } from 'lucide-solid'
import { Button } from '../../ui/button'
import { SplitLayout } from './split-layout'
import {
  createLayoutState,
  splitPane,
  resizeSplit,
  closePane,
  focusPane,
  undoClosePane,
  movePane,
  neighborLeaf,
  countLeaves,
  type SplitLayoutState,
  type SplitLayoutLeaf,
} from './model'
const meta = {
  title: 'Layout/Binary split layout',
  component: SplitLayout,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  args: {
    state: createLayoutState({ kind: 'leaf', id: 'preview' }),
    label: 'Work panes',
    labelForLeaf: (leaf) => leaf.id,
    renderLeaf: () => null,
    onResize: () => {},
  },
} satisfies Meta<typeof SplitLayout>
export default meta
type Story = StoryObj<typeof meta>
function Demo(props: { nested?: boolean; eight?: boolean }) {
  let initial: SplitLayoutState<SplitLayoutLeaf> = createLayoutState({ kind: 'leaf', id: 'editor' })
  initial = splitPane(initial, 'editor', {
    direction: 'row',
    placement: 'after',
    leaf: { kind: 'leaf', id: 'terminal' },
    splitId: 'main',
  })
  if (props.nested)
    initial = splitPane(initial, 'editor', {
      direction: 'column',
      placement: 'after',
      leaf: { kind: 'leaf', id: 'review' },
      splitId: 'review-split',
    })
  if (props.eight) {
    for (const [target, id, direction] of [
      ['editor', 'c', 'column'],
      ['terminal', 'd', 'column'],
      ['editor', 'e', 'row'],
      ['c', 'f', 'row'],
      ['terminal', 'g', 'row'],
      ['d', 'h', 'row'],
    ] as const)
      initial = splitPane(initial, target, {
        direction,
        placement: 'after',
        leaf: { kind: 'leaf', id },
        splitId: `split-${id}`,
      })
  }
  const [state, setState] = createSignal(initial)
  let sequence = 0
  return (
    <div class="flex h-screen flex-col gap-2 p-4">
      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!neighborLeaf(state(), state().focusedLeafId, -1)}
          onClick={() => {
            const id = state().focusedLeafId
            const previous = neighborLeaf(state(), id, -1)
            if (previous)
              setState((s) => movePane(s, id, previous.id, 'before', 'row', `move-${++sequence}`))
          }}
        >
          Move pane left
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={countLeaves(state().center) >= 8}
          onClick={() => {
            const suffix = ++sequence
            setState((s) =>
              splitPane(s, s.focusedLeafId, {
                direction: 'row',
                placement: 'after',
                leaf: { kind: 'leaf', id: `new-${suffix}` },
                splitId: `new-split-${suffix}`,
              })
            )
          }}
        >
          Split pane
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!state().closed.length}
          onClick={() => setState(undoClosePane)}
        >
          Undo close
        </Button>
      </div>
      <div class="min-h-0 flex-1">
        <SplitLayout
          state={state()}
          label="Example work panes"
          labelForLeaf={(leaf) => leaf.id}
          onMove={(id, target, intent) =>
            setState((s) =>
              movePane(s, id, target, intent.placement, intent.direction, `move-${++sequence}`)
            )
          }
          renderPaneActions={(leaf) => (
            <Show when={!props.eight}>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={!neighborLeaf(state(), leaf().id, -1)}
                aria-label={`Move ${leaf().id} before previous pane`}
                onClick={() => {
                  const previous = neighborLeaf(state(), leaf().id, -1)
                  if (previous)
                    setState((s) =>
                      movePane(s, leaf().id, previous.id, 'before', 'row', `move-${++sequence}`)
                    )
                }}
              >
                <ArrowLeft />
              </Button>
            </Show>
          )}
          onFocus={(id) => setState((s) => focusPane(s, id))}
          onResize={(id, ratio) => setState((s) => resizeSplit(s, id, ratio))}
          onClose={(id) => {
            const next = closePane(state(), id, () => ({ kind: 'leaf', id: 'placeholder' }))
            setState(next)
            return next.focusedLeafId
          }}
          renderLeaf={(leaf) => (
            <textarea
              aria-label={`Draft in ${leaf().id}`}
              class="size-full resize-none bg-transparent p-2 text-foreground"
              placeholder="Type an unsent draft, resize, or close another pane."
            />
          )}
        />
      </div>
    </div>
  )
}
export const TwoPanes: Story = { render: () => <Demo /> }
export const NestedDirections: Story = { render: () => <Demo nested /> }
export const EightPanes: Story = { render: () => <Demo eight /> }
