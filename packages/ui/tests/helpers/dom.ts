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
  'innerWidth',
  'innerHeight',
] as const

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 10))

type Saved = Map<string, PropertyDescriptor | undefined>

let installed: { window: Window; saved: Saved } | undefined

function install() {
  if (installed) return installed.window
  const window = new Window({ url: 'http://localhost/' })
  const saved: Saved = new Map()
  const target = globalThis as Record<string, unknown>
  const source = window as unknown as Record<string, unknown>
  // The listed names replace the runtime's own (its `Event` is not the one the DOM's
  // elements dispatch). Every other class the window defines is added only where the
  // runtime has none, so `AbortController`, `URL` and the like keep their own.
  const names = new Set<string>(GLOBALS)
  for (const key of Object.getOwnPropertyNames(window)) {
    if (/^[A-Z]/.test(key) && !(key in globalThis)) names.add(key)
  }
  for (const key of names) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    const value = source[key]
    if (value === undefined) continue
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value: typeof value === 'function' && !/^[A-Z]/.test(key) ? value.bind(window) : value,
    })
  }
  // A browser reports `animationName: none` for an element no stylesheet animates; the DOM
  // reports an empty string. Presence logic reads that to decide whether an exit animation
  // is running, and an empty name would leave a closed overlay mounted, waiting for an
  // `animationend` that no animation will send.
  const computed = window.getComputedStyle.bind(window)
  Object.defineProperty(target, 'getComputedStyle', {
    configurable: true,
    writable: true,
    value: (element: Parameters<typeof computed>[0]) =>
      new Proxy(computed(element), {
        get(style, property) {
          const value = Reflect.get(style, property, style) as unknown
          if (property === 'animationName') return value || 'none'
          return typeof value === 'function' ? value.bind(style) : value
        },
      }),
  })
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
  /** The page's window, typed as the browser's: the suites read it as one. */
  window: typeof globalThis
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

  // Unmounting schedules work for a later task (a focus scope returning focus, a layer
  // dispatching its dismiss event). Wait it out while the globals it needs still exist: left to
  // run after `afterAll`, it throws in whichever test file is loaded next.
  afterEach(async () => {
    while (disposers.length) disposers.pop()!()
    await settle()
    installed?.window.document.body.replaceChildren()
  })

  afterAll(async () => {
    await settle()
    uninstall()
  })

  return {
    get window() {
      return install() as unknown as typeof globalThis
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
