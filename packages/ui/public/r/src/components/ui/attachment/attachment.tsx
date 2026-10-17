import {
  Archive,
  File as FileIcon,
  FileCode,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-solid'
import { Show, splitProps, type ComponentProps, type JSX } from 'solid-js'
import { cn } from '../../../lib/utils'
import { Button } from '../button'

/**
 * Attachment.
 *
 * A file that travels with a message or sits in the composer. Three
 * presentations of one thing: a `chip` (a line, for the composer and for a list
 * of many), a `card` (name, type and size, for a message's attachments), and a
 * `tile` (a preview image with the name beneath, for pictures).
 *
 * ## It only offers what works
 *
 * An attachment is a *claim that a file exists and can be handled*. This
 * component therefore draws an action only when the caller supplied the
 * handler: no `onOpen`/`href` and the name is plain text, not a dead button; no
 * `onRemove` and there is no ✕. A host whose attachments cannot be reopened (a
 * name the runtime echoed back, a file that was never stored) renders honest,
 * static chips instead of controls that do nothing.
 *
 * ## Untrusted metadata
 *
 * Name, type and size come from whoever sent the file. They are rendered as
 * text, the name is never used as a path or URL, and a preview is shown only
 * for `blob:`, `https:`/`http:` or a `data:image/*` raster source (no SVG, which
 * can carry script when opened on its own).
 *
 * `status` states the truth about the file's lifecycle in words (`uploading`,
 * `error`, `unavailable`), not by colour alone.
 */
export type AttachmentKind = 'image' | 'document' | 'code' | 'text' | 'archive' | 'other'
export type AttachmentStatus = 'ready' | 'uploading' | 'error' | 'unavailable'
export type AttachmentVariant = 'chip' | 'card' | 'tile'

const KIND_ICON = {
  image: ImageIcon,
  document: FileText,
  code: FileCode,
  text: FileText,
  archive: Archive,
  other: FileIcon,
} as const

/** The figure as written: whole numbers from 10 up, one decimal below. */
const shown = (amount: number) => (amount >= 10 ? Math.round(amount) : Math.round(amount * 10) / 10)

/** `1536` → `1.5 KB`. Returns nothing for a value that is not a finite size. */
export function formatAttachmentSize(bytes: number | undefined): string | undefined {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return undefined
  if (Math.round(bytes) < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  // What is shown, not the raw value, decides the unit: 1023.9 KB rounds to
  // "1024 KB", which should read "1 MB".
  let value = bytes / 1024
  let unit = 0
  while (shown(value) >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${shown(value)} ${units[unit]}`
}

/** The only sources a preview may use. */
export function safePreviewSrc(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (value.startsWith('blob:')) return value
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : undefined
  } catch {
    return undefined
  }
}

export type AttachmentProps = Omit<ComponentProps<'div'>, 'children'> & {
  name: string
  kind?: AttachmentKind
  /** Bytes. */
  size?: number
  variant?: AttachmentVariant
  status?: AttachmentStatus
  /** 0–100 while `uploading`; omit for indeterminate. */
  progress?: number
  /** Why it failed or is unavailable, in words. */
  statusLabel?: string
  previewSrc?: string
  /** Open the file in the host. Omit and the name is not a control. */
  onOpen?: () => void
  /** Open the file by address. Omit and the name is not a link. */
  href?: string
  /** Detach it. Omit and there is no remove control. */
  onRemove?: () => void
  removeLabel?: string
}

export function Attachment(props: AttachmentProps) {
  const [local, rest] = splitProps(props, [
    'class',
    'name',
    'kind',
    'size',
    'variant',
    'status',
    'progress',
    'statusLabel',
    'previewSrc',
    'onOpen',
    'href',
    'onRemove',
    'removeLabel',
  ])
  const variant = () => local.variant ?? 'chip'
  const status = () => local.status ?? 'ready'
  const preview = () => (local.kind === 'image' ? safePreviewSrc(local.previewSrc) : undefined)
  const Icon = () => KIND_ICON[local.kind ?? 'other']
  const size = () => formatAttachmentSize(local.size)
  const actionable = () => status() === 'ready' || status() === 'error'

  const mark = (): JSX.Element => {
    if (status() === 'uploading')
      return <LoaderCircle aria-hidden="true" class="motion-safe:animate-spin" />
    if (status() === 'error') return <TriangleAlert aria-hidden="true" />
    const Glyph = Icon()
    return <Glyph aria-hidden="true" />
  }

  const label = (): JSX.Element => (
    <span class="min-w-0 truncate font-medium" title={local.name}>
      {local.name}
    </span>
  )

  const name = (): JSX.Element => (
    <Show
      when={actionable() && (local.href !== undefined || local.onOpen !== undefined)}
      fallback={label()}
    >
      <Show
        when={local.href !== undefined}
        fallback={
          <button
            type="button"
            class="min-w-0 truncate rounded-xs text-start font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-subtle"
            title={local.name}
            onClick={() => local.onOpen?.()}
          >
            {local.name}
          </button>
        }
      >
        <a
          href={local.href}
          target="_blank"
          rel="noreferrer noopener"
          class="min-w-0 truncate rounded-xs font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-primary-subtle"
          title={local.name}
        >
          {local.name}
        </a>
      </Show>
    </Show>
  )

  const detail = (): JSX.Element => (
    <Show when={status() !== 'ready' || size()}>
      <span
        class={cn('shrink-0 text-xs', {
          'text-destructive': status() === 'error',
          'text-muted-foreground': status() !== 'error',
        })}
        role={status() === 'uploading' || status() === 'error' ? 'status' : undefined}
      >
        {status() === 'uploading'
          ? local.progress === undefined
            ? 'Uploading…'
            : `Uploading ${Math.round(local.progress)}%`
          : status() === 'error'
            ? (local.statusLabel ?? 'Could not attach')
            : status() === 'unavailable'
              ? (local.statusLabel ?? 'Unavailable')
              : size()}
      </span>
    </Show>
  )

  const remove = (): JSX.Element => (
    <Show when={local.onRemove}>
      <Button
        type="button"
        variant="ghost"
        size="icon-2xs"
        class="shrink-0"
        aria-label={local.removeLabel ?? `Remove ${local.name}`}
        onClick={() => local.onRemove?.()}
      >
        <X aria-hidden="true" />
      </Button>
    </Show>
  )

  return (
    <div
      data-slot="attachment"
      data-variant={variant()}
      data-status={status()}
      class={cn(
        'min-w-0 text-sm',
        {
          'inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card py-1 ps-2 pe-1':
            variant() === 'chip',
          'flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-card p-2':
            variant() === 'card',
          'flex w-32 flex-col gap-1.5': variant() === 'tile',
          'border-destructive': status() === 'error',
          'opacity-70': status() === 'unavailable',
        },
        local.class
      )}
      {...rest}
    >
      <Show
        when={variant() === 'tile'}
        fallback={
          <>
            <span
              class={cn('grid shrink-0 place-items-center text-muted-foreground [&_svg]:size-4', {
                'size-9 overflow-hidden rounded-lg bg-muted': variant() === 'card',
                'text-destructive': status() === 'error',
              })}
            >
              <Show when={preview() && variant() === 'card'} fallback={mark()}>
                <img src={preview()} alt="" class="size-full object-cover" />
              </Show>
            </span>
            <span class="flex min-w-0 flex-1 items-center gap-2">
              {name()}
              {detail()}
            </span>
            {remove()}
          </>
        }
      >
        <span class="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-border bg-muted text-muted-foreground [&_svg]:size-6">
          <Show when={preview()} fallback={mark()}>
            <img src={preview()} alt="" class="size-full object-cover" />
          </Show>
        </span>
        <span class="flex min-w-0 items-center gap-1">
          {name()}
          {remove()}
        </span>
        {detail()}
      </Show>
    </div>
  )
}

export function AttachmentList(props: ComponentProps<'ul'>) {
  const [local, rest] = splitProps(props, ['class', 'children'])
  return (
    <ul
      role="list"
      data-slot="attachment-list"
      class={cn('m-0 flex min-w-0 list-none flex-wrap gap-2 p-0', local.class)}
      {...rest}
    >
      {local.children}
    </ul>
  )
}
