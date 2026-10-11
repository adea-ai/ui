/*
 * Substantially translated from KiroCrew website/src/components/ChatInput.tsx
 * and PasteHighlightLayer.tsx at 283e136c0f902e965a535a7c9548c57c7504fed0.
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * Licensed under Apache-2.0; see LICENSE and NOTICE.
 */
import {
  For,
  Show,
  createEffect,
  createSignal,
  createUniqueId,
  on,
  onCleanup,
  onMount,
} from 'solid-js'
import {
  countLines,
  findTokenRanges,
  formatToken,
  isPasteBlock,
  nextSeq,
  pruneBlocks,
  shouldCollapse,
  stripTrailingBlankLines,
  tokenRangeAt,
  type PasteBlock,
} from './paste-tokens'
import { Tooltip as KobalteTooltip } from '@kobalte/core/tooltip'

export type PasteTokenDraft = { text: string; blocks: PasteBlock[] }
type TokenRange = { start: number; end: number; block: PasteBlock }
type Segment = { text: string; block?: PasteBlock }

export type PasteTokenEditorProps = {
  value: string
  resetKey?: unknown
  blocks: readonly PasteBlock[]
  ref: (element: HTMLTextAreaElement | undefined) => void
  createBlockId: () => string
  onChange: (draft: PasteTokenDraft) => void
  inputLabel: string
  placeholder: string
  disabled?: boolean
  readOnly?: boolean
  composing: () => boolean
  onCompositionStart: () => void
  onCompositionEnd: () => void
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

const PREVIEW_OPEN_DELAY_MS = 300
const PREVIEW_MAX_LINES = 12

function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches)
  )
}

function isBlockquotePrefix(linePrefix: string): boolean {
  let sawMarker = false
  for (let index = 0; index < linePrefix.length; index += 1) {
    const code = linePrefix.charCodeAt(index)
    if (code === 62) sawMarker = true
    else if (code !== 32 && code !== 9) return false
  }
  return sawMarker
}

