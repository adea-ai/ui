import { describe, expect, test } from 'bun:test'
import { inlineScriptLiteral, themeScript } from '../src/components/theme'

/**
 * The no-flash script's only injection surface.
 *
 * `themeScript` is emitted into an inline `<script>`, and the one value that reaches
 * its source as *text* is the storage key. `JSON.stringify` alone is not enough
 * there: it produces a correct JavaScript literal and leaves `<` alone, so a key
 * containing `</script>` ends the tag early and the remainder is parsed as HTML.
 *
 * CodeQL flags the unescaped form as `js/bad-code-sanitization`, which is how this
 * was found. These tests are the reason it cannot come back — the escaping is easy to
 * "simplify" back to `JSON.stringify` in a refactor, and the result would look
 * identical for every ordinary key.
 */

/** The literal as it would appear inside a `<script>` element. */
function embedded(storageKey: string): string {
  return inlineScriptLiteral(storageKey)
}

describe('inlineScriptLiteral', () => {
  test('a key containing a closing tag cannot end the script element', () => {
    const literal = embedded('x</script><img src=x onerror=alert(1)>')
    expect(literal).not.toContain('</script>')
    expect(literal).not.toContain('<')
    expect(literal).not.toContain('>')
  })

  test('the escaped literal still parses back to the original string', () => {
    const key = 'x</script>&"\'\u2028\u2029'
    // `JSON.parse` accepts the `\uXXXX` escapes, which is the whole point: the value
    // is inert to the HTML tokenizer and identical to the JavaScript parser.
    expect(JSON.parse(embedded(key))).toBe(key)
  })

  test('quotes and backslashes are still escaped', () => {
    expect(JSON.parse(embedded('a"b\\c'))).toBe('a"b\\c')
  })

  test('an ordinary key is unchanged apart from its quotes', () => {
    expect(embedded('adea-appearance')).toBe('"adea-appearance"')
  })

  test('line separators are escaped, because a parser treated them as terminators', () => {
    const literal = embedded('a\u2028b')
    expect(literal).not.toContain('\u2028')
    expect(literal).toContain('\\u2028')
  })
})

describe('themeScript', () => {
  test('the default key produces a script with no angle brackets', () => {
    const script = themeScript()
    expect(script).toContain('"adea-appearance"')
    expect(script).not.toContain('<')
    expect(script).not.toContain('>')
  })

  test('a hostile key is neutralised in the emitted script', () => {
    const script = themeScript('</script><script>alert(1)</script>')
    expect(script).not.toContain('</script>')
    expect(script).not.toContain('<script>')
  })

  /**
   * The stored values are read at runtime and written to `dataset`, which is a
   * property assignment rather than code — worth asserting, because it is the reason
   * only the key needs escaping.
   */
  test('a stored accent or font id is assigned, never executed', () => {
    const script = themeScript()
    expect(script).toContain('r.dataset.accent=p.accent')
    expect(script).toContain('r.dataset.font=p.font')
    expect(script).not.toContain('eval(')
  })
})
