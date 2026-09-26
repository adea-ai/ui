import type { ComponentProps } from 'solid-js'
import { createSignal, Show, splitProps } from 'solid-js'
import { cn } from '../../../lib/utils'

/**
 * Avatar.
 *
 * The fallback is painted *under* the image and the image is removed on error,
 * which is the arrangement that avoids every flicker case: a cached image
 * covers the fallback on the first paint, a slow image shows the fallback
 * until it arrives, and a broken image leaves the fallback in place instead of
 * a browser glyph.
 *
 * Initials are derived here so the rule lives in one place rather than in
 * every caller's string slicing: two words give two letters, one word gives
 * one, and a name with no letters gives nothing rather than a stray dot.
 */
export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  if (!first) return ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

const avatarSizes = {
  xs: 'size-5 text-2xs',
  sm: 'size-6 text-2xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-12 text-base',
} as const

export type AvatarProps = ComponentProps<'span'> & {
  size?: keyof typeof avatarSizes
}

export function Avatar(props: AvatarProps) {
  const [local, rest] = splitProps(props, ['class', 'size'])

  return (
    <span
      data-slot="avatar"
      class={cn(
        'relative flex shrink-0 overflow-hidden rounded-full select-none',
        avatarSizes[local.size ?? 'md'],
        local.class
      )}
      {...rest}
    />
  )
}

export type AvatarImageProps = Omit<ComponentProps<'img'>, 'onError'> & {
  onLoadingStatusChange?: (status: 'loading' | 'loaded' | 'error') => void
}

export function AvatarImage(props: AvatarImageProps) {
  const [local, rest] = splitProps(props, ['class', 'alt', 'onLoadingStatusChange'])
  const [status, setStatus] = createSignal<'loading' | 'loaded' | 'error'>('loading')

  const update = (next: 'loading' | 'loaded' | 'error') => {
    setStatus(next)
    local.onLoadingStatusChange?.(next)
  }

  return (
    <Show when={status() !== 'error'}>
      <img
        data-slot="avatar-image"
        alt={local.alt ?? ''}
        class={cn('absolute inset-0 z-10 aspect-square size-full object-cover', local.class)}
        onLoad={() => update('loaded')}
        onError={() => update('error')}
        {...rest}
      />
    </Show>
  )
}

export type AvatarFallbackProps = ComponentProps<'span'> & {
  /** A person or entity name. Initials are derived from it. */
  name?: string
  /** Replace the derived initials with a glyph or emoji string. */
  content?: string
  /** How long to wait before showing the fallback, in ms. 0 shows it at once. */
  delay?: number
}

export function AvatarFallback(props: AvatarFallbackProps) {
  const [local, rest] = splitProps(props, ['class', 'name', 'content', 'delay'])
  const [revealed, setRevealed] = createSignal((local.delay ?? 0) <= 0)

  if ((local.delay ?? 0) > 0) {
    setTimeout(() => setRevealed(true), local.delay)
  }

  const label = () => local.content ?? initialsFrom(local.name ?? '')

  return (
    <span
      data-slot="avatar-fallback"
      class={cn(
        'bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full font-medium',
        { 'opacity-0': !revealed() },
        local.class
      )}
      {...rest}
    >
      <span aria-hidden="true">{label()}</span>
      {local.name ? <span class="visually-hidden">{local.name}</span> : null}
    </span>
  )
}
