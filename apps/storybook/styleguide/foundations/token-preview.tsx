import type { TokenDefinition } from '@adea-ai/ui'
import type { JSX } from 'solid-js'
import { createSignal, onMount } from 'solid-js'

/**
 * Workshop-only helpers for rendering a token.
 *
 * The value shown is the *computed* value, read from the live document, not the
 * text in `theme.css`. That distinction is the point: a gallery that prints the
 * source string can look correct while a token is overridden, misspelled or
 * missing entirely. Reading `getComputedStyle` shows what the browser resolved
 * after the whole cascade ran, including the `.dark` class the theme toolbar
 * toggles.
 */
function readToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
}

/** The resolved value of a custom property, read after mount. */
export function TokenValue(props: { name: string }) {
  const [value, setValue] = createSignal('')
  onMount(() => setValue(readToken(props.name)))
  return <code class="text-xs text-muted-foreground">{value() || '\u2014'}</code>
}

/** A colour chip painted with the token itself, so it cannot misreport. */
export function ColorSwatch(props: { name: string; label?: string }) {
  return (
    <div class="flex items-center gap-3">
      <span
        class="size-8 shrink-0 rounded-md border border-border"
        style={{ 'background-color': `var(--${props.name})` }}
        aria-hidden="true"
      />
      <span class="flex min-w-0 flex-col">
        <code class="truncate text-xs font-medium">{props.name}</code>
        <TokenValue name={props.name} />
      </span>
    </div>
  )
}

/** A row of the token table used on the foundations pages. */
export function TokenRow(props: { token: TokenDefinition; preview?: JSX.Element }) {
  return (
    <tr>
      <td class="w-56">
        <code class="text-xs font-medium">{props.token.name}</code>
      </td>
      <td class="w-32">
        <TokenValue name={props.token.name} />
      </td>
      <td>{props.preview}</td>
      <td class="text-muted-foreground">{props.token.description}</td>
    </tr>
  )
}

export function TokenTable(props: { children?: JSX.Element }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Token</th>
          <th>Resolved</th>
          <th>Preview</th>
          <th>Purpose</th>
        </tr>
      </thead>
      <tbody>{props.children}</tbody>
    </table>
  )
}
