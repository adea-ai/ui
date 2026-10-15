import type { ComponentProps } from 'solid-js'
import { splitProps } from 'solid-js'
import { cva, type VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'

/**
 * Callout.
 *
 * A quiet aside that belongs to the content around it: the summary at the top of
 * an answer, a note in documentation, a remembered fact beside the reply that
 * used it. It is a card-coloured block with one rule on its start edge, and
 * nothing about it interrupts the reader.
 *
 * That is the difference from `Alert`. An `Alert` is a message about the state of
 * the surface it sits in — a failed sync, a validation summary — so it is always
 * `role="alert"`, a live announcement, with a tone glyph and a tinted status
 * surface. A callout is static page content: a plain `div` with `role="note"`, no
 * live region, no icon, and no tint. A caller whose note really is a status
 * message uses `Alert`; one whose note needs a different landmark role passes
 * `role`. Reach for `Card` when the block is a self-contained object with its own
 * header, content and footer; a callout has no parts beyond an optional
 * `CalloutTitle`.
 *
 * The rule is the only thing that varies by `variant`: `default` is the accent
 * (`--primary`), and the four status hues use the same tokens `Alert` does. The
 * rule is a logical `border-s-*`, so it moves to the right in RTL. The corners
 * stay square because a rounded box would curve the rule into a crescent.
 *
 * `size` is the padding rung and the rule's weight together, so a caller never
 * sets `p-*` or a border width to make one denser. The rungs are Cortana's three
 * answer-view callouts, expressed in the Tailwind spacing scale:
 *
 * - `lg`: 22px / 24px padding, 3px rule — Cortana's `.answer-copy`.
 * - `md`: 18px / 20px padding, 3px rule — Cortana's `.answer-memory`.
 * - `sm`: 12px / 14px padding, 2px rule — Cortana's `.answer-note`.
 *
 * Type size and colour are inherited rather than set (only the card foreground is
 * applied), so a callout in a dense panel and one in an article both read at the
 * size of the text around them.
 */
export const calloutVariants = cva('bg-card text-card-foreground block rounded-none', {
  variants: {
    variant: {
      default: 'border-s-primary',
      destructive: 'border-s-destructive',
      success: 'border-s-success',
      warning: 'border-s-warning',
      info: 'border-s-info',
    },
    size: {
      /** 12px block / 14px inline padding, 2px rule: a short inline note. */
      sm: 'border-s-2 px-3.5 py-3',
      /** 18px block / 20px inline padding, 3px rule: a supporting aside. */
      md: 'border-s-3 px-5 py-4.5',
      /** 22px block / 24px inline padding, 3px rule: the lead summary of a view. */
      lg: 'border-s-3 px-6 py-5.5',
    },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export type CalloutProps = ComponentProps<'div'> & VariantProps<typeof calloutVariants>

export function Callout(props: CalloutProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size'])
  return (
    <div
      data-slot="callout"
      role="note"
      class={cn(calloutVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    />
  )
}

/**
 * An optional heading line for the callout. It is a styled `div`, not a heading
 * element: a callout sits inside someone else's outline, and a fixed heading
 * level would break it. Pass `role="heading"` with `aria-level` where the
 * content does belong in the outline.
 */
export function CalloutTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="callout-title"
      class={cn('not-last:mb-1 font-medium tracking-tight', local.class)}
      {...rest}
    />
  )
}
