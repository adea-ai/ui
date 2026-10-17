import type { ComponentProps } from 'solid-js'
import { children, createMemo, splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

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
 *
 * Text that has no break opportunity (a 200-character token, a URL, a file path)
 * wraps with `overflow-wrap: anywhere` rather than overflowing the box. `anywhere`
 * and not `break-word`, because only `anywhere` lowers the box's min-content width:
 * a callout that is a flex or grid item (auto minimum size) then shrinks to its
 * track instead of stretching it. The callout's own padding, rule and width are
 * untouched, so none of its sizing differs from Cortana's.
 *
 * The block is deliberately not a flex or grid container: its children are inline
 * text, links and code, and a flex root would turn each of those into a separate
 * item and break the line.
 */
export const calloutVariants = cva(
  'bg-card text-card-foreground block rounded-none wrap-anywhere',
  {
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
  }
)

export type CalloutProps = ComponentProps<'div'> & VariantProps<typeof calloutVariants>

const isRendered = (node: unknown) =>
  node != null && typeof node !== 'boolean' && (typeof node !== 'string' || node.trim() !== '')

const isCalloutTitle = (node: unknown) =>
  typeof node === 'object' &&
  node !== null &&
  'getAttribute' in node &&
  typeof node.getAttribute === 'function' &&
  node.getAttribute('data-slot') === 'callout-title'

export function Callout(props: CalloutProps) {
  const [local, rest] = splitProps(props, ['class', 'variant', 'size', 'children'])
  const resolved = children(() => local.children)
  // CSS cannot see text nodes, so the callout looks at what it renders and marks a
  // title with nothing after it. The title reads the mark to drop its bottom margin.
  const titleOnly = createMemo(() => {
    const nodes = resolved.toArray().filter(isRendered)
    return nodes.length === 1 && isCalloutTitle(nodes[0])
  })
  return (
    <div
      data-slot="callout"
      data-title-only={titleOnly() ? '' : undefined}
      role="note"
      class={cn(calloutVariants({ variant: local.variant, size: local.size }), local.class)}
      {...rest}
    >
      {resolved()}
    </div>
  )
}

/**
 * An optional heading line for the callout. It is a styled `div`, not a heading
 * element: a callout sits inside someone else's outline, and a fixed heading
 * level would break it. Pass `role="heading"` with `aria-level` where the
 * content does belong in the outline.
 *
 * The title carries a 4px (`mb-1`) margin below it, whatever follows: a
 * paragraph, a list, or bare text. CSS cannot see text nodes, so a selector such
 * as `:last-child` or `:only-child` cannot tell `<Title/>text` (needs the gap)
 * from `<Title/>` (needs none), and `not-last:mb-1` silently dropped the gap for
 * bare text, the most common body. So the gap stays the default and the one case
 * that does not want it is detected by `Callout`, which sees its rendered
 * children: a callout whose only child is a title carries `data-title-only`, and
 * the title drops its margin so the block ends at its own padding. A caller never
 * passes `mb-0` for this. Anything else after the title, text included, keeps the
 * gap.
 */
export function CalloutTitle(props: ComponentProps<'div'>) {
  const [local, rest] = splitProps(props, ['class'])
  return (
    <div
      data-slot="callout-title"
      class={cn('mb-1 font-medium tracking-tight in-data-title-only:mb-0', local.class)}
      {...rest}
    />
  )
}
