/**
 * Turning a tool's input or output into text, safely.
 *
 * A tool call's payload is whatever the model sent and whatever the tool
 * returned: it can be a megabyte of log, an object that refers to itself, a
 * `BigInt` (which `JSON.stringify` throws on), or a getter that throws. A
 * transcript component that calls `JSON.stringify` on that and renders the result
 * is one hostile payload away from a frozen tab or a blank page, so this is a
 * small serializer of our own rather than a call to the built-in one:
 *
 * - **It never throws.** Anything it cannot read becomes a marker string.
 * - **It stops early.** Output is written into a budget of `maxChars`; the moment
 *   the budget is spent it stops walking, so the cost is bounded by the budget and
 *   not by the size of the value.
 * - **It says when it stopped.** `truncated` is true whenever text was cut, so the
 *   caller can tell the reader the view is partial instead of passing off a cut
 *   JSON document as the whole thing.
 * - **It does not lie about types.** Values JSON cannot carry are written as what
 *   they are (`12n`, `undefined`, `NaN`) rather than coerced to `null`, which
 *   would read as the tool having returned null.
 *
 * Strings are returned as given, not quoted and not re-parsed: re-serializing a
 * JSON string would silently round numbers beyond double precision.
 */
export type ToolValueText = Readonly<{
  text: string
  /** `json` for structured values, `text` for strings and anything that is not JSON. */
  language: 'json' | 'text'
  /** True when `text` is only the start of the value. */
  truncated: boolean
}>

/** Characters shown per section unless the caller says otherwise. */
export const TOOL_VALUE_MAX_CHARS = 20_000

/** Nesting deeper than this is written as a marker. */
const MAX_DEPTH = 12

class BudgetSpent extends Error {}

type Writer = {
  out: string[]
  length: number
  max: number
}

function write(writer: Writer, chunk: string) {
  writer.out.push(chunk)
  writer.length += chunk.length
  if (writer.length > writer.max) throw new BudgetSpent()
}

/** A JSON string literal, without stringifying more than the budget could hold. */
function quote(writer: Writer, value: string): string {
  const room = Math.max(0, writer.max - writer.length)
  // Past the budget the result is thrown away, so the tail need not be well formed.
  return value.length > room + 1
    ? JSON.stringify(value.slice(0, room + 1)).slice(0, -1)
    : JSON.stringify(value)
}

function describeNonJson(value: unknown): string {
  switch (typeof value) {
    case 'undefined':
      return 'undefined'
    case 'bigint':
      return `${value}n`
    case 'symbol':
      return value.toString()
    case 'function':
      return `[Function${value.name ? ` ${value.name}` : ''}]`
    default:
      return String(value)
  }
}

/** At most `limit` items: each costs at least a character, so more could never be shown. */
function take<T>(source: Iterable<T>, limit: number): T[] {
  const taken: T[] = []
  for (const item of source) {
    if (taken.length > limit) break
    taken.push(item)
  }
  return taken
}

function readEntries(value: object, limit: number): [string, unknown][] {
  const entries: [string, unknown][] = []
  for (const key of Object.keys(value).slice(0, limit + 1)) {
    try {
      entries.push([key, (value as Record<string, unknown>)[key]])
    } catch {
      entries.push([key, '[Unreadable]'])
    }
  }
  return entries
}

function writeValue(writer: Writer, value: unknown, depth: number, ancestors: object[]) {
  if (value === null) return write(writer, 'null')
  if (typeof value === 'string') return write(writer, quote(writer, value))
  if (typeof value === 'number') {
    return write(writer, Number.isFinite(value) ? JSON.stringify(value) : String(value))
  }
  if (typeof value === 'boolean') return write(writer, String(value))
  if (typeof value !== 'object') {
    // bigint, undefined, symbol, function: written as what they are, in quotes
    // only where a bare token would be mistaken for the surrounding structure.
    const text = describeNonJson(value)
    return write(
      writer,
      typeof value === 'bigint' || typeof value === 'undefined' ? text : quote(writer, text)
    )
  }

  if (ancestors.includes(value)) return write(writer, '"[Circular]"')

  let subject: unknown = value
  if (!Array.isArray(value) && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    try {
      subject = (value as { toJSON: () => unknown }).toJSON()
    } catch {
      return write(writer, '"[Unreadable]"')
    }
    if (typeof subject !== 'object' || subject === null) {
      return writeValue(writer, subject, depth, ancestors)
    }
  }
  const node = subject as object

  if (ArrayBuffer.isView(node) || node instanceof ArrayBuffer) {
    return write(
      writer,
      quote(writer, `[${node.constructor.name}: ${node.byteLength.toLocaleString('en')} bytes]`)
    )
  }

  let items: unknown[] | undefined
  let fields: [string, unknown][] | undefined
  if (Array.isArray(node)) items = node
  else if (node instanceof Set) items = take(node, writer.max)
  else if (node instanceof Map) items = take(node, writer.max).map(([key, entry]) => [key, entry])
  else if (node instanceof Error) {
    fields = [
      ['name', node.name],
      ['message', node.message],
    ]
  } else fields = readEntries(node, writer.max)

  if (depth >= MAX_DEPTH) {
    return write(writer, quote(writer, items ? `[Array(${items.length})]` : '[Object]'))
  }

  const nested = [...ancestors, value]
  const indent = '  '.repeat(depth + 1)
  const closing = '  '.repeat(depth)

  if (items) {
    if (items.length === 0) return write(writer, '[]')
    write(writer, '[\n')
    // Indexed rather than `forEach`, which skips the holes of a sparse array: a
    // million-slot hole would loop a million times without ever spending the budget.
    for (let index = 0; index < items.length; index += 1) {
      write(writer, indent)
      writeValue(writer, items[index], depth + 1, nested)
      write(writer, index < items.length - 1 ? ',\n' : '\n')
    }
    return write(writer, `${closing}]`)
  }

  const present = fields ?? []
  if (present.length === 0) return write(writer, '{}')
  write(writer, '{\n')
  present.forEach(([key, entry], index) => {
    write(writer, `${indent}${quote(writer, key)}: `)
    writeValue(writer, entry, depth + 1, nested)
    write(writer, index < present.length - 1 ? ',\n' : '\n')
  })
  write(writer, `${closing}}`)
}

export function formatToolValue(
  value: unknown,
  options: { maxChars?: number } = {}
): ToolValueText {
  const requested = options.maxChars
  const max =
    requested === undefined || Number.isNaN(requested)
      ? TOOL_VALUE_MAX_CHARS
      : Math.max(0, Math.floor(requested))

  if (typeof value === 'string') {
    return {
      text: value.slice(0, max),
      language: 'text',
      truncated: value.length > max,
    }
  }
  if (value === undefined || typeof value === 'symbol' || typeof value === 'function') {
    return { text: describeNonJson(value).slice(0, max), language: 'text', truncated: false }
  }

  const writer: Writer = { out: [], length: 0, max }
  let truncated = false
  try {
    writeValue(writer, value, 0, [])
  } catch (error) {
    // Anything other than the budget running out is a bug in a getter or a proxy
    // we could not foresee; the reader still gets what was written so far.
    truncated = true
    if (!(error instanceof BudgetSpent) && writer.out.length === 0) {
      return { text: '[Unreadable]', language: 'text', truncated: false }
    }
  }
  const joined = writer.out.join('')
  return {
    text: joined.length > max ? joined.slice(0, max) : joined,
    language: 'json',
    truncated: truncated || joined.length > max,
  }
}
