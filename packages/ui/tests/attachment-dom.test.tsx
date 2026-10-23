import { describe, expect, test } from 'bun:test'

import type { AttachmentProps } from '../src/components/ui/attachment/attachment'
import { useDom } from './helpers/dom'

const dom = useDom()

// Loaded once the window exists: the module registers its delegated click handler on the
// document as it evaluates, so a static import would run before the window was installed.
const { Attachment, AttachmentList } = await import('../src/components/ui/attachment/attachment')

const attach = (props: Partial<AttachmentProps> = {}) =>
  dom
    .mount(() => <Attachment name="report.pdf" {...props} />)
    .querySelector('[data-slot="attachment"]') as HTMLElement

describe('Attachment', () => {
  test('is a chip showing the name, the size and the kind icon', () => {
    const chip = attach({ size: 2048, kind: 'document' })
    expect(chip.getAttribute('data-variant')).toBe('chip')
    expect(chip.getAttribute('data-status')).toBe('ready')
    expect(chip.textContent).toBe('report.pdf2 KB')
    expect(chip.querySelector('svg')).not.toBeNull()
    expect(chip.querySelector('[title="report.pdf"]')?.tagName).toBe('SPAN')
  })

  test('shows no size line when the size is unknown', () => {
    expect(attach({}).textContent).toBe('report.pdf')
  })

  test('the card and tile variants shape the layout', () => {
    expect(attach({ variant: 'card' }).classList.contains('max-w-sm')).toBe(true)
    const tile = attach({ variant: 'tile', size: 10 })
    expect(tile.classList.contains('w-32')).toBe(true)
    expect(tile.textContent).toBe('report.pdf10 B')
  })

  test('a name with an open handler is a button that calls it', () => {
    let opened = 0
    const chip = attach({ onOpen: () => (opened += 1) })
    const button = chip.querySelector('button[title="report.pdf"]') as HTMLButtonElement
    button.click()
    expect(opened).toBe(1)
  })

  test('a name with an href is an external link that does not leak the opener', () => {
    const link = attach({ href: 'https://example.com/report.pdf' }).querySelector('a')!
    expect(link.getAttribute('href')).toBe('https://example.com/report.pdf')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer noopener')
  })

  test('an attachment that is not ready or failed cannot be opened', () => {
    const chip = attach({ status: 'uploading', onOpen: () => {}, href: 'https://example.com/x' })
    expect(chip.querySelector('button, a')).toBeNull()
    expect(attach({ status: 'unavailable', onOpen: () => {} }).querySelector('button')).toBeNull()
  })

  test('uploading shows progress as a status and a spinner', () => {
    const chip = attach({ status: 'uploading', progress: 41.6 })
    expect(chip.querySelector('[role="status"]')?.textContent).toBe('Uploading 42%')
    expect(chip.querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
  })

  test('uploading without progress says so plainly', () => {
    expect(attach({ status: 'uploading' }).querySelector('[role="status"]')?.textContent).toBe(
      'Uploading…'
    )
  })

  test('an error says what happened in the destructive tone, and can still be opened or removed', () => {
    let removed = 0
    const chip = attach({
      status: 'error',
      statusLabel: 'Too large',
      onOpen: () => {},
      onRemove: () => (removed += 1),
    })
    const status = chip.querySelector('[role="status"]')!
    expect(status.textContent).toBe('Too large')
    expect(status.classList.contains('text-destructive')).toBe(true)
    expect(chip.classList.contains('border-destructive')).toBe(true)
    expect(chip.querySelector('button[title="report.pdf"]')).not.toBeNull()
    ;(chip.querySelector('button[aria-label]') as HTMLButtonElement).click()
    expect(removed).toBe(1)
  })

  test('an error with no label falls back to a default', () => {
    expect(attach({ status: 'error' }).querySelector('[role="status"]')?.textContent).toBe(
      'Could not attach'
    )
  })

  test('an unavailable attachment is dimmed and says so', () => {
    const chip = attach({ status: 'unavailable' })
    expect(chip.classList.contains('opacity-70')).toBe(true)
    expect(chip.textContent).toContain('Unavailable')
    expect(attach({ status: 'unavailable', statusLabel: 'Expired' }).textContent).toContain(
      'Expired'
    )
  })

  test('Remove is offered only with a handler, and is named for the file unless labelled', () => {
    expect(attach({}).querySelector('button')).toBeNull()
    expect(
      attach({ onRemove: () => {} })
        .querySelector('button')
        ?.getAttribute('aria-label')
    ).toBe('Remove report.pdf')
    expect(
      attach({ onRemove: () => {}, removeLabel: 'Drop it' })
        .querySelector('button')
        ?.getAttribute('aria-label')
    ).toBe('Drop it')
  })

  test('a card previews an image from a safe source', () => {
    const card = attach({
      variant: 'card',
      kind: 'image',
      previewSrc: 'https://example.com/a.png',
    })
    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png')
  })

  test('a tile previews an image, and an unsafe source falls back to the icon', () => {
    const safe = attach({ variant: 'tile', kind: 'image', previewSrc: 'blob:abc' })
    expect(safe.querySelector('img')?.getAttribute('src')).toBe('blob:abc')
    const unsafe = attach({
      variant: 'tile',
      kind: 'image',
      previewSrc: 'javascript:alert(1)',
    })
    expect(unsafe.querySelector('img')).toBeNull()
    expect(unsafe.querySelector('svg')).not.toBeNull()
  })

  test('only an image attachment shows a preview', () => {
    const card = attach({
      variant: 'card',
      kind: 'document',
      previewSrc: 'https://example.com/a.png',
    })
    expect(card.querySelector('img')).toBeNull()
  })

  test('a chip never shows a preview image', () => {
    const chip = attach({ kind: 'image', previewSrc: 'https://example.com/a.png' })
    expect(chip.querySelector('img')).toBeNull()
  })

  test('a tile puts the name and Remove under the thumbnail', () => {
    const tile = attach({ variant: 'tile', onRemove: () => {}, status: 'error' })
    expect(tile.querySelector('button[aria-label="Remove report.pdf"]')).not.toBeNull()
    expect(tile.querySelector('[role="status"]')?.textContent).toBe('Could not attach')
  })
})

describe('AttachmentList', () => {
  test('is a list of its attachments', () => {
    const root = dom.mount(() => (
      <AttachmentList class="opacity-90">
        <li>
          <Attachment name="a.txt" />
        </li>
        <li>
          <Attachment name="b.txt" />
        </li>
      </AttachmentList>
    ))
    const list = root.querySelector('[data-slot="attachment-list"]')!
    expect(list.tagName).toBe('UL')
    expect(list.getAttribute('role')).toBe('list')
    expect(list.classList.contains('opacity-90')).toBe(true)
    expect(list.querySelectorAll('[data-slot="attachment"]').length).toBe(2)
  })
})