/** Controlled plain-text editor that treats known paste markers as atomic ranges. */
export function PasteTokenEditor(props: PasteTokenEditorProps) {
  const [preview, setPreview] = createSignal<PasteBlock | null>(null)
  const descriptionId = `paste-preview-${createUniqueId()}`
  let field: HTMLTextAreaElement | undefined
  let mirror: HTMLDivElement | undefined
  let previewTimer: ReturnType<typeof setTimeout> | undefined
  let scheduledBlockId: string | null = null
  let rawPasteNext = false
  let suppressPasteInput = false
  let nativePasteInputSeen = false

  const ranges = () => findTokenRanges(props.value, props.blocks)
  const clearTimer = () => {
    clearTimeout(previewTimer)
    previewTimer = undefined
  }
  const closePreview = () => {
    clearTimer()
    scheduledBlockId = null
    setPreview(null)
  }
  const schedulePreview = (block: PasteBlock) => {
    if (scheduledBlockId === block.id) return
    clearTimer()
    scheduledBlockId = block.id
    setPreview(null)
    previewTimer = setTimeout(() => {
      previewTimer = undefined
      const current = ranges().find((range) => range.block.id === block.id)
      if (current) setPreview(current.block)
      else closePreview()
    }, PREVIEW_OPEN_DELAY_MS)
  }
  const change = (text: string, blocks: readonly PasteBlock[] = props.blocks) => {
    props.onChange({ text, blocks: pruneBlocks(text, [...blocks]) })
  }
  const snapToTokenEdge = (
    position: number,
    tokenRanges: readonly TokenRange[] = ranges(),
    edge?: 'start' | 'end'
  ) => {
    for (const range of tokenRanges) {
      if (position > range.start && position < range.end) {
        if (edge === 'start') return range.start
        if (edge === 'end') return range.end
        return position - range.start <= range.end - position ? range.start : range.end
      }
    }
    return position
  }
  const setCaret = (position: number, focus = false) => {
    requestAnimationFrame(() => {
      if (!field) return
      if (focus) field.focus()
      field.setSelectionRange(position, position)
    })
  }
  const replaceRange = (start: number, end: number) => {
    if (!field) return
    const removed = ranges().filter((range) => range.start < end && range.end > start)
    if (!removed.length) return
    const nextStart = Math.min(start, ...removed.map((range) => range.start))
    const nextEnd = Math.max(end, ...removed.map((range) => range.end))
    const next = props.value.slice(0, nextStart) + props.value.slice(nextEnd)
    change(
      next,
      props.blocks.filter((block) => !removed.some((range) => range.block.id === block.id))
    )
    setCaret(nextStart)
  }
  const expandToken = (range: TokenRange) => {
    const next =
      props.value.slice(0, range.start) + range.block.content + props.value.slice(range.end)
    change(
      next,
      props.blocks.filter((block) => block.id !== range.block.id)
    )
    closePreview()
    setCaret(range.start + range.block.content.length, true)
  }

  const segments = (): Segment[] => {
    const result: Segment[] = []
    let cursor = 0
    for (const range of ranges()) {
      if (range.start > cursor) result.push({ text: props.value.slice(cursor, range.start) })
      result.push({ text: props.value.slice(range.start, range.end), block: range.block })
      cursor = range.end
    }
    if (cursor < props.value.length) result.push({ text: props.value.slice(cursor) })
    if (!result.length) result.push({ text: props.value })
    return result
  }

  const scheduleCaretPreview = () => {
    if (isTouchDevice() || props.composing() || !field) {
      closePreview()
      return
    }
    if (field.selectionStart !== field.selectionEnd) {
      closePreview()
      return
    }
    const caret = field.selectionStart
    const range = ranges().find((candidate) => caret > candidate.start && caret < candidate.end)
    if (!range) closePreview()
    else schedulePreview(range.block)
  }

  const schedulePointerPreview = (event: MouseEvent) => {
    if (isTouchDevice() || props.composing() || event.buttons !== 0 || !mirror) {
      closePreview()
      return
    }
    for (const span of mirror.querySelectorAll<HTMLElement>('[data-paste-seq]')) {
      const rect = span.getBoundingClientRect()
      if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      ) {
        const sequence = Number(span.dataset.pasteSeq)
        const range = ranges().find((candidate) => candidate.block.seq === sequence)
        if (range) schedulePreview(range.block)
        else closePreview()
        return
      }
    }
    closePreview()
  }

  const snapSelection = () => {
    if (!field || props.composing()) return
    const start = field.selectionStart
    const end = field.selectionEnd
    scheduleCaretPreview()
    if (start === end) return
    const direction = field.selectionDirection
    const tokenRanges = ranges()
    const nextStart = snapToTokenEdge(start, tokenRanges)
    const nextEnd = snapToTokenEdge(end, tokenRanges)
    if (nextStart !== start || nextEnd !== end) {
      field.setSelectionRange(Math.min(nextStart, nextEnd), Math.max(nextStart, nextEnd), direction)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    rawPasteNext =
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === 'v'
    if (props.composing() || event.isComposing || event.keyCode === 229 || !field) {
      props.onKeyDown(event)
      return
    }
    if (event.key === 'Escape' && preview()) closePreview()

    const value = props.value
    const start = field.selectionStart
    const end = field.selectionEnd
    const collapsed = start === end
    const tokenRanges = ranges()
    const plainModifier = !event.metaKey && !event.ctrlKey && !event.altKey
    const backspace = event.key === 'Backspace'
    const deletion = backspace || event.key === 'Delete'
    let remove: readonly [number, number] | undefined

    if (deletion && !collapsed) {
      if (tokenRanges.some((range) => range.start < end && range.end > start)) remove = [start, end]
    } else if (deletion) {
      const adjacent = tokenRanges.find((range) =>
        backspace ? range.end === start : range.start === start
      )
      if (adjacent && (plainModifier || event.altKey || event.ctrlKey)) {
        remove = [adjacent.start, adjacent.end]
      } else if (event.metaKey) {
        const boundary = backspace
          ? value.lastIndexOf('\n', start - 1) + 1
          : value.indexOf('\n', start)
        const from = backspace ? boundary : start
        const to = backspace ? start : boundary < 0 ? value.length : boundary
        if (tokenRanges.some((range) => range.start < to && range.end > from)) remove = [from, to]
      }
    }
    if (remove) {
      event.preventDefault()
      replaceRange(remove[0], remove[1])
      props.onKeyDown(event)
      return
    }

    if (plainModifier && collapsed && !event.shiftKey) {
      const left = event.key === 'ArrowLeft'
      const right = event.key === 'ArrowRight'
      const adjacent = left
        ? tokenRanges.find((range) => range.end === start)
        : right
          ? tokenRanges.find((range) => range.start === start)
          : undefined
      if (adjacent) {
        event.preventDefault()
        setCaret(left ? adjacent.start : adjacent.end)
        props.onKeyDown(event)
        return
      }
    }
    if (!event.metaKey && !event.ctrlKey && !event.altKey && event.shiftKey) {
      const direction = field.selectionDirection === 'backward' ? 'backward' : 'forward'
      const active = direction === 'backward' ? start : end
      const adjacent =
        event.key === 'ArrowLeft'
          ? tokenRanges.find((range) => range.end === active)
          : event.key === 'ArrowRight'
            ? tokenRanges.find((range) => range.start === active)
            : undefined
      if (adjacent) {
        event.preventDefault()
        requestAnimationFrame(() => {
          if (!field) return
          if (event.key === 'ArrowLeft' && direction === 'backward')
            field.setSelectionRange(adjacent.start, end, 'backward')
          else if (event.key === 'ArrowLeft')
            field.setSelectionRange(
              start,
              adjacent.start,
              start <= adjacent.start ? 'forward' : 'backward'
            )
          else if (direction === 'backward')
            field.setSelectionRange(adjacent.end, end, adjacent.end <= end ? 'backward' : 'forward')
          else field.setSelectionRange(start, adjacent.end, 'forward')
        })
        props.onKeyDown(event)
        return
      }
    }

    const navigation =
      event.key === 'Home' ||
      event.key === 'End' ||
      ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
        (event.metaKey || event.ctrlKey || event.altKey))
    if (navigation) {
      const leftward = event.key === 'ArrowLeft' || event.key === 'Home'
      requestAnimationFrame(() => {
        if (!field) return
        const nextRanges = findTokenRanges(field.value, props.blocks)
        const edge = leftward ? 'start' : 'end'
        const nextStart = snapToTokenEdge(field.selectionStart, nextRanges, edge)
        const nextEnd = snapToTokenEdge(field.selectionEnd, nextRanges, edge)
        if (nextStart !== field.selectionStart || nextEnd !== field.selectionEnd) {
          field.setSelectionRange(
            Math.min(nextStart, nextEnd),
            Math.max(nextStart, nextEnd),
            field.selectionDirection
          )
        }
      })
    }
    props.onKeyDown(event)
  }

  const expandSelectionForClipboard = (start: number, end: number): string | null => {
    if (start === end) return null
    const covered = ranges().filter((range) => range.start >= start && range.end <= end)
    if (!covered.length) return null
    let result = ''
    let cursor = start
    for (const range of covered) {
      result += props.value.slice(cursor, range.start) + range.block.content
      cursor = range.end
    }
    return result + props.value.slice(cursor, end)
  }

  const handlePaste = (event: ClipboardEvent) => {
    const forceRaw = rawPasteNext
    rawPasteNext = false
    const pasted = event.clipboardData?.getData('text/plain') ?? ''
    if (!pasted || !field || props.readOnly || props.disabled) return
    const cleaned = forceRaw ? pasted : stripTrailingBlankLines(pasted)
    const start = field.selectionStart
    const end = field.selectionEnd
    const before = props.value.slice(0, start)
    const after = props.value.slice(end)

    if (!forceRaw && shouldCollapse(cleaned)) {
      const id = props.createBlockId()
      if (props.blocks.some((block) => block.id === id)) return
      const block: PasteBlock = {
        id,
        seq: nextSeq([...props.blocks]),
        lines: countLines(cleaned),
        content: cleaned,
      }
      if (!isPasteBlock(block)) return
      const linePrefix = before.slice(before.lastIndexOf('\n') + 1)
      const leading =
        before && !before.endsWith('\n') && !isBlockquotePrefix(linePrefix) ? '\n' : ''
      const trailing = after && !after.startsWith('\n') ? '\n' : ''
      const insert = leading + formatToken(block) + trailing
      event.preventDefault()
      change(before + insert + after, [...props.blocks, block])
      closePreview()
      setCaret(before.length + insert.length)
      return
    }
    if (forceRaw) return
    if (cleaned !== pasted && cleaned !== '') {
      event.preventDefault()
      const next = before + cleaned + after
      nativePasteInputSeen = false
      suppressPasteInput = true
      let inserted = false
      try {
        inserted =
          typeof document.execCommand === 'function' &&
          document.execCommand('insertText', false, cleaned)
      } catch {
        inserted = false
      }
      if (!nativePasteInputSeen) suppressPasteInput = false
      change(next)
      if (inserted && field.value === next) return
      setCaret(before.length + cleaned.length)
    }
  }

  const handleClipboard = (event: ClipboardEvent) => {
    if (!field || !event.clipboardData) return
    const start = field.selectionStart
    const end = field.selectionEnd
    const expanded = expandSelectionForClipboard(start, end)
    if (expanded === null) return
    event.clipboardData.setData('text/plain', expanded)
    event.preventDefault()
    if (event.type === 'cut') {
      change(props.value.slice(0, start) + props.value.slice(end))
      setCaret(start)
    }
  }

  const handleClick = (event: MouseEvent) => {
    if (!field || !props.blocks.length) return
    const range = tokenRangeAt(props.value, props.blocks, field.selectionStart)
    if (!range) return
    if (isTouchDevice() || event.detail >= 2) expandToken(range)
    else {
      requestAnimationFrame(() => field?.setSelectionRange(range.start, range.end))
    }
  }

  createEffect(on(() => props.value, closePreview))
  createEffect(on(() => props.blocks, closePreview))
  createEffect(
    on(
      () => props.resetKey,
      () => {
        rawPasteNext = false
        closePreview()
      }
    )
  )
  onMount(() => {
    window.addEventListener('scroll', closePreview, true)
    window.addEventListener('resize', closePreview)
    onCleanup(() => {
      window.removeEventListener('scroll', closePreview, true)
      window.removeEventListener('resize', closePreview)
    })
  })
  onCleanup(() => clearTimer())

  return (
    <KobalteTooltip
      open={!!preview()}
      onOpenChange={() => undefined}
      openDelay={PREVIEW_OPEN_DELAY_MS}
    >
      <KobalteTooltip.Trigger as="div" class="relative">
        <div
          ref={(element) => (mirror = element)}
          data-slot="paste-token-mirror"
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 overflow-hidden select-none whitespace-pre-wrap break-words px-4 py-3 text-sm text-transparent"
        >
          <For each={segments()}>
            {(segment) =>
              segment.block ? (
                <span
                  class="box-decoration-clone rounded-md bg-primary-subtle"
                  data-paste-seq={segment.block.seq}
                >
                  {segment.text}
                </span>
              ) : (
                <span>{segment.text}</span>
              )
            }
          </For>
          {props.value.endsWith('\n') ? '\u200b' : ''}
        </div>
        <textarea
          ref={(element) => {
            field = element
            props.ref(element)
            onCleanup(() => {
              if (field === element) field = undefined
              props.ref(undefined)
            })
          }}
          data-slot="composer-input"
          aria-label={props.inputLabel}
          aria-describedby={preview() ? descriptionId : undefined}
          class="relative field-sizing-content text-foreground placeholder:text-muted-foreground min-h-11 max-h-36 w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-none disabled:opacity-50"
          value={props.value}
          disabled={props.disabled}
          readOnly={props.readOnly}
          placeholder={props.placeholder}
          rows={1}
          onInput={(event) => {
            if (suppressPasteInput) {
              suppressPasteInput = false
              nativePasteInputSeen = true
              return
            }
            change(event.currentTarget.value)
          }}
          onPaste={handlePaste}
          onCopy={handleClipboard}
          onCut={handleClipboard}
          onClick={handleClick}
          onSelect={snapSelection}
          onMouseMove={schedulePointerPreview}
          onMouseLeave={closePreview}
          onScroll={(event) => {
            if (mirror) {
              mirror.scrollTop = event.currentTarget.scrollTop
              mirror.scrollLeft = event.currentTarget.scrollLeft
            }
            closePreview()
          }}
          onCompositionStart={props.onCompositionStart}
          onCompositionEnd={props.onCompositionEnd}
          onFocus={props.onFocus}
          onBlur={() => {
            rawPasteNext = false
            props.onBlur()
            closePreview()
          }}
          onKeyDown={handleKeyDown}
        />
      </KobalteTooltip.Trigger>
      <Show when={preview()}>
        {(block) => {
          const lines = () => block().content.split('\n')
          const shown = () => lines().slice(0, PREVIEW_MAX_LINES).join('\n')
          const remainder = () => Math.max(0, lines().length - PREVIEW_MAX_LINES)
          return (
            <KobalteTooltip.Portal>
              <KobalteTooltip.Content
                id={descriptionId}
                data-slot="paste-token-preview"
                class="bg-scrim text-scrim-foreground z-(--z-tooltip) w-fit max-w-64 rounded-md px-2 py-1 text-xs origin-(--kb-tooltip-content-transform-origin) text-balance data-expanded:animate-in data-expanded:fade-in-0 data-expanded:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-expanded:duration-150 data-closed:duration-100"
              >
                <pre class="m-0 max-w-64 overflow-hidden whitespace-pre-wrap break-words font-mono">
                  {shown()}
                </pre>
                <Show when={remainder() > 0}>
                  <span class="text-muted-foreground">+{remainder()} more lines</span>
                </Show>
                <KobalteTooltip.Arrow aria-hidden="true" />
              </KobalteTooltip.Content>
            </KobalteTooltip.Portal>
          )
        }}
      </Show>
    </KobalteTooltip>
  )
}
