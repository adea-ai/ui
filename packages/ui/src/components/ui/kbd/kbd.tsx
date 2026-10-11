import type { ComponentProps } from 'solid-js'
import { For, splitProps } from 'solid-js'
import { cva, type VariantProps } from '#lib/variants'
import { cn } from '#lib/utils'

export const kbdVariants = cva(
  'bg-muted text-muted-foreground pointer-events-none inline-flex items-center justify-center rounded-sm border border-border font-mono text-2xs font-medium select-none',
  {
    variants: {
      size: {
        sm: 'min-h-4 min-w-4 gap-0.5 px-0.5 leading-none',
        md: 'min-h-5 min-w-5 gap-1 px-1',
      },
    },
    defaultVariants: { size: 'md' },
  }
)

export const kbdGroupVariants = cva('inline-flex items-center', {
  variants: { size: { sm: 'gap-0.5', md: 'gap-1' } },
  defaultVariants: { size: 'md' },
})

export type KbdProps = ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>
export type KbdGroupProps = ComponentProps<'span'> & VariantProps<typeof kbdGroupVariants>

/** A semantic keyboard key. Use the compact size for decorative control hints. */
export function Kbd(props: KbdProps) {
  const [local, rest] = splitProps(props, ['class', 'size'])
  return (
    <kbd data-slot="kbd" class={cn(kbdVariants({ size: local.size }), local.class)} {...rest} />
  )
}

/** A shortcut is a sequence of key caps; the group owns their spacing. */
export function KbdGroup(props: KbdGroupProps) {
  const [local, rest] = splitProps(props, ['class', 'size'])
  return (
    <span
      data-slot="kbd-group"
      class={cn(kbdGroupVariants({ size: local.size }), local.class)}
      {...rest}
    />
  )
}

/** Split a glyph chord such as ⇧⌘P into individual caps, preserving code points. */
export function shortcutKeyList(keys: string): string[] {
  return [...keys]
}

export type ShortcutKeysProps = {
  keys: string
  /** Layout only; compact cap appearance belongs to Kbd. */
  class?: string
}

/**
 * Decorative character-per-cap shortcut hint. The host control owns its
 * accessible name and parseable aria-keyshortcuts; reading the glyphs again
 * would duplicate that name. Use Kbd/KbdGroup directly for spoken prose or
 * multi-character key names such as Enter and Ctrl.
 */
export function ShortcutKeys(props: ShortcutKeysProps) {
  return (
    <KbdGroup size="sm" aria-hidden="true" class={props.class}>
      <For each={shortcutKeyList(props.keys)}>{(key) => <Kbd size="sm">{key}</Kbd>}</For>
    </KbdGroup>
  )
}
