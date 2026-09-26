import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Textarea.
 *
 * Shares the Input's border, focus and invalid treatment exactly — the two are
 * the same control at different aspect ratios, and a form that mixes them must
 * not show a seam between them.
 *
 * `field-sizing: content` lets the element grow with its content where the
 * engine supports it, which is the behaviour a chat composer wants; `rows`
 * remains the fallback so an unsupported engine still gets a usable height.
 */
export function Textarea(props: ComponentProps<'textarea'>) {
  const [local, rest] = splitProps(props, ['class'])

  return (
    <textarea
      data-slot="textarea"
      class={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-transparent px-control-md py-2 text-sm',
        'transition-[color,box-shadow,border-color] ease-out outline-none',
        'placeholder:text-muted-foreground',
        'selection:bg-primary selection:text-primary-foreground',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-primary-subtle',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive-subtle',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y',
        local.class
      )}
      {...rest}
    />
  )
}
