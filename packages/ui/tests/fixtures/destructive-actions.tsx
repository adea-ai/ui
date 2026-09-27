import { For } from 'solid-js'
import { render } from 'solid-js/web'
import { Alert, AlertDescription, AlertTitle } from '../../src/components/ui/alert/alert'
import { Badge } from '../../src/components/ui/badge/badge'
import { Button } from '../../src/components/ui/button/button'
import { builtinThemes, themeCssVariables } from '../../src/lib/themes'
import '../../src/styles/globals.css'

const applyTheme = (theme: (typeof builtinThemes)[number]) => (element: HTMLElement) => {
  for (const [name, value] of Object.entries(themeCssVariables(theme))) {
    element.style.setProperty(name, value)
  }
}

function Fixture() {
  return (
    <main class="flex flex-col gap-4">
      <For each={builtinThemes}>
        {(theme) => (
          <section class="flex flex-col gap-2" data-theme-id={theme.id} ref={applyTheme(theme)}>
            <div class="flex flex-wrap items-center gap-2">
              <div class="bg-background p-2" data-surface="background">
                <Button
                  variant="destructive"
                  data-destructive-action
                  aria-label={`Delete on ${theme.id} background`}
                >
                  Delete
                </Button>
              </div>
              <div class="bg-card p-2" data-surface="card">
                <Button
                  variant="destructive"
                  data-destructive-action
                  aria-label={`Delete on ${theme.id} card`}
                >
                  Delete
                </Button>
              </div>
              <div class="bg-popover p-2" data-surface="popover">
                <Button
                  variant="destructive"
                  data-destructive-action
                  aria-label={`Delete on ${theme.id} popover`}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant="destructive" data-destructive-badge>
                Failed
              </Badge>
              <Alert variant="destructive" data-destructive-alert>
                <AlertTitle>Could not delete</AlertTitle>
                <AlertDescription>The item is still in use.</AlertDescription>
              </Alert>
            </div>
          </section>
        )}
      </For>
    </main>
  )
}

render(Fixture, document.body)
