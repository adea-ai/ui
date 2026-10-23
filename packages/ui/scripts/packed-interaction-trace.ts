/**
 * Names the interaction a packed leg was in when its renderer died.
 *
 * Playwright's own error for a crashed renderer carries no call log: it reads
 * `evaluate: Target crashed` and nothing else, so the log of a failing leg says
 * which leg died and not which interaction it was in. The archived #481 failure
 * is unreadable for exactly that reason. The trace remembers the last action the
 * leg performed, so the next occurrence carries the step that has to be read.
 *
 * Nothing here decides an outcome. The trace only remembers a string: every call
 * it intercepts is forwarded unchanged, and no assertion, budget or pass/fail
 * decision is touched.
 */

/** The locator actions the trace records. */
const ACTION_METHODS = ['click', 'fill', 'press', 'hover'] as const

/** The page methods that hand out the locators the trace records. */
const LOCATOR_FACTORIES = [
  'getByRole',
  'getByLabel',
  'getByTestId',
  'getByText',
  'locator',
] as const

type LocatorFactory = (typeof LOCATOR_FACTORIES)[number]

/** The label of a locator argument: its text, its pattern, or nothing. */
function labelOf(value: unknown): string | undefined {
  if (typeof value === 'string') return `'${value}'`
  if (value instanceof RegExp) return String(value)
  return undefined
}

/** What the trace knows about the page it watches. */
export interface InteractionTrace {
  /** The last action the page performed, as a short sentence, or nothing yet. */
  lastAction: () => string | undefined
}

/** A locator's own shape, as far as the trace touches it. */
type TraceableLocator = Record<string, unknown>

/** The page's own shape, as far as the trace touches it. */
type TraceablePage = Record<string, unknown>

/**
 * Describes the target of a locator call, so the record names what was being
 * driven: the role and the accessible name for a role lookup, the looked-up
 * text for the others.
 */
function describeTarget(factory: LocatorFactory, args: unknown[]): string {
  const [first, second] = args
  if (factory === 'getByRole') {
    const role = labelOf(first) ?? 'role'
    const options = second as { name?: unknown } | undefined
    const name = labelOf(options?.name)
    return name === undefined ? `getByRole ${role}` : `getByRole ${role} name ${name}`
  }
  const target = labelOf(first)
  return target === undefined ? factory : `${factory} ${target}`
}

/**
 * Watches a page and remembers the last action it performed.
 *
 * The trace installs itself on the page's own locator factories and on the
 * action methods of the locators they return. The locator itself is returned
 * unchanged — it is the same object, with its action methods shadowed — so
 * assertions that take a locator keep working exactly as before.
 */
export function tracePageInteractions(page: unknown): InteractionTrace {
  let last: string | undefined
  if (typeof page !== 'object' || page === null) return { lastAction: () => undefined }
  const target = page as TraceablePage

  for (const factory of LOCATOR_FACTORIES) {
    const original = target[factory]
    if (typeof original !== 'function') continue
    const call = (original as (...args: unknown[]) => TraceableLocator).bind(page)
    target[factory] = (...args: unknown[]) => {
      const locator = call(...args)
      for (const method of ACTION_METHODS) {
        const action = locator[method]
        if (typeof action !== 'function') continue
        const label = `${method} on ${describeTarget(factory, args)}`
        locator[method] = (...actionArgs: unknown[]) => {
          last = label
          return (action as (...a: unknown[]) => Promise<unknown>).apply(locator, actionArgs)
        }
      }
      return locator
    }
  }

  const evaluate = target['evaluate']
  if (typeof evaluate === 'function') {
    const call = (evaluate as (...args: unknown[]) => Promise<unknown>).bind(page)
    target['evaluate'] = (...args: unknown[]) => {
      last = 'evaluate'
      return call(...args)
    }
  }

  return { lastAction: () => last }
}
