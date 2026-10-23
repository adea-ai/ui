import { afterAll, afterEach, beforeAll } from 'bun:test'
import type { JSX } from 'solid-js'

import { Window } from 'happy-dom'
import { render } from 'solid-js/web'

/**
 * Browser globals a component reads while it renders, copied from a happy-dom window.
 *
 * The unit lane has no DOM by default (most suites assert pure logic or read source),
 * so a suite that renders a component installs one for its own file only: `useDom()`
 * called at the top of the file installs it, and `afterAll` puts the previous globals
 * back, so a suite that checks for "no DOM" behaviour never sees another file's window.
 */
const GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLTextAreaElement',
  'HTMLButtonElement',
  'HTMLTemplateElement',
  'SVGElement',
  'DocumentFragment',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'FocusEvent',
  'InputEvent',
  'MutationObserver',
  'getComputedStyle',
  'matchMedia',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'localStorage',
  'sessionStorage',
] as const

type Saved = Map<string, PropertyDescriptor | undefined>

let installed: { window: Window; saved: Saved } | undefined

function install() {
  if (installed) return installed.window
  const window = new Window({ url: 'http://localhost/' })
  const saved: Saved = new Map()
  const target = globalThis as Record<string, unknown>
  for (const key of GLOBALS) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    const value = (window as unknown as Record<string, unknown>)[key]
    if (value === undefined) continue
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value: typeof value === 'function' && !/^[A-Z]/.test(key) ? value.bind(window) : value,
    })
  }
  installed = { window, saved }
  return window
}

function uninstall() {
  if (!installed) return
  for (const [key, descriptor] of installed.saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete (globalThis as Record<string, unknown>)[key]
  }
  installed.window.happyDOM.close()
  installed = undefined
}

export type Dom = {
  window: Window
  /** Render into a fresh container attached to the body; unmounted after each test. */
  mount: (ui: () => JSX.Element) => HTMLElement
}

export function useDom(): Dom {
  const disposers: Array<() => void> = []

  // Installed as the file's body runs, not in `beforeAll`: the compiled JSX registers its
  // delegated events on `window.document` in the last statement of the test module, which
  // is before any hook runs. A previous DOM file's `afterAll` has removed its window by now.
  install()
  beforeAll(() => {
    install()
  })

  afterEach(() => {
    while (disposers.length) disposers.pop()!()
    installed?.window.document.body.replaceChildren()
  })

  afterAll(uninstall)

  return {
    get window() {
      return install()
    },
    mount(ui) {
      const { document } = install()
      const container = document.createElement('div')
      document.body.appendChild(container)
      disposers.push(render(ui, container as unknown as HTMLElement))
      return container as unknown as HTMLElement
    },
  }
}
