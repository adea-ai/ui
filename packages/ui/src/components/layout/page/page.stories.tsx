import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { Settings } from 'lucide-solid'
import { Button } from '../../ui/button/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card/card'
import {
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderContent,
  PageHeaderDescription,
  PageHeaderTitle,
  PageSection,
} from './page'

/**
 * Page.
 *
 * The title block and section layout at the top of a scrollable page. Its job is to
 * fix one thing: where the title, the description and the primary action sit, so two
 * pages in the same app cannot disagree about it.
 *
 * The action slot is singular on purpose. A page header with four equally-weighted
 * buttons has not decided what the page is for; a design system can make that look
 * tidy but cannot make it true. The primary action goes here, and the rest go in an
 * overflow menu or on the rows they belong to.
 */
const meta = {
  title: 'Layout/Page',
  component: Page,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof Page>

export default meta
type Story = StoryObj<typeof meta>

/** Title, description, one action, and sections separated by space. */
export const Default: Story = {
  render: () => (
    <Page class="h-screen">
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Appearance</PageHeaderTitle>
          <PageHeaderDescription>
            Theme, typeface and density. Applied immediately, saved per workspace.
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Button size="sm" variant="outline">
            Reset to defaults
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageSection
        title="Theme"
        description="The design system ships dark-first, with a light theme as an equal."
      >
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Dark</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">
              The theme the design language was drawn against.
            </p>
          </CardContent>
        </Card>
      </PageSection>

      <PageSection title="Density" description="How much of the window goes to content.">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Comfortable</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">32px rows. The default.</p>
          </CardContent>
        </Card>
      </PageSection>
    </Page>
  ),
}

/**
 * A page whose primary action is a single button — the shape that keeps a header
 * honest. Everything else is in the rows.
 */
export const SingleAction: Story = {
  render: () => (
    <Page class="h-screen">
      <PageHeader>
        <PageHeaderContent>
          <PageHeaderTitle>Projects</PageHeaderTitle>
          <PageHeaderDescription>
            Each project is a repository plus the worktrees and sessions you open in it.
          </PageHeaderDescription>
        </PageHeaderContent>
        <PageHeaderActions>
          <Button size="sm">New project</Button>
        </PageHeaderActions>
      </PageHeader>
      <PageSection>
        <div class="flex flex-col gap-2">
          {['adea', 'cortana', 'control-plane'].map((project) => (
            <div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
              <span class="text-sm font-medium">{project}</span>
              <Settings class="size-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </PageSection>
    </Page>
  ),
}
