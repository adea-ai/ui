import { Show, splitProps, type Component, type ComponentProps, type JSX } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

/**
 * EntityIcon.
 *
 * A tile that stands for a thing: a room, a project, an agent, an installed
 * plugin, a workspace. Its job is to be identifiable in a column of its
 * siblings, which is a different job from `Avatar`'s (identifying a *person*) and
 * the reason the two are separate components rather than one with a `round` prop.
 *
 * Three decisions are baked in because getting them wrong is what makes icon
 * grids look messy:
 *
 * 1. **A glyph is always present.** A brand with no logo gets a monogram, not an
 *    empty box. `fallback` takes the name and returns the glyph, so a caller can
 *    choose initials, a domain letter, or a kind icon.
 * 2. **The tile owns its own contrast.** `tone` tints the background and the
 *    glyph together, so a caller never picks a colour pair and never ships an
 *    icon that disappears against its tile.
 * 3. **Size is on the control ladder**, not arbitrary. A tile in a rail and a
 *    tile in a detail header are the same two or three sizes every other
 *    interactive element uses.
 *
 * `shape="rounded"` is the default because a rounded square reads as an object
 * and a circle reads as a person; use `circle` only when the tile really does
 * hold a face.
 */
export const entityIconVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden border font-semibold select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      shape: {
        rounded: 'rounded-lg',
        circle: 'rounded-full',
        square: 'rounded-none',
      },
      size: {
        xs: 'size-5 text-2xs [&_svg]:size-3',
        sm: 'size-6 text-2xs [&_svg]:size-3.5',
        md: 'size-8 text-xs [&_svg]:size-4',
        lg: 'size-10 text-sm [&_svg]:size-5',
        xl: 'size-12 text-base [&_svg]:size-6',
      },
      tone: {
        /** Neutral: an inset tile with a hairline edge — the default. */
        neutral: 'border-border bg-muted text-muted-foreground',
        /** On the brand: for a thing the application itself owns. */
        primary: 'border-transparent bg-primary-subtle text-primary',
        /** Bare: no fill and no edge, for a tile that already sits on a surface. */
        bare: 'border-transparent bg-transparent text-foreground',
        success: 'border-transparent bg-success-subtle text-success',
        warning: 'border-transparent bg-warning-subtle text-warning',
        danger: 'border-transparent bg-destructive-subtle text-destructive',
        info: 'border-transparent bg-info-subtle text-info',
      },
    },
    defaultVariants: { shape: 'rounded', size: 'md', tone: 'neutral' },
  }
)

type EntityIconVariantProps = VariantProps<typeof entityIconVariants>

export type EntityIconProps = Omit<ComponentProps<'span'>, 'children'> &
  EntityIconVariantProps & {
    /** The entity's name. Used for the accessible label and, via `fallback`, the monogram. */
    name: string
    /**
     * A logo or icon — a Lucide icon reference (`icon={Wrench}`) or an element
     * (`icon={<Wrench />}`). Both are accepted because both are what a caller
     * naturally writes, and the difference is an implementation detail they should
     * not have to know.
     */
    icon?: Component | JSX.Element
    /** Glyph for an entity with no icon. Defaults to the name's first two letters. */
    fallback?: (name: string) => JSX.Element
    /** A corner badge: a status dot, an unread count, an installed tick. */
    badge?: JSX.Element
    /** A second edge, drawn outside the tile — an active or selected ring. */
    ring?: boolean
  }

/**
 * Two letters from a name, chosen so the result is stable and readable: the
 * first letter of the first two words when there are two ("Agent HQ" → "AH"),
 * otherwise the first two characters ("Kitchen" → "Ki").
 */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  return name.trim().slice(0, 2)
}

/**
 * A glyph is either a component reference or an element, and the two render
 * differently — `Dynamic` for the first, the element itself for the second. The
 * union is discriminated so the branch is checked rather than cast.
 */
type Glyph = { kind: 'component'; value: Component } | { kind: 'element'; value: JSX.Element }

function Glyph(props: { glyph: Glyph }) {
  return props.glyph.kind === 'component' ? (
    <Dynamic component={props.glyph.value} />
  ) : (
    props.glyph.value
  )
}

export function EntityIcon(props: EntityIconProps) {
  const [local, rest] = splitProps(props, [
    'name',
    'icon',
    'fallback',
    'badge',
    'ring',
    'shape',
    'size',
    'tone',
    'class',
  ])

  const glyph = (): Glyph | undefined => {
    const icon = local.icon
    if (!icon) return undefined
    return typeof icon === 'function'
      ? { kind: 'component', value: icon as Component }
      : { kind: 'element', value: icon as JSX.Element }
  }

  return (
    <span
      class={cn(
        entityIconVariants({ shape: local.shape, size: local.size, tone: local.tone }),
        local.ring && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
        local.class
      )}
      role="img"
      aria-label={local.name}
      {...rest}
    >
      <Show
        when={glyph()}
        fallback={local.fallback ? local.fallback(local.name) : monogram(local.name)}
      >
        {(value) => <Glyph glyph={value()} />}
      </Show>
      <Show when={local.badge}>
        <span class="absolute right-0 bottom-0 translate-x-1/4 translate-y-1/4">{local.badge}</span>
      </Show>
    </span>
  )
}
