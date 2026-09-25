import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Box, Files, GitBranch, Settings, Terminal, Users } from 'lucide-solid'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command'

/**
 * Command.
 *
 * The command palette: a filtered list of everything the user can do, ranked by
 * fuzzy match. It is the one place where a keyboard-first surface is the *primary*
 * one, so it carries rules the rest of the system does not:
 *
 *   - Every item must be reachable by typing its name. If the user has to remember
 *     which group it lives in, the palette has failed at its job.
 *   - Groups exist for reading, not for navigation. The ranking crosses them.
 *   - The empty state says what would match, rather than apologising.
 */
const meta = {
  title: 'Primitives/Navigation/Command',
  component: Command,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Command>

export default meta
type Story = StoryObj<typeof meta>

/** The palette in a dialog-shaped surface, which is how it ships. */
export const Default: Story = {
  render: () => (
    <div class="w-144 overflow-hidden rounded-xl border border-border shadow-xl">
      <Command>
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try "worktree".</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem>
              <Terminal />
              Dev view
              <CommandShortcut>⌘1</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Files />
              Files
              <CommandShortcut>⌘2</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <GitBranch />
              Worktrees
              <CommandShortcut>⌘3</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Users />
              Agents
              <CommandShortcut>⌘4</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem>
              <Box />
              New session
            </CommandItem>
            <CommandItem>
              <Settings />
              Open settings
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
}

/** No results, which has to suggest a next step rather than dead-end. */
export const EmptyState: Story = {
  render: () => (
    <div class="w-144 overflow-hidden rounded-xl border border-border shadow-xl">
      <Command>
        <CommandInput placeholder="Type a command or search…" value="zzz" />
        <CommandList>
          <CommandEmpty>Nothing matches "zzz". Every action is also in the rail.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem>
              <Terminal />
              Dev view
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  ),
}
