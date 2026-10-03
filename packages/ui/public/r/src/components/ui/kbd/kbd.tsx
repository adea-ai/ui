import type { ComponentProps } from 'solid-js'
import { For, splitProps } from 'solid-js'
import { cva, type VariantProps } from '../../../lib/variants'
import { cn } from '../../../lib/utils'

/**
 * Kbd.
 *
 * A keyboard key, in the order the user presses them. The element is a real
 * `<kbd>` so the semantics survive copy-paste, and the mono face is what makes
 * a shortcut visually distinct from the sentence around it.
 *
 * `size="compact"` exists for the dense rows a default cap would outweigh — a
 * rail search row, a sidebar shortcut hint. It drops a height rung, and it
 * lightens the fill and weight with it because at that size a solid muted cap
 * reads heavier than the row text it sits in. The default rendering is every
 * cap that is not inside such a row, and it is untouched by the rung.
 *
 * `KbdGroup` exists because a shortcut is a sequence: typing `⌘` then `K`
 * needs a gap between them that is a layout concern, not punctuation.
 */
export const kbdVariants = cva(
  'bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded-sm border border-border px-1 font-mono text-2xs font-medium select-none',
  {
    variants: {
      size: {
        default: '',
        compact: 'h-4 min-w-4 bg-muted/40 px-0.5 font-normal leading-none',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

export type KbdSize = NonNullable<VariantProps<typeof kbdVariants>['size']>

export function Kbd(props: ComponentProps<'kbd'> & { size?: KbdSize }) {
  const [local, rest] = splitProps(props, ['size', 'class'])

  return (
    <kbd data-slot="kbd" class={cn(kbdVariants({ size: local.size }), local.class)} {...rest} />
  )
}

export const kbdGroupVariants = cva('inline-flex items-center gap-1', {
  variants: {
    size: {
      default: '',
      /** The gap is what separates caps, so it tightens with them. */
      compact: 'gap-0.5',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

export function KbdGroup(props: ComponentProps<'span'> & { size?: KbdSize }) {
  const [local, rest] = splitProps(props, ['size', 'class'])

  return (
    <span
      data-slot="kbd-group"
      class={cn(kbdGroupVariants({ size: local.size }), local.class)}
      {...rest}
    />
  )
}

/**
 * Split a written chord into one entry per key cap. Every character is a key:
 * `⌘K` renders as `⌘` + `K`, and a longer chord like `⇧⌘P` stays three caps
 * wide, which matches how the system draws chords in menus.
 */
export function kbdChordKeys(keys: string): string[] {
  return [...keys]
}

export type KbdChordProps = Omit<ComponentProps<'span'>, 'children'> & {
  /** The chord as it is drawn, e.g. `"⌘K"` or `"⇧⌘P"`. One cap per character. */
  keys: string
  size?: KbdSize
}

/**
 * KbdChord.
 *
 * A written chord drawn as caps, one per character. Decoration only: the
 * composition renders `aria-hidden`, so the accessible name and the parseable
 * `aria-keyshortcuts` stay on the control the chord belongs to. That is why
 * there is no children — the chord says what was drawn, nothing more.
 */
export function KbdChord(props: KbdChordProps) {
  const [local, rest] = splitProps(props, ['keys', 'size', 'class'])

  return (
    <KbdGroup {...rest} size={local.size} class={local.class} aria-hidden="true">
      <For each={kbdChordKeys(local.keys)}>{(key) => <Kbd size={local.size}>{key}</Kbd>}</For>
    </KbdGroup>
  )
}
