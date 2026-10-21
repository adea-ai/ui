import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createSignal } from 'solid-js'
import { Home } from 'lucide-solid'
import { Badge } from '../../ui/badge/badge'
import { WorkspaceSwitcher } from './workspace-switcher'

/**
 * WorkspaceSwitcher.
 *
 * The picker in the top bar that names the workspace the window is looking at.
 * Choosing a workspace changes the view and nothing else; the switcher reports
 * an id and owns no lifecycle, so a host cannot wire it to restart or move work
 * by accident. It is one menu rather than the nested accordion a sidebar would
 * use, because the sidebar under it already shows what is inside.
 */
const meta = {
  title: 'Composites/Workspace switcher',
  component: WorkspaceSwitcher,
  parameters: { layout: 'padded' },
  args: { workspaces: [], value: undefined, onValueChange: () => {} },
  tags: ['autodocs'],
} satisfies Meta<typeof WorkspaceSwitcher>

export default meta
type Story = StoryObj<typeof meta>

// Decorative tiles: a mark inside a menu row must not be a second button. Stories pass
// marks as functions, so the trigger and the menu row each draw their own.
const mark = (name: string) => (
  <span class="flex size-5 items-center justify-center rounded-md border border-border text-xs font-semibold uppercase">
    {name.slice(0, 1)}
  </span>
)

/** The default: the home workspace first, a count on one row, a create action at the foot. */
export const Default: Story = {
  render: () => {
    const [value, setValue] = createSignal('home')
    return (
      <WorkspaceSwitcher
        value={value()}
        onValueChange={setValue}
        onCreate={() => {}}
        onManage={() => {}}
        workspaces={[
          { id: 'home', name: 'Home', mark: () => <Home class="size-4" /> },
          {
            id: 'adea',
            name: 'adea',
            mark: () => mark('adea'),
            detail: (
              <Badge size="sm" variant="notification">
                3
              </Badge>
            ),
          },
          { id: 'cortana', name: 'cortana', mark: () => mark('cortana') },
        ]}
      />
    )
  },
}

/** A long name truncates in the trigger so the top bar's other controls keep their room. */
export const LongName: Story = {
  render: () => (
    <div class="w-64">
      <WorkspaceSwitcher
        value="long"
        onValueChange={() => {}}
        workspaces={[
          {
            id: 'long',
            name: 'A workspace with an unreasonably long name',
            mark: () => mark('long'),
          },
        ]}
      />
    </div>
  ),
}

/** Before any workspace is current. */
export const Empty: Story = {
  render: () => (
    <WorkspaceSwitcher
      value={undefined}
      onValueChange={() => {}}
      placeholder="Choose workspace"
      workspaces={[]}
    />
  ),
}

/**
 * With `onReorder`, the menu offers "Reorder workspaces…". The dialog lists the
 * workspaces with a labelled Move up and Move down on each row; Home is `fixed`,
 * so it stays first and nothing moves above it. Each move is reported at once
 * and the host passes the workspaces back in the new order.
 */
export const Reorderable: Story = {
  render: () => {
    const [value, setValue] = createSignal('home')
    const [order, setOrder] = createSignal(['home', 'adea', 'cortana', 'themes'])
    const names: Record<string, string> = {
      home: 'Home',
      adea: 'adea',
      cortana: 'cortana',
      themes: 'themes',
    }
    const workspaces = () =>
      order().map((id) => ({
        id,
        name: names[id] ?? id,
        mark: () => (id === 'home' ? <Home class="size-4" /> : mark(names[id] ?? id)),
        fixed: id === 'home',
      }))
    return (
      <WorkspaceSwitcher
        value={value()}
        onValueChange={setValue}
        workspaces={workspaces()}
        onReorder={(ids) => {
          setOrder([...ids])
        }}
      />
    )
  },
}

/**
 * A mark built once, as a node, is also safe: the trigger keeps the node and the
 * current row draws a copy. Prefer a function (as the other stories do), because
 * a copy has no event handlers or reactive bindings.
 */
export const StableMark: Story = {
  render: () => {
    const [value, setValue] = createSignal('adea')
    return (
      <WorkspaceSwitcher
        value={value()}
        onValueChange={setValue}
        workspaces={[
          { id: 'adea', name: 'adea', mark: mark('adea') },
          { id: 'cortana', name: 'cortana', mark: mark('cortana') },
        ]}
      />
    )
  },
}
