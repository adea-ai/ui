import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * StatusBar.
 *
 * The thin strip pinned to the bottom of the window. Its purpose is to hold
 * *ambient* facts the user checks without acting: connection state, branch,
 * counts, the current mode. Anything interactive belongs in the top bar or a
 * pane — a status bar is read, not operated, and a control here is one the user
 * will not find.
 *
 * Height comes from `--statusbar-height`, so a pane's bottom padding can
 * reserve it without a magic number.
 */
export function StatusBar(props: ComponentProps<'footer'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <footer
      data-slot="status-bar"
      class={cn(
        'text-muted-foreground flex h-statusbar shrink-0 items-center gap-3 border-t border-border px-3 text-2xs',
        local.class
      )}
      {...rest}
    />
  )
}

/** A single readout. `tone` carries meaning; it is not decoration. */
export function StatusBarItem(
  props: ComponentProps<'span'> & {
    tone?: 'default' | 'success' | 'warning' | 'destructive'
    /** Draw a leading state dot, e.g. for a connection. */
    dot?: boolean
  }
) {
  const [local, rest] = splitProps(props, ['class', 'tone', 'dot', 'children'])

  return (
    <span
      data-slot="status-bar-item"
      class={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0',
        {
          'text-muted-foreground': local.tone === undefined || local.tone === 'default',
          'text-success': local.tone === 'success',
          'text-warning': local.tone === 'warning',
          'text-destructive': local.tone === 'destructive',
        },
        local.class
      )}
      {...rest}
    >
      {local.dot ? (
        <span
          aria-hidden="true"
          class={cn('size-1.5 shrink-0 rounded-full bg-current', {
            'animate-pulse': local.tone === 'warning',
          })}
        />
      ) : null}
      {local.children}
    </span>
  )
}

/** Pushes everything after it to the trailing edge. */
export function StatusBarSpacer() {
  return <span aria-hidden="true" class="flex-1" />
}
