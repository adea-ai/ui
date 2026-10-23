/**
 * Remember the named globals exactly as they are now (value, accessor and
 * enumerability, or that they were absent) and return a function that puts them back.
 * A suite that stubs a browser global in some tests calls the restorer in `afterEach`,
 * so a name the runtime never defined is deleted again instead of left as `undefined`.
 */
export function preserveGlobals(...names: string[]): () => void {
  const saved = names.map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const
  )
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete (globalThis as Record<string, unknown>)[name]
    }
  }
}
