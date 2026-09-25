import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { FileQuestion, Plus, Search } from 'lucide-solid'
import { Button } from '../button/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty'

/**
 * Empty.
 *
 * The state of a region that has nothing to show yet, or after a filter removed
 * everything. It exists as a component because an empty state is where apps most
 * often improvise: a bare grey sentence in one view, a centred illustration with
 * two buttons in another.
 *
 * The shape is fixed — media, title, description, actions — so the only decisions a
 * caller makes are which parts to include.
 */
const meta = {
  title: 'Primitives/Feedback/Empty',
  component: Empty,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Empty>

export default meta
type Story = StoryObj<typeof meta>

/** The full shape, with an action that gives the user somewhere to go. */
export const WithAction: Story = {
  render: () => (
    <div class="w-144 rounded-xl border border-border">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Plus />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            A project is a repository plus the worktrees and sessions you open inside it.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm">Create a project</Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
}

/**
 * A filtered-to-nothing state, which must offer a way back.
 *
 * An empty state that says "no results" and nothing else is a dead end. Either
 * offer a reset, or explain what would match.
 */
export const FilteredToNothing: Story = {
  render: () => (
    <div class="w-144 rounded-xl border border-border">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>No sessions match "worktree evidence"</EmptyTitle>
          <EmptyDescription>
            Search covers session titles and the first message in each.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button size="sm" variant="outline">
            Clear the filter
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  ),
}

/** The minimal form: a title and a sentence, for a small pane. */
export const Minimal: Story = {
  render: () => (
    <div class="w-96 rounded-xl border border-border">
      <Empty class="min-h-32">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>Nothing selected</EmptyTitle>
          <EmptyDescription>Choose a file to see its contents.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  ),
}

/** Import to confirm the type is exported alongside the components. */
export const AllParts: Story = {
  render: () => (
    <div class="w-144 rounded-xl border border-border">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileQuestion />
          </EmptyMedia>
          <EmptyTitle>EmptyHeader groups media, title and description</EmptyTitle>
          <EmptyDescription>
            EmptyContent holds the actions, so they sit at a fixed distance from the description
            regardless of how long it is.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <span class="text-xs text-muted-foreground">Actions go here</span>
        </EmptyContent>
      </Empty>
    </div>
  ),
}
