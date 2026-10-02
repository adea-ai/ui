import type { Meta, StoryObj } from 'storybook-solidjs-vite'
import { createMemo, createSignal, For, Show } from 'solid-js'
import { Blocks, CalendarDays, MessageSquare, WandSparkles } from 'lucide-solid'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import {
  CatalogBrowser,
  CatalogDetail,
  CatalogDetailSection,
  type CatalogBrowserEntry,
} from './index'

type CatalogItem = Readonly<{
  id: string
  name: string
  description: string
  category: string
  publisher: string
  installed: boolean
  permissions: readonly string[]
}>

const data: readonly CatalogItem[] = [
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Run commands in project workspaces.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Review pull requests and repository activity.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: true,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Bring upcoming events into your workspace.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Inspect and automate browser sessions.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Search trusted project references.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues and project progress.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Explore designs and linked prototypes.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Find documents shared with your team.',
    category: 'Developer tools',
    publisher: 'Community',
    installed: false,
  },
  {
    id: 'mail',
    name: 'Mail',
    description: 'Review messages without leaving your workspace.',
    category: 'Communication',
    publisher: 'Adea',
    installed: false,
  },
].map((item) => ({
  ...item,
  permissions: ['Read project metadata', 'Open approved workspace links'],
}))

const entries: readonly CatalogBrowserEntry<CatalogItem>[] = data.map((value) => ({
  id: value.id,
  value,
  name: value.name,
  description: value.description,
  category: value.category,
  publisher: value.publisher,
  installed: value.installed,
}))

function MarketplaceExample() {
  const [tab, setTab] = createSignal('discover')
  const [query, setQuery] = createSignal('')
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [verifiedOnly, setVerifiedOnly] = createSignal(false)
  const [installError, setInstallError] = createSignal<string>()
  const visibleEntries = createMemo(() => {
    const term = query().trim().toLowerCase()
    return entries.filter((entry) => {
      const inTab = tab() !== 'installed' || entry.installed
      const verified = !verifiedOnly() || entry.publisher === 'Adea'
      const matches =
        !term ||
        `${entry.name} ${entry.description} ${entry.category} ${entry.publisher}`
          .toLowerCase()
          .includes(term)
      return inTab && verified && matches
    })
  })
  const groups = createMemo(() => {
    const categories = ['Developer tools', 'Communication']
    return categories.flatMap((category) => {
      const categoryEntries = visibleEntries().filter((entry) => entry.category === category)
      return categoryEntries.length
        ? [{ id: category, label: category, entries: categoryEntries }]
        : []
    })
  })

  return (
    <CatalogBrowser
      open
      tabs={[
        { id: 'discover', label: 'Discover' },
        { id: 'installed', label: 'Installed' },
        { id: 'navigation', label: 'Navigation', kind: 'supplemental' },
      ]}
      tab={tab()}
      tabsLabel="Catalog views"
      onTabChange={setTab}
      renderSupplementalView={() => (
        <section class="grid min-w-0 gap-2" aria-labelledby="navigation-title">
          <h2 id="navigation-title" class="font-semibold">
            Navigation preferences
          </h2>
          <p class="text-muted-foreground text-sm">
            Choose which approved destinations appear in your workspace navigation.
          </p>
          <Button variant="outline" size="sm">
            Review navigation targets
          </Button>
        </section>
      )}
      query={query()}
      onQueryChange={setQuery}
      searchLabel="Search catalog"
      searchPlaceholder="Search applications"
      resultsRegionLabel="Application results"
      filterControl={
        <Button
          variant={verifiedOnly() ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={verifiedOnly()}
          onClick={() => setVerifiedOnly((value) => !value)}
        >
          Verified publishers
        </Button>
      }
      resultCount={visibleEntries().length}
      resultLabel={(count) => `${count} applications`}
      loadingLabel="Loading catalog"
      status="ready"
      catalogError={{
        title: 'Catalog unavailable',
        description: 'The catalog could not be reached. Retry to check again.',
      }}
      catalogErrorAction={<Button variant="outline">Retry</Button>}
      installError={installError()}
      notices={[
        {
          id: 'catalog-integrity',
          role: 'status',
          message: 'Publisher information was verified against the active registry.',
        },
      ]}
      emptyState={{
        title: 'No applications found',
        description: 'Try a shorter search or switch to another catalog view.',
      }}
      emptyStateAction={
        <Button variant="outline" onClick={() => setQuery('')}>
          Clear search
        </Button>
      }
      groups={groups()}
      entries={entries}
      selectedId={selectedId()}
      onSelect={(item) => {
        setInstallError(undefined)
        setSelectedId(item.id)
      }}
      onBack={() => setSelectedId(null)}
      backLabel="Back to catalog"
      detailRegionLabel="Application details"
      installedLabel="Installed"
      showMoreLabel={(hidden) =>
        `See ${hidden
          .slice(0, 2)
          .map((entry) => entry.name)
          .join(', ')} and more`
      }
      showLessLabel="Show less"
      renderIcon={(item) => {
        const Icon =
          item.id === 'calendar'
            ? CalendarDays
            : item.id === 'mail'
              ? MessageSquare
              : item.id === 'browser'
                ? WandSparkles
                : Blocks
        return <Icon size={20} aria-hidden="true" />
      }}
      renderDetail={(item) => (
        <CatalogDetail
          title={item.name}
          description={item.description}
          category={item.category}
          publisher={item.publisher}
          publishedByLabel={(publisher) => `Published by ${publisher}`}
          leading={<Blocks size={24} aria-hidden="true" />}
          eyebrow="Verified"
          badges={item.installed ? <Badge variant="outline">Installed</Badge> : undefined}
          action={
            <Button
              disabled={item.installed}
              onClick={() =>
                setInstallError(
                  'Install request was rejected by the provider. Nothing was installed.'
                )
              }
            >
              {item.installed ? 'Installed' : 'Request install'}
            </Button>
          }
          status={
            <Show when={installError()}>
              {(message) => (
                <p role="alert" class="text-destructive text-sm">
                  {message()}
                </p>
              )}
            </Show>
          }
        >
          <CatalogDetailSection title="Permissions">
            <ul class="grid gap-2 text-sm">
              <For each={item.permissions}>{(permission) => <li>{permission}</li>}</For>
            </ul>
          </CatalogDetailSection>
          <CatalogDetailSection title="Activation">
            <Button disabled>Enable application</Button>
            <p class="text-muted-foreground text-sm" role="status">
              This application requires workspace approval before it can be enabled.
            </p>
          </CatalogDetailSection>
        </CatalogDetail>
      )}
    />
  )
}

const meta = {
  title: 'Composites/Catalog Browser',
  component: MarketplaceExample,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A searchable, categorized catalog presentation. Hosts own verification, filtering, installed state, permission decisions, callbacks, and supplemental views. The shared component provides the accessible tab, search, list, and detail transitions and returns focus to the originating result.',
      },
    },
  },
} satisfies Meta<typeof MarketplaceExample>

export default meta
type Story = StoryObj<typeof meta>

export const Marketplace: Story = {}
