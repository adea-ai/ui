import {
  createContext,
  createUniqueId,
  Show,
  splitProps,
  useContext,
  type ComponentProps,
} from 'solid-js'
import { cn } from '#lib/utils'
import { Button } from '../../ui/button'
import { boundText } from '../sources/source'

/**
 * Suggestions.
 *
 * A row of one-click prompts: each chip is the text that will be sent, so choosing
 * one is a single decision and never "fill the composer, then still have to press
 * send". What a chip *does* with its text — send it, drop it in the composer —
 * is the host's `onSelect`; this component only reports which one was chosen.
 *
 * - **Layout.** `wrap` (default) lets chips flow onto further lines, which is the
 *   right behaviour at a narrow width. `scroll` keeps a single line that scrolls
 *   sideways, for a bar above a composer that must not grow; the chips are real
 *   buttons, so keyboard focus scrolls them into view and nothing depends on a
 *   pointer to reach the overflow.
 * - **Long text is clipped, not hidden.** A chip is one line and truncates; the
 *   full text is the button's accessible name and its `title`.
 * - **The host owns authority.** No `onSelect`, or a `disabledReason`, disables
 *   every chip and says why in words under the row. Chips use `aria-disabled`
 *   rather than `disabled`, so a keyboard or screen-reader user can still reach
 *   them and hear the reason instead of finding a row that is silently skipped.
 */
export type SuggestionsProps = Omit<ComponentProps<'div'>, 'onSelect'> & {
  /** The row's accessible name. */
  label?: string
  layout?: 'wrap' | 'scroll'
  /** Called with the chosen chip's text. Without it every chip is disabled. */
  onSelect?: (text: string) => void
  /** Why the chips cannot be used right now. Implies disabled. */
  disabledReason?: string
}

type SuggestionsContext = {
  select: (text: string) => void
  blocked: () => boolean
  reasonId: () => string | undefined
}

const SuggestionsContext = createContext<SuggestionsContext>()

export function Suggestions(props: SuggestionsProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'label',
    'layout',
    'onSelect',
    'disabledReason',
    'children',
  ])
  const uid = createUniqueId()
  const reasonId = `${uid}-reason`
  const reason = () =>
    local.disabledReason
      ? boundText(local.disabledReason, 240)
      : local.onSelect === undefined
        ? 'Suggestions are not available here.'
        : undefined

  return (
    <SuggestionsContext.Provider
      value={{
        select: (text) => local.onSelect?.(text),
        blocked: () => reason() !== undefined,
        reasonId: () => (reason() ? reasonId : undefined),
      }}
    >
      <div data-slot="suggestions" class="flex min-w-0 flex-col gap-1.5">
        <div
          role="group"
          aria-label={local.label ?? 'Suggested prompts'}
          class={cn(
            'flex min-w-0 gap-2',
            {
              'flex-wrap': local.layout !== 'scroll',
              // Padding below keeps the focus ring of a chip from being clipped by the scroller.
              'flex-nowrap overflow-x-auto p-1 [&>*]:shrink-0': local.layout === 'scroll',
            },
            local.class
          )}
          {...rest}
        >
          {local.children}
        </div>
        <Show when={reason()}>
          <p id={reasonId} role="status" class="m-0 text-xs text-muted-foreground">
            {reason()}
          </p>
        </Show>
      </div>
    </SuggestionsContext.Provider>
  )
}

export type SuggestionProps = Omit<ComponentProps<'button'>, 'onSelect' | 'children'> & {
  /** The text that is sent when the chip is chosen. Also the chip's name. */
  text: string
}

export function Suggestion(props: SuggestionProps) {
  const [local, rest] = splitProps(props, ['class', 'text', 'onClick'])
  const context = useContext(SuggestionsContext)
  // A chip outside a `Suggestions` row has no handler to call: inert and honest.
  const blocked = () => context === undefined || context.blocked()
  const text = () => boundText(local.text, 400)

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-slot="suggestion"
      title={text().length > 40 ? text() : undefined}
      aria-disabled={blocked() || undefined}
      aria-describedby={context?.reasonId()}
      class={cn('max-w-full', local.class)}
      onClick={(event) => {
        if (blocked()) {
          event.preventDefault()
          return
        }
        if (typeof local.onClick === 'function') local.onClick(event)
        // The host's own string, untouched: only the label is clipped, never what is sent.
        context?.select(local.text)
      }}
      {...rest}
    >
      <span class="truncate">{text()}</span>
    </Button>
  )
}
