import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

/**
 * Tabs.
 *
 * For switching between sibling views of the *same* subject — a file's code, diff
 * and history. Not for moving between pages: a tab is expected to keep its panel
 * and its scroll position, which a route does not.
 *
 * Kobalte manages the roving tabindex and the arrow keys, so the tab strip is a
 * single stop in the tab order and the arrows move within it. A hand-rolled strip
 * of buttons puts every tab in the tab order, which makes a five-tab strip five
 * stops on the way to the content.
 */
const meta = {
  title: 'Primitives/Navigation/Tabs',
  component: Tabs,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

/** The underline form, for a panel whose header already has a rule. */
export const Default: Story = {
  render: () => (
    <Tabs defaultValue="code" class="w-144">
      <TabsList>
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="diff">Diff</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="code">
        <p class="text-sm text-muted-foreground">
          The file as it stands. Kept mounted while other tabs are shown, so scroll position
          survives.
        </p>
      </TabsContent>
      <TabsContent value="diff">
        <p class="text-sm text-muted-foreground">Changes against the base branch.</p>
      </TabsContent>
      <TabsContent value="history">
        <p class="text-sm text-muted-foreground">Commits that touched this file.</p>
      </TabsContent>
    </Tabs>
  ),
}

/**
 * The segmented form, for a pane where a full-width underline would collide with
 * the panel's own header rule — a file-tree filter, a preview mode switcher.
 */
export const Segmented: Story = {
  render: () => (
    <Tabs defaultValue="preview" class="w-144">
      <TabsList appearance="segmented">
        <TabsTrigger value="preview" appearance="segmented">
          Preview
        </TabsTrigger>
        <TabsTrigger value="source" appearance="segmented">
          Source
        </TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <div class="rounded-lg border border-border p-4 text-sm">The rendered result.</div>
      </TabsContent>
      <TabsContent value="source">
        <div class="rounded-lg border border-border p-4 font-mono text-sm">{'<Component />'}</div>
      </TabsContent>
    </Tabs>
  ),
}

/**
 * Vertical tabs, for a long list of sections where a horizontal strip would
 * scroll — the shape a settings pane takes when it has more than about six
 * sections.
 */
export const Vertical: Story = {
  render: () => (
    <Tabs defaultValue="general" orientation="vertical" class="flex gap-6">
      <TabsList orientation="vertical" class="border-b-0">
        <TabsTrigger orientation="vertical" value="general">
          General
        </TabsTrigger>
        <TabsTrigger orientation="vertical" value="appearance">
          Appearance
        </TabsTrigger>
        <TabsTrigger orientation="vertical" value="advanced">
          Advanced
        </TabsTrigger>
      </TabsList>
      <div class="min-w-0 flex-1">
        <TabsContent value="general">
          <p class="text-sm text-muted-foreground">General settings.</p>
        </TabsContent>
        <TabsContent value="appearance">
          <p class="text-sm text-muted-foreground">Theme and typeface.</p>
        </TabsContent>
        <TabsContent value="advanced">
          <p class="text-sm text-muted-foreground">Paths and environment overrides.</p>
        </TabsContent>
      </div>
    </Tabs>
  ),
}

/**
 * A tab that is not available yet, rather than one that is missing.
 *
 * A disabled tab is a promise about something the user can have; a hidden one is
 * a feature they cannot discover. Where the reason is knowable, say it in the
 * panel rather than leaving the tab greyed with no explanation.
 */
export const DisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="code" class="w-144">
      <TabsList>
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="diff" disabled>
          Diff
        </TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="code">
        <p class="text-sm text-muted-foreground">
          Diff is disabled because this file is untracked.
        </p>
      </TabsContent>
      <TabsContent value="history">
        <p class="text-sm text-muted-foreground">No commits yet.</p>
      </TabsContent>
    </Tabs>
  ),
}
