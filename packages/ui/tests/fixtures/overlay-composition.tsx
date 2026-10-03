import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { render } from 'solid-js/web'
import * as contextMenuStories from '../../src/components/ui/context-menu/context-menu.stories'
import type { DrawerContentProps } from '../../src/components/ui/drawer/drawer'
import * as drawerStories from '../../src/components/ui/drawer/drawer.stories'
import * as dropdownMenuStories from '../../src/components/ui/dropdown-menu/dropdown-menu.stories'
import * as menubarStories from '../../src/components/ui/menubar/menubar.stories'
import * as navigationMenuStories from '../../src/components/ui/navigation-menu/navigation-menu.stories'
import { Toaster, toast } from '../../src/components/ui/toast/toast'
import '../../src/styles/globals.css'

/**
 * Overlay composition fixture.
 *
 * Renders the stories themselves rather than a copy of them: the defects this
 * guards were in the stories' composition (a group label outside its group, a
 * drawer side on the wrong part) and in wrappers the stories exercise, so a
 * hand-written replica would pass while the specification stayed broken.
 *
 * The scenario is chosen by `window.overlayScenario`, set before this script runs,
 * so each test mounts exactly one overlay tree.
 */

type StoryLike = { render?: unknown }

function story(entry: StoryLike): () => JSX.Element {
  return entry.render as () => JSX.Element
}

function decorated(meta: { decorators?: unknown }): () => JSX.Element {
  const [decorator] = meta.decorators as [() => JSX.Element]
  return decorator
}

// The side is the root's: corvu ignores it on the content, so the type refuses it
// rather than letting a drawer silently open from the bottom.
// @ts-expect-error `side` belongs on `Drawer`, not `DrawerContent`.
const misplacedSide: DrawerContentProps = { side: 'right' }
void misplacedSide

const positions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const

function Toasters() {
  return (
    <section>
      <h2>Toaster fixture</h2>
      <p>Content in flow above the regions, so an unpositioned region lands below it.</p>
      <For each={positions}>
        {(position) => (
          <>
            <button
              type="button"
              onClick={() => toast.show({ title: `Toast ${position}`, region: position })}
            >
              Show {position}
            </button>
            <Toaster position={position} region={position} data-testid={`toaster-${position}`} />
          </>
        )}
      </For>
    </section>
  )
}

const scenarios: Record<string, () => JSX.Element> = {
  'navigation-menu-default': decorated(navigationMenuStories.default),
  'navigation-menu-single': story(navigationMenuStories.SingleEntry),
  'navigation-menu-descriptions': story(navigationMenuStories.WithDescriptions),
  'dropdown-menu-grouped': story(dropdownMenuStories.Grouped),
  'context-menu-default': story(contextMenuStories.Default),
  'menubar-default': story(menubarStories.Default),
  'drawer-from-the-side': story(drawerStories.FromTheSide),
  toasters: Toasters,
}

const scenario = (window as Window & { overlayScenario?: string }).overlayScenario ?? ''
const Scenario = scenarios[scenario]
if (!Scenario) throw new Error(`Unknown overlay scenario: ${scenario}`)

render(
  () => (
    <main>
      <h1 class="sr-only">Overlay composition fixture</h1>
      <Scenario />
    </main>
  ),
  document.body
)
