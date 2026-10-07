import { Polymorphic, type PolymorphicProps } from '@kobalte/core/polymorphic'
import { type ComponentProps, splitProps, type ValidComponent } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * Typography.
 *
 * The type ladder in `theme.css` has eight rungs, each with its own leading. These
 * two components are where a rung is paired with its weight and tracking, so a call
 * site names a *role* — a page title, a section heading, a caption — and never
 * re-decides `text-xl font-semibold tracking-tight` for itself. Twenty call sites
 * that each choose a size and a weight drift; twenty that name a role cannot.
 *
 * **Size is visual; the element is the document outline.** They are separate
 * decisions and the API keeps them separate. Each size has a conventional default
 * element (`display`, `title` and `page` render an `h1`, `section` an `h2`, `card`
 * an `h3`, `subsection` an `h4`) so the common case needs no prop, but the default
 * is a convenience, not a coupling: a card-sized title that is the first heading
 * in a settings section is an `h2`, so it says `as="h2"`. Never pick a `size` to get
 * a heading level, and never pick an element to get a size.
 *
 * Headings are 600, and weights stop at 600 — on a dark surface a bold word blooms.
 * Leading comes from the rung; `leading="none"` is for a title whose surrounding
 * stack already sets the rhythm (a card or dialog header), and is the only other
 * option.
 */
// cva only returns a closure. A heading-only consumer must discard Text's recipe.
export const headingVariants = /* @__PURE__ */ cva('font-semibold', {
  variants: {
    size: {
      /** 30px. An app-level headline — a first-run or empty-app screen. Once per app. */
      display: 'text-3xl tracking-tight',
      /** 24px. A landing title or a headline figure larger than a stat's. */
      title: 'text-2xl tracking-tight',
      /** 20px. The title of a page (`PageHeaderTitle`). */
      page: 'text-xl tracking-tight',
      /** 18px. A section heading inside a page (`PageSection`). */
      section: 'text-lg tracking-tight',
      /** 16px. A card, dialog, drawer or settings-section title. */
      card: 'text-base tracking-tight',
      /** 14px. A heading inside a compact surface: a sheet, a chart, a column. */
      subsection: 'text-sm',
    },
    leading: {
      /** The rung's own line-height from `theme.css`. */
      rung: '',
      /** Line-height 1, for a title whose container's gap sets the rhythm. */
      none: 'leading-none',
    },
    /** Tabular figures, so a row of numbers can be compared without digits shifting. */
    numeric: {
      true: 'tabular-nums',
    },
    tone: {
      /** Inherit the surrounding colour — right on every surface by construction. */
      inherit: '',
      foreground: 'text-foreground',
      muted: 'text-muted-foreground',
    },
  },
  defaultVariants: {
    size: 'section',
    leading: 'rung',
    tone: 'inherit',
  },
})

/**
 * The conventional element for each heading size. Exported so a test (and a
 * reader) can see the whole mapping in one place; pass `as` to depart from it.
 */
export const headingElement = {
  display: 'h1',
  title: 'h1',
  page: 'h1',
  section: 'h2',
  card: 'h3',
  subsection: 'h4',
} as const

type HeadingVariantProps = VariantProps<typeof headingVariants>
type HeadingSize = keyof typeof headingElement

export type HeadingProps<T extends ValidComponent = 'h2'> = PolymorphicProps<
  T,
  HeadingVariantProps & {
    class?: string
  }
>

export function Heading<T extends ValidComponent = 'h2'>(props: HeadingProps<T>) {
  const [local, rest] = splitProps(props as HeadingProps & { as?: ValidComponent }, [
    'as',
    'size',
    'leading',
    'numeric',
    'tone',
    'class',
  ])

  return (
    <Polymorphic
      as={local.as ?? headingElement[(local.size ?? 'section') as HeadingSize]}
      data-slot="heading"
      class={cn(
        headingVariants({
          size: local.size,
          leading: local.leading,
          numeric: local.numeric,
          tone: local.tone,
        }),
        local.class
      )}
      {...(rest as ComponentProps<'h2'>)}
    />
  )
}

/**
 * Text.
 *
 * Everything that is not a heading. Body and strong copy use the content font
 * axis; labels, captions and microcopy inherit the UI face. Code uses its own
 * family and size axis for anything a user compares character by character.
 *
 * `tone` is a separate axis from `variant` because "secondary" is a colour
 * decision, not a size: a muted caption and a muted body line are both common.
 * The default inherits, so text on a filled surface picks up that surface's
 * foreground without the caller restating it.
 *
 * Defaults: `body` renders a `p`, `code` a `code`, every other variant a `span`.
 *
 * `overline` is the small uppercase label above a group — a list group's
 * heading, a settings navigation group, an eyebrow over a page title. It is the
 * one variant whose tone defaults to `muted` rather than inheriting, because an
 * overline in the body foreground competes with the heading it introduces. Pass
 * `tone` to override. It labels a group; it is not a heading, so it renders a
 * `span` and stays out of the document outline.
 */
export const textVariants = /* @__PURE__ */ cva('', {
  variants: {
    variant: {
      /** 14px / 400. Body copy and descriptions. */
      body: 'font-content text-content',
      /** 14px / 500. Labels, control text, list-row titles. */
      label: 'text-sm font-medium',
      /** 14px / 600. Emphasis inside body copy. */
      strong: 'font-content text-content font-semibold',
      /** 12px / 400. Metadata, secondary rows, units. */
      caption: 'text-xs',
      /** 11px / 500. The floor: keyboard keys, the status bar. */
      micro: 'text-2xs font-medium',
      /** 11px / 500, uppercase and tracked. A group label or eyebrow; muted by default. */
      overline: 'text-2xs font-medium tracking-wide uppercase',
      /** 12px mono. Ids, paths, hashes, inline code. */
      code: 'font-code text-code',
    },
    tone: {
      inherit: '',
      foreground: 'text-foreground',
      muted: 'text-muted-foreground',
    },
    numeric: {
      true: 'tabular-nums',
    },
  },
  defaultVariants: {
    variant: 'body',
    tone: 'inherit',
  },
})

export const textElement = {
  body: 'p',
  label: 'span',
  strong: 'span',
  caption: 'span',
  micro: 'span',
  overline: 'span',
  code: 'code',
} as const

/** The tone a variant takes when the caller names none: muted for `overline`, else inherit. */
export function textDefaultTone(variant: TextVariant | null | undefined) {
  return variant === 'overline' ? 'muted' : undefined
}

type TextVariantProps = VariantProps<typeof textVariants>
type TextVariant = keyof typeof textElement

export type TextProps<T extends ValidComponent = 'p'> = PolymorphicProps<
  T,
  TextVariantProps & {
    class?: string
  }
>

export function Text<T extends ValidComponent = 'p'>(props: TextProps<T>) {
  const [local, rest] = splitProps(props as TextProps & { as?: ValidComponent }, [
    'as',
    'variant',
    'tone',
    'numeric',
    'class',
  ])

  return (
    <Polymorphic
      as={local.as ?? textElement[(local.variant ?? 'body') as TextVariant]}
      data-slot="text"
      class={cn(
        textVariants({
          variant: local.variant,
          tone: local.tone ?? textDefaultTone(local.variant),
          numeric: local.numeric,
        }),
        local.class
      )}
      {...(rest as ComponentProps<'p'>)}
    />
  )
}
