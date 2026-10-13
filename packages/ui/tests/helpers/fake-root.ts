import type { ThemeRoot } from '../../src/components/theme/theme-document'

const attributeOf = (key: string) => `data-${key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`

/**
 * A stand-in for `<html>` that records what was written to it.
 *
 * Models only what the theme document writer uses: attributes (with `dataset`
 * as a view onto the `data-*` ones), inline custom properties, and the class list.
 * Enough to assert the whole document contract without a DOM.
 */
export function fakeRoot() {
  const attributes = new Map<string, string>()
  const properties = new Map<string, string>()
  const classes = new Set<string>()

  const dataset = new Proxy({} as Record<string, string | undefined>, {
    get: (_, key: string) => attributes.get(attributeOf(key)),
    set: (_, key: string, value: unknown) => {
      attributes.set(attributeOf(key), String(value))
      return true
    },
  })
  const style = {
    colorScheme: '',
    setProperty: (name: string, value: string) => void properties.set(name, value),
    removeProperty: (name: string) => {
      const previous = properties.get(name) ?? ''
      properties.delete(name)
      return previous
    },
    getPropertyValue: (name: string) => properties.get(name) ?? '',
  }
  const classList = {
    toggle(name: string, force?: boolean) {
      const on = force ?? !classes.has(name)
      if (on) classes.add(name)
      else classes.delete(name)
      return on
    },
    contains: (name: string) => classes.has(name),
  }
  const root = {
    classList,
    dataset,
    style,
    removeAttribute: (name: string) => void attributes.delete(name),
    setAttribute: (name: string, value: string) => void attributes.set(name, String(value)),
  } as unknown as ThemeRoot
  return { root, attributes, properties, classes, style }
}

/** A `localStorage` stand-in; `blocked` makes every access throw as a sandboxed iframe does. */
export function installLocalStorage(initial: Record<string, string> = {}) {
  const backing = new Map(Object.entries(initial))
  const store = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, String(value)),
    removeItem: (key: string) => void backing.delete(key),
  }
  const host = globalThis as { localStorage?: unknown }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: store })
  return {
    backing,
    restore() {
      if (original) Object.defineProperty(globalThis, 'localStorage', original)
      else delete host.localStorage
    },
  }
}

export function blockLocalStorage() {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const host = globalThis as { localStorage?: unknown }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    },
  })
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete host.localStorage
  }
}
