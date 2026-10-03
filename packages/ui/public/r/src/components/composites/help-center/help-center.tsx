import { createSignal, For, onCleanup, Show } from 'solid-js'
import { ExternalLink } from 'lucide-solid'
import { cn } from '../../../lib/utils'
import { ActionButton } from '../action-button'
import { Alert, AlertDescription } from '../../ui/alert'
import { Card, CardContent, CardHeader } from '../../ui/card'
import { Kbd, KbdGroup } from '../../ui/kbd'
import { Heading } from '../../ui/typography'

export type HelpShortcut = { label: string; keys: readonly string[] }
export type HelpLink = { label: string; description?: string; url: string }
export type HelpCenterProps = {
  appName: string
  shortcuts: readonly HelpShortcut[]
  links: readonly HelpLink[]
  openExternal?: (url: string) => Promise<void>
  /** Hides the page heading and introduction when a host dialog supplies them. */
  showHeader?: boolean
  class?: string
}

/** A shared help page: real keyboard shortcuts and the application's project resources. */
export function HelpCenter(props: HelpCenterProps) {
  const [error, setError] = createSignal('')
  let disposed = false
  onCleanup(() => {
    disposed = true
  })
  const openLink = async (url: string) => {
    setError('')
    try {
      await props.openExternal?.(url)
    } catch {
      if (!disposed) setError('Could not open this help resource. Please try again.')
    }
  }
  return (
    <div class={cn('flex min-w-0 flex-col gap-5', props.class)}>
      <Show when={props.showHeader !== false}>
        <div class="flex flex-col gap-2">
          <Heading size="page">Help Center</Heading>
          <p class="text-sm text-muted-foreground">
            Keyboard shortcuts and resources for {props.appName}.
          </p>
        </div>
      </Show>
      <Card>
        <CardHeader>
          <h2 class="text-base font-semibold text-foreground">Keyboard shortcuts</h2>
        </CardHeader>
        <CardContent>
          <ul class="flex flex-col gap-3">
            <For each={props.shortcuts}>
              {(shortcut) => (
                <li class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-sm">{shortcut.label}</span>
                  <KbdGroup>
                    <For each={shortcut.keys}>{(key) => <Kbd>{key}</Kbd>}</For>
                  </KbdGroup>
                </li>
              )}
            </For>
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 class="text-base font-semibold text-foreground">Project links</h2>
        </CardHeader>
        <CardContent>
          <ul class="flex flex-col gap-4">
            <For each={props.links}>
              {(link) => (
                <li class="flex min-w-0 flex-col items-start gap-1">
                  <ActionButton
                    as="a"
                    variant="link"
                    size="sm"
                    class="text-foreground decoration-primary"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    tooltip={`Open ${link.label} in your browser.`}
                    onClick={(event) => {
                      if (props.openExternal) {
                        event.preventDefault()
                        void openLink(link.url)
                      }
                    }}
                  >
                    {link.label}
                    <ExternalLink aria-hidden="true" />
                  </ActionButton>
                  <Show when={link.description}>
                    <p class="text-sm text-muted-foreground">{link.description}</p>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </CardContent>
      </Card>
      <Show when={error()}>
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error()}</AlertDescription>
        </Alert>
      </Show>
    </div>
  )
}
