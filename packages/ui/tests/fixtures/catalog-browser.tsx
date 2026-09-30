import { createMemo, createSignal, For, Show } from 'solid-js'
import { render } from 'solid-js/web'
import { Blocks, CalendarDays, MessageSquare, WandSparkles } from 'lucide-solid'
import { Badge } from '../../src/components/ui/badge/badge'
import { Button } from '../../src/components/ui/button/button'
import {
  CatalogBrowser,
  CatalogDetail,
  CatalogDetailSection,
  type CatalogBrowserEntry,
} from '../../src/components/composites/catalog-browser'
import '../../src/styles/globals.css'

type AppRecord = Readonly<{
  id: string
  name: string
  description: string
  category: string
  publisher: string
  installed: boolean
  permissions: readonly string[]
}>

const records: readonly AppRecord[] = [
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Run commands in a project workspace.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: true,
    permissions: ['Read project files', 'Run approved commands'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Review repository and pull request activity.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: true,
    permissions: ['Read repository metadata'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Review upcoming team events.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
    permissions: ['Read calendar events'],
  },
  {
    id: 'browser',
    name: 'Browser',
    description: 'Inspect approved browser sessions.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
    permissions: ['Open approved websites'],
  },
  {
    id: 'docs',
    name: 'Documentation',
    description: 'Search trusted project references.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
    permissions: ['Read documentation'],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues and project progress.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
    permissions: ['Read issue metadata'],
  },
  {
    id: 'figma',
    name: 'Figma',
    description: 'Explore linked designs and prototypes.',
    category: 'Developer tools',
    publisher: 'Community',
    installed: false,
    permissions: ['Read design metadata'],
  },
  {
    id: 'drive',
    name: 'Drive',
    description: 'Find documents shared with your team.',
    category: 'Developer tools',
    publisher: 'Adea',
    installed: false,
    permissions: ['Read shared documents'],
  },
  {
    id: 'mail',
    name: 'Mail',
    description: 'Review messages from your workspace.',
    category: 'Communication',
    publisher: 'Adea',
    installed: false,
    permissions: ['Read messages'],
  },
]

const entries: readonly CatalogBrowserEntry<AppRecord>[] = records.map((value) => ({
  id: value.id,
  value,
  name: value.name,
  description: value.description,
  category: value.category,
  publisher: value.publisher,
  installed: value.installed,
}))

const longNotices = Array.from({ length: 18 }, (_, index) => ({
  id: `verification-${index + 1}`,
  role: 'status' as const,
  message: `Verification notice ${index + 1}: publisher metadata was checked against the trusted catalog. ${'The signed record remains within the approved workspace policy. '.repeat(4)}`,
}))

function Fixture() {
  const [tab, setTab] = createSignal('discover')
  const [query, setQuery] = createSignal('')
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [installError, setInstallError] = createSignal<string>()
  const [status, setStatus] = createSignal<'ready' | 'loading' | 'error'>('ready')
  const [longMessages, setLongMessages] = createSignal(false)
  const visibleEntries = createMemo(() => {
    const term = query().trim().toLowerCase()
    return entries.filter((entry) => {
      const inTab = tab() !== 'installed' || entry.installed
      const matches =
        !term ||
        `${entry.name} ${entry.description} ${entry.category} ${entry.publisher}`
          .toLowerCase()
          .includes(term)
      return inTab && matches
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
    <main class="flex h-screen min-w-0 flex-col gap-3 p-4">
      <div class="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setLongMessages(false)
            setStatus('loading')
          }}
        >
          Simulate catalog loading
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setLongMessages(false)
            setStatus('error')
          }}
        >
          Simulate catalog failure
        </Button>
        <Button
          onClick={() => {
            setLongMessages(true)
            setStatus('loading')
          }}
        >
          Show long loading notices
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setLongMessages(true)
            setStatus('error')
          }}
        >
          Show long error notices
        </Button>
      </div>
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
              Review the destinations available in the workspace navigation.
            </p>
            <Button variant="outline">Review destinations</Button>
          </section>
        )}
        query={query()}
        onQueryChange={setQuery}
        searchLabel="Search applications"
        searchPlaceholder="Search applications"
        resultsRegionLabel="Application results"
        resultCount={visibleEntries().length}
        resultLabel={(count) => `${count} applications`}
        loadingLabel="Loading applications"
        status={status()}
        catalogError={{
          title: 'Catalog unavailable',
          description: longMessages()
            ? `The catalog could not be reached. ${'Retry after the provider connection has been restored. '.repeat(16)}`
            : 'The catalog could not be reached. Retry to check again.',
          role: 'alert',
        }}
        catalogErrorAction={
          <Show when={!longMessages()}>
            <Button
              variant="outline"
              onClick={() => {
                setStatus('loading')
                queueMicrotask(() => setStatus('ready'))
              }}
            >
              Retry catalog
            </Button>
          </Show>
        }
        installError={installError()}
        notices={
          longMessages()
            ? longNotices
            : [
                {
                  id: 'verification',
                  role: 'status',
                  message: 'Publisher records were checked against the trusted catalog.',
                },
              ]
        }
        emptyState={{
          title: 'No applications found',
          description: 'Try another search or browse a different catalog view.',
        }}
        emptyStateAction={
          <Button variant="outline" onClick={() => setQuery('')}>
            Clear search
          </Button>
        }
        groups={groups()}
        entries={entries}
        selectedId={selectedId()}
        onSelect={(record) => {
          setInstallError(undefined)
          setSelectedId(record.id)
        }}
        onBack={() => setSelectedId(null)}
        backLabel="Back to catalog"
        detailRegionLabel="Application details"
        installedLabel="Installed"
        publishedByLabel={(publisher) => `Published by ${publisher}`}
        showMoreLabel={(hidden) =>
          `See ${hidden
            .slice(0, 2)
            .map((entry) => entry.name)
            .join(', ')} and more`
        }
        showLessLabel="Show less"
        renderIcon={(record) => {
          const Icon =
            record.id === 'calendar'
              ? CalendarDays
              : record.id === 'mail'
                ? MessageSquare
                : record.id === 'browser'
                  ? WandSparkles
                  : Blocks
          return <Icon size={20} aria-hidden="true" />
        }}
        renderDetail={(record) => (
          <CatalogDetail
            title={record.name}
            description={record.description}
            category={record.category}
            publisher={record.publisher}
            publishedByLabel={(publisher) => `Published by ${publisher}`}
            leading={<Blocks size={24} aria-hidden="true" />}
            eyebrow="Verified"
            badges={record.installed ? <Badge variant="outline">Installed</Badge> : undefined}
            action={
              <Button
                disabled={record.installed}
                onClick={() =>
                  setInstallError('Install request was rejected. Nothing was installed.')
                }
              >
                {record.installed ? 'Installed' : 'Request install'}
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
                <For each={record.permissions}>{(permission) => <li>{permission}</li>}</For>
              </ul>
            </CatalogDetailSection>
            <CatalogDetailSection title="Activation">
              <Button disabled>Enable application</Button>
              <p class="text-muted-foreground text-sm" role="status">
                Workspace approval is required before this application can be enabled.
              </p>
            </CatalogDetailSection>
          </CatalogDetail>
        )}
      />
    </main>
  )
}

render(() => <Fixture />, document.body)
