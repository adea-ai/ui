import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { ChevronRight } from 'lucide-solid'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'

/**
 * Collapsible.
 *
 * One region that shows and hides. Accordion is this in a list; reach for
 * Collapsible when there is exactly one, so a caller does not have to build a
 * one-item accordion whose semantics say "list of one".
 *
 * A disclosure that reveals a form is not a Collapsible — it is a page. This is for
 * the case where the hidden content is an explanation or an advanced option, where
 * hiding it is a favour rather than a gate.
 */
const meta = {
  title: 'Primitives/Navigation/Collapsible',
  component: Collapsible,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Collapsible>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Collapsible class="w-[32rem] rounded-xl border border-border p-4">
      <CollapsibleTrigger class="group">
        <ChevronRight class="size-3.5 transition-transform ease-out group-data-[expanded]:rotate-90" />
        Advanced options
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Base directory: ~/Developer/Adea</p>
          <p>Materialisation: copy-on-write when the filesystem allows it.</p>
          <p>Digest: content hash, recorded in the worktree manifest.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  ),
}

/** Open by default, for a disclosure that is hiding the primary content. */
export const DefaultOpen: Story = {
  render: () => (
    <Collapsible defaultOpen class="w-[32rem] rounded-xl border border-border p-4">
      <CollapsibleTrigger class="group">
        <ChevronRight class="size-3.5 transition-transform ease-out group-data-[expanded]:rotate-90" />
        What this lane checks
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul class="mt-3 flex list-inside list-disc flex-col gap-1 text-sm text-muted-foreground">
          <li>A stalled stream fails the run; a slow machine does not.</li>
          <li>The budget governs, not a round cap.</li>
          <li>A broken probe is never retried.</li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  ),
}
