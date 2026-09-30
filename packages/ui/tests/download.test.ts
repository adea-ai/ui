import { expect, test } from 'bun:test'
import { downloadBlob } from '../src/lib/download'

test('downloadBlob preserves the payload and filename and cleans up after a failed click', async () => {
  const blob = new Blob(['export payload'], { type: 'application/json' })
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const revoked: string[] = []
  let appended: HTMLAnchorElement | undefined
  let removed = false
  let clicked = false
  let focusRestored = false
  const fakeDocument: {
    activeElement: HTMLElement | HTMLAnchorElement
    createElement: (tagName: string) => HTMLAnchorElement
    body: { append: (element: HTMLAnchorElement) => void }
  } = {
    activeElement: {
      isConnected: true,
      focus(options?: FocusOptions) {
        expect(options).toEqual({ preventScroll: true })
        focusRestored = true
      },
    } as HTMLElement,
    createElement(tagName) {
      expect(tagName).toBe('a')
      return anchor
    },
    body: {
      append(element) {
        appended = element
      },
    },
  }

  const anchor = {
    href: '',
    download: '',
    hidden: false,
    tabIndex: 0,
    setAttribute(name: string, value: string) {
      if (name === 'aria-hidden') expect(value).toBe('true')
    },
    click() {
      clicked = true
      fakeDocument.activeElement = anchor
      throw new Error('synthetic click failure')
    },
    remove() {
      removed = true
    },
  } as unknown as HTMLAnchorElement

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (received: Blob) => {
      expect(received).toBe(blob)
      return 'blob:shared-download-test'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => revoked.push(url),
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
  })

  try {
    expect(() => downloadBlob(blob, 'workspace.json')).toThrow('synthetic click failure')
    expect(appended).toBe(anchor)
    expect(anchor.href).toBe('blob:shared-download-test')
    expect(anchor.download).toBe('workspace.json')
    expect(anchor.hidden).toBe(true)
    expect(anchor.tabIndex).toBe(-1)
    expect(clicked).toBe(true)
    expect(removed).toBe(true)
    expect(focusRestored).toBe(true)
    expect(revoked).toEqual([])

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(revoked).toEqual(['blob:shared-download-test'])
  } finally {
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate)
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke)
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
