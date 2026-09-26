import { createSignal } from 'solid-js'
import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Badge } from '../badge'
import { Board, BoardCardBody, BoardCardTitle, type BoardColumn } from './board'

type Task = Readonly<{ id: string; title: string; priority: 'low' | 'normal' | 'urgent' }>

const columns: readonly BoardColumn[] = [
  { id: 'planned', label: 'Planned' },
  { id: 'in_progress', label: 'In-Progress' },
  { id: 'in_review', label: 'In-Review' },
  { id: 'done', label: 'Completed', disabled: true },
]

/**
 * Mirrors a server-side transition map: a card may only be dropped where the
 * server would accept the move. This is the contract the component refuses to
 * guess at.
 */
const legal: Record<string, readonly string[]> = {
  planned: ['in_progress', 'in_review'],
  in_progress: ['in_review', 'planned'],
  in_review: ['in_progress', 'planned'],
  done: [],
}

const initial: readonly Task[] = [
  { id: 't1', title: 'Port the appearance view', priority: 'urgent' },
  { id: 't2', title: 'Audit the rail against KiroCrew', priority: 'normal' },
  { id: 't3', title: 'Retire packages/ui in adea', priority: 'low' },
  { id: 't4', title: 'Document the theme axis', priority: 'normal' },
]

const columnOf: Record<string, string> = {
  t1: 'in_progress',
  t2: 'planned',
  t3: 'planned',
  t4: 'in_review',
}

const priorityVariant = {
  low: 'subtle',
  normal: 'secondary',
  urgent: 'warning',
} as const

const meta = {
  title: 'UI/Board',
  component: Board,
  tags: ['autodocs'],
  // The required props, so a story that supplies only a `render` is still typed.
  args: {
    columns,
    items: initial,
    itemId: (task: Task) => task.id,
    itemColumn: (task: Task) => columnOf[task.id] ?? 'planned',
    canDrop: (_task: Task, from: string, to: string) => (legal[from] ?? []).includes(to),
    onMove: () => undefined,
    children: (task: Task) => <BoardCardBody>{task.title}</BoardCardBody>,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Columns of cards with drag between them. The column ids are the caller's and so is the rule deciding which moves are legal, so the board never encodes a state machine the server would reject. A column that cannot receive the dragged card renders as unavailable rather than silently accepting the drop. Keyboard: focus a card and press Ctrl/Cmd + arrow to move it; the result is announced.",
      },
    },
  },
} satisfies Meta<typeof Board<Task>>

export default meta
type Story = StoryObj<typeof meta>

function BoardExample() {
  const [placement, setPlacement] = createSignal({ ...columnOf })

  return (
    <Board
      columns={columns}
      items={initial}
      itemId={(task) => task.id}
      itemColumn={(task) => placement()[task.id] ?? 'planned'}
      canDrop={(_task, from, to) => (legal[from] ?? []).includes(to)}
      onMove={(move) => setPlacement((current) => ({ ...current, [move.itemId]: move.to }))}
      class="max-w-3xl"
      emptyColumn={(column) => `No tasks in ${column.label}`}
    >
      {(task) => (
        <BoardCardBody>
          <BoardCardTitle>{task.title}</BoardCardTitle>
          <Badge variant={priorityVariant[task.priority]} size="sm">
            {task.priority}
          </Badge>
        </BoardCardBody>
      )}
    </Board>
  )
}

export const Default: Story = {
  render: () => <BoardExample />,
}

/** An empty column states what is missing rather than showing a blank lane. */
export const EmptyColumns: Story = {
  render: () => (
    <Board
      columns={[
        { id: 'a', label: 'Empty lane' },
        { id: 'b', label: 'Another', meta: '0' },
      ]}
      items={[]}
      itemId={(item: Task) => item.id}
      itemColumn={() => 'a'}
      canDrop={() => true}
      onMove={() => undefined}
      class="max-w-xl"
    >
      {(task) => <BoardCardBody>{task.title}</BoardCardBody>}
    </Board>
  ),
}

/** A column with a count in its header. */
export const WithCounts: Story = {
  render: () => (
    <Board
      columns={[
        { id: 'planned', label: 'Planned', meta: '2' },
        { id: 'in_progress', label: 'In-Progress', meta: '1' },
        { id: 'in_review', label: 'In-Review', meta: '1' },
        { id: 'done', label: 'Completed', meta: '0', disabled: true },
      ]}
      items={initial}
      itemId={(task) => task.id}
      itemColumn={(task) => columnOf[task.id] ?? 'planned'}
      canDrop={(_task, from, to) => (legal[from] ?? []).includes(to)}
      onMove={() => undefined}
      class="max-w-3xl"
    >
      {(task) => <BoardCardBody>{task.title}</BoardCardBody>}
    </Board>
  ),
}

/** Many cards, to show a lane scrolling with the page rather than each column. */
export const LongLanes: Story = {
  render: () => (
    <Board
      columns={[{ id: 'one', label: 'Everything', meta: '24' }]}
      items={Array.from({ length: 24 }, (_, index) => ({
        id: `x${index}`,
        title: `Card ${index + 1}`,
        priority: 'normal' as const,
      }))}
      itemId={(task) => task.id}
      itemColumn={() => 'one'}
      canDrop={() => false}
      onMove={() => undefined}
      class="max-w-xs"
    >
      {(task) => <BoardCardBody>{task.title}</BoardCardBody>}
    </Board>
  ),
}
