import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import { ChevronDown, ChevronUp, CircleDot } from 'lucide-solid'
import { ActionButton } from '../../src/components/composites/action-button'
import { ListRow, ListRowControl } from '../../src/components/composites/list-row'
import { Badge } from '../../src/components/ui/badge'
import { Button } from '../../src/components/ui/button'
import '../../src/styles/globals.css'

const appName = 'A Very Long Workspace Application Name for Shared Design Systems'
const description =
  'A long description explains what this workspace application does, how it appears in navigation, and why its actions must remain readable beside the complete set of management controls.'
const [actionCount, setActionCount] = createSignal(0)
const [activations, setActivations] = createSignal(0)
const [submissions, setSubmissions] = createSignal(0)
let buttonRef: HTMLButtonElement | undefined

render(
  () => (
    <main class="flex w-full flex-col gap-2">
      <h1 class="text-base font-medium">Workspace applications</h1>
      <span id="report-help" class="visually-hidden">
        Opens the selected report.
      </span>
      <span id="static-row-help" class="visually-hidden">
        This row describes a static workspace item.
      </span>
      <ListRow
        class="w-full"
        data-testid="long-description-row"
        leading={<CircleDot aria-hidden="true" />}
        description={description}
        trailing={
          <>
            <Badge size="sm" variant="secondary">
              In sidebar
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActionCount((n) => n + 1)}
            >
              Open {appName}
            </Button>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              tooltip={`Move ${appName} up`}
              aria-label={`Move ${appName} up`}
              onClick={() => setActionCount((n) => n + 1)}
            >
              <ChevronUp aria-hidden="true" />
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              tooltip={`Move ${appName} down`}
              aria-label={`Move ${appName} down`}
              onClick={() => setActionCount((n) => n + 1)}
            >
              <ChevronDown aria-hidden="true" />
            </ActionButton>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Disable ${appName}`}
              onClick={() => setActionCount((n) => n + 1)}
            >
              Disable
            </Button>
          </>
        }
      >
        {appName}
      </ListRow>
      <ListRow
        class="w-full"
        data-testid="large-leading-description-row"
        leading={
          <span
            aria-hidden="true"
            class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-subtle text-sm font-medium"
          >
            AC
          </span>
        }
        description={description}
        trailing={
          <>
            <Badge size="sm" variant="secondary">
              In sidebar
            </Badge>
            <Button type="button" variant="ghost" size="sm">
              Open {appName}
            </Button>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              tooltip={`Move ${appName} up`}
              aria-label={`Move ${appName} up`}
            >
              <ChevronUp aria-hidden="true" />
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              tooltip={`Move ${appName} down`}
              aria-label={`Move ${appName} down`}
            >
              <ChevronDown aria-hidden="true" />
            </ActionButton>
            <Button type="button" variant="ghost" size="sm" aria-label={`Disable ${appName}`}>
              Disable
            </Button>
          </>
        }
      >
        {appName}
      </ListRow>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSubmissions((count) => count + 1)
        }}
      >
        <ListRow
          as="button"
          aria-label="Open report"
          aria-describedby="report-help"
          tooltip="Open the report"
          ref={(element: HTMLButtonElement) => {
            buttonRef = element
          }}
          onClick={() => setActivations((count) => count + 1)}
        >
          Report
        </ListRow>
        <ListRow as="a" href="#details" tooltip="Read report details">
          Details
        </ListRow>
        <ListRow tooltip="Run this action" onClick={() => setActivations((count) => count + 1)}>
          Run action
        </ListRow>
        <ListRow as="button" tabIndex={-1} aria-label="Skip tab order">
          Skip tab order
        </ListRow>
        <ListRowControl aria-label="Static row" aria-describedby="static-row-help">
          Static row
        </ListRowControl>
        <ListRowControl
          data-testid="description-row-regular"
          description="First row supporting detail"
        >
          First description row
        </ListRowControl>
        <ListRowControl
          data-testid="description-row-dense"
          dense
          description="Second row supporting detail"
        >
          Second description row
        </ListRowControl>
      </form>
      <ListRowControl
        as="div"
        data-testid="plain-row-div"
        leading={
          <span class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-subtle text-sm font-medium">
            DV
          </span>
        }
        description={description}
        trailing={
          <Badge size="sm" variant="secondary">
            Ready
          </Badge>
        }
      >
        Plain workspace row
      </ListRowControl>
      <ul aria-label="List item row examples" class="flex flex-col gap-2">
        <ListRowControl
          as="li"
          data-testid="plain-row-li"
          leading={
            <span class="grid size-12 shrink-0 place-items-center rounded-md bg-primary-subtle text-sm font-medium">
              LI
            </span>
          }
          description={description}
          trailing={
            <Badge size="sm" variant="secondary">
              Ready
            </Badge>
          }
        >
          Plain list item row
        </ListRowControl>
      </ul>
      <ListRowControl
        as="a"
        href="#selected-row"
        class="w-full"
        data-testid="selected-row"
        selected
      >
        Selected worktree
      </ListRowControl>
      <output data-testid="action-count">{actionCount()}</output>
      <output aria-label="Activations">{activations()}</output>
      <output aria-label="Submissions">{submissions()}</output>
      <output aria-label="Forwarded ref">{buttonRef?.tagName ?? 'missing'}</output>
    </main>
  ),
  document.getElementById('list-row-root') ?? document.body
)
